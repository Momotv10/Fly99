import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Plane, Ticket, DollarSign, TrendingUp, AlertCircle, 
  Clock, CheckCircle2, Building2, UserCheck, ArrowUpRight, Eye 
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    agents: 0,
    providers: 0,
    customers: 0,
    bookings: 0,
    pendingBookings: 0,
    issuedToday: 0,
    totalRevenue: 0,
    todayRevenue: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    const user = JSON.parse(systemUser);
    if (user.role !== 'admin' && user.role !== 'employee') {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadStats = async () => {
    const [agents, providers, customers, bookings] = await Promise.all([
      base44.entities.Agent.list(),
      base44.entities.Provider.list(),
      base44.entities.Customer.list(),
      base44.entities.Booking.list('-created_date', 100)
    ]);

    const today = new Date().toISOString().split('T')[0];
    const pendingBookings = bookings.filter(b => b.status === 'pending_issue');
    const issuedToday = bookings.filter(b => {
      if (b.status !== 'issued' || !b.updated_date) return false;
      try {
        const dateStr = typeof b.updated_date === 'string' ? b.updated_date : '';
        return dateStr.startsWith(today);
      } catch { return false; }
    });
    const totalRevenue = bookings
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const todayRevenue = bookings
      .filter(b => {
        if (b.payment_status !== 'paid' || !b.created_date) return false;
        try {
          const dateStr = typeof b.created_date === 'string' ? b.created_date : '';
          return dateStr.startsWith(today);
        } catch { return false; }
      })
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    setStats({
      agents: agents.length,
      providers: providers.length,
      customers: customers.length,
      bookings: bookings.length,
      pendingBookings: pendingBookings.length,
      issuedToday: issuedToday.length,
      totalRevenue,
      todayRevenue
    });

    setRecentBookings(bookings.slice(0, 5));
    setLoading(false);
  };

  const statCards = [
    { title: 'إجمالي الحجوزات', value: stats.bookings, icon: Ticket, color: 'bg-blue-500', link: 'AdminBookings' },
    { title: 'بانتظار الإصدار', value: stats.pendingBookings, icon: Clock, color: 'bg-amber-500', link: 'AdminBookings' },
    { title: 'الوكلاء', value: stats.agents, icon: UserCheck, color: 'bg-purple-500', link: 'AdminAgents' },
    { title: 'المزودين', value: stats.providers, icon: Building2, color: 'bg-green-500', link: 'AdminProviders' },
    { title: 'العملاء', value: stats.customers, icon: Users, color: 'bg-indigo-500', link: 'AdminCustomers' },
    { title: 'إيرادات اليوم', value: `${stats.todayRevenue.toLocaleString()} ر.س`, icon: DollarSign, color: 'bg-emerald-500', link: 'AdminFinance' },
  ];

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700' },
    paid: { label: 'تم الدفع', color: 'bg-blue-100 text-blue-700' },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-amber-100 text-amber-700' },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">لوحة التحكم</h1>
          <p className="text-slate-600">مرحباً بك في لوحة إدارة نظام الحجوزات</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <Link key={index} to={createPageUrl(stat.link)}>
              <Card className="hover:shadow-lg transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${stat.color}`}>
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.title}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>آخر الحجوزات</CardTitle>
            <Link to={createPageUrl('AdminBookings')}>
              <Button variant="ghost" size="sm">
                عرض الكل
                <ArrowUpRight className="mr-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBookings.map((booking) => {
                const status = statusConfig[booking.status] || statusConfig.pending_payment;
                return (
                  <div key={booking.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Ticket className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{booking.booking_number}</p>
                        <p className="text-sm text-slate-500">{booking.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={status.color}>{status.label}</Badge>
                      <span className="font-semibold">{booking.total_amount?.toLocaleString()} ر.س</span>
                      <Link to={createPageUrl('AdminBookingDetails') + '?id=' + booking.id}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}