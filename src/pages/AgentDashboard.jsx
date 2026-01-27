import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createPageUrl } from "@/utils";
import { 
  Search, TrendingUp, DollarSign, Users, Ticket, Calendar,
  CheckCircle2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Plane, FileText, RefreshCw, Wallet, Target, BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    balance: 0,
    totalBookings: 0,
    totalCommission: 0,
    monthBookings: 0,
    monthSales: 0,
    monthCommission: 0,
    pendingBookings: 0,
    issuedTickets: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'agent' || !user.related_entity_id) {
      navigate(createPageUrl('Home'));
      return;
    }

    loadAgentData(user.related_entity_id);
  }, []);

  const loadAgentData = async (agentId) => {
    try {
      // جلب بيانات الوكيل
      const agentData = await base44.entities.Agent.filter({ id: agentId });
      if (agentData.length === 0) {
        navigate(createPageUrl('Home'));
        return;
      }
      setAgent(agentData[0]);

      // جلب الحجوزات
      const bookings = await base44.entities.Booking.filter({ agent_id: agentId }, '-created_date', 100);
      setRecentBookings(bookings.slice(0, 5));

      // جلب المعاملات
      const transactions = await base44.entities.AgentTransaction.filter({ agent_id: agentId }, '-created_date', 5);
      setRecentTransactions(transactions);

      // حساب الإحصائيات
      const thisMonth = startOfMonth(new Date());
      const monthBookings = bookings.filter(b => new Date(b.created_date) >= thisMonth);

      setStats({
        balance: agentData[0].balance || 0,
        totalBookings: agentData[0].total_bookings || bookings.length,
        totalCommission: agentData[0].total_commission || 0,
        totalSales: agentData[0].total_sales || bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
        monthBookings: monthBookings.length,
        monthSales: monthBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
        monthCommission: monthBookings.reduce((sum, b) => sum + (b.agent_commission || 0), 0),
        pendingBookings: bookings.filter(b => ['pending_payment', 'paid', 'pending_issue'].includes(b.status)).length,
        issuedTickets: bookings.filter(b => b.status === 'issued').length
      });

      // بيانات الرسم البياني - آخر 7 أيام
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayBookings = bookings.filter(b => {
          const bDate = new Date(b.created_date);
          return bDate.toDateString() === date.toDateString();
        });
        return {
          day: format(date, 'EEE', { locale: ar }),
          bookings: dayBookings.length,
          sales: dayBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
        };
      });
      setChartData(last7Days);

      setLoading(false);
    } catch (error) {
      console.error('Error loading agent data:', error);
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_payment: { label: 'بانتظار الدفع', class: 'bg-yellow-100 text-yellow-700' },
      paid: { label: 'مدفوع', class: 'bg-blue-100 text-blue-700' },
      pending_issue: { label: 'بانتظار الإصدار', class: 'bg-orange-100 text-orange-700' },
      issued: { label: 'صادرة', class: 'bg-green-100 text-green-700' },
      cancelled: { label: 'ملغية', class: 'bg-red-100 text-red-700' },
      refunded: { label: 'مسترجعة', class: 'bg-slate-100 text-slate-700' }
    };
    const config = statusConfig[status] || { label: status, class: 'bg-slate-100' };
    return <Badge className={config.class}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AgentSidebar agent={agent} balance={stats.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* الترحيب والبطاقات السريعة */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
                مرحباً، {agent?.contact_person || agent?.name} 👋
              </h1>
              <p className="text-slate-600 mt-1">
                {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}
              </p>
            </div>
            <Button 
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              onClick={() => navigate(createPageUrl('AgentSearchPremium'))}
            >
              <Search className="h-5 w-5 ml-2" />
              بحث وحجز جديد
            </Button>
          </div>

          {/* تنبيه الرصيد */}
          {stats.balance < 100 && (
            <Card className="mb-6 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-amber-900">رصيدك منخفض!</p>
                  <p className="text-sm text-amber-700">الرصيد الحالي ${stats.balance} - يرجى إضافة رصيد لمتابعة إصدار التذاكر</p>
                </div>
                <Button className="bg-amber-600 hover:bg-amber-700">
                  <Wallet className="h-4 w-4 ml-2" />
                  طلب إيداع
                </Button>
              </CardContent>
            </Card>
          )}

          {/* بطاقات الإحصائيات */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <Badge className="bg-white/20 text-white border-0">متاح</Badge>
                </div>
                <p className="text-3xl font-bold">${stats.balance.toLocaleString()}</p>
                <p className="text-sm opacity-90 mt-1">الرصيد المتاح</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+{stats.monthBookings}</span>
                  </div>
                </div>
                <p className="text-3xl font-bold">{stats.totalBookings}</p>
                <p className="text-sm opacity-90 mt-1">إجمالي الحجوزات</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge className="bg-white/20 text-white border-0">هذا الشهر</Badge>
                </div>
                <p className="text-3xl font-bold">${stats.monthCommission.toLocaleString()}</p>
                <p className="text-sm opacity-90 mt-1">عمولات الشهر</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{stats.pendingBookings}</p>
                <p className="text-sm opacity-90 mt-1">حجوزات معلقة</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* الرسم البياني */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                نشاط آخر 7 أيام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={(value, name) => [value, name === 'bookings' ? 'الحجوزات' : 'المبيعات']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bookings" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorBookings)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* إجراءات سريعة */}
          <Card>
            <CardHeader>
              <CardTitle>إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start h-12"
                style={{ backgroundColor: agent?.brand_color }}
                onClick={() => navigate(createPageUrl('AgentSearchPremium'))}
              >
                <Search className="ml-3 h-5 w-5" />
                بحث عن رحلات
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12"
                onClick={() => navigate(createPageUrl('AgentBookings'))}
              >
                <Ticket className="ml-3 h-5 w-5" />
                إدارة الحجوزات
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12"
                onClick={() => navigate(createPageUrl('AgentBalance'))}
              >
                <DollarSign className="ml-3 h-5 w-5" />
                كشف الحساب
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12"
                onClick={() => navigate(createPageUrl('AgentApiDocs'))}
              >
                <FileText className="ml-3 h-5 w-5" />
                وثائق API
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* آخر الحجوزات والمعاملات */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* آخر الحجوزات */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-blue-600" />
                آخر الحجوزات
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('AgentBookings'))}>
                عرض الكل
              </Button>
            </CardHeader>
            <CardContent>
              {recentBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Plane className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">لا توجد حجوزات بعد</p>
                  <Button 
                    className="mt-4"
                    style={{ backgroundColor: agent?.brand_color }}
                    onClick={() => navigate(createPageUrl('AgentSearchPremium'))}
                  >
                    ابدأ الحجز الأول
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => navigate(createPageUrl('AgentBookingDetails') + `?id=${booking.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{booking.customer_name}</p>
                          <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                            <Plane className="h-3 w-3" />
                            {booking.departure_city} ← {booking.arrival_city}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {booking.departure_date && format(new Date(booking.departure_date), 'd MMM', { locale: ar })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">${booking.total_amount}</p>
                          <p className="text-xs text-green-600">عمولتك: ${booking.agent_commission || 0}</p>
                          <div className="mt-1">
                            {getStatusBadge(booking.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* آخر المعاملات */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                آخر المعاملات
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('AgentBalance'))}>
                عرض الكل
              </Button>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">لا توجد معاملات بعد</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          tx.transaction_type === 'deposit' || tx.transaction_type === 'commission'
                            ? 'bg-green-100'
                            : 'bg-red-100'
                        }`}>
                          {tx.transaction_type === 'deposit' || tx.transaction_type === 'commission' ? (
                            <ArrowDownRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.transaction_type === 'deposit' ? 'إيداع' :
                             tx.transaction_type === 'commission' ? 'عمولة' :
                             tx.transaction_type === 'booking_payment' ? 'حجز تذكرة' :
                             tx.description}
                          </p>
                          <p className="text-xs text-slate-500">
                            {tx.created_date && format(new Date(tx.created_date), 'd MMM', { locale: ar })}
                          </p>
                        </div>
                      </div>
                      <p className={`font-bold ${
                        tx.transaction_type === 'deposit' || tx.transaction_type === 'commission'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {tx.transaction_type === 'deposit' || tx.transaction_type === 'commission' ? '+' : '-'}
                        ${Math.abs(tx.amount).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}