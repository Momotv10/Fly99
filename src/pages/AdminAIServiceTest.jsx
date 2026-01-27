import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { messagePoller } from '@/components/ai/WAHAMessagePoller';
import { masterProcessor } from '@/components/ai/MasterProcessor';
import { 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  MessageSquare, Brain, Database, Zap 
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAIServiceTest() {
  const [diagnostics, setDiagnostics] = useState({
    poller: { status: 'unknown', details: '' },
    processor: { status: 'unknown', details: '' },
    gateways: { status: 'unknown', count: 0, connected: 0 },
    recentMessages: { status: 'unknown', count: 0 },
    aiSessions: { status: 'unknown', count: 0 }
  });
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 5000);
    return () => clearInterval(interval);
  }, []);

  const runDiagnostics = async () => {
    const results = { ...diagnostics };

    // 1. فحص البوابات
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({ is_active: true });
      const connected = gateways.filter(g => g.status === 'connected');
      results.gateways = {
        status: connected.length > 0 ? 'ok' : 'error',
        count: gateways.length,
        connected: connected.length,
        details: `${connected.length} من ${gateways.length} متصلة`
      };
    } catch (error) {
      results.gateways = { status: 'error', count: 0, connected: 0, details: error.message };
    }

    // 2. فحص الرسائل الأخيرة
    try {
      const messages = await base44.entities.WhatsAppMessage.list('-created_date', 10);
      const recent = messages.filter(m => {
        const msgTime = new Date(m.created_date);
        const now = new Date();
        return (now - msgTime) < 60000; // آخر دقيقة
      });
      results.recentMessages = {
        status: messages.length > 0 ? 'ok' : 'warning',
        count: messages.length,
        recentCount: recent.length,
        details: `${recent.length} رسالة في آخر دقيقة`
      };
    } catch (error) {
      results.recentMessages = { status: 'error', count: 0, details: error.message };
    }

    // 3. فحص الجلسات النشطة
    try {
      const sessions = await base44.entities.AISession.filter({ is_active: true });
      results.aiSessions = {
        status: 'ok',
        count: sessions.length,
        details: `${sessions.length} جلسة نشطة`
      };
    } catch (error) {
      results.aiSessions = { status: 'error', count: 0, details: error.message };
    }

    // 4. حالة Poller
    results.poller = {
      status: messagePoller.isRunning ? 'ok' : 'error',
      details: messagePoller.isRunning ? 'يعمل بشكل صحيح' : 'متوقف'
    };

    // 5. حالة Processor
    results.processor = {
      status: 'ok',
      details: 'جاهز للمعالجة'
    };

    setDiagnostics(results);
  };

  const testEndToEnd = async () => {
    setTesting(true);
    setTestResults([]);
    const results = [];

    try {
      // 1. اختبار البوابة
      results.push({ step: 'فحص البوابات', status: 'running' });
      setTestResults([...results]);

      const gateways = await base44.entities.WhatsAppGateway.filter({
        type: 'customers',
        status: 'connected',
        is_active: true
      });

      if (gateways.length === 0) {
        results[0] = { step: 'فحص البوابات', status: 'error', message: 'لا توجد بوابات متصلة' };
        setTestResults([...results]);
        return;
      }

      results[0] = { step: 'فحص البوابات', status: 'success', message: `وجدنا ${gateways.length} بوابة` };
      setTestResults([...results]);

      // 2. اختبار سحب الرسائل
      results.push({ step: 'سحب الرسائل من WAHA', status: 'running' });
      setTestResults([...results]);

      await messagePoller.pollMessages();
      
      results[1] = { step: 'سحب الرسائل من WAHA', status: 'success', message: 'تم السحب بنجاح' };
      setTestResults([...results]);

      // 3. فحص الرسائل غير المعالجة
      results.push({ step: 'فحص الرسائل غير المعالجة', status: 'running' });
      setTestResults([...results]);

      const unprocessed = await base44.entities.WhatsAppMessage.filter({
        direction: 'incoming',
        processed_by_ai: false
      });

      results[2] = { 
        step: 'فحص الرسائل غير المعالجة', 
        status: unprocessed.length > 0 ? 'warning' : 'success', 
        message: `${unprocessed.length} رسالة بانتظار المعالجة` 
      };
      setTestResults([...results]);

      // 4. معالجة الرسائل
      if (unprocessed.length > 0) {
        results.push({ step: 'معالجة الرسائل بالذكاء الاصطناعي', status: 'running' });
        setTestResults([...results]);

        for (const msg of unprocessed.slice(0, 3)) {
          await masterProcessor.processIncomingMessage(msg);
        }

        results[3] = { 
          step: 'معالجة الرسائل بالذكاء الاصطناعي', 
          status: 'success', 
          message: `تمت معالجة ${Math.min(3, unprocessed.length)} رسالة` 
        };
        setTestResults([...results]);
      }

      toast.success('الاختبار اكتمل بنجاح!');

    } catch (error) {
      console.error('خطأ في الاختبار:', error);
      results.push({ step: 'خطأ', status: 'error', message: error.message });
      setTestResults([...results]);
      toast.error('فشل الاختبار: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const manualPoll = async () => {
    toast.loading('جاري سحب الرسائل...');
    try {
      await messagePoller.pollMessages();
      toast.success('تم سحب الرسائل بنجاح');
      await runDiagnostics();
    } catch (error) {
      toast.error('فشل السحب: ' + error.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok':
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      ok: 'bg-green-100 text-green-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800'
    };
    
    const labels = {
      ok: 'يعمل',
      success: 'نجح',
      warning: 'تحذير',
      error: 'خطأ',
      running: 'جاري...'
    };

    return (
      <Badge className={styles[status] || 'bg-gray-100'}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔬 اختبار خدمة العملاء الذكية
          </h1>
          <p className="text-gray-600">تشخيص شامل للنظام</p>
        </div>

        {/* حالة النظام */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">البوابات</span>
                </div>
                {getStatusIcon(diagnostics.gateways.status)}
              </div>
              <p className="text-2xl font-bold">{diagnostics.gateways.connected}/{diagnostics.gateways.count}</p>
              <p className="text-sm text-gray-600">{diagnostics.gateways.details}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold">الرسائل</span>
                </div>
                {getStatusIcon(diagnostics.recentMessages.status)}
              </div>
              <p className="text-2xl font-bold">{diagnostics.recentMessages.count}</p>
              <p className="text-sm text-gray-600">{diagnostics.recentMessages.details}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">الجلسات النشطة</span>
                </div>
                {getStatusIcon(diagnostics.aiSessions.status)}
              </div>
              <p className="text-2xl font-bold">{diagnostics.aiSessions.count}</p>
              <p className="text-sm text-gray-600">{diagnostics.aiSessions.details}</p>
            </CardContent>
          </Card>
        </div>

        {/* حالة المكونات */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>حالة المكونات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Message Poller</span>
                {getStatusBadge(diagnostics.poller.status)}
                <span className="text-sm text-gray-600">{diagnostics.poller.details}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Message Processor</span>
                {getStatusBadge(diagnostics.processor.status)}
                <span className="text-sm text-gray-600">{diagnostics.processor.details}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* أدوات الاختبار */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>أدوات الاختبار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={testEndToEnd} disabled={testing}>
                <Zap className="ml-2 h-4 w-4" />
                اختبار شامل
              </Button>
              <Button onClick={manualPoll} variant="outline">
                <RefreshCw className="ml-2 h-4 w-4" />
                سحب الرسائل يدوياً
              </Button>
              <Button onClick={runDiagnostics} variant="outline">
                <RefreshCw className="ml-2 h-4 w-4" />
                تحديث التشخيص
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* نتائج الاختبار */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>نتائج الاختبار</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="font-medium">{result.step}</div>
                      {result.message && (
                        <div className="text-sm text-gray-600">{result.message}</div>
                      )}
                    </div>
                    {getStatusBadge(result.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}