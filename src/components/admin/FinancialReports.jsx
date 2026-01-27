import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";

export default function FinancialReports() {
  const [reportType, setReportType] = useState('account_statement');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accounts, setAccounts] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await base44.entities.Account.filter({ is_active: true });
    setAccounts(data);
  };

  const generateReport = async () => {
    setLoading(true);
    
    try {
      if (reportType === 'account_statement') {
        await generateAccountStatement();
      } else if (reportType === 'profit_loss') {
        await generateProfitLoss();
      } else if (reportType === 'balance_sheet') {
        await generateBalanceSheet();
      } else if (reportType === 'provider_summary') {
        await generateProviderSummary();
      }
    } catch (error) {
      toast.error('حدث خطأ في إنشاء التقرير');
    }
    
    setLoading(false);
  };

  const generateAccountStatement = async () => {
    const filter = {
      entry_date: { $gte: dateFrom, $lte: dateTo }
    };
    
    if (selectedAccount !== 'all') {
      filter['entries.account_id'] = selectedAccount;
    }
    
    const entries = await base44.entities.JournalEntry.filter(filter, 'entry_date');
    
    // حساب الرصيد الافتتاحي والختامي
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    
    const transactions = [];
    
    for (const entry of entries) {
      for (const line of entry.entries || []) {
        if (selectedAccount === 'all' || line.account_id === selectedAccount) {
          totalDebit += line.debit || 0;
          totalCredit += line.credit || 0;
          
          transactions.push({
            date: entry.entry_date,
            entry_number: entry.entry_number,
            description: line.description || entry.description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            balance: openingBalance + totalDebit - totalCredit
          });
        }
      }
    }
    
    const closingBalance = openingBalance + totalDebit - totalCredit;
    
    setReportData({
      type: 'account_statement',
      accountName: selectedAccount === 'all' ? 'جميع الحسابات' : accounts.find(a => a.id === selectedAccount)?.name,
      dateFrom,
      dateTo,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      transactions
    });
  };

  const generateProfitLoss = async () => {
    const entries = await base44.entities.JournalEntry.filter({
      entry_date: { $gte: dateFrom, $lte: dateTo }
    });
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    const revenueAccounts = await base44.entities.Account.filter({ type: 'revenue' });
    const expenseAccounts = await base44.entities.Account.filter({ type: 'expense' });
    
    for (const entry of entries) {
      for (const line of entry.entries || []) {
        const account = [...revenueAccounts, ...expenseAccounts].find(a => a.id === line.account_id);
        
        if (account?.type === 'revenue') {
          totalRevenue += line.credit - line.debit;
        } else if (account?.type === 'expense') {
          totalExpenses += line.debit - line.credit;
        }
      }
    }
    
    const netProfit = totalRevenue - totalExpenses;
    
    setReportData({
      type: 'profit_loss',
      dateFrom,
      dateTo,
      totalRevenue,
      totalExpenses,
      netProfit,
      revenueAccounts: revenueAccounts.map(a => ({
        name: a.name,
        amount: entries.reduce((sum, e) => {
          const line = e.entries.find(l => l.account_id === a.id);
          return sum + (line ? (line.credit - line.debit) : 0);
        }, 0)
      })),
      expenseAccounts: expenseAccounts.map(a => ({
        name: a.name,
        amount: entries.reduce((sum, e) => {
          const line = e.entries.find(l => l.account_id === a.id);
          return sum + (line ? (line.debit - line.credit) : 0);
        }, 0)
      }))
    });
  };

  const generateBalanceSheet = async () => {
    const allAccounts = await base44.entities.Account.filter({ is_active: true });
    
    const assets = allAccounts.filter(a => a.type === 'asset');
    const liabilities = allAccounts.filter(a => a.type === 'liability');
    const equity = allAccounts.filter(a => a.type === 'equity');
    
    const totalAssets = assets.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalEquity = equity.reduce((sum, a) => sum + (a.balance || 0), 0);
    
    setReportData({
      type: 'balance_sheet',
      date: dateTo,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity
    });
  };

  const generateProviderSummary = async () => {
    const providers = await base44.entities.Provider.filter({ is_active: true });
    const bookings = await base44.entities.Booking.filter({
      created_date: { $gte: dateFrom, $lte: dateTo },
      status: 'issued'
    });
    
    const summary = providers.map(provider => {
      const providerBookings = bookings.filter(b => b.provider_id === provider.id);
      const totalAmount = providerBookings.reduce((sum, b) => sum + (b.provider_amount || 0), 0);
      const totalCommission = providerBookings.reduce((sum, b) => sum + (b.system_commission || 0), 0);
      
      return {
        name: provider.company_name_ar,
        bookings: providerBookings.length,
        totalAmount,
        totalCommission,
        balance: provider.balance || 0
      };
    });
    
    setReportData({
      type: 'provider_summary',
      dateFrom,
      dateTo,
      providers: summary,
      totalBookings: summary.reduce((sum, p) => sum + p.bookings, 0),
      totalRevenue: summary.reduce((sum, p) => sum + p.totalAmount, 0),
      totalCommission: summary.reduce((sum, p) => sum + p.totalCommission, 0)
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // تصدير إلى CSV
    const csv = convertToCSV(reportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${reportType}_${Date.now()}.csv`;
    link.click();
  };

  const convertToCSV = (data) => {
    if (!data) return '';
    
    let csv = '';
    
    if (data.type === 'account_statement' && data.transactions) {
      csv = 'التاريخ,رقم القيد,البيان,مدين,دائن,الرصيد\n';
      data.transactions.forEach(t => {
        csv += `${t.date},${t.entry_number},${t.description},${t.debit},${t.credit},${t.balance}\n`;
      });
    }
    
    return csv;
  };

  return (
    <div className="space-y-6">
      {/* خيارات التقرير */}
      <Card>
        <CardHeader>
          <CardTitle>إنشاء تقرير</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>نوع التقرير</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account_statement">كشف حساب</SelectItem>
                  <SelectItem value="profit_loss">الأرباح والخسائر</SelectItem>
                  <SelectItem value="balance_sheet">الميزانية العمومية</SelectItem>
                  <SelectItem value="provider_summary">ملخص المزودين</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === 'account_statement' && (
              <div>
                <Label>الحساب</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحسابات</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button 
            onClick={generateReport}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء التقرير'}
          </Button>
        </CardContent>
      </Card>

      {/* عرض التقرير */}
      {reportData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {reportData.type === 'account_statement' && 'كشف حساب'}
                {reportData.type === 'profit_loss' && 'قائمة الأرباح والخسائر'}
                {reportData.type === 'balance_sheet' && 'الميزانية العمومية'}
                {reportData.type === 'provider_summary' && 'ملخص المزودين'}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 ml-1" />
                  طباعة
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 ml-1" />
                  تصدير
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* كشف الحساب */}
            {reportData.type === 'account_statement' && (
              <div>
                <div className="flex justify-between mb-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-500">الحساب</p>
                    <p className="font-semibold">{reportData.accountName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">الفترة</p>
                    <p className="font-semibold">{reportData.dateFrom} إلى {reportData.dateTo}</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>رقم القيد</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead>مدين</TableHead>
                      <TableHead>دائن</TableHead>
                      <TableHead>الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={5} className="font-semibold">الرصيد الافتتاحي</TableCell>
                      <TableCell className="font-semibold">${reportData.openingBalance}</TableCell>
                    </TableRow>
                    {reportData.transactions?.map((trans, i) => (
                      <TableRow key={i}>
                        <TableCell>{trans.date}</TableCell>
                        <TableCell className="font-mono text-sm">{trans.entry_number}</TableCell>
                        <TableCell>{trans.description}</TableCell>
                        <TableCell className="text-green-600">${trans.debit}</TableCell>
                        <TableCell className="text-red-600">${trans.credit}</TableCell>
                        <TableCell className="font-semibold">${trans.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={3}>الإجمالي</TableCell>
                      <TableCell className="text-green-600">${reportData.totalDebit}</TableCell>
                      <TableCell className="text-red-600">${reportData.totalCredit}</TableCell>
                      <TableCell>${reportData.closingBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* قائمة الأرباح والخسائر */}
            {reportData.type === 'profit_loss' && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">الفترة:</span>
                    <span className="font-semibold">{reportData.dateFrom} إلى {reportData.dateTo}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    الإيرادات
                  </h3>
                  <div className="space-y-2">
                    {reportData.revenueAccounts?.map((acc, i) => (
                      <div key={i} className="flex justify-between p-2 bg-green-50 rounded">
                        <span>{acc.name}</span>
                        <span className="font-semibold text-green-600">${acc.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 bg-green-100 rounded font-semibold">
                      <span>إجمالي الإيرادات</span>
                      <span className="text-green-700">${reportData.totalRevenue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    المصروفات
                  </h3>
                  <div className="space-y-2">
                    {reportData.expenseAccounts?.map((acc, i) => (
                      <div key={i} className="flex justify-between p-2 bg-red-50 rounded">
                        <span>{acc.name}</span>
                        <span className="font-semibold text-red-600">${acc.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 bg-red-100 rounded font-semibold">
                      <span>إجمالي المصروفات</span>
                      <span className="text-red-700">${reportData.totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${
                  reportData.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">صافي الربح/الخسارة</span>
                    <span className={`text-2xl font-bold ${
                      reportData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      ${Math.abs(reportData.netProfit).toFixed(2)}
                      {reportData.netProfit < 0 && ' (خسارة)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ملخص المزودين */}
            {reportData.type === 'provider_summary' && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="bg-blue-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-slate-600">إجمالي الحجوزات</p>
                      <p className="text-2xl font-bold text-blue-600">{reportData.totalBookings}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-slate-600">إجمالي الإيرادات</p>
                      <p className="text-2xl font-bold text-green-600">${reportData.totalRevenue.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-slate-600">إجمالي العمولات</p>
                      <p className="text-2xl font-bold text-purple-600">${reportData.totalCommission.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المزود</TableHead>
                      <TableHead>الحجوزات</TableHead>
                      <TableHead>الإيرادات</TableHead>
                      <TableHead>العمولات</TableHead>
                      <TableHead>الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.providers?.map((prov, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">{prov.name}</TableCell>
                        <TableCell>{prov.bookings}</TableCell>
                        <TableCell className="text-green-600">${prov.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-purple-600">${prov.totalCommission.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${prov.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}