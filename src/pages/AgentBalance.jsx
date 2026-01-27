import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPageUrl } from "@/utils";
import { 
  Wallet, TrendingUp, TrendingDown, Download, RefreshCw, Calendar,
  ArrowUpRight, ArrowDownRight, DollarSign, Search, FileText, Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AgentBalance() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalCommissions: 0,
    monthDeposits: 0,
    monthWithdrawals: 0
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (agentId) => {
    try {
      const [agentData, transactionsData] = await Promise.all([
        base44.entities.Agent.filter({ id: agentId }),
        base44.entities.AgentTransaction.filter({ agent_id: agentId }, '-created_date', 100)
      ]);
      
      if (agentData.length > 0) setAgent(agentData[0]);
      setTransactions(transactionsData);

      // حساب الإحصائيات
      const thisMonth = startOfMonth(new Date());
      const monthTx = transactionsData.filter(t => new Date(t.created_date) >= thisMonth);

      setStats({
        totalDeposits: transactionsData.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
        totalWithdrawals: transactionsData.filter(t => ['booking_payment', 'withdrawal'].includes(t.transaction_type)).reduce((sum, t) => sum + t.amount, 0),
        totalCommissions: transactionsData.filter(t => t.transaction_type === 'commission').reduce((sum, t) => sum + t.amount, 0),
        monthDeposits: monthTx.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
        monthWithdrawals: monthTx.filter(t => ['booking_payment', 'withdrawal'].includes(t.transaction_type)).reduce((sum, t) => sum + t.amount, 0)
      });

      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const getTransactionTypeLabel = (type) => {
    const types = {
      deposit: { label: 'إيداع', class: 'bg-green-100 text-green-700', icon: ArrowDownRight },
      withdrawal: { label: 'سحب', class: 'bg-red-100 text-red-700', icon: ArrowUpRight },
      booking_payment: { label: 'حجز تذكرة', class: 'bg-blue-100 text-blue-700', icon: ArrowUpRight },
      commission: { label: 'عمولة', class: 'bg-purple-100 text-purple-700', icon: ArrowDownRight },
      refund: { label: 'استرجاع', class: 'bg-amber-100 text-amber-700', icon: ArrowDownRight },
      adjustment: { label: 'تسوية', class: 'bg-slate-100 text-slate-700', icon: DollarSign },
      api_booking: { label: 'حجز API', class: 'bg-indigo-100 text-indigo-700', icon: ArrowUpRight }
    };
    return types[type] || { label: type, class: 'bg-slate-100', icon: DollarSign };
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.reference_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || tx.transaction_type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const exportStatement = () => {
    // تصدير كشف الحساب
    const data = filteredTransactions.map(tx => ({
      التاريخ: tx.created_date ? format(new Date(tx.created_date), 'yyyy-MM-dd HH:mm') : '',
      النوع: getTransactionTypeLabel(tx.transaction_type).label,
      الوصف: tx.description || '',
      المبلغ: tx.amount,
      'الرصيد بعد': tx.balance_after
    }));
    
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف_حساب_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('تم تصدير كشف الحساب');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">الحساب المالي</h1>
            <p className="text-slate-600">إدارة ومتابعة رصيدك والمعاملات المالية</p>
          </div>
          <Button variant="outline" onClick={exportStatement}>
            <Download className="h-4 w-4 ml-2" />
            تصدير كشف الحساب
          </Button>
        </div>

        {/* بطاقات الملخص */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <Wallet className="h-8 w-8 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">متاح</Badge>
              </div>
              <p className="text-4xl font-bold">${(agent?.balance || 0).toLocaleString()}</p>
              <p className="text-sm opacity-90 mt-1">الرصيد الحالي</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">${stats.totalDeposits.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">إجمالي الإيداعات</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-600">${stats.totalCommissions.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">إجمالي العمولات</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-600">${stats.totalWithdrawals.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">إجمالي المصروفات</p>
            </CardContent>
          </Card>
        </div>

        {/* الفلاتر */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث في المعاملات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="نوع العملية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العمليات</SelectItem>
                  <SelectItem value="deposit">الإيداعات</SelectItem>
                  <SelectItem value="booking_payment">حجوزات التذاكر</SelectItem>
                  <SelectItem value="commission">العمولات</SelectItem>
                  <SelectItem value="refund">الاسترجاعات</SelectItem>
                  <SelectItem value="api_booking">حجوزات API</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => loadData(agent?.id)}>
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* جدول المعاملات */}
        <Card>
          <CardHeader>
            <CardTitle>كشف الحساب</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الرصيد بعد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const typeInfo = getTransactionTypeLabel(tx.transaction_type);
                    const Icon = typeInfo.icon;
                    const isCredit = ['deposit', 'commission', 'refund'].includes(tx.transaction_type);
                    
                    return (
                      <TableRow key={tx.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-medium">
                                {tx.created_date && format(new Date(tx.created_date), 'd MMM yyyy', { locale: ar })}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tx.created_date && format(new Date(tx.created_date), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeInfo.class}>
                            <Icon className="h-3 w-3 ml-1" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs truncate">{tx.description || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-sm">{tx.reference_id || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <p className={`font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                          </p>
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
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">لا توجد معاملات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}