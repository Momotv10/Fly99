import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createPageUrl } from "@/utils";
import { 
  Plane, TrendingUp, Clock, CheckCircle2, Users, DollarSign, 
  Calendar, Plus, Bell, AlertTriangle, ArrowUpRight, ArrowDownRight,
  FileText, Target, BarChart3, Loader2
} from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    balance: 0,
    totalBookings: 0,
    totalRevenue: 0,
    monthBookings: 0,
    monthRevenue: 0,
    pendingBookings: 0,
    issuedTickets: 0,
    activeSeats: 0,
    totalSeats: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [suggestedFlights, setSuggestedFlights] = useState([]);
  const [chartData, setChartData] = useState([]);

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

    loadProviderData(user.related_entity_id);
  }, []);

  const loadProviderData = async (providerId) => {
    try {
      // جلب بيانات المزود
      const providerData = await base44.entities.Provider.filter({ id: providerId });
      if (providerData.length === 0) {
        navigate(createPageUrl('Home'));
        return;
      }
      setProvider(providerData[0]);

      // جلب البيانات بشكل متوازي
      const authorizedAirlines = providerData[0].authorized_airlines || [];
      
      const [bookingsData, seatsData, flightsData] = await Promise.all([
        base44.entities.Booking.filter({ provider_id: providerId }, '-created_date', 100),
        base44.entities.AvailableSeat.filter({ provider_id: providerId }),
        authorizedAirlines.length > 0 
          ? base44.entities.Flight.filter({ 
              airline_id: { $in: authorizedAirlines },
              is_active: true 
            })
          : Promise.resolve([])
      ]);

      // حساب الإحصائيات
      const thisMonth = startOfMonth(new Date());
      const monthBookings = bookingsData.filter(b => new Date(b.created_date) >= thisMonth);
      const pendingBookings = bookingsData.filter(b => b.status === 'pending_issue');
      const issuedBookings = bookingsData.filter(b => b.status === 'issued');

      setStats({
        balance: providerData[0].balance || 0,
        totalBookings: bookingsData.length,
        totalRevenue: bookingsData.reduce((sum, b) => sum + (b.provider_amount || 0), 0),
        monthBookings: monthBookings.length,
        monthRevenue: monthBookings.reduce((sum, b) => sum + (b.provider_amount || 0), 0),
        pendingBookings: pendingBookings.length,
        issuedTickets: issuedBookings.length,
        activeSeats: seatsData.filter(s => s.status === 'active').length,
        totalSeats: seatsData.length
      });

      setRecentBookings(pendingBookings.slice(0, 5));

      // الرحلات المقترحة (التي لم يضف لها مقاعد بعد)
      const existingSeatFlightIds = seatsData.map(s => s.flight_id);
      const suggested = flightsData.filter(f => !existingSeatFlightIds.includes(f.id)).slice(0, 5);
      setSuggestedFlights(suggested);

      // بيانات الرسم البياني - آخر 7 أيام
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayBookings = bookingsData.filter(b => {
          const bDate = new Date(b.created_date);
          return bDate.toDateString() === date.toDateString();
        });
        return {
          day: format(date, 'EEE', { locale: ar }),
          bookings: dayBookings.length,
          revenue: dayBookings.reduce((sum, b) => sum + (b.provider_amount || 0), 0)
        };
      });
      setChartData(last7Days);

      setLoading(false);
    } catch (error) {
      console.error('Error loading provider data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <ProviderSidebar provider={provider} stats={stats} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* الترحيب */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
                مرحباً، {provider?.contact_person} 👋
              </h1>
              <p className="text-slate-600 mt-1">
                {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate(createPageUrl('ProviderBookings'))}
              >
                <FileText className="h-5 w-5 ml-2" />
                الحجوزات
              </Button>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={() => navigate(createPageUrl('ProviderSeats'))}
              >
                <Plus className="h-5 w-5 ml-2" />
                إضافة مقاعد
              </Button>
            </div>
          </div>

          {/* تنبيه الحجوزات المعلقة */}
          {stats.pendingBookings > 0 && (
            <Card className="mb-6 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-amber-900">لديك {stats.pendingBookings} حجوزات تنتظر الإصدار!</p>
                  <p className="text-sm text-amber-700">يرجى إصدار التذاكر في أقرب وقت ممكن</p>
                </div>
                <Button 
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => navigate(createPageUrl('ProviderBookings'))}
                >
                  <Clock className="h-4 w-4 ml-2" />
                  عرض الحجوزات
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
                    <DollarSign className="h-5 w-5" />
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
                    <FileText className="h-5 w-5" />
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
                <p className="text-3xl font-bold">${stats.monthRevenue.toLocaleString()}</p>
                <p className="text-sm opacity-90 mt-1">إيرادات الشهر</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plane className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{stats.activeSeats}</p>
                <p className="text-sm opacity-90 mt-1">مقاعد نشطة</p>
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
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={(value, name) => [
                        name === 'revenue' ? `$${value}` : value, 
                        name === 'revenue' ? 'الإيرادات' : 'الحجوزات'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* الرحلات المقترحة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-600" />
                رحلات مقترحة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestedFlights.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لقد أضفت مقاعد لجميع الرحلات!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestedFlights.map((flight) => (
                    <div 
                      key={flight.id} 
                      className="p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200"
                      onClick={() => navigate(createPageUrl('ProviderSeats'))}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{flight.flight_number}</p>
                          <p className="text-xs text-slate-600">
                            {flight.departure_city} → {flight.arrival_city}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-amber-600">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-center text-slate-500 mt-2">
                    أضف مقاعد لهذه الرحلات لزيادة مبيعاتك
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* الحجوزات المعلقة */}
        {stats.pendingBookings > 0 && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                حجوزات تنتظر الإصدار
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('ProviderBookings'))}>
                عرض الكل
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div 
                    key={booking.id} 
                    className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(createPageUrl('ProviderBookings'))}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{booking.customer_name}</p>
                        <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                          <Plane className="h-3 w-3" />
                          {booking.flight_number} • {booking.departure_city} → {booking.arrival_city}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {booking.departure_date} | {booking.passengers_count} مسافر
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-green-600">${booking.provider_amount}</p>
                        <Badge className="mt-1 bg-amber-100 text-amber-700">
                          بانتظار الإصدار
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}