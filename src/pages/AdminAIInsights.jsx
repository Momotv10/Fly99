import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Users, MapPin, Bell, BellOff } from 'lucide-react';

export default function AdminAIInsights() {
  const [unavailableRequests, setUnavailableRequests] = useState([]);
  const [suspiciousCustomers, setSuspiciousCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRequests: 0,
    topRoutes: [],
    blacklistedCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. الطلبات غير المتوفرة
      const requests = await base44.entities.UnavailableFlightRequest.list('-request_count', 50);
      setUnavailableRequests(requests);

      // 2. العملاء المشبوهين
      const suspicious = await base44.entities.CustomerClassification.filter({
        classification: 'suspicious'
      }, '-warnings_count', 20);
      setSuspiciousCustomers(suspicious);

      // 3. القائمة السوداء
      const blacklisted = await base44.entities.CustomerClassification.filter({
        classification: 'blacklisted'
      });

      // 4. حساب الإحصائيات
      const routeMap = {};
      requests.forEach(req => {
        const route = `${req.from_city} → ${req.to_city}`;
        routeMap[route] = (routeMap[route] || 0) + (req.request_count || 1);
      });

      const topRoutes = Object.entries(routeMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([route, count]) => ({ route, count }));

      setStats({
        totalRequests: requests.length,
        topRoutes,
        blacklistedCount: blacklisted.length
      });

    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmin = async (requestId) => {
    try {
      await base44.entities.UnavailableFlightRequest.update(requestId, {
        admin_notified: true,
        status: 'notified_admin'
      });
      
      loadData();
    } catch (error) {
      console.error('خطأ:', error);
    }
  };

  const blacklistCustomer = async (phone) => {
    if (!confirm('هل تريد حظر هذا العميل؟')) return;

    try {
      const classifications = await base44.entities.CustomerClassification.filter({
        customer_phone: phone
      });

      if (classifications[0]) {
        await base44.entities.CustomerClassification.update(classifications[0].id, {
          classification: 'blacklisted',
          blacklist_reason: 'حظر يدوي من المدير',
          blacklisted_at: new Date().toISOString()
        });
      }

      loadData();
    } catch (error) {
      console.error('خطأ:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">رؤى الذكاء الاصطناعي</h1>
            <p className="text-slate-600 mt-2">تحليلات وتنبيهات ذكية من نظام خدمة العملاء</p>
          </div>

          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">طلبات غير متوفرة</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalRequests}</p>
                  </div>
                  <MapPin className="h-12 w-12 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">عملاء مشبوهين</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{suspiciousCustomers.length}</p>
                  </div>
                  <AlertTriangle className="h-12 w-12 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">القائمة السوداء</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{stats.blacklistedCount}</p>
                  </div>
                  <Users className="h-12 w-12 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أكثر المسارات طلباً */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                أكثر المسارات طلباً (غير متوفرة)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topRoutes.length === 0 ? (
                <p className="text-slate-500 text-center py-8">لا توجد بيانات</p>
              ) : (
                <div className="space-y-3">
                  {stats.topRoutes.map((route, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {i + 1}
                        </div>
                        <span className="font-medium">{route.route}</span>
                      </div>
                      <Badge variant="secondary">{route.count} طلب</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* تنبيهات عاجلة */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                تنبيهات عاجلة - طلبات متكررة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-slate-500">جاري التحميل...</p>
              ) : unavailableRequests.filter(r => r.request_count >= 3).length === 0 ? (
                <p className="text-center py-8 text-slate-500">لا توجد تنبيهات</p>
              ) : (
                <div className="space-y-3">
                  {unavailableRequests
                    .filter(r => r.request_count >= 3)
                    .slice(0, 10)
                    .map(req => (
                      <div key={req.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">
                              {req.from_city} → {req.to_city}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              عدد الطلبات: <strong>{req.request_count}</strong>
                              {req.airline_preference && ` | الشركة المفضلة: ${req.airline_preference}`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              آخر طلب: {new Date(req.updated_date).toLocaleString('ar')}
                            </p>
                          </div>
                          {!req.admin_notified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => notifyAdmin(req.id)}
                            >
                              <BellOff className="h-4 w-4 ml-2" />
                              تم الاطلاع
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* عملاء مشبوهين */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                عملاء مشبوهين
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suspiciousCustomers.length === 0 ? (
                <p className="text-center py-8 text-slate-500">لا يوجد عملاء مشبوهين</p>
              ) : (
                <div className="space-y-3">
                  {suspiciousCustomers.map(customer => (
                    <div key={customer.id} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900 font-mono">
                            {customer.customer_phone}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            التحذيرات: <strong className="text-red-600">{customer.warnings_count}</strong>
                            {' | '}
                            إجمالي الطلبات: {customer.total_requests}
                          </p>
                          {customer.last_warning_at && (
                            <p className="text-xs text-slate-500 mt-1">
                              آخر تحذير: {new Date(customer.last_warning_at).toLocaleString('ar')}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => blacklistCustomer(customer.customer_phone)}
                        >
                          حظر
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}