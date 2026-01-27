import React, { useState, useEffect, useRef } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Send,
  Power,
  Zap,
  Clock,
  Shield,
  Bot,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { wahaSystem } from '@/components/ai/WAHACompleteSystem';
import { base44 } from '@/api/base44Client';

export default function AdminAIServiceDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [aiChat, setAiChat] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const chatEndRef = useRef(null);

  const [connectionError, setConnectionError] = useState('');
  const [gatewayInfo, setGatewayInfo] = useState(null);

  // تحميل الحالة
  useEffect(() => {
    const loadStatus = async () => {
      try {
        // جلب معلومات البوابة
        const gateways = await base44.entities.WhatsAppGateway.filter(
          { is_active: true },
          '-created_date',
          1
        );
        if (gateways.length > 0) {
          setGatewayInfo(gateways[0]);
        }

        const systemStatus = wahaSystem.getStatus();
        setStatus(systemStatus);

        // اختبار الاتصال
        const connResult = await wahaSystem.testConnection();
        setConnectionStatus(connResult.success ? 'connected' : 'disconnected');
        setConnectionError(connResult.error || '');

        // جلب آخر الرسائل
        const messages = await base44.entities.WhatsAppMessage.list('-created_date', 20);
        setRecentMessages(messages);

      } catch (error) {
        console.error('خطأ:', error);
        setConnectionStatus('error');
        setConnectionError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // إرسال رسالة اختبار
  const sendTestMessage = async () => {
    if (!testPhone || !testMessage) return;
    setSending(true);

    try {
      await wahaSystem.sendText(testPhone, testMessage);
      alert('✅ تم إرسال الرسالة بنجاح!');
      setTestMessage('');
    } catch (error) {
      alert('❌ فشل الإرسال: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  // محادثة مع AI
  const chatWithAI = async () => {
    if (!adminMessage.trim()) return;

    const userMsg = { role: 'user', content: adminMessage, time: new Date() };
    setAiChat(prev => [...prev, userMsg]);
    setAdminMessage('');

    try {
      const result = await wahaSystem.ai.process(adminMessage, 'admin');
      const aiMsg = { role: 'ai', content: result, time: new Date() };
      setAiChat(prev => [...prev, aiMsg]);
    } catch (error) {
      const errMsg = { role: 'ai', content: 'حدث خطأ في المعالجة', time: new Date() };
      setAiChat(prev => [...prev, errMsg]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">جاري تحميل النظام...</p>
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Bot className="h-8 w-8 text-blue-600" />
                لوحة تحكم خدمة العملاء الذكية
              </h1>
              <p className="text-slate-600 mt-2">مراقبة وإدارة النظام</p>
            </div>

            <Badge
              className={`text-lg px-4 py-2 ${
                connectionStatus === 'connected'
                  ? 'bg-green-600'
                  : connectionStatus === 'checking'
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="h-4 w-4 ml-2" />
                  متصل
                </>
              ) : connectionStatus === 'checking' ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  جاري الفحص
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 ml-2" />
                  غير متصل
                </>
              )}
            </Badge>
          </div>

          {/* معلومات الاتصال */}
          {connectionError && (
            <Alert className="mb-6 border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <strong>خطأ في الاتصال:</strong> {connectionError}
                <br />
                <span className="text-sm">
                  URL: {gatewayInfo?.waha_server_url || status?.config?.wahaUrl}
                  <br />
                  API Key: {gatewayInfo?.waha_api_key?.substring(0, 10)}...
                </span>
              </AlertDescription>
            </Alert>
          )}

          {gatewayInfo && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 font-medium">الخادم:</span>
                    <p className="truncate">{gatewayInfo.waha_server_url}</p>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">الجلسة:</span>
                    <p>{gatewayInfo.session_id || 'default'}</p>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">API Key:</span>
                    <p>{gatewayInfo.waha_api_key?.substring(0, 10)}...</p>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Webhook:</span>
                    <p className="truncate text-xs">{gatewayInfo.webhook_url}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* بطاقات الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-3xl font-bold text-blue-900">
                    {(status?.poller?.received || 0) + (status?.webhook?.received || 0)}
                  </div>
                  <p className="text-sm text-blue-700">رسائل واردة</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-3xl font-bold text-green-900">
                    {(status?.poller?.processed || 0) + (status?.webhook?.processed || 0)}
                  </div>
                  <p className="text-sm text-green-700">تمت معالجتها</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-3xl font-bold text-orange-900">
                    {status?.webhook?.duplicates || 0}
                  </div>
                  <p className="text-sm text-orange-700">مكررة (تم حظرها)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  <div className="text-3xl font-bold text-red-900">
                    {(status?.poller?.errors || 0) + (status?.webhook?.errors || 0)}
                  </div>
                  <p className="text-sm text-red-700">أخطاء</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="monitor" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="monitor">📊 المراقبة</TabsTrigger>
              <TabsTrigger value="test">🧪 الاختبار</TabsTrigger>
              <TabsTrigger value="ai-chat">💬 محادثة AI</TabsTrigger>
              <TabsTrigger value="messages">📨 الرسائل</TabsTrigger>
            </TabsList>

            {/* تبويب المراقبة */}
            <TabsContent value="monitor">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* حالة النظام */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      حالة النظام
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">حالة الاتصال</span>
                        <Badge className={connectionStatus === 'connected' ? 'bg-green-600' : 'bg-red-600'}>
                          {connectionStatus === 'connected' ? '✅ متصل' : '❌ منقطع'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">وقت التشغيل</span>
                        <span className="text-slate-600">
                          {Math.floor((status?.uptime || 0) / 60)} دقيقة
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">الوضع</span>
                        <Badge className="bg-blue-600">
                          {status?.mode === 'polling' ? '🔄 سحب تلقائي' : status?.mode === 'websocket' ? '🔌 WebSocket' : '🎯 Webhook'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">Dedup Cache</span>
                        <Badge variant="outline">
                          {status?.dedup?.processed || 0} رسالة
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* التنبيهات */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      التنبيهات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {status?.alerts?.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {status.alerts.map((alert, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded border ${
                              alert.severity === 'critical'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-yellow-50 border-yellow-200'
                            }`}
                          >
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(alert.timestamp).toLocaleTimeString('ar')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>لا توجد تنبيهات</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* تبويب الاختبار */}
            <TabsContent value="test">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-600" />
                    إرسال رسالة اختبار
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        رقم الهاتف (بدون +)
                      </label>
                      <Input
                        placeholder="966500000000"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        نص الرسالة
                      </label>
                      <Textarea
                        placeholder="اكتب رسالتك هنا..."
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <Button
                      onClick={sendTestMessage}
                      disabled={sending || !testPhone || !testMessage}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {sending ? (
                        <>
                          <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                          جاري الإرسال...
                        </>
                      ) : (
                        <>
                          <Send className="ml-2 h-4 w-4" />
                          إرسال
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* تبويب محادثة AI */}
            <TabsContent value="ai-chat">
              <Card className="h-[500px] flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-600" />
                    محادثة مع الذكاء الاصطناعي
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto mb-4 space-y-3 p-4 bg-slate-50 rounded-lg">
                    {aiChat.length === 0 ? (
                      <div className="text-center text-slate-500 py-8">
                        ابدأ المحادثة مع الذكاء الاصطناعي...
                      </div>
                    ) : (
                      aiChat.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${
                            msg.role === 'user' ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {msg.role === 'user' ? (
                                <User className="h-4 w-4" />
                              ) : (
                                <Bot className="h-4 w-4 text-purple-600" />
                              )}
                              <span className="text-xs opacity-75">
                                {msg.role === 'user' ? 'أنت' : 'AI'}
                              </span>
                            </div>
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="اكتب رسالتك..."
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && chatWithAI()}
                    />
                    <Button onClick={chatWithAI} className="bg-purple-600">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* تبويب الرسائل */}
            <TabsContent value="messages">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    آخر الرسائل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {recentMessages.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        لا توجد رسائل حتى الآن
                      </div>
                    ) : (
                      recentMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg border ${
                            msg.direction === 'incoming'
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-green-50 border-green-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">
                              {msg.direction === 'incoming' ? '📥 وارد' : '📤 صادر'}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {new Date(msg.created_date).toLocaleString('ar')}
                            </span>
                          </div>
                          <p className="text-sm">
                            <strong>
                              {msg.direction === 'incoming' ? 'من: ' : 'إلى: '}
                            </strong>
                            {msg.from_number || msg.to_number}
                          </p>
                          <p className="text-sm mt-1">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}