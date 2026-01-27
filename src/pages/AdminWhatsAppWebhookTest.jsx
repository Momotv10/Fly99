import React, { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { webhookSetupManager } from '@/components/ai/WebhookSetupManager';
import { webhookHandler } from '@/components/ai/WebhookHandler';
import { base44 } from '@/api/base44Client';

export default function AdminWhatsAppWebhookTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [gatewayStatus, setGatewayStatus] = useState([]);
  const [stats, setStats] = useState(null);

  const handleTestAllWebhooks = async () => {
    setTesting(true);
    setResults([]);

    try {
      console.log('🧪 اختبار جميع Webhooks...\n');

      // 1. اختبار الـ Webhook URL
      console.log('📋 1. اختبار Webhook URL');
      const urlTest = await webhookSetupManager.testWebhook();
      setResults(prev => [...prev, {
        name: 'Webhook URL',
        status: urlTest ? 'success' : 'failed',
        message: urlTest ? '✅ الـ Webhook يستقبل الرسائل' : '❌ الـ Webhook لا يستجيب'
      }]);

      // 2. جلب البوابات
      console.log('📋 2. جلب البوابات');
      const gateways = await base44.entities.WhatsAppGateway.filter({
        is_active: true
      });

      const gatewayChecks = [];
      for (const gateway of gateways || []) {
        try {
          gatewayChecks.push({
            name: gateway.name,
            status: gateway.status,
            connected: gateway.status === 'connected',
            webhook: gateway.webhook_url ? '✅' : '❌'
          });
        } catch (e) {
          gatewayChecks.push({
            name: gateway.name,
            status: 'error',
            error: e.message
          });
        }
      }
      setGatewayStatus(gatewayChecks);

      // 3. إعداد Webhooks
      console.log('📋 3. إعداد Webhooks');
      const setupResults = await webhookSetupManager.setupAllWebhooks();
      setResults(prev => [...prev, {
        name: 'Webhook Setup',
        status: setupResults.length > 0 ? 'success' : 'failed',
        message: `تم إعداد ${setupResults.length} بوابة`
      }]);

      // 4. معلومات الخدمة
      console.log('📋 4. معلومات الخدمة');
      const serviceStats = webhookHandler.getStats();
      setStats(serviceStats);
      setResults(prev => [...prev, {
        name: 'Service Status',
        status: 'success',
        message: `الخدمة جاهزة - Queue: ${serviceStats.queueSize}`
      }]);

      console.log('✅ اكتمل الاختبار');

    } catch (error) {
      console.error('❌ خطأ:', error);
      setResults(prev => [...prev, {
        name: 'Error',
        status: 'failed',
        message: error.message
      }]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />

      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">🧪 اختبار Webhook</h1>
            <p className="text-slate-600 mt-2">اختبار شامل لاتصال Waha والخدمة</p>
          </div>

          {/* زر الاختبار */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Button
                onClick={handleTestAllWebhooks}
                disabled={testing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
              >
                {testing ? (
                  <>
                    <RefreshCw className="ml-2 h-5 w-5 animate-spin" />
                    جاري الاختبار...
                  </>
                ) : (
                  <>
                    <PlayCircle className="ml-2 h-5 w-5" />
                    بدء الاختبار الشامل
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* نتائج الاختبار */}
          {results.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>نتائج الاختبار</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((result, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <span className="font-medium">{result.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">{result.message}</span>
                        <Badge className={result.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                          {result.status === 'success' ? '✅' : '❌'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* حالة البوابات */}
          {gatewayStatus.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>حالة البوابات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gatewayStatus.map((gateway, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div>
                        <p className="font-medium">{gateway.name}</p>
                        <p className="text-xs text-slate-500">Status: {gateway.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={gateway.connected ? 'bg-green-600' : 'bg-orange-600'}>
                          {gateway.connected ? 'متصلة' : 'منقطعة'}
                        </Badge>
                        <span className="text-lg">{gateway.webhook}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* معلومات الخدمة */}
          {stats && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  الخدمة جاهزة 100%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.queueSize}</div>
                    <p className="text-sm text-slate-600">في الطابور</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.processing ? 'نعم' : 'لا'}</div>
                    <p className="text-sm text-slate-600">قيد المعالجة</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.dedup.inMemory}</div>
                    <p className="text-sm text-slate-600">معرفات مخزنة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}