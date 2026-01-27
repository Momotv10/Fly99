import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Lock, Bell, User, Upload, Loader2, CheckCircle2, Eye, EyeOff
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function ProviderSettings() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // بيانات الحساب
  const [profileData, setProfileData] = useState({
    company_name_ar: '',
    company_name_en: '',
    logo_url: '',
    brand_color: '#3B82F6',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: ''
  });
  
  // تغيير كلمة المرور
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // إعدادات الإشعارات
  const [notificationSettings, setNotificationSettings] = useState({
    new_booking: true,
    payment_received: true,
    booking_cancelled: true
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'provider' || !user.related_entity_id) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (providerId) => {
    const providerData = await base44.entities.Provider.filter({ id: providerId });
    
    if (providerData.length > 0) {
      const p = providerData[0];
      setProvider(p);
      setProfileData({
        company_name_ar: p.company_name_ar || '',
        company_name_en: p.company_name_en || '',
        logo_url: p.logo_url || '',
        brand_color: p.brand_color || '#3B82F6',
        contact_person: p.contact_person || '',
        email: p.email || '',
        phone: p.phone || '',
        whatsapp: p.whatsapp || '',
        address: p.address || ''
      });
      setNotificationSettings(p.notification_settings || {
        new_booking: true,
        payment_received: true,
        booking_cancelled: true
      });
    }
    
    setLoading(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProfileData({ ...profileData, logo_url: file_url });
      toast.success('تم رفع الشعار');
    } catch (error) {
      toast.error('فشل رفع الشعار');
    }
    setUploadingLogo(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await base44.entities.Provider.update(provider.id, profileData);
      toast.success('تم حفظ التغييرات');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    setSaving(true);
    try {
      // التحقق من كلمة المرور الحالية
      if (provider.password_hash !== passwordData.current_password) {
        toast.error('كلمة المرور الحالية غير صحيحة');
        setSaving(false);
        return;
      }
      
      await base44.entities.Provider.update(provider.id, {
        password_hash: passwordData.new_password
      });
      
      // تحديث مستخدم النظام أيضاً
      const systemUsers = await base44.entities.SystemUser.filter({ related_entity_id: provider.id });
      if (systemUsers.length > 0) {
        await base44.entities.SystemUser.update(systemUsers[0].id, {
          password_hash: passwordData.new_password
        });
      }
      
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('تم تغيير كلمة المرور بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    }
    setSaving(false);
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await base44.entities.Provider.update(provider.id, {
        notification_settings: notificationSettings
      });
      toast.success('تم حفظ إعدادات الإشعارات');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ProviderSidebar provider={provider} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6" />
            الإعدادات
          </h1>
          <p className="text-slate-600">إدارة إعدادات حسابك</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              الملف الشخصي
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="h-4 w-4" />
              كلمة المرور
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              الإشعارات
            </TabsTrigger>
          </TabsList>

          {/* الملف الشخصي */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>معلومات الحساب</CardTitle>
                <CardDescription>تعديل معلومات شركتك الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* الشعار */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    {profileData.logo_url ? (
                      <img src={profileData.logo_url} alt="" className="h-24 w-24 rounded-xl border object-cover" />
                    ) : (
                      <div 
                        className="h-24 w-24 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                        style={{ backgroundColor: profileData.brand_color }}
                      >
                        {profileData.company_name_ar?.charAt(0) || 'م'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>شعار الشركة</Label>
                    <label className="cursor-pointer block mt-2">
                      <Button variant="outline" type="button" disabled={uploadingLogo}>
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        ) : (
                          <Upload className="h-4 w-4 ml-2" />
                        )}
                        رفع شعار جديد
                      </Button>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <div>
                    <Label>لون العلامة التجارية</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="color"
                        value={profileData.brand_color}
                        onChange={(e) => setProfileData({ ...profileData, brand_color: e.target.value })}
                        className="h-10 w-14 rounded border cursor-pointer"
                      />
                      <Input
                        value={profileData.brand_color}
                        onChange={(e) => setProfileData({ ...profileData, brand_color: e.target.value })}
                        className="w-24"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>الاسم التجاري (عربي)</Label>
                    <Input
                      value={profileData.company_name_ar}
                      onChange={(e) => setProfileData({ ...profileData, company_name_ar: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>الاسم التجاري (إنجليزي)</Label>
                    <Input
                      value={profileData.company_name_en}
                      onChange={(e) => setProfileData({ ...profileData, company_name_en: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>اسم المسؤول</Label>
                    <Input
                      value={profileData.contact_person}
                      onChange={(e) => setProfileData({ ...profileData, contact_person: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>رقم الواتساب</Label>
                    <Input
                      value={profileData.whatsapp}
                      onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <Label>العنوان</Label>
                  <Input
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                    حفظ التغييرات
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* كلمة المرور */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>تغيير كلمة المرور</CardTitle>
                <CardDescription>تأكد من استخدام كلمة مرور قوية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>كلمة المرور الحالية</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <Label>كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <Label>تأكيد كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={handleChangePassword} 
                  disabled={saving || !passwordData.current_password || !passwordData.new_password}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Lock className="h-4 w-4 ml-2" />}
                  تغيير كلمة المرور
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* الإشعارات */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات الإشعارات</CardTitle>
                <CardDescription>تحكم في الإشعارات التي تصلك</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">حجز جديد</p>
                    <p className="text-sm text-slate-500">إشعار عند استلام حجز جديد</p>
                  </div>
                  <Switch
                    checked={notificationSettings.new_booking}
                    onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, new_booking: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">استلام دفعة</p>
                    <p className="text-sm text-slate-500">إشعار عند تأكيد دفع من عميل</p>
                  </div>
                  <Switch
                    checked={notificationSettings.payment_received}
                    onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, payment_received: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">إلغاء حجز</p>
                    <p className="text-sm text-slate-500">إشعار عند إلغاء حجز</p>
                  </div>
                  <Switch
                    checked={notificationSettings.booking_cancelled}
                    onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, booking_cancelled: v })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                    حفظ الإعدادات
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}