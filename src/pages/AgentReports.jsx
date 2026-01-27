import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { 
  BarChart3, TrendingUp, Download, RefreshCw, Calendar,
  DollarSign, Ticket, Users, Plane, FileText, PieChart
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AgentReports() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSales: 0,
    totalCommission: 0,
    avgTicketPrice: 0,
    cancelledBookings: 0,
    issuedTickets: 0
  });

  const [chartData, setChartData] = useState({
    salesByDay: [],
    salesByRoute: [],
    bookingsByStatus: [],
    commissionTrend: []
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadData(user.related_entity_id);
  }, [period]);

  const loadData = async (agentId) => {
    try {
      const [agentData, bookingsData, transactionsData] = await Promise.all([
        base44.entities.Agent.filter({ id: agentId }),
        base44.entities.Booking.filter({ agent_id: agentId }, '-created_date', 500),
        base44.entities.AgentTransaction.filter({ agent_id: agentId }, '-created_date', 200)
      ]);
      
      if (agentData.length > 0) setAgent(agentData[0]);
      
      // فلترة حسب الفترة
      let startDate;
      const now = new Date();
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          startDate = startOfYear(now);
          break;
        default:
          startDate = startOfMonth(now);
      }

      const filteredBookings = bookingsData.filter(b => new Date(b.created_date) >= startDate);
      const filteredTransactions = transactionsData.filter(t => new Date(t.created_date) >= startDate);

      setBookings(filteredBookings);
      setTransactions(filteredTransactions);

      // حساب الإحصائيات
      const totalSales = filteredBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const totalCommission = filteredBookings.reduce((sum, b) => sum + (b.agent_commission || 0), 0);

      setStats({
        totalBookings: filteredBookings.length,
        totalSales: totalSales,
        totalCommission: totalCommission,
        avgTicketPrice: filteredBookings.length > 0 ? Math.round(totalSales / filteredBookings.length) : 0,
        cancelledBookings: filteredBookings.filter(b => b.status === 'cancelled').length,
        issuedTickets: filteredBookings.filter(b => b.status === 'issued').length
      });

      // بناء بيانات الرسوم البيانية
      buildChartData(filteredBookings, filteredTransactions);

      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const buildChartData = (bookings, transactions) => {
    // المبيعات اليومية
    const salesByDay = {};
    bookings.forEach(b => {
      const day = format(new Date(b.created_date), 'MM/dd');
      salesByDay[day] = (salesByDay[day] || 0) + (b.total_amount || 0);
    });
    
    // المبيعات حسب المسار
    const salesByRoute = {};
    bookings.forEach(b => {
      const route = `${b.departure_city} - ${b.arrival_city}`;
      salesByRoute[route] = (salesByRoute[route] || 0) + (b.total_amount || 0);
    });

    // الحجوزات حسب الحالة
    const bookingsByStatus = {
      'صادرة': bookings.filter(b => b.status === 'issued').length,
      'معلقة': bookings.filter(b => ['pending_payment', 'paid', 'pending_issue'].includes(b.status)).length,
      'ملغية': bookings.filter(b => b.status === 'cancelled').length
    };

    // اتجاه العمولات
    const commissionTrend = {};
    transactions.filter(t => t.transaction_type === 'commission').forEach(t => {
      const day = format(new Date(t.created_date), 'MM/dd');
      commissionTrend[day] = (commissionTrend[day] || 0) + t.amount;
    });

    setChartData({
      salesByDay: Object.entries(salesByDay).map(([day, amount]) => ({ day, amount })).slice(-14),
      salesByRoute: Object.entries(salesByRoute).map(([route, amount]) => ({ route, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
      bookingsByStatus: Object.entries(bookingsByStatus).map(([name, value]) => ({ name, value })),
      commissionTrend: Object.entries(commissionTrend).map(([day, amount]) => ({ day, amount })).slice(-14)
    });
  };

  const exportReport = () => {
    const reportData = {
      period: period,
      generated_at: new Date().toISOString(),
      agent: agent?.name,
      stats: stats,
      bookings: bookings.map(b => ({
        booking_number: b.booking_number,
        customer: b.customer_name,
        route: `${b.departure_city} - ${b.arrival_city}`,
        date: b.departure_date,
        amount: b.total_amount,
        commission: b.agent_commission,
        status: b.status
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_${agent?.name}_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    toast.success('تم تصدير التقرير');
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
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">التقارير المالية</h1>
            <p className="text-slate-600">تحليل شامل لأدائك ومبيعاتك</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">آخر أسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="quarter">هذا الربع</SelectItem>
                <SelectItem value="year">هذا العام</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportReport}>
              <Download className="h-4 w-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        {/* بطاقات الملخص */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Ticket className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">{stats.totalBookings}</p>
              <p className="text-sm opacity-90">إجمالي الحجوزات</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">${stats.totalSales.toLocaleString()}</p>
              <p className="text-sm opacity-90">إجمالي المبيعات</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">${stats.totalCommission.toLocaleString()}</p>
              <p className="text-sm opacity-90">إجمالي العمولات</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">${stats.avgTicketPrice}</p>
              <p className="text-sm opacity-90">متوسط سعر التذكرة</p>
            </CardContent>
          </Card>
        </div>

        {/* الرسوم البيانية */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* المبيعات اليومية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                المبيعات اليومية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.salesByDay}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'المبيعات']} />
                    <Area type="monotone" dataKey="amount" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* الحجوزات حسب الحالة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-600" />
                الحجوزات حسب الحالة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={chartData.bookingsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {chartData.bookingsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* أكثر المسارات مبيعاً */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-green-600" />
                أكثر المسارات مبيعاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.salesByRoute} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="route" type="category" width={100} />
                    <Tooltip formatter={(value) => [`$${value}`, 'المبيعات']} />
                    <Bar dataKey="amount" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* اتجاه العمولات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                اتجاه العمولات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.commissionTrend}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'العمولة']} />
                    <Line type="monotone" dataKey="amount" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ملخص الأداء */}
        <Card>
          <CardHeader>
            <CardTitle>ملخص الأداء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-green-600">{stats.issuedTickets}</p>
                <p className="text-sm text-green-700">تذاكر صادرة</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-red-600">{stats.cancelledBookings}</p>
                <p className="text-sm text-red-700">حجوزات ملغية</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {stats.totalBookings > 0 ? Math.round((stats.issuedTickets / stats.totalBookings) * 100) : 0}%
                </p>
                <p className="text-sm text-blue-700">نسبة النجاح</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {stats.totalSales > 0 ? Math.round((stats.totalCommission / stats.totalSales) * 100) : 0}%
                </p>
                <p className="text-sm text-purple-700">نسبة العمولة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}