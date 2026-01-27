import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Plus, Info, ExternalLink, FileText, History, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import GatewayForm from '@/components/whatsapp/GatewayForm';
import GatewayCard from '@/components/whatsapp/GatewayCard';
import QuickTestPanel from '@/components/whatsapp/QuickTestPanel';
import MessageTemplates from '@/components/whatsapp/MessageTemplates';
import WhatsAppConversations from '@/components/whatsapp/WhatsAppConversations';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminWhatsAppGateways() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('gateways');
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadGateways();
  }, []);

  const loadGateways = async () => {
    setLoading(true);
    const data = await base44.entities.WhatsAppGateway.list();
    setGateways(data);
    setLoading(false);
  };

  const handleSave = async (formData) => {
    try {
      if (editingGateway) {
        await base44.entities.WhatsAppGateway.update(editingGateway.id, formData);
        toast.success('✅ تم تحديث البوابة بنجاح');
      } else {
        await base44.entities.WhatsAppGateway.create({
          ...formData,
          status: 'disconnected',
          messages_sent: 0,
          messages_received: 0
        });
        toast.success('✅ تم إنشاء البوابة بنجاح');
      }
      
      setDialogOpen(false);
      setEditingGateway(null);
      loadGateways();
    } catch (error) {
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const handleEdit = (gateway) => {
    setEditingGateway(gateway);
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.WhatsAppGateway.delete(id);
      toast.success('تم حذف البوابة');
      loadGateways();
    } catch (error) {
      toast.error('حدث خطأ في الحذف');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGateway(null);
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-green-600" />
            إدارة بوابات الواتساب
          </h1>
          <p className="text-slate-600">نظام متعدد البوابات مع خوادم WAHA مستقلة</p>
        </div>

        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <p className="font-semibold text-blue-900 mb-1">💡 نظام بوابات متعددة</p>
            <p className="text-sm text-blue-800">
              يمكنك إنشاء بوابات متعددة، كل بوابة تتصل بخادم WAHA مستقل خاص بها. 
              هذا يسمح لك بإدارة أرقام واتساب مختلفة للعملاء والمزودين والموظفين بشكل منفصل ومنظم.
            </p>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              البوابات ({gateways.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              قوالب الرسائل
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              المحادثات
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              دليل الاستخدام
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gateways">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">بوابات الواتساب النشطة</h2>
                  <p className="text-slate-600 text-sm">
                    {gateways.length === 0 ? 'لا توجد بوابات' : `${gateways.length} بوابة`}
                  </p>
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={(open) => { 
                  setDialogOpen(open); 
                  if (!open) setEditingGateway(null); 
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة بوابة جديدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingGateway ? 'تعديل البوابة' : 'إضافة بوابة واتساب جديدة'}
                      </DialogTitle>
                    </DialogHeader>
                    <GatewayForm 
                      gateway={editingGateway}
                      onSave={handleSave}
                      onCancel={handleCloseDialog}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <Card className="p-12 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-500">جاري التحميل...</p>
                </Card>
              ) : (
                <>
                  {gateways.length > 0 && (
                    <div className="mb-6">
                      <QuickTestPanel gateways={gateways} />
                    </div>
                  )}
                  
                  {gateways.length === 0 ? (
                <Card className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">لا توجد بوابات واتساب</h3>
                  <p className="text-slate-500 mb-4">أضف بوابة جديدة للبدء في استخدام خدمات الواتساب</p>
                  <Button onClick={() => setDialogOpen(true)} className="bg-green-600">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة أول بوابة
                  </Button>
                </Card>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {gateways.map((gateway) => (
                        <GatewayCard
                          key={gateway.id}
                          gateway={gateway}
                          onUpdate={loadGateways}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="templates">
            <MessageTemplates />
          </TabsContent>
          
          <TabsContent value="conversations">
            <WhatsAppConversations />
          </TabsContent>

          <TabsContent value="guide">
            <Card>
              <CardHeader>
                <CardTitle>دليل استخدام نظام البوابات المتعددة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold mb-3 text-green-900">🚀 كيفية البدء</h3>
                  <ol className="list-decimal mr-5 space-y-2 text-sm">
                    <li>
                      <strong>إنشاء بوابة جديدة:</strong> اضغط على "إضافة بوابة جديدة"
                    </li>
                    <li>
                      <strong>أدخل المعلومات:</strong> حدد الاسم، النوع، رابط خادم WAHA، ومفتاح API
                    </li>
                    <li>
                      <strong>اختبر الاتصال:</strong> اضغط "اختبار الاتصال" للتأكد من صحة البيانات
                    </li>
                    <li>
                      <strong>احفظ البوابة:</strong> بعد نجاح الاختبار يمكنك الحفظ
                    </li>
                    <li>
                      <strong>اتصل بالواتساب:</strong> اضغط "اتصال" وامسح QR من هاتفك
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold mb-3 text-purple-900">🎯 أنواع البوابات</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold">🟦 بوابة العملاء</p>
                      <p className="text-slate-600">لإرسال التذاكر، تأكيدات الحجز، والإشعارات للعملاء</p>
                    </div>
                    <div>
                      <p className="font-semibold">🟪 بوابة المزودين</p>
                      <p className="text-slate-600">للتواصل الذكي التلقائي مع المزودين وطلب المقاعد</p>
                    </div>
                    <div>
                      <p className="font-semibold">🟩 بوابة الموظفين</p>
                      <p className="text-slate-600">للتواصل الداخلي والإشعارات للموظفين</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg">
                  <h3 className="font-semibold mb-3 text-amber-900">⚙️ متطلبات خادم WAHA</h3>
                  <ul className="list-disc mr-5 space-y-1 text-sm">
                    <li>كل بوابة تحتاج خادم WAHA مستقل (يمكن تشغيل عدة خوادم)</li>
                    <li>رابط الخادم مثل: https://waha.example.com/api</li>
                    <li>مفتاح API للمصادقة والأمان</li>
                    <li>الخادم يجب أن يكون يعمل ويمكن الوصول إليه</li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-3 text-blue-900">✨ المميزات</h3>
                  <ul className="list-disc mr-5 space-y-1 text-sm">
                    <li>بوابات متعددة مستقلة تماماً</li>
                    <li>اختبار الاتصال قبل الحفظ</li>
                    <li>اختبار إرسال الرسائل</li>
                    <li>متابعة حالة الاتصال لحظياً</li>
                    <li>عداد الرسائل المرسلة والمستلمة</li>
                    <li>تحديد بوابة افتراضية لكل نوع</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <a 
                    href="https://waha.devlike.pro/docs/overview/quick-start/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    وثائق WAHA الرسمية - كيفية تشغيل خادم WAHA
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