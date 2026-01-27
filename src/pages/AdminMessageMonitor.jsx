import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Shield, Zap } from 'lucide-react';
import { messageTracker } from '@/components/ai/MessageTracker';
import { messageQueue } from '@/components/ai/MessageQueue';

export default function AdminMessageMonitor() {
  const [trackerStats, setTrackerStats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrackerStats(messageTracker.getStats());
      setQueueStats(messageQueue.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">مراقبة نظام الرسائل</h1>
            <p className="text-slate-600 mt-2">نظام منع التكرار والطابور الذكي</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* إحصائيات MessageTracker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  <Shield className="inline h-4 w-4 ml-2" />
                  الرسائل المستقبلة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {trackerStats?.totalReceived || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  <Shield className="inline h-4 w-4 ml-2 text-red-500" />
                  المكررات المحظورة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {trackerStats?.duplicatesBlocked || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  نسبة التكرار: {trackerStats?.duplicateRate || 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  <Activity className="inline h-4 w-4 ml-2" />
                  حجم الطابور
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {queueStats?.currentQueueSize || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  قيد المعالجة: {queueStats?.processingCount || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  <TrendingUp className="inline h-4 w-4 ml-2 text-green-500" />
                  رسائل مجمعة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {queueStats?.totalAggregated || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* تفاصيل Tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  نظام منع التكرار
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">الرسائل المتتبعة</span>
                  <Badge variant="outline">{trackerStats?.trackedMessages || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">المحتوى المتتبع</span>
                  <Badge variant="outline">{trackerStats?.trackedContent || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-slate-600">آخر تنظيف</span>
                  <span className="text-xs text-slate-500">
                    {trackerStats?.lastCleanup 
                      ? new Date(trackerStats.lastCleanup).toLocaleTimeString('ar')
                      : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* تفاصيل Queue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-600" />
                  الطابور الذكي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">إجمالي المعالجات</span>
                  <Badge variant="outline">{queueStats?.totalProcessed || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">متوسط حجم الطابور</span>
                  <Badge variant="outline">{queueStats?.averageQueueSize || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-slate-600">العملاء النشطين</span>
                  <Badge className="bg-blue-600">{queueStats?.processingCount || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}