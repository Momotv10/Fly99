import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, Plus, Pencil, Lock } from 'lucide-react';
import { toast } from "sonner";

const accountTypes = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات'
};

const accountCategories = {
  cash: 'نقدية',
  bank: 'بنوك',
  receivable: 'مدينون',
  payable: 'دائنون',
  sales: 'مبيعات',
  ticket_sales: 'مبيعات التذاكر',
  visa_sales: 'مبيعات الفيز',
  cost: 'تكلفة',
  commission: 'عمولات',
  commission_revenue: 'إيرادات العمولات',
  provider: 'مزودين',
  agent: 'وكلاء',
  provider_agent: 'وكلاء المزودين',
  customer: 'عملاء',
  payment_gateway: 'بوابات دفع',
  profit: 'أرباح'
};

export default function AccountsManager() {
  const [accounts, setAccounts] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  
  const [formData, setFormData] = useState({
    account_number: '',
    name: '',
    name_en: '',
    type: 'asset',
    category: 'cash',
    parent_account_id: '',
    level: 1,
    is_active: true
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await base44.entities.Account.list('account_number');
    setAccounts(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingAccount) {
      if (editingAccount.is_system) {
        toast.error('لا يمكن تعديل حسابات النظام');
        return;
      }
      await base44.entities.Account.update(editingAccount.id, formData);
      toast.success('تم تحديث الحساب');
    } else {
      await base44.entities.Account.create(formData);
      toast.success('تم إنشاء الحساب');
    }
    
    setDialogOpen(false);
    resetForm();
    loadAccounts();
  };

  const handleEdit = (account) => {
    if (account.is_system) {
      toast.error('لا يمكن تعديل حسابات النظام');
      return;
    }
    
    setEditingAccount(account);
    setFormData({
      account_number: account.account_number,
      name: account.name,
      name_en: account.name_en || '',
      type: account.type,
      category: account.category,
      parent_account_id: account.parent_account_id || '',
      level: account.level || 1,
      is_active: account.is_active !== false
    });
    setDialogOpen(true);
  };

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const resetForm = () => {
    setEditingAccount(null);
    setFormData({
      account_number: '',
      name: '',
      name_en: '',
      type: 'asset',
      category: 'cash',
      parent_account_id: '',
      level: 1,
      is_active: true
    });
  };

  const organizeTree = () => {
    const tree = [];
    const mainAccounts = accounts.filter(a => !a.parent_account_id);
    
    mainAccounts.forEach(account => {
      tree.push({
        ...account,
        children: accounts.filter(a => a.parent_account_id === account.id)
      });
    });
    
    return tree;
  };

  const accountTree = organizeTree();

  const AccountRow = ({ account, level = 0 }) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.includes(account.id);
    
    return (
      <>
        <div 
          className="flex items-center p-3 hover:bg-slate-50 rounded-lg transition-colors"
          style={{ paddingRight: `${level * 2 + 1}rem` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(account.id)}>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-500">{account.account_number}</span>
                <span className="font-semibold">{account.name}</span>
                {account.is_system && (
                  <Lock className="h-3 w-3 text-slate-400" title="حساب نظام" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {accountTypes[account.type]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {accountCategories[account.category]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className={`font-semibold ${
                account.balance > 0 ? 'text-green-600' : 
                account.balance < 0 ? 'text-red-600' : 'text-slate-600'
              }`}>
                ${Math.abs(account.balance || 0).toFixed(2)}
              </p>
            </div>
            
            {!account.is_system && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleEdit(account)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {account.children.map(child => (
              <AccountRow key={child.id} account={child} level={level + 1} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">شجرة الحسابات</h2>
          <p className="text-slate-600">إدارة الحسابات الرئيسية والفرعية</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="ml-2 h-4 w-4" />
              إضافة حساب
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>رقم الحساب *</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <Label>المستوى</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>اسم الحساب (عربي) *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>اسم الحساب (إنجليزي)</Label>
                <Input
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>نوع الحساب *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accountTypes).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>التصنيف *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accountCategories).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>الحساب الأب (اختياري)</Label>
                <Select value={formData.parent_account_id} onValueChange={(v) => setFormData({ ...formData, parent_account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="بدون حساب أب (حساب رئيسي)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>بدون</SelectItem>
                    {accounts.filter(a => a.level < formData.level).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_number} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  حفظ
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-1">
            {accountTree.map(account => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}