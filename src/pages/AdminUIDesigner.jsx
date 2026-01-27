import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Palette, Type, Image, Eye, EyeOff, Save, RefreshCw, Layout,
  Settings, FileText, Shield, Globe, Phone, Mail, MapPin, Loader2
} from 'lucide-react';

export default function AdminUIDesigner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await base44.entities.SystemSettings.list();
      const settingsMap = {};
      data.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
        settingsMap[`${s.setting_key}_id`] = s.id;
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Load settings error:', error);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (key.endsWith('_id')) continue;
        
        const existingId = settings[`${key}_id`];
        if (existingId) {
          await base44.entities.SystemSettings.update(existingId, {
            setting_value: value
          });
        } else {
          await base44.entities.SystemSettings.create({
            setting_type: 'general',
            setting_key: key,
            setting_value: value
          });
        }
      }
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل حفظ الإعدادات');
    }
    setSaving(false);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50" dir="rtl">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">مصمم الواجهات</h1>
              <p className="text-slate-600">تخصيص واجهة النظام والنصوص والألوان</p>
            </div>
            <Button onClick={saveSettings} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              حفظ التغييرات
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="general">
                <Settings className="h-4 w-4 ml-2" />
                عام
              </TabsTrigger>
              <TabsTrigger value="hero">
                <Image className="h-4 w-4 ml-2" />
                الصفحة الرئيسية
              </TabsTrigger>
              <TabsTrigger value="colors">
                <Palette className="h-4 w-4 ml-2" />
                الألوان
              </TabsTrigger>
              <TabsTrigger value="texts">
                <Type className="h-4 w-4 ml-2" />
                النصوص
              </TabsTrigger>
              <TabsTrigger value="contact">
                <Phone className="h-4 w-4 ml-2" />
                التواصل
              </TabsTrigger>
              <TabsTrigger value="legal">
                <Shield className="h-4 w-4 ml-2" />
                السياسات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>معلومات الشركة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>اسم الشركة</Label>
                      <Input
                        value={settings.company_name || ''}
                        onChange={(e) => updateSetting('company_name', e.target.value)}
                        placeholder="اسم الشركة"
                      />
                    </div>
                    <div>
                      <Label>اسم الشركة بالإنجليزية</Label>
                      <Input
                        value={settings.company_name_en || ''}
                        onChange={(e) => updateSetting('company_name_en', e.target.value)}
                        placeholder="Company Name"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>وصف الشركة</Label>
                      <Textarea
                        value={settings.company_description || ''}
                        onChange={(e) => updateSetting('company_description', e.target.value)}
                        placeholder="وصف قصير عن الشركة"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>رابط الشعار</Label>
                      <Input
                        value={settings.company_logo || ''}
                        onChange={(e) => updateSetting('company_logo', e.target.value)}
                        placeholder="https://..."
                        dir="ltr"
                      />
                      {settings.company_logo && (
                        <img src={settings.company_logo} alt="" className="h-16 mt-2 object-contain" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>إعدادات العرض</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-semibold">إظهار شريط الشركاء</p>
                        <p className="text-sm text-slate-500">شعارات شركات الطيران والمزودين</p>
                      </div>
                      <Switch
                        checked={settings.show_partners_slider !== 'false'}
                        onCheckedChange={(checked) => updateSetting('show_partners_slider', checked.toString())}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-semibold">إظهار قسم المميزات</p>
                        <p className="text-sm text-slate-500">لماذا تختارنا</p>
                      </div>
                      <Switch
                        checked={settings.show_features !== 'false'}
                        onCheckedChange={(checked) => updateSetting('show_features', checked.toString())}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-semibold">إظهار الإعلانات</p>
                        <p className="text-sm text-slate-500">شريط الإعلانات المتحرك</p>
                      </div>
                      <Switch
                        checked={settings.show_advertisements !== 'false'}
                        onCheckedChange={(checked) => updateSetting('show_advertisements', checked.toString())}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="font-semibold">المزود الخارجي الذكي</p>
                        <p className="text-sm text-slate-500">البحث في مواقع الحجز الخارجية</p>
                      </div>
                      <Switch
                        checked={settings.external_provider_enabled !== 'false'}
                        onCheckedChange={(checked) => updateSetting('external_provider_enabled', checked.toString())}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hero">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>البانر الرئيسي</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>العنوان الرئيسي</Label>
                      <Input
                        value={settings.hero_title || ''}
                        onChange={(e) => updateSetting('hero_title', e.target.value)}
                        placeholder="رحلتك تبدأ من هنا"
                      />
                    </div>
                    <div>
                      <Label>العنوان الفرعي</Label>
                      <Textarea
                        value={settings.hero_subtitle || ''}
                        onChange={(e) => updateSetting('hero_subtitle', e.target.value)}
                        placeholder="اكتشف أفضل العروض على تذاكر الطيران"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>رابط صورة الخلفية</Label>
                      <Input
                        value={settings.hero_image || ''}
                        onChange={(e) => updateSetting('hero_image', e.target.value)}
                        placeholder="https://..."
                        dir="ltr"
                      />
                      {settings.hero_image && (
                        <img src={settings.hero_image} alt="" className="w-full h-32 mt-2 object-cover rounded-lg" />
                      )}
                    </div>
                    <div>
                      <Label>نص زر البحث</Label>
                      <Input
                        value={settings.search_button_text || ''}
                        onChange={(e) => updateSetting('search_button_text', e.target.value)}
                        placeholder="ابحث عن رحلتك"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>قسم المميزات</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>عنوان قسم المميزات</Label>
                      <Input
                        value={settings.features_title || ''}
                        onChange={(e) => updateSetting('features_title', e.target.value)}
                        placeholder="لماذا تختارنا؟"
                      />
                    </div>
                    <div>
                      <Label>وصف قسم المميزات</Label>
                      <Textarea
                        value={settings.features_description || ''}
                        onChange={(e) => updateSetting('features_description', e.target.value)}
                        placeholder="نقدم لك تجربة حجز استثنائية"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>عنوان قسم الشركاء</Label>
                      <Input
                        value={settings.partners_title || ''}
                        onChange={(e) => updateSetting('partners_title', e.target.value)}
                        placeholder="شركاؤنا"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="colors">
              <Card>
                <CardHeader>
                  <CardTitle>ألوان الواجهة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <Label>اللون الأساسي</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.primary_color || '#3B82F6'}
                          onChange={(e) => updateSetting('primary_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.primary_color || '#3B82F6'}
                          onChange={(e) => updateSetting('primary_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>اللون الثانوي</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.secondary_color || '#8B5CF6'}
                          onChange={(e) => updateSetting('secondary_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.secondary_color || '#8B5CF6'}
                          onChange={(e) => updateSetting('secondary_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>لون التمييز</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.accent_color || '#10B981'}
                          onChange={(e) => updateSetting('accent_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.accent_color || '#10B981'}
                          onChange={(e) => updateSetting('accent_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>لون الخلفية</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.background_color || '#F8FAFC'}
                          onChange={(e) => updateSetting('background_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.background_color || '#F8FAFC'}
                          onChange={(e) => updateSetting('background_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>لون النص</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.text_color || '#1E293B'}
                          onChange={(e) => updateSetting('text_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.text_color || '#1E293B'}
                          onChange={(e) => updateSetting('text_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>لون زر الإجراء</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="color"
                          value={settings.cta_color || '#2563EB'}
                          onChange={(e) => updateSetting('cta_color', e.target.value)}
                          className="w-12 h-12 rounded cursor-pointer"
                        />
                        <Input
                          value={settings.cta_color || '#2563EB'}
                          onChange={(e) => updateSetting('cta_color', e.target.value)}
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="texts">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>نصوص صفحات تسجيل الدخول</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>عنوان صفحة دخول الإدارة</Label>
                      <Input
                        value={settings.admin_login_title || ''}
                        onChange={(e) => updateSetting('admin_login_title', e.target.value)}
                        placeholder="لوحة تحكم الإدارة"
                      />
                    </div>
                    <div>
                      <Label>عنوان صفحة دخول المزودين</Label>
                      <Input
                        value={settings.provider_login_title || ''}
                        onChange={(e) => updateSetting('provider_login_title', e.target.value)}
                        placeholder="بوابة المزودين"
                      />
                    </div>
                    <div>
                      <Label>عنوان صفحة دخول الوكلاء</Label>
                      <Input
                        value={settings.agent_login_title || ''}
                        onChange={(e) => updateSetting('agent_login_title', e.target.value)}
                        placeholder="بوابة الوكلاء"
                      />
                    </div>
                    <div>
                      <Label>عنوان صفحة دخول موظفي الإصدار</Label>
                      <Input
                        value={settings.employee_login_title || ''}
                        onChange={(e) => updateSetting('employee_login_title', e.target.value)}
                        placeholder="لوحة موظفي الإصدار"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>نصوص عامة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>نص حقوق النشر</Label>
                      <Input
                        value={settings.copyright_text || ''}
                        onChange={(e) => updateSetting('copyright_text', e.target.value)}
                        placeholder="جميع الحقوق محفوظة"
                      />
                    </div>
                    <div>
                      <Label>نص رسالة الترحيب</Label>
                      <Textarea
                        value={settings.welcome_message || ''}
                        onChange={(e) => updateSetting('welcome_message', e.target.value)}
                        placeholder="مرحباً بك في نظام الحجوزات"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>رسالة نجاح الحجز</Label>
                      <Textarea
                        value={settings.booking_success_message || ''}
                        onChange={(e) => updateSetting('booking_success_message', e.target.value)}
                        placeholder="تم حجزك بنجاح"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle>معلومات التواصل</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          رقم الهاتف
                        </Label>
                        <Input
                          value={settings.contact_phone || ''}
                          onChange={(e) => updateSetting('contact_phone', e.target.value)}
                          placeholder="+967 123 456 789"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          رقم الواتساب
                        </Label>
                        <Input
                          value={settings.contact_whatsapp || ''}
                          onChange={(e) => updateSetting('contact_whatsapp', e.target.value)}
                          placeholder="+967 123 456 789"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          البريد الإلكتروني
                        </Label>
                        <Input
                          value={settings.contact_email || ''}
                          onChange={(e) => updateSetting('contact_email', e.target.value)}
                          placeholder="info@example.com"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          العنوان
                        </Label>
                        <Textarea
                          value={settings.contact_address || ''}
                          onChange={(e) => updateSetting('contact_address', e.target.value)}
                          placeholder="العنوان الكامل"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>ساعات العمل</Label>
                        <Input
                          value={settings.working_hours || ''}
                          onChange={(e) => updateSetting('working_hours', e.target.value)}
                          placeholder="السبت - الخميس: 9 صباحاً - 6 مساءً"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="legal">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>سياسة الخصوصية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={settings.privacy_policy || ''}
                      onChange={(e) => updateSetting('privacy_policy', e.target.value)}
                      placeholder="نص سياسة الخصوصية..."
                      rows={10}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>الشروط والأحكام</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={settings.terms_conditions || ''}
                      onChange={(e) => updateSetting('terms_conditions', e.target.value)}
                      placeholder="نص الشروط والأحكام..."
                      rows={10}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>سياسة الإلغاء والاسترداد</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={settings.refund_policy || ''}
                      onChange={(e) => updateSetting('refund_policy', e.target.value)}
                      placeholder="نص سياسة الإلغاء والاسترداد..."
                      rows={10}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}