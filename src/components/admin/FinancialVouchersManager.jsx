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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Receipt, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, 
  Eye, Printer, Search, Filter, DollarSign, Loader2, Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function FinancialVouchersManager() {
  const [vouchers, setVouchers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [saving, setSaving] = useState(false);
  const [voucherType, setVoucherType] = useState('receipt');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [formData, setFormData] = useState({
    voucher_type: 'receipt',
    voucher_date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    from_account_id: '',
    to_account_id: '',
    beneficiary_name: '',
    beneficiary_type: 'other',
    beneficiary_id: '',
    description: '',
    payment_method: 'cash',
    check_number: '',
    bank_name: '',
    notes: '',
    attachment_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [vouchersData, accountsData, providersData, agentsData] = await Promise.all([
      base44.entities.FinancialVoucher.list('-created_date', 100),
      base44.entities.Account.filter({ is_active: true }),
      base44.entities.Provider.filter({ is_active: true }),
      base44.entities.Agent.filter({ is_active: true })
    ]);
    setVouchers(vouchersData);
    setAccounts(accountsData);
    setProviders(providersData);
    setAgents(agentsData);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // التحقق من البيانات
      if (!formData.amount || formData.amount <= 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        setSaving(false);
        return;
      }

      // إنشاء رقم السند
      const voucherNumber = `${formData.voucher_type === 'receipt' ? 'RV' : formData.voucher_type === 'payment' ? 'PV' : 'TV'}-${Date.now()}`;

      // الحصول على أسماء الحسابات
      const fromAccount = accounts.find(a => a.id === formData.from_account_id);
      const toAccount = accounts.find(a => a.id === formData.to_account_id);

      // إنشاء السند
      const voucher = await base44.entities.FinancialVoucher.create({
        ...formData,
        voucher_number: voucherNumber,
        from_account_name: fromAccount?.name,
        to_account_name: toAccount?.name,
        status: 'approved'
      });

      // إنشاء القيد المحاسبي
      const journalEntry = await base44.entities.JournalEntry.create({
        entry_number: `JE-${voucherNumber}`,
        entry_date: formData.voucher_date,
        description: formData.description,
        reference_type: formData.voucher_type === 'receipt' ? 'payment' : 'payment',
        reference_id: voucher.id,
        entries: [
          {
            account_id: formData.to_account_id,
            account_name: toAccount?.name,
            account_number: toAccount?.account_number,
            debit: formData.amount,
            credit: 0,
            description: formData.description
          },
          {
            account_id: formData.from_account_id,
            account_name: fromAccount?.name,
            account_number: fromAccount?.account_number,
            debit: 0,
            credit: formData.amount,
            description: formData.description
          }
        ],
        total_debit: formData.amount,
        total_credit: formData.amount,
        is_balanced: true,
        status: 'posted'
      });

      // تحديث أرصدة الحسابات
      if (fromAccount) {
        await base44.entities.Account.update(fromAccount.id, {
          balance: (fromAccount.balance || 0) - formData.amount,
          credit_total: (fromAccount.credit_total || 0) + formData.amount
        });

        // إنشاء حركة الحساب
        await base44.entities.AccountTransaction.create({
          transaction_number: `TR-${Date.now()}-1`,
          account_id: fromAccount.id,
          account_name: fromAccount.name,
          account_number: fromAccount.account_number,
          transaction_date: new Date().toISOString(),
          transaction_type: 'credit',
          amount: formData.amount,
          balance_before: fromAccount.balance || 0,
          balance_after: (fromAccount.balance || 0) - formData.amount,
          description: formData.description,
          reference_type: 'voucher',
          reference_id: voucher.id,
          reference_number: voucherNumber,
          journal_entry_id: journalEntry.id,
          related_account_id: toAccount?.id,
          related_account_name: toAccount?.name,
          status: 'completed'
        });
      }

      if (toAccount) {
        await base44.entities.Account.update(toAccount.id, {
          balance: (toAccount.balance || 0) + formData.amount,
          debit_total: (toAccount.debit_total || 0) + formData.amount
        });

        // إنشاء حركة الحساب
        await base44.entities.AccountTransaction.create({
          transaction_number: `TR-${Date.now()}-2`,
          account_id: toAccount.id,
          account_name: toAccount.name,
          account_number: toAccount.account_number,
          transaction_date: new Date().toISOString(),
          transaction_type: 'debit',
          amount: formData.amount,
          balance_before: toAccount.balance || 0,
          balance_after: (toAccount.balance || 0) + formData.amount,
          description: formData.description,
          reference_type: 'voucher',
          reference_id: voucher.id,
          reference_number: voucherNumber,
          journal_entry_id: journalEntry.id,
          related_account_id: fromAccount?.id,
          related_account_name: fromAccount?.name,
          status: 'completed'
        });
      }

      // تحديث رصيد الكيان المرتبط
      if (formData.beneficiary_type === 'provider' && formData.beneficiary_id) {
        const provider = providers.find(p => p.id === formData.beneficiary_id);
        if (provider) {
          const balanceChange = formData.voucher_type === 'payment' ? -formData.amount : formData.amount;
          await base44.entities.Provider.update(provider.id, {
            balance: (provider.balance || 0) + balanceChange
          });
        }
      } else if (formData.beneficiary_type === 'agent' && formData.beneficiary_id) {
        const agent = agents.find(a => a.id === formData.beneficiary_id);
        if (agent) {
          const balanceChange = formData.voucher_type === 'receipt' ? formData.amount : -formData.amount;
          await base44.entities.Agent.update(agent.id, {
            balance: (agent.balance || 0) + balanceChange
          });
        }
      }

      toast.success(`تم إنشاء سند ${formData.voucher_type === 'receipt' ? 'القبض' : formData.voucher_type === 'payment' ? 'الصرف' : 'التحويل'} بنجاح`);
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    }

    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      voucher_type: 'receipt',
      voucher_date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      from_account_id: '',
      to_account_id: '',
      beneficiary_name: '',
      beneficiary_type: 'other',
      beneficiary_id: '',
      description: '',
      payment_method: 'cash',
      check_number: '',
      bank_name: '',
      notes: '',
      attachment_url: ''
    });
  };

  const handleUploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, attachment_url: file_url });
      toast.success('تم رفع المرفق');
    } catch (error) {
      toast.error('فشل رفع المرفق');
    }
  };

  const handlePrint = (voucher) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>سند ${voucher.voucher_type === 'receipt' ? 'قبض' : voucher.voucher_type === 'payment' ? 'صرف' : 'تحويل'} - ${voucher.voucher_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; }
            .voucher-number { font-size: 14px; color: #666; }
            .details { margin: 20px 0; }
            .row { display: flex; margin: 10px 0; }
            .label { width: 150px; font-weight: bold; }
            .amount { font-size: 28px; font-weight: bold; text-align: center; margin: 30px 0; padding: 20px; border: 2px solid #000; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature { text-align: center; width: 200px; }
            .signature-line { border-top: 1px solid #000; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">سند ${voucher.voucher_type === 'receipt' ? 'قبض' : voucher.voucher_type === 'payment' ? 'صرف' : 'تحويل'}</div>
            <div class="voucher-number">رقم: ${voucher.voucher_number}</div>
          </div>
          <div class="details">
            <div class="row"><span class="label">التاريخ:</span> ${voucher.voucher_date}</div>
            <div class="row"><span class="label">المستفيد:</span> ${voucher.beneficiary_name || '-'}</div>
            <div class="row"><span class="label">من حساب:</span> ${voucher.from_account_name || '-'}</div>
            <div class="row"><span class="label">إلى حساب:</span> ${voucher.to_account_name || '-'}</div>
            <div class="row"><span class="label">البيان:</span> ${voucher.description}</div>
            <div class="row"><span class="label">طريقة الدفع:</span> ${voucher.payment_method}</div>
          </div>
          <div class="amount">$${voucher.amount.toLocaleString()}</div>
          <div class="footer">
            <div class="signature">
              <div class="signature-line"></div>
              <div>المحاسب</div>
            </div>
            <div class="signature">
              <div class="signature-line"></div>
              <div>المستلم</div>
            </div>
            <div class="signature">
              <div class="signature-line"></div>
              <div>المدير</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = !searchTerm || 
      v.voucher_number?.includes(searchTerm) ||
      v.beneficiary_name?.includes(searchTerm) ||
      v.description?.includes(searchTerm);
    const matchesType = filterType === 'all' || v.voucher_type === filterType;
    return matchesSearch && matchesType;
  });

  const voucherTypeConfig = {
    receipt: { label: 'سند قبض', icon: ArrowDownCircle, color: 'bg-green-100 text-green-700' },
    payment: { label: 'سند صرف', icon: ArrowUpCircle, color: 'bg-red-100 text-red-700' },
    transfer: { label: 'سند تحويل', icon: ArrowLeftRight, color: 'bg-blue-100 text-blue-700' }
  };

  // إحصائيات
  const stats = {
    totalReceipts: vouchers.filter(v => v.voucher_type === 'receipt').reduce((sum, v) => sum + (v.amount || 0), 0),
    totalPayments: vouchers.filter(v => v.voucher_type === 'payment').reduce((sum, v) => sum + (v.amount || 0), 0),
    totalTransfers: vouchers.filter(v => v.voucher_type === 'transfer').reduce((sum, v) => sum + (v.amount || 0), 0),
    count: vouchers.length
  };

  return (
    <div className="space-y-6">
      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowDownCircle className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">إجمالي القبض</p>
                <p className="text-2xl font-bold">${stats.totalReceipts.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">إجمالي الصرف</p>
                <p className="text-2xl font-bold">${stats.totalPayments.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">إجمالي التحويلات</p>
                <p className="text-2xl font-bold">${stats.totalTransfers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Receipt className="h-8 w-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">عدد السندات</p>
                <p className="text-2xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 w-64"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="receipt">سندات قبض</SelectItem>
              <SelectItem value="payment">سندات صرف</SelectItem>
              <SelectItem value="transfer">سندات تحويل</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => setFormData({...formData, voucher_type: 'receipt'})}>
                <ArrowDownCircle className="ml-2 h-4 w-4" />
                سند قبض
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => setFormData({...formData, voucher_type: 'payment'})}>
                <ArrowUpCircle className="ml-2 h-4 w-4" />
                سند صرف
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setFormData({...formData, voucher_type: 'transfer'})}>
                <ArrowLeftRight className="ml-2 h-4 w-4" />
                تحويل
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {formData.voucher_type === 'receipt' && <ArrowDownCircle className="h-5 w-5 text-green-600" />}
                  {formData.voucher_type === 'payment' && <ArrowUpCircle className="h-5 w-5 text-red-600" />}
                  {formData.voucher_type === 'transfer' && <ArrowLeftRight className="h-5 w-5 text-blue-600" />}
                  {voucherTypeConfig[formData.voucher_type]?.label || 'سند جديد'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.voucher_date}
                      onChange={(e) => setFormData({ ...formData, voucher_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>المبلغ *</Label>
                    <div className="relative">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>من حساب *</Label>
                    <Select 
                      value={formData.from_account_id} 
                      onValueChange={(v) => setFormData({ ...formData, from_account_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الحساب" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_number} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>إلى حساب *</Label>
                    <Select 
                      value={formData.to_account_id} 
                      onValueChange={(v) => setFormData({ ...formData, to_account_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الحساب" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_number} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>نوع المستفيد</Label>
                    <Select 
                      value={formData.beneficiary_type} 
                      onValueChange={(v) => setFormData({ ...formData, beneficiary_type: v, beneficiary_id: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="other">آخر</SelectItem>
                        <SelectItem value="provider">مزود</SelectItem>
                        <SelectItem value="agent">وكيل</SelectItem>
                        <SelectItem value="customer">عميل</SelectItem>
                        <SelectItem value="employee">موظف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    {formData.beneficiary_type === 'provider' && (
                      <>
                        <Label>اختر المزود</Label>
                        <Select 
                          value={formData.beneficiary_id} 
                          onValueChange={(v) => {
                            const prov = providers.find(p => p.id === v);
                            setFormData({ 
                              ...formData, 
                              beneficiary_id: v,
                              beneficiary_name: prov?.company_name_ar
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.company_name_ar}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    {formData.beneficiary_type === 'agent' && (
                      <>
                        <Label>اختر الوكيل</Label>
                        <Select 
                          value={formData.beneficiary_id} 
                          onValueChange={(v) => {
                            const ag = agents.find(a => a.id === v);
                            setFormData({ 
                              ...formData, 
                              beneficiary_id: v,
                              beneficiary_name: ag?.name
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    {(formData.beneficiary_type === 'other' || formData.beneficiary_type === 'customer' || formData.beneficiary_type === 'employee') && (
                      <>
                        <Label>اسم المستفيد</Label>
                        <Input
                          value={formData.beneficiary_name}
                          onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value })}
                        />
                      </>
                    )}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>طريقة الدفع</Label>
                    <Select 
                      value={formData.payment_method} 
                      onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">نقداً</SelectItem>
                        <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                        <SelectItem value="check">شيك</SelectItem>
                        <SelectItem value="card">بطاقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.payment_method === 'check' && (
                    <div>
                      <Label>رقم الشيك</Label>
                      <Input
                        value={formData.check_number}
                        onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label>ملاحظات</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div>
                  <Label>مرفق (اختياري)</Label>
                  <label className="cursor-pointer block mt-1">
                    <div className="border rounded-lg p-3 hover:bg-slate-50 transition-colors text-center border-dashed">
                      <Upload className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                      <span className="text-sm text-slate-600">
                        {formData.attachment_url ? 'تم الرفع ✓' : 'اضغط لرفع مرفق'}
                      </span>
                    </div>
                    <input type="file" className="hidden" onChange={handleUploadAttachment} />
                  </label>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : 'حفظ السند'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* جدول السندات */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المستفيد</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVouchers.map((voucher) => {
                const config = voucherTypeConfig[voucher.voucher_type];
                const Icon = config?.icon || Receipt;
                
                return (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono">{voucher.voucher_number}</TableCell>
                    <TableCell>
                      <Badge className={config?.color}>
                        <Icon className="h-3 w-3 ml-1" />
                        {config?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{voucher.voucher_date}</TableCell>
                    <TableCell>{voucher.beneficiary_name || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{voucher.description}</TableCell>
                    <TableCell className="font-semibold text-lg">${voucher.amount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={voucher.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                        {voucher.status === 'approved' ? 'معتمد' : 'مسودة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedVoucher(voucher);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handlePrint(voucher)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredVouchers.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد سندات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة عرض السند */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل السند</DialogTitle>
          </DialogHeader>
          
          {selectedVoucher && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-slate-500">رقم السند</Label>
                  <p className="font-mono font-semibold">{selectedVoucher.voucher_number}</p>
                </div>
                <div>
                  <Label className="text-slate-500">التاريخ</Label>
                  <p>{selectedVoucher.voucher_date}</p>
                </div>
                <div>
                  <Label className="text-slate-500">من حساب</Label>
                  <p>{selectedVoucher.from_account_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">إلى حساب</Label>
                  <p>{selectedVoucher.to_account_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">المستفيد</Label>
                  <p>{selectedVoucher.beneficiary_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">طريقة الدفع</Label>
                  <p>{selectedVoucher.payment_method}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-500">البيان</Label>
                  <p>{selectedVoucher.description}</p>
                </div>
              </div>

              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-sm text-slate-500">المبلغ</p>
                <p className="text-4xl font-bold text-blue-600">${selectedVoucher.amount?.toLocaleString()}</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handlePrint(selectedVoucher)}>
                  <Printer className="ml-2 h-4 w-4" />
                  طباعة السند
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}