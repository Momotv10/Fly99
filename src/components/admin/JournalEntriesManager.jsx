import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Trash2, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";

export default function JournalEntriesManager() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  const [formData, setFormData] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    reference_type: 'manual',
    entries: [
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' }
    ]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [entriesData, accountsData] = await Promise.all([
      base44.entities.JournalEntry.list('-entry_date', 50),
      base44.entities.Account.filter({ is_active: true })
    ]);
    setEntries(entriesData);
    setAccounts(accountsData);
  };

  const addEntryLine = () => {
    setFormData({
      ...formData,
      entries: [...formData.entries, { account_id: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeEntryLine = (index) => {
    if (formData.entries.length <= 2) {
      toast.error('يجب أن يحتوي القيد على قيدين على الأقل');
      return;
    }
    const updated = formData.entries.filter((_, i) => i !== index);
    setFormData({ ...formData, entries: updated });
  };

  const updateEntryLine = (index, field, value) => {
    const updated = [...formData.entries];
    updated[index][field] = value;
    
    // تحديث اسم الحساب تلقائياً
    if (field === 'account_id') {
      const account = accounts.find(a => a.id === value);
      updated[index].account_name = account?.name;
      updated[index].account_number = account?.account_number;
    }
    
    setFormData({ ...formData, entries: updated });
  };

  const calculateTotals = () => {
    const totalDebit = formData.entries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
    const totalCredit = formData.entries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    
    return { totalDebit, totalCredit, isBalanced };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { totalDebit, totalCredit, isBalanced } = calculateTotals();
    
    if (!isBalanced) {
      toast.error('القيد غير متوازن! يجب أن يتساوى المدين والدائن');
      return;
    }
    
    // التحقق من أن كل سطر له حساب
    for (const line of formData.entries) {
      if (!line.account_id) {
        toast.error('يرجى اختيار حساب لكل سطر');
        return;
      }
    }
    
    const entryNumber = `JE-${Date.now()}`;
    
    const entryData = {
      entry_number: entryNumber,
      entry_date: formData.entry_date,
      description: formData.description,
      reference_type: formData.reference_type,
      entries: formData.entries,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: isBalanced,
      status: 'posted'
    };
    
    await base44.entities.JournalEntry.create(entryData);
    
    // تحديث أرصدة الحسابات
    for (const line of formData.entries) {
      const account = accounts.find(a => a.id === line.account_id);
      if (account) {
        const newBalance = (account.balance || 0) + (line.debit - line.credit);
        await base44.entities.Account.update(account.id, { balance: newBalance });
      }
    }
    
    toast.success('تم إنشاء القيد بنجاح');
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormData({
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      reference_type: 'manual',
      entries: [
        { account_id: '', debit: 0, credit: 0, description: '' },
        { account_id: '', debit: 0, credit: 0, description: '' }
      ]
    });
  };

  const { totalDebit, totalCredit, isBalanced } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">القيود المالية</h2>
          <p className="text-slate-600">إدارة القيود اليومية</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="ml-2 h-4 w-4" />
              قيد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إنشاء قيد مالي</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>التاريخ *</Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>نوع المرجع</Label>
                  <Select value={formData.reference_type} onValueChange={(v) => setFormData({ ...formData, reference_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">يدوي</SelectItem>
                      <SelectItem value="booking">حجز</SelectItem>
                      <SelectItem value="payment">دفع</SelectItem>
                      <SelectItem value="commission">عمولة</SelectItem>
                      <SelectItem value="transfer">تحويل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>البيان *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  required
                />
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base">تفاصيل القيد</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEntryLine}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة سطر
                  </Button>
                </div>

                {formData.entries.map((line, index) => (
                  <div key={index} className="flex items-end gap-2 p-3 bg-slate-50 rounded">
                    <div className="flex-1">
                      <Label className="text-xs">الحساب</Label>
                      <Select 
                        value={line.account_id} 
                        onValueChange={(v) => updateEntryLine(index, 'account_id', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="اختر" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_number} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">مدين</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => updateEntryLine(index, 'debit', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">دائن</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => updateEntryLine(index, 'credit', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">البيان</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateEntryLine(index, 'description', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {formData.entries.length > 2 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeEntryLine(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold">الإجماليات:</span>
                  <div className="flex gap-8">
                    <div>
                      <span className="text-sm text-slate-500 ml-2">مدين:</span>
                      <span className="font-semibold text-green-600">${totalDebit.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500 ml-2">دائن:</span>
                      <span className="font-semibold text-blue-600">${totalCredit.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {!isBalanced && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>القيد غير متوازن! الفرق: ${Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!isBalanced}
                >
                  حفظ القيد
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم القيد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entry_number}</TableCell>
                  <TableCell>{entry.entry_date}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.reference_type}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">${entry.total_debit?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={entry.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                      {entry.status === 'posted' ? 'مرحّل' : 'مسودة'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setSelectedEntry(entry);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {entries.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد قيود مالية</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* عرض تفاصيل القيد */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تفاصيل القيد</DialogTitle>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-slate-500">رقم القيد</Label>
                  <p className="font-mono font-semibold">{selectedEntry.entry_number}</p>
                </div>
                <div>
                  <Label className="text-slate-500">التاريخ</Label>
                  <p>{selectedEntry.entry_date}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-500">البيان</Label>
                  <p>{selectedEntry.description}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحساب</TableHead>
                    <TableHead>البيان</TableHead>
                    <TableHead>مدين</TableHead>
                    <TableHead>دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEntry.entries?.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{line.account_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{line.account_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        {line.debit > 0 && `$${line.debit.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-blue-600 font-semibold">
                        {line.credit > 0 && `$${line.credit.toFixed(2)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={2}>الإجمالي</TableCell>
                    <TableCell className="text-green-600">${selectedEntry.total_debit?.toFixed(2)}</TableCell>
                    <TableCell className="text-blue-600">${selectedEntry.total_credit?.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}