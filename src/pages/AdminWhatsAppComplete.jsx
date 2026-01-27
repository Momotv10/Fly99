import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, Plus, Info, ExternalLink, CheckCircle2,
  FileText, History, Settings, Globe, RefreshCw, XCircle, Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import WhatsAppConnect from '@/components/whatsapp/WhatsAppConnect';
import MessageTemplates from '@/components/whatsapp/MessageTemplates';
import WhatsAppConversations from '@/components/whatsapp/WhatsAppConversations';
import { WAHAClient } from '@/components/whatsapp/WAHAClient';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminWhatsAppComplete() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('gateways');
  const [gateways, setGateways] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionOk, setConnectionOk] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'customers',
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadGateways();
    testWAHAConnection();
  }, []);

  const testWAHAConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch('https://waha.yemencode.info/api/sessions/', {
        headers: { 'X-Api-Key': 'baaa4cf6482c4493858638795f3b478f' }
      });
      setConnectionOk(res.ok);
    } catch (e) {
      setConnectionOk(false);
    }
    setTestingConnection(false);
  };

  const loadGateways = async () => {
    const data = await base44.entities.WhatsAppGateway.list();
    setGateways(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await base44.entities.WhatsAppGateway.create({
      ...formData,
      status: 'disconnected',
      messages_sent: 0,
      messages_received: 0
    });
    
    toast.success('تم إنشاء البوابة بنجاح');
    setDialogOpen(false);
    resetForm();
    loadGateways();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'customers',
      is_default: false,
      is_active: true
    });
  };

  const typeLabels = {
    customers: { name: 'العملاء', desc: 'لإرسال التذاكر والإشعارات' },
    providers: { name: 'المزودين', desc: 'للتواصل الذكي مع المزودين' },
    employees: { name: 'الموظفين', desc: 'للتواصل الداخلي' }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-green-600" />
            بوابة الواتساب
          </h1>
          <p className="text-slate-600">إدارة اتصالات واتساب باستخدام WAHA</p>
        </div>

        {/* حالة الاتصال بـ WAHA */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              حالة خادم WAHA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testingConnection ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الاتصال بخادم WAHA...</span>
              </div>
            ) : connectionOk === true ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>متصل بنجاح!</strong> خادم WAHA يعمل بشكل صحيح
                </AlertDescription>
              </Alert>
            ) : connectionOk === false ? (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>فشل الاتصال!</strong> تأكد من أن خادم WAHA يعمل
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-sm">
              <div>
                <Label className="text-slate-500">رابط الخادم</Label>
                <p className="font-mono" dir="ltr">https://waha.yemencode.info/api</p>
              </div>
              <div>
                <Label className="text-slate-500">API Key</Label>
                <p className="font-mono text-xs" dir="ltr">baaa4cf6...3b478f</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={testWAHAConnection}
                disabled={testingConnection}
              >
                <RefreshCw className="h-4 w-4 ml-1" />
                اختبار الاتصال
              </Button>
              <a 
                href="https://waha.devlike.pro/docs/overview/quick-start/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 ml-1" />
                  دليل WAHA
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              البوابات
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              قوالب الرسائل
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              المحادثات
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              الإعدادات المتقدمة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gateways">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">بوابات الواتساب</h2>
                  <p className="text-slate-600">إدارة أرقام الواتساب المتصلة بالنظام</p>
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة بوابة جديدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة بوابة واتساب</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>اسم البوابة *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="مثال: بوابة العملاء الرئيسية"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label>نوع البوابة *</Label>
                        <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(typeLabels).map(([key, info]) => (
                              <SelectItem key={key} value={key}>
                                <div>
                                  <p className="font-semibold">{info.name}</p>
                                  <p className="text-xs text-slate-500">{info.desc}</p>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded">
                        <Switch
                          checked={formData.is_default}
                          onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                        />
                        <Label>جعلها البوابة الافتراضية لهذا النوع</Label>
                      </div>
                      
                      <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit" className="bg-green-600 hover:bg-green-700">
                          إنشاء البوابة
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* قائمة البوابات */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {gateways.map((gateway) => (
                  <Card key={gateway.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{gateway.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {typeLabels[gateway.type]?.name}
                            </Badge>
                            {gateway.is_default && (
                              <Badge className="bg-blue-500">افتراضي</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <WhatsAppConnect gateway={gateway} onUpdate={loadGateways} />
                      
                      {gateway.phone_number && (
                        <div className="pt-3 border-t">
                          <Label className="text-slate-500 text-xs">الرقم المتصل</Label>
                          <p className="font-mono text-sm" dir="ltr">{gateway.phone_number}</p>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-xs text-slate-500 pt-2 border-t">
                        <div className="text-center">
                          <p className="font-semibold text-green-600">{gateway.messages_sent || 0}</p>
                          <p>مرسلة</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-blue-600">{gateway.messages_received || 0}</p>
                          <p>مستلمة</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {gateways.length === 0 && (
                <Card className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">لا توجد بوابات واتساب</h3>
                  <p className="text-slate-500 mb-4">أضف بوابة جديدة للبدء</p>
                  <Button onClick={() => setDialogOpen(true)} className="bg-green-600">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة أول بوابة
                  </Button>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="templates">
            <MessageTemplates />
          </TabsContent>
          
          <TabsContent value="conversations">
            <WhatsAppConversations />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات WAHA المتقدمة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">معلومات الخادم الحالي:</p>
                    <div className="space-y-1 text-sm">
                      <p>• <strong>الرابط:</strong> <code dir="ltr">https://waha.yemencode.info/api</code></p>
                      <p>• <strong>API Key:</strong> <code dir="ltr">baaa4cf6482c4493858638795f3b478f</code></p>
                      <p>• <strong>الحالة:</strong> {connectionOk ? '✅ متصل' : '❌ غير متصل'}</p>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold mb-3">كيفية الإعداد والاستخدام</h3>
                  <ol className="list-decimal mr-5 space-y-2 text-sm">
                    <li>
                      <strong>إنشاء بوابة:</strong> اضغط على "إضافة بوابة" وحدد النوع (عملاء/مزودين/موظفين)
                    </li>
                    <li>
                      <strong>الاتصال:</strong> اضغط على زر "اتصال الآن" في البوابة
                    </li>
                    <li>
                      <strong>مسح QR:</strong> سيظهر رمز QR تلقائياً - امسحه بواتساب من هاتفك
                    </li>
                    <li>
                      <strong>التأكد:</strong> ستتحول الحالة إلى "متصل" خلال ثوانٍ
                    </li>
                    <li>
                      <strong>الاستخدام:</strong> النظام الآن جاهز لإرسال واستقبال الرسائل
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold mb-3">استخدام الذكاء الاصطناعي مع الواتساب</h3>
                  <p className="text-sm mb-3">
                    بوابة "المزودين" ستستخدم للتواصل الذكي التلقائي:
                  </p>
                  <ul className="list-disc mr-5 space-y-1 text-sm">
                    <li>طلب المقاعد من المزودين تلقائياً</li>
                    <li>معالجة ردود المزودين وتحليلها</li>
                    <li>إنشاء المقاعد تلقائياً بعد التأكيد</li>
                    <li>معالجة أوامر المزودين (إيقاف/تفعيل/تعديل)</li>
                  </ul>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold mb-3">إرسال التذاكر للعملاء</h3>
                  <p className="text-sm">
                    بوابة "العملاء" ستستخدم لإرسال:
                  </p>
                  <ul className="list-disc mr-5 space-y-1 text-sm mt-2">
                    <li>تأكيد الحجز</li>
                    <li>التذاكر الصادرة (PDF)</li>
                    <li>تذكير بموعد السفر</li>
                    <li>إشعارات التحديثات</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <a 
                    href="https://waha.devlike.pro/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    وثائق WAHA الرسمية
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}