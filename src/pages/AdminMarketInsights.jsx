import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, AlertTriangle, Users, BarChart3, 
  CheckCircle, XCircle, Clock, Ban 
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMarketInsights() {
  const [selectedTab, setSelectedTab] = useState('unavailable');

  // جلب الطلبات غير المتوفرة
  const { data: unavailableRequests = [] } = useQuery({
    queryKey: ['unavailable-requests'],
    queryFn: () => base44.entities.UnavailableFlightRequest.filter({
      status: 'pending'
    }, '-created_date', 50),
    refetchInterval: 30000
  });

  // جلب العملاء المشبوهين
  const { data: suspiciousCustomers = [] } = useQuery({
    queryKey: ['suspicious-customers'],
    queryFn: () => base44.entities.BlacklistedCustomer.filter({
      is_active: false,
      auto_detected: true
    }, '-created_date', 30),
    refetchInterval: 60000
  });

  // جلب المحظورين
  const { data: blacklisted = [] } = useQuery({
    queryKey: ['blacklisted'],
    queryFn: () => base44.entities.BlacklistedCustomer.filter({
      is_active: true
    }, '-created_date', 50)
  });

  // تحليل البيانات
  const analytics = React.useMemo(() => {
    const routeCount = {};
    
    unavailableRequests.forEach(req => {
      const route = `${req.from_city} → ${req.to_city}`;
      routeCount[route] = (routeCount[route] || 0) + (req.request_count || 1);
    });

    const topRoutes = Object.entries(routeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalRequests: unavailableRequests.length,
      totalDemand: unavailableRequests.reduce((sum, r) => sum + (r.request_count || 1), 0),
      topRoutes,
      urgentCount: unavailableRequests.filter(r => r.urgency === 'urgent').length,
      suspiciousCount: suspiciousCustomers.length,
      blacklistedCount: blacklisted.length
    };
  }, [unavailableRequests, suspiciousCustomers, blacklisted]);

  const handleFulfill = async (requestId) => {
    try {
      await base44.entities.UnavailableFlightRequest.update(requestId, {
        status: 'fulfilled',
        admin_notified: true
      });
      toast.success('تم تحديث الحالة');
    } catch (e) {
      toast.error('فشل التحديث');
    }
  };

  const handleBlockCustomer = async (customerId, phone) => {
    try {
      await base44.entities.BlacklistedCustomer.update(customerId, {
        is_active: true,
        blocked_by: 'Admin'
      });
      toast.success('تم حظر العميل');
    } catch (e) {
      toast.error('فشل الحظر');
    }
  };

  const handleUnblock = async (customerId) => {
    try {
      await base44.entities.BlacklistedCustomer.update(customerId, {
        is_active: false
      });
      toast.success('تم إلغاء الحظر');
    } catch (e) {
      toast.error('فشل الإلغاء');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">📊 رؤى السوق والذكاء التسويقي</h1>
            <p className="text-slate-600 mt-1">احتياجات العملاء والفرص التجارية</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">طلبات غير متوفرة</p>
                    <p className="text-2xl font-bold text-blue-600">{analytics.totalRequests}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">إجمالي الطلب</p>
                    <p className="text-2xl font-bold text-green-600">{analytics.totalDemand}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">عملاء مشبوهين</p>
                    <p className="text-2xl font-bold text-orange-600">{analytics.suspiciousCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">محظورين</p>
                    <p className="text-2xl font-bold text-red-600">{analytics.blacklistedCount}</p>
                  </div>
                  <Ban className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setSelectedTab('unavailable')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'unavailable'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600'
              }`}
            >
              طلبات غير متوفرة
            </button>
            <button
              onClick={() => setSelectedTab('top-routes')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'top-routes'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600'
              }`}
            >
              أكثر المسارات طلباً
            </button>
            <button
              onClick={() => setSelectedTab('suspicious')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'suspicious'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600'
              }`}
            >
              عملاء مشبوهين
            </button>
            <button
              onClick={() => setSelectedTab('blacklisted')}
              className={`px-4 py-2 font-medium ${
                selectedTab === 'blacklisted'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600'
              }`}
            >
              القائمة السوداء
            </button>
          </div>

          {/* Content */}
          {selectedTab === 'unavailable' && (
            <Card>
              <CardHeader>
                <CardTitle>🔍 طلبات الرحلات غير المتوفرة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unavailableRequests.map(req => (
                    <div key={req.id} className="border rounded-lg p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-lg">
                              {req.from_city} → {req.to_city}
                            </span>
                            {req.urgency === 'urgent' && (
                              <Badge variant="destructive">عاجل</Badge>
                            )}
                            {req.request_count > 1 && (
                              <Badge variant="secondary">{req.request_count}× طلبات</Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-600 space-y-1">
                            <p>👤 {req.customer_name} - {req.customer_phone}</p>
                            {req.requested_date && <p>📅 {req.requested_date}</p>}
                            {req.passengers_count && <p>👥 {req.passengers_count} مسافر</p>}
                            {req.airline_preference && <p>✈️ {req.airline_preference}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFulfill(req.id)}
                          >
                            <CheckCircle className="h-4 w-4 ml-1" />
                            تم التوفير
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {unavailableRequests.length === 0 && (
                    <p className="text-center text-slate-500 py-8">لا توجد طلبات</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTab === 'top-routes' && (
            <Card>
              <CardHeader>
                <CardTitle>📈 أكثر المسارات طلباً</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topRoutes.map(([route, count], i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-slate-400">#{i + 1}</span>
                        <span className="font-medium">{route}</span>
                      </div>
                      <Badge variant="secondary">{count} طلب</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTab === 'suspicious' && (
            <Card>
              <CardHeader>
                <CardTitle>⚠️ عملاء مشبوهين (يحتاجون مراجعة)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suspiciousCustomers.map(customer => (
                    <div key={customer.id} className="border rounded-lg p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">{customer.phone_number}</p>
                          <p className="text-sm text-slate-600 mt-1">{customer.reason}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{customer.offense_type}</Badge>
                            <Badge variant="secondary">المخالفات: {customer.offense_count}</Badge>
                          </div>
                          {customer.notes && (
                            <p className="text-xs text-slate-500 mt-2">📝 {customer.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleBlockCustomer(customer.id, customer.phone_number)}
                          >
                            <Ban className="h-4 w-4 ml-1" />
                            حظر
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {suspiciousCustomers.length === 0 && (
                    <p className="text-center text-slate-500 py-8">✅ لا يوجد عملاء مشبوهين</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTab === 'blacklisted' && (
            <Card>
              <CardHeader>
                <CardTitle>🚫 القائمة السوداء (محظورين)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {blacklisted.map(customer => (
                    <div key={customer.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-red-900">{customer.phone_number}</p>
                          <p className="text-sm text-red-700 mt-1">{customer.reason}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="destructive">{customer.offense_type}</Badge>
                            <Badge variant="outline">المخالفات: {customer.offense_count}</Badge>
                            <Badge variant="outline">بواسطة: {customer.blocked_by}</Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnblock(customer.id)}
                        >
                          <XCircle className="h-4 w-4 ml-1" />
                          إلغاء الحظر
                        </Button>
                      </div>
                    </div>
                  ))}

                  {blacklisted.length === 0 && (
                    <p className="text-center text-slate-500 py-8">لا يوجد عملاء محظورين</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}