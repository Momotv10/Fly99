import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, TrendingUp, TrendingDown, FileText, Calendar, 
  Download, Filter, ArrowUpRight, ArrowDownRight, Loader2
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ProviderStatement() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_month');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'provider' || !user.related_entity_id) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (providerId) => {
    try {
      const [providerData, transactionsData, accountTransData] = await Promise.all([
        base44.entities.Provider.filter({ id: providerId }),
        base44.entities.ProviderTransaction.filter({ provider_id: providerId }, '-created_date'),
        base44.entities.AccountTransaction.filter({ provider_id: providerId }, '-created_date', 200)
      ]);
      
      if (providerData.length > 0) {
        setProvider(providerData[0]);
      }
      
      // دمج المعاملات من كلا المصدرين
      const mergedTransactions = [
        ...transactionsData.map(t => ({ ...t, source: 'provider' })),
        ...accountTransData.map(t => ({
          ...t,
          transaction_type: t.transaction_type === 'credit' ? 'booking_earning' : 'withdrawal',
          source: 'account'
        }))
      ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      
      // إزالة التكرارات بناءً على المرجع
      const uniqueTransactions = mergedTransactions.filter((t, index, self) => 
        index === self.findIndex(tx => 
          tx.reference_id === t.reference_id && tx.amount === t.amount
        )
      );
      
      setTransactions(uniqueTransactions);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_3_months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      default:
        return null;
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    // فلتر النوع
    if (filterType !== 'all' && tx.transaction_type !== filterType) return false;
    
    // فلتر التاريخ
    const dateFilter = getDateFilter();
    if (dateFilter) {
      const txDate = new Date(tx.created_date);
      if (txDate < dateFilter.start || txDate > dateFilter.end) return false;
    }
    
    return true;
  });

  // حساب الإحصائيات
  const stats = {
    totalIn: filteredTransactions
      .filter(tx => ['booking_earning', 'deposit'].includes(tx.transaction_type))
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0),
    totalOut: filteredTransactions
      .filter(tx => ['commission_deduction', 'withdrawal', 'transfer_to_agent'].includes(tx.transaction_type))
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0),
    transactionsCount: filteredTransactions.length
  };

  const transactionTypeConfig = {
    booking_earning: { label: 'إيرادات حجز', color: 'bg-green-100 text-green-700', icon: ArrowDownRight },
    commission_deduction: { label: 'خصم عمولة', color: 'bg-red-100 text-red-700', icon: ArrowUpRight },
    withdrawal: { label: 'سحب', color: 'bg-orange-100 text-orange-700', icon: ArrowUpRight },
    deposit: { label: 'إيداع', color: 'bg-blue-100 text-blue-700', icon: ArrowDownRight },
    transfer_to_agent: { label: 'تحويل لوكيل', color: 'bg-purple-100 text-purple-700', icon: ArrowUpRight },
    adjustment: { label: 'تسوية', color: 'bg-slate-100 text-slate-700', icon: DollarSign }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ProviderSidebar provider={provider} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              كشف الحساب
            </h1>
            <p className="text-slate-600">عرض جميع المعاملات المالية</p>
          </div>
          <Button variant="outline">
            <Download className="ml-2 h-4 w-4" />
            تصدير PDF
          </Button>
        </div>

        {/* الرصيد الحالي */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 md:col-span-2">
            <CardContent className="p-6">
              <p className="text-sm opacity-90">الرصيد الحالي</p>
              <p className="text-4xl font-bold mt-2">${(provider?.balance || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">إجمالي الوارد</span>
              </div>
              <p className="text-2xl font-bold mt-2">${stats.totalIn.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                <span className="text-sm">إجمالي الصادر</span>
              </div>
              <p className="text-2xl font-bold mt-2">${stats.totalOut.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* الفلاتر */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">تصفية:</span>
              </div>
              
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفترات</SelectItem>
                  <SelectItem value="this_month">هذا الشهر</SelectItem>
                  <SelectItem value="last_month">الشهر الماضي</SelectItem>
                  <SelectItem value="last_3_months">آخر 3 أشهر</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="booking_earning">إيرادات الحجوزات</SelectItem>
                  <SelectItem value="transfer_to_agent">تحويلات للوكلاء</SelectItem>
                  <SelectItem value="withdrawal">السحوبات</SelectItem>
                </SelectContent>
              </Select>
              
              <Badge variant="outline" className="mr-auto">
                {filteredTransactions.length} معاملة
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* جدول المعاملات */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ/الوقت</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>البيان</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead className="text-green-600">لكم (دائن)</TableHead>
                    <TableHead className="text-red-600">عليكم (مدين)</TableHead>
                    <TableHead>الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const config = transactionTypeConfig[tx.transaction_type] || { label: tx.transaction_type, color: 'bg-slate-100', icon: DollarSign };
                    const Icon = config.icon;
                    const isCredit = ['booking_earning', 'deposit'].includes(tx.transaction_type);
                    
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div>
                            <p>{format(new Date(tx.created_date), 'd MMM yyyy', { locale: ar })}</p>
                            <p className="text-xs text-slate-500">{format(new Date(tx.created_date), 'HH:mm')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={config.color}>
                            <Icon className="h-3 w-3 ml-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs truncate">{tx.description}</p>
                        </TableCell>
                        <TableCell>
                          {tx.reference_id && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {tx.reference_id.substring(0, 8)}...
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-green-600 font-semibold">
                          {isCredit ? `$${Math.abs(tx.amount || 0).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-red-600 font-semibold">
                          {!isCredit ? `$${Math.abs(tx.amount || 0).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold">${(tx.balance_after || 0).toLocaleString()}</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {filteredTransactions.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد معاملات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}