import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  MessageSquare, Send, Settings, Phone, CheckCircle2, 
  XCircle, Clock, ArrowUpRight, ArrowDownLeft, Wifi, WifiOff
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminMessaging() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [settings, setSettings] = useState({
    whatsapp_number: '',
    whatsapp_connected: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [messagesData, settingsData] = await Promise.all([
      base44.entities.WhatsAppMessage.list('-created_date', 100),
      base44.entities.SystemSettings.filter({ setting_key: 'whatsapp_number' })
    ]);
    
    setMessages(messagesData);
    if (settingsData.length > 0) {
      setSettings(prev => ({ ...prev, whatsapp_number: settingsData[0].setting_value }));
    }
    setLoading(false);
  };

  const handleSaveWhatsApp = async () => {
    const existing = await base44.entities.SystemSettings.filter({ setting_key: 'whatsapp_number' });
    if (existing.length > 0) {
      await base44.entities.SystemSettings.update(existing[0].id, { setting_value: settings.whatsapp_number });
    } else {
      await base44.entities.SystemSettings.create({
        setting_key: 'whatsapp_number',
        setting_value: settings.whatsapp_number,
        setting_type: 'communication'
      });
    }
    toast.success('تم حفظ رقم الواتساب');
  };

  const statusConfig = {
    sent: { label: 'مرسلة', color: 'bg-blue-100 text-blue-700', icon: Send },
    delivered: { label: 'وصلت', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    read: { label: 'مقروءة', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    failed: { label: 'فشلت', color: 'bg-red-100 text-red-700', icon: XCircle },
    received: { label: 'واردة', color: 'bg-purple-100 text-purple-700', icon: ArrowDownLeft },
    processed: { label: 'معالجة', color: 'bg-amber-100 text-amber-700', icon: CheckCircle2 }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">بوابة الرسائل الذكية</h1>
          <p className="text-slate-600">إدارة رسائل الواتساب والإشعارات</p>
        </div>

        <Tabs defaultValue="messages" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-xl shadow-sm">
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              الرسائل
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              إعدادات الاتصال
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Send className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {messages.filter(m => m.direction === 'outgoing').length}
                    </p>
                    <p className="text-sm text-slate-500">رسائل صادرة</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <ArrowDownLeft className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {messages.filter(m => m.direction === 'incoming').length}
                    </p>
                    <p className="text-sm text-slate-500">رسائل واردة</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {messages.filter(m => m.processed).length}
                    </p>
                    <p className="text-sm text-slate-500">معالجة</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-xl">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {messages.filter(m => m.status === 'failed').length}
                    </p>
                    <p className="text-sm text-slate-500">فاشلة</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>سجل الرسائل</CardTitle>
                <CardDescription>جميع الرسائل الواردة والصادرة</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاتجاه</TableHead>
                      <TableHead>الرقم</TableHead>
                      <TableHead>المحتوى</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => {
                      const status = statusConfig[message.status] || statusConfig.sent;
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow key={message.id}>
                          <TableCell>
                            <div className={`p-2 rounded-lg w-fit ${
                              message.direction === 'incoming' ? 'bg-purple-100' : 'bg-blue-100'
                            }`}>
                              {message.direction === 'incoming' ? (
                                <ArrowDownLeft className="h-4 w-4 text-purple-600" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span dir="ltr" className="text-sm font-mono">
                              {message.direction === 'incoming' ? message.from_number : message.to_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-xs truncate text-sm">{message.content}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {message.message_type === 'text' ? 'نص' :
                               message.message_type === 'image' ? 'صورة' :
                               message.message_type === 'document' ? 'مستند' : 'قالب'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 ml-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {message.created_date && format(new Date(message.created_date), 'dd MMM HH:mm', { locale: ar })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {messages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          لا توجد رسائل
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    إعدادات الواتساب
                  </CardTitle>
                  <CardDescription>ربط رقم واتساب بيزنس للإشعارات</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <MessageSquare className="h-4 w-4" />
                    <AlertDescription>
                      لربط رقم الواتساب، يجب أن يكون لديك حساب WhatsApp Business API
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label>رقم الواتساب</Label>
                    <Input
                      value={settings.whatsapp_number}
                      onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                      placeholder="+966xxxxxxxxx"
                      dir="ltr"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      {settings.whatsapp_connected ? (
                        <Wifi className="h-5 w-5 text-green-600" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-red-600" />
                      )}
                      <span>حالة الاتصال</span>
                    </div>
                    <Badge className={settings.whatsapp_connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {settings.whatsapp_connected ? 'متصل' : 'غير متصل'}
                    </Badge>
                  </div>

                  <Button onClick={handleSaveWhatsApp} className="w-full">
                    حفظ الإعدادات
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>قوالب الرسائل</CardTitle>
                  <CardDescription>قوالب الرسائل المستخدمة في الإشعارات</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-xl">
                    <h4 className="font-semibold mb-2">رسالة تأكيد الحجز</h4>
                    <p className="text-sm text-slate-600">
                      مرحباً {'{customer_name}'}، تم تأكيد حجزك رقم {'{booking_number}'} بنجاح.
                      الرحلة: {'{flight_number}'} من {'{departure}'} إلى {'{arrival}'}
                    </p>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <h4 className="font-semibold mb-2">طلب إصدار للموظف</h4>
                    <p className="text-sm text-slate-600">
                      طلب إصدار جديد 🎫
                      رقم الحجز: {'{booking_number}'}
                      العميل: {'{customer_name}'}
                      الهاتف: {'{customer_phone}'}
                      الرحلة: {'{flight_details}'}
                    </p>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <h4 className="font-semibold mb-2">رسالة إصدار التذكرة</h4>
                    <p className="text-sm text-slate-600">
                      تم إصدار تذكرتك ✅
                      رقم الحجز: {'{booking_number}'}
                      رقم التذكرة: {'{ticket_number}'}
                      مرفق ملف التذكرة
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}