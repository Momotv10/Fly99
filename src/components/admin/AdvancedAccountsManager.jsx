import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ChevronRight, ChevronDown, Plus, Pencil, Lock, Building2, Users, 
  Wallet, CreditCard, TrendingUp, RefreshCw, Eye, DollarSign,
  Folder, FolderOpen, Search
} from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';

const accountTypes = {
  asset: { label: 'أصول', color: 'bg-blue-100 text-blue-700' },
  liability: { label: 'خصوم', color: 'bg-red-100 text-red-700' },
  equity: { label: 'حقوق ملكية', color: 'bg-purple-100 text-purple-700' },
  revenue: { label: 'إيرادات', color: 'bg-green-100 text-green-700' },
  expense: { label: 'مصروفات', color: 'bg-orange-100 text-orange-700' }
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

export default function AdvancedAccountsManager() {
  const [accounts, setAccounts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [providerAgents, setProviderAgents] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewTransactionsDialog, setViewTransactionsDialog] = useState(false);
  const [selectedAccountForTrans, setSelectedAccountForTrans] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  const [formData, setFormData] = useState({
    account_number: '',
    name: '',
    name_en: '',
    type: 'asset',
    category: 'cash',
    parent_account_id: '',
    level: 1,
    is_main: false,
    opening_balance: 0,
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [accountsData, providersData, agentsData, providerAgentsData] = await Promise.all([
      base44.entities.Account.list('account_number'),
      base44.entities.Provider.filter({ is_active: true }),
      base44.entities.Agent.filter({ is_active: true }),
      base44.entities.ProviderAgent.filter({ is_active: true })
    ]);
    setAccounts(accountsData);
    setProviders(providersData);
    setAgents(agentsData);
    setProviderAgents(providerAgentsData);
    setLoading(false);
  };

  const initializeSystemAccounts = async () => {
    const existingAccounts = await base44.entities.Account.list();
    if (existingAccounts.length > 0) {
      toast.info('الحسابات الأساسية موجودة مسبقاً');
      return;
    }

    const systemAccounts = [
      // حسابات رئيسية
      { account_number: '1000', name: 'الأصول', type: 'asset', category: 'cash', is_system: true, is_main: true, level: 1 },
      { account_number: '1100', name: 'النقدية والبنوك', type: 'asset', category: 'cash', is_system: true, is_main: true, level: 1 },
      { account_number: '1110', name: 'الصندوق', type: 'asset', category: 'cash', is_system: true, level: 2 },
      { account_number: '1120', name: 'البنوك', type: 'asset', category: 'bank', is_system: true, level: 2 },
      
      // حسابات المدينون
      { account_number: '1200', name: 'المدينون', type: 'asset', category: 'receivable', is_system: true, is_main: true, level: 1 },
      { account_number: '1210', name: 'حسابات الوكلاء', type: 'asset', category: 'agent', is_system: true, is_main: true, level: 2 },
      
      // حسابات الخصوم
      { account_number: '2000', name: 'الخصوم', type: 'liability', category: 'payable', is_system: true, is_main: true, level: 1 },
      { account_number: '2100', name: 'الدائنون', type: 'liability', category: 'payable', is_system: true, is_main: true, level: 1 },
      { account_number: '2110', name: 'حسابات المزودين', type: 'liability', category: 'provider', is_system: true, is_main: true, level: 2 },
      
      // حسابات الإيرادات
      { account_number: '4000', name: 'الإيرادات', type: 'revenue', category: 'sales', is_system: true, is_main: true, level: 1 },
      { account_number: '4100', name: 'مبيعات التذاكر', type: 'revenue', category: 'ticket_sales', is_system: true, level: 2 },
      { account_number: '4200', name: 'مبيعات الفيز', type: 'revenue', category: 'visa_sales', is_system: true, level: 2 },
      { account_number: '4300', name: 'إيرادات العمولات', type: 'revenue', category: 'commission_revenue', is_system: true, is_main: true, level: 2 },
      
      // حسابات المصروفات
      { account_number: '5000', name: 'المصروفات', type: 'expense', category: 'cost', is_system: true, is_main: true, level: 1 },
      { account_number: '5100', name: 'عمولات الوكلاء', type: 'expense', category: 'commission', is_system: true, level: 2 },
      
      // بوابات الدفع
      { account_number: '1300', name: 'بوابات الدفع', type: 'asset', category: 'payment_gateway', is_system: true, is_main: true, level: 1 },
    ];

    for (const acc of systemAccounts) {
      await base44.entities.Account.create(acc);
    }

    toast.success('تم إنشاء شجرة الحسابات الأساسية');
    loadData();
  };

  const syncAccountsWithEntities = async () => {
    // مزامنة حسابات المزودين
    for (const provider of providers) {
      const existingAccount = accounts.find(a => 
        a.related_entity_type === 'provider' && a.related_entity_id === provider.id
      );
      
      if (!existingAccount) {
        const parentAccount = accounts.find(a => a.account_number === '2110');
        const newAccount = await base44.entities.Account.create({
          account_number: `2110-${provider.id.slice(-4)}`,
          name: `حساب المزود - ${provider.company_name_ar}`,
          name_en: `Provider - ${provider.company_name_en || provider.company_name_ar}`,
          type: 'liability',
          category: 'provider',
          parent_account_id: parentAccount?.id,
          related_entity_type: 'provider',
          related_entity_id: provider.id,
          balance: provider.balance || 0,
          level: 3,
          is_active: true
        });
        
        await base44.entities.Provider.update(provider.id, { account_id: newAccount.id });
      }
    }

    // مزامنة حسابات الوكلاء
    for (const agent of agents) {
      const existingAccount = accounts.find(a => 
        a.related_entity_type === 'agent' && a.related_entity_id === agent.id
      );
      
      if (!existingAccount) {
        const parentAccount = accounts.find(a => a.account_number === '1210');
        const newAccount = await base44.entities.Account.create({
          account_number: `1210-${agent.id.slice(-4)}`,
          name: `حساب الوكيل - ${agent.name}`,
          name_en: `Agent - ${agent.name_en || agent.name}`,
          type: 'asset',
          category: 'agent',
          parent_account_id: parentAccount?.id,
          related_entity_type: 'agent',
          related_entity_id: agent.id,
          balance: agent.balance || 0,
          level: 3,
          is_active: true
        });
        
        await base44.entities.Agent.update(agent.id, { account_id: newAccount.id });
      }
    }

    // مزامنة حسابات وكلاء المزودين
    for (const providerAgent of providerAgents) {
      const existingAccount = accounts.find(a => 
        a.related_entity_type === 'provider_agent' && a.related_entity_id === providerAgent.id
      );
      
      if (!existingAccount) {
        // إيجاد حساب المزود الأب
        const providerAccount = accounts.find(a => 
          a.related_entity_type === 'provider' && a.related_entity_id === providerAgent.provider_id
        );
        
        const newAccount = await base44.entities.Account.create({
          account_number: `${providerAccount?.account_number || '2110'}-${providerAgent.id.slice(-4)}`,
          name: `حساب وكيل المزود - ${providerAgent.name}`,
          type: 'liability',
          category: 'provider_agent',
          parent_account_id: providerAccount?.id,
          related_entity_type: 'provider_agent',
          related_entity_id: providerAgent.id,
          related_provider_id: providerAgent.provider_id,
          balance: providerAgent.balance || 0,
          level: 4,
          is_active: true
        });
        
        await base44.entities.ProviderAgent.update(providerAgent.id, { account_id: newAccount.id });
      }
    }

    toast.success('تمت مزامنة الحسابات بنجاح');
    loadData();
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
      await base44.entities.Account.create({
        ...formData,
        balance: formData.opening_balance || 0
      });
      toast.success('تم إنشاء الحساب');
    }
    
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (account) => {
    if (account.is_system) {
      toast.error('لا يمكن تعديل حسابات النظام');
      return;
    }
    
    setEditingAccount(account);
    setFormData({
      account_number: account.account_number || '',
      name: account.name,
      name_en: account.name_en || '',
      type: account.type,
      category: account.category,
      parent_account_id: account.parent_account_id || '',
      level: account.level || 1,
      is_main: account.is_main || false,
      opening_balance: account.opening_balance || 0,
      is_active: account.is_active !== false
    });
    setDialogOpen(true);
  };

  const viewTransactions = async (account) => {
    setSelectedAccountForTrans(account);
    const trans = await base44.entities.AccountTransaction.filter(
      { account_id: account.id },
      '-transaction_date',
      50
    );
    setTransactions(trans);
    setViewTransactionsDialog(true);
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
      is_main: false,
      opening_balance: 0,
      is_active: true
    });
  };

  const organizeTree = () => {
    const tree = [];
    const mainAccounts = accounts.filter(a => !a.parent_account_id);
    
    const addChildren = (account) => {
      const children = accounts.filter(a => a.parent_account_id === account.id);
      return {
        ...account,
        children: children.map(child => addChildren(child))
      };
    };
    
    mainAccounts.forEach(account => {
      tree.push(addChildren(account));
    });
    
    return tree;
  };

  const filteredAccounts = accounts.filter(a => {
    const matchesSearch = !searchTerm || 
      a.name?.includes(searchTerm) || 
      a.account_number?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const accountTree = organizeTree();

  const AccountRow = ({ account, level = 0 }) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.includes(account.id);
    
    const getEntityIcon = () => {
      if (account.related_entity_type === 'provider') return <Building2 className="h-4 w-4 text-blue-600" />;
      if (account.related_entity_type === 'agent') return <Users className="h-4 w-4 text-green-600" />;
      if (account.related_entity_type === 'provider_agent') return <Users className="h-4 w-4 text-purple-600" />;
      if (account.category === 'payment_gateway') return <CreditCard className="h-4 w-4 text-amber-600" />;
      if (account.is_main) return <FolderOpen className="h-4 w-4 text-slate-600" />;
      return <Wallet className="h-4 w-4 text-slate-400" />;
    };
    
    return (
      <>
        <div 
          className={`flex items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border-r-4 ${
            account.is_main ? 'border-blue-500 bg-blue-50/50' : 'border-transparent'
          }`}
          style={{ paddingRight: `${level * 1.5 + 1}rem` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(account.id)} className="p-1 hover:bg-slate-200 rounded">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            {getEntityIcon()}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-500">{account.account_number}</span>
                <span className="font-semibold">{account.name}</span>
                {account.is_system && (
                  <Lock className="h-3 w-3 text-slate-400" title="حساب نظام" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs ${accountTypes[account.type]?.color}`}>
                  {accountTypes[account.type]?.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {accountCategories[account.category]}
                </Badge>
                {account.related_entity_type && (
                  <Badge variant="secondary" className="text-xs">
                    {account.related_entity_type === 'provider' && 'مزود'}
                    {account.related_entity_type === 'agent' && 'وكيل'}
                    {account.related_entity_type === 'provider_agent' && 'وكيل مزود'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left min-w-24">
              <p className={`font-semibold text-lg ${
                account.balance > 0 ? 'text-green-600' : 
                account.balance < 0 ? 'text-red-600' : 'text-slate-600'
              }`}>
                ${Math.abs(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500">
                {account.balance >= 0 ? 'لكم' : 'عليكم'}
              </p>
            </div>
            
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => viewTransactions(account)}
                title="عرض الحركات"
              >
                <Eye className="h-4 w-4" />
              </Button>
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

  // إحصائيات سريعة
  const stats = {
    totalAssets: accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + (a.balance || 0), 0),
    totalLiabilities: accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + (a.balance || 0), 0),
    totalRevenue: accounts.filter(a => a.type === 'revenue').reduce((sum, a) => sum + (a.balance || 0), 0),
    providersCount: accounts.filter(a => a.category === 'provider').length,
    agentsCount: accounts.filter(a => a.category === 'agent').length
  };

  return (
    <div className="space-y-6">
      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">إجمالي الأصول</p>
            <p className="text-2xl font-bold">${stats.totalAssets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">إجمالي الخصوم</p>
            <p className="text-2xl font-bold">${stats.totalLiabilities.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">حسابات المزودين</p>
            <p className="text-2xl font-bold">{stats.providersCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <p className="text-sm opacity-90">حسابات الوكلاء</p>
            <p className="text-2xl font-bold">{stats.agentsCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث عن حساب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 w-64"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="التصنيف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {Object.entries(accountCategories).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={initializeSystemAccounts}>
            <Folder className="h-4 w-4 ml-2" />
            إنشاء شجرة أساسية
          </Button>
          <Button variant="outline" onClick={syncAccountsWithEntities}>
            <RefreshCw className="h-4 w-4 ml-2" />
            مزامنة الحسابات
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة حساب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                        {Object.entries(accountTypes).map(([key, { label }]) => (
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
                  <Select 
                    value={formData.parent_account_id || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, parent_account_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="بدون حساب أب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون</SelectItem>
                      {accounts.filter(a => a.level < formData.level).map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>الرصيد الافتتاحي</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                  />
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
      </div>

      {/* شجرة الحسابات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            شجرة الحسابات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
          ) : (
            <div className="space-y-1">
              {accountTree.map(account => (
                <AccountRow key={account.id} account={account} />
              ))}
              {accountTree.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد حسابات</p>
                  <p className="text-sm">اضغط على "إنشاء شجرة أساسية" للبدء</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة عرض الحركات */}
      <Dialog open={viewTransactionsDialog} onOpenChange={setViewTransactionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              حركات الحساب: {selectedAccountForTrans?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 bg-slate-50 rounded-lg mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500">رقم الحساب</p>
                <p className="font-mono font-semibold">{selectedAccountForTrans?.account_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">الرصيد الحالي</p>
                <p className={`font-semibold text-lg ${
                  selectedAccountForTrans?.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${Math.abs(selectedAccountForTrans?.balance || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">عدد الحركات</p>
                <p className="font-semibold">{transactions.length}</p>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead>مدين (لكم)</TableHead>
                <TableHead>دائن (عليكم)</TableHead>
                <TableHead>الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((trans) => (
                <TableRow key={trans.id}>
                  <TableCell className="text-sm">
                    {format(new Date(trans.transaction_date || trans.created_date), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{trans.description}</p>
                      {trans.reference_number && (
                        <p className="text-xs text-slate-500 font-mono">{trans.reference_number}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-semibold">
                    {trans.transaction_type === 'debit' ? `$${trans.amount.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell className="text-red-600 font-semibold">
                    {trans.transaction_type === 'credit' ? `$${trans.amount.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${trans.balance_after?.toLocaleString() || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    لا توجد حركات مسجلة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}