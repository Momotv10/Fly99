import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { wahaSystem } from '@/components/ai/WAHAIntegratedSystem';

export default function AdminWAHADashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const systemStatus = wahaSystem.getStatus();
        setStatus(systemStatus);
      } catch (error) {
        console.error('خطأ:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 5000); // تحديث كل 5 ثوانٍ

    return () => clearInterval(interval);
  }, []);

  const runTests = async () => {
    setLoading(true);
    try {
      const results = await wahaSystem.runDiagnostics();
      setDiagnostics(results);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !status) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />

      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          {/* الرأس */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              🎮 لوحة تحكم WAHA
            </h1>
            <p className="text-slate-600 mt-2">نظام متكامل للخدمة الذكية</p>
          </div>

          {/* حالة النظام */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>حالة النظام</span>
                <Badge
                  className={
                    status.healthy ? 'bg-green-600' : 'bg-red-600'
                  }
                >
                  {status.healthy ? '🟢 سليم' : '🔴 خطأ'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{status.monitor?.status}</p>
            </CardContent>
          </Card>

          {/* الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-3xl font-bold">
                    {status.monitor?.messagesReceived}
                  </div>
                  <p className="text-sm text-slate-600">رسائل واردة</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-3xl font-bold">
                    {status.monitor?.messagesProcessed}
                  </div>
                  <p className="text-sm text-slate-600">معالجة</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-3xl font-bold">
                    {status.monitor?.messagesSent}
                  </div>
                  <p className="text-sm text-slate-600">مرسلة</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  <div className="text-3xl font-bold">
                    {status.monitor?.errors}
                  </div>
                  <p className="text-sm text-slate-600">أخطاء</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* معلومات التشغيل */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>معلومات التشغيل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-600">نسبة النجاح</p>
                  <p className="text-lg font-bold">
                    {status.monitor?.successRate}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">وقت التشغيل</p>
                  <p className="text-lg font-bold">
                    {Math.floor(status.monitor?.uptime / 60)}د
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">حجم الطابور</p>
                  <p className="text-lg font-bold">
                    {status.queue?.queueSize}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* الاختبارات */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>الاختبارات التشخيصية</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={runTests} className="w-full bg-blue-600 mb-4">
                <RefreshCw className="ml-2 h-4 w-4" />
                تشغيل الاختبارات
              </Button>

              {diagnostics && (
                <div className="space-y-2">
                  {Object.entries(diagnostics).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded"
                    >
                      <span className="font-medium capitalize">{key}</span>
                      <Badge
                        className={
                          value ? 'bg-green-600' : 'bg-red-600'
                        }
                      >
                        {value ? '✅' : '❌'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* التنبيهات */}
          {status.alerts && status.alerts.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-700">
                  ⚠️ التنبيهات الأخيرة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {status.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="p-2 bg-white rounded border border-orange-200"
                    >
                      <p className="text-sm font-medium text-orange-700">
                        {alert.error}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(alert.timestamp).toLocaleTimeString('ar')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* نقاط التفتيش */}
          <Card className="mt-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-700 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                نقاط التفتيش (Checkpoints)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {status.checkpoints?.map((cp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-white rounded"
                  >
                    <div>
                      <p className="font-medium text-sm">{cp.component}</p>
                      <p className="text-xs text-slate-500">
                        {cp.description}
                      </p>
                    </div>
                    <Badge
                      className={
                        cp.protected ? 'bg-red-600' : 'bg-blue-600'
                      }
                    >
                      {cp.protected ? '🔒' : '📝'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}