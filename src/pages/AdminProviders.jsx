import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Pencil, Trash2, Search, Building2, Phone, Mail, Key, Eye, EyeOff, 
  Upload, DollarSign, Users, TrendingUp, FileText, Loader2, CheckCircle2,
  Wallet, ExternalLink
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminProviders() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name_ar: '',
    company_name_en: '',
    logo_url: '',
    brand_color: '#3B82F6',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    whatsapp_group_id: '',
    address: '',
    city: '',
    country: '',
    authorized_airlines: [],
    commission_value: 10,
    username: '',
    password: '',
    is_active: true
  });

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
    }
  };

  const loadData = async () => {
    try {
      const [providersData, airlinesData] = await Promise.all([
        base44.entities.Provider.list('-created_date'),
        base44.entities.Airline.filter({ is_active: true })
      ]);
      setProviders(providersData || []);
      setAirlines(airlinesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('حدث خطأ في تحميل البيانات');
      setProviders([]);
      setAirlines([]);
    }
    setLoading(false);
  };

  const generateCredentials = () => {
    const username = `pro_${Date.now().toString(36)}`;
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    setFormData({ ...formData, username, password });
    toast.success('تم إنشاء بيانات الدخول');
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      toast.success('تم رفع الشعار');
    } catch (error) {
      toast.error('فشل رفع الشعار');
    }
    setUploadingLogo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingProvider) {
        // تحديث المزود
        await base44.entities.Provider.update(editingProvider.id, {
          ...formData,
          password_hash: formData.password
        });
        
        // تحديث مستخدم النظام
        const systemUsers = await base44.entities.SystemUser.filter({ related_entity_id: editingProvider.id });
        if (systemUsers.length > 0) {
          await base44.entities.SystemUser.update(systemUsers[0].id, {
            full_name: formData.company_name_ar,
            username: formData.username,
            password_hash: formData.password,
            email: formData.email,
            phone: formData.phone,
            whatsapp: formData.whatsapp,
            is_active: formData.is_active
          });
        }
        
        toast.success('تم تحديث المزود بنجاح');
      } else {
        // إنشاء المزود
        const provider = await base44.entities.Provider.create({
          ...formData,
          password_hash: formData.password,
          balance: 0,
          total_bookings: 0,
          total_revenue: 0
        });
        
        // البحث عن حساب المزودين الرئيسي
        const mainProviderAccounts = await base44.entities.Account.filter({ 
          category: 'provider',
          is_main: true 
        });
        let parentAccountId = null;
        
        if (mainProviderAccounts.length === 0) {
          // إنشاء حساب رئيسي للمزودين إذا لم يكن موجوداً
          const mainAccount = await base44.entities.Account.create({
            account_number: '2110',
            name: 'حسابات المزودين',
            name_en: 'Providers Accounts',
            type: 'liability',
            category: 'provider',
            is_main: true,
            is_system: true,
            level: 2,
            balance: 0,
            is_active: true
          });
          parentAccountId = mainAccount.id;
        } else {
          parentAccountId = mainProviderAccounts[0].id;
        }
        
        // إنشاء حساب مالي للمزود
        const account = await base44.entities.Account.create({
          account_number: `2110-${provider.id.slice(-6)}`,
          name: `حساب المزود - ${formData.company_name_ar}`,
          name_en: `Provider Account - ${formData.company_name_en || formData.company_name_ar}`,
          type: 'liability',
          category: 'provider',
          parent_account_id: parentAccountId,
          related_entity_type: 'provider',
          related_entity_id: provider.id,
          balance: 0,
          level: 3,
          is_system: false,
          is_active: true
        });
        
        // تحديث المزود بمعرف الحساب
        await base44.entities.Provider.update(provider.id, {
          account_id: account.id
        });
        
        // إنشاء مستخدم نظام
        await base44.entities.SystemUser.create({
          full_name: formData.company_name_ar,
          username: formData.username,
          password_hash: formData.password,
          email: formData.email,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          role: 'provider',
          related_entity_id: provider.id,
          related_entity_type: 'provider',
          is_active: formData.is_active
        });

        // إرسال رسالة ترحيب عبر WAHA
        await sendWelcomeMessage(formData);
        
        toast.success('تم إضافة المزود بنجاح وإنشاء حسابه المالي');
      }
      
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الحفظ');
    }
    
    setSaving(false);
  };

  const sendWelcomeMessage = async (data) => {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({ status: 'connected' });
      if (gateways.length > 0 && data.whatsapp) {
        const gateway = gateways[0];
        const loginUrl = `${window.location.origin}${createPageUrl('SystemLogin')}?type=provider`;
        const welcomeMessage = `🎉 مرحباً بك في نظام حجز الطيران!

تم إنشاء حسابك بنجاح كمزود خدمة.

📋 بيانات الدخول:
• اسم المستخدم: ${data.username}
• كلمة المرور: ${data.password}

🔗 رابط تسجيل الدخول:
${loginUrl}

⚠️ يُرجى تغيير كلمة المرور فور أول تسجيل دخول.

نتمنى لك تجربة موفقة! 🚀`;

        const phoneNumber = data.whatsapp.replace(/\D/g, '');
        await fetch(`${gateway.waha_server_url}/api/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': gateway.waha_api_key
          },
          body: JSON.stringify({
            chatId: `${phoneNumber}@c.us`,
            text: welcomeMessage,
            session: gateway.session_id || 'default'
          })
        });
        toast.success('تم إرسال رسالة ترحيب للمزود عبر واتساب');
      }
    } catch (error) {
      console.log('فشل إرسال رسالة واتساب:', error);
    }
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormData({
      company_name_ar: provider.company_name_ar || '',
      company_name_en: provider.company_name_en || '',
      logo_url: provider.logo_url || '',
      brand_color: provider.brand_color || '#3B82F6',
      contact_person: provider.contact_person || '',
      email: provider.email || '',
      phone: provider.phone || '',
      whatsapp: provider.whatsapp || '',
      whatsapp_group_id: provider.whatsapp_group_id || '',
      address: provider.address || '',
      city: provider.city || '',
      country: provider.country || '',
      authorized_airlines: provider.authorized_airlines || [],
      commission_value: provider.commission_value || 10,
      username: provider.username || '',
      password: provider.password_hash || '',
      is_active: provider.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف المزود؟ سيتم حذف جميع البيانات المرتبطة به.')) {
      try {
        // حذف مستخدم النظام
        const systemUsers = await base44.entities.SystemUser.filter({ related_entity_id: id });
        for (const user of systemUsers) {
          await base44.entities.SystemUser.delete(user.id);
        }
        
        // حذف المزود
        await base44.entities.Provider.delete(id);
        toast.success('تم حذف المزود');
        loadData();
      } catch (error) {
        toast.error('فشل حذف المزود');
      }
    }
  };

  const resetForm = () => {
    setEditingProvider(null);
    setFormData({
      company_name_ar: '',
      company_name_en: '',
      logo_url: '',
      brand_color: '#3B82F6',
      contact_person: '',
      email: '',
      phone: '',
      whatsapp: '',
      whatsapp_group_id: '',
      address: '',
      city: '',
      country: '',
      authorized_airlines: [],
      commission_value: 10,
      username: '',
      password: '',
      is_active: true
    });
  };

  const toggleAirline = (airlineId) => {
    const current = formData.authorized_airlines || [];
    if (current.includes(airlineId)) {
      setFormData({ ...formData, authorized_airlines: current.filter(id => id !== airlineId) });
    } else {
      setFormData({ ...formData, authorized_airlines: [...current, airlineId] });
    }
  };

  const filteredProviders = (providers || []).filter(p => 
    !searchTerm ||
    p.company_name_ar?.includes(searchTerm) || 
    p.contact_person?.includes(searchTerm) ||
    p.phone?.includes(searchTerm) ||
    p.username?.includes(searchTerm)
  );

  // إحصائيات
  const stats = {
    total: (providers || []).length,
    active: (providers || []).filter(p => p.is_active !== false).length,
    totalRevenue: (providers || []).reduce((sum, p) => sum + (p.total_revenue || 0), 0),
    totalBookings: (providers || []).reduce((sum, p) => sum + (p.total_bookings || 0), 0),
    totalBalance: (providers || []).reduce((sum, p) => sum + (p.balance || 0), 0)
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* الإحصائيات */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm opacity-90">إجمالي المزودين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm opacity-90">مزودين نشطين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalBookings}</p>
                  <p className="text-sm opacity-90">إجمالي الحجوزات</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-sm opacity-90">إجمالي الإيرادات</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* العنوان وزر الإضافة */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة المزودين</h1>
            <p className="text-slate-600">إدارة مزودي الخدمة وشركات الطيران</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة مزود جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProvider ? 'تعديل المزود' : 'إضافة مزود جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* معلومات الشركة */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">معلومات الشركة</h3>
                  
                  {/* رفع الشعار */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="" className="h-20 w-20 rounded-xl border object-cover" />
                      ) : (
                        <div className="h-20 w-20 rounded-xl bg-slate-100 flex items-center justify-center border-2 border-dashed">
                          <Building2 className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>شعار المزود</Label>
                      <label className="cursor-pointer block mt-1">
                        <div className="border rounded-lg p-3 hover:bg-slate-50 transition-colors text-center">
                          {uploadingLogo ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          ) : (
                            <>
                              <Upload className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                              <span className="text-sm text-slate-600">اضغط لرفع الشعار</span>
                            </>
                          )}
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    </div>
                    <div>
                      <Label>لون العلامة التجارية</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={formData.brand_color}
                          onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                          className="h-10 w-14 rounded border cursor-pointer"
                        />
                        <Input
                          value={formData.brand_color}
                          onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                          className="w-24"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الاسم التجاري (عربي) *</Label>
                      <Input
                        value={formData.company_name_ar}
                        onChange={(e) => setFormData({ ...formData, company_name_ar: e.target.value })}
                        placeholder="مثال: شركة السفر الذهبي"
                        required
                      />
                    </div>
                    <div>
                      <Label>الاسم التجاري (إنجليزي)</Label>
                      <Input
                        value={formData.company_name_en}
                        onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
                        placeholder="Golden Travel Co."
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>العنوان</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="الشارع، المبنى..."
                    />
                  </div>
                </div>

                {/* معلومات التواصل */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">معلومات التواصل</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم الشخص المسؤول *</Label>
                      <Input
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>رقم الواتساب *</Label>
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        placeholder="967XXXXXXXXX"
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <Label>معرف مجموعة واتساب (اختياري)</Label>
                      <Input
                        value={formData.whatsapp_group_id}
                        onChange={(e) => setFormData({ ...formData, whatsapp_group_id: e.target.value })}
                        placeholder="group_id@g.us"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* شركات الطيران */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">شركات الطيران المعتمدة</h3>
                  <p className="text-sm text-slate-500">حدد شركات الطيران التي يستطيع المزود إدراج مقاعد لها</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg max-h-48 overflow-y-auto">
                    {airlines.map((airline) => (
                      <label 
                        key={airline.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                          (formData.authorized_airlines || []).includes(airline.id)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Checkbox
                          checked={(formData.authorized_airlines || []).includes(airline.id)}
                          onCheckedChange={() => toggleAirline(airline.id)}
                        />
                        <div className="flex items-center gap-2">
                          {airline.logo_url && (
                            <img src={airline.logo_url} alt="" className="h-6 w-6" />
                          )}
                          <span className="text-sm font-medium">{airline.name_ar || airline.iata_code}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* العمولة */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">العمولة</h3>
                  
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <Label>عمولة النظام لكل عملية حجز (مبلغ مقطوع) *</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                      <Input
                        type="number"
                        value={formData.commission_value}
                        onChange={(e) => setFormData({ ...formData, commission_value: parseFloat(e.target.value) || 0 })}
                        min="0"
                        className="max-w-32"
                        required
                      />
                      <span className="text-slate-600">$ لكل حجز</span>
                    </div>
                    <p className="text-xs text-amber-700 mt-2">
                      سيتم خصم هذا المبلغ من كل عملية حجز ناجحة وإضافته لأرباح النظام
                    </p>
                  </div>
                </div>

                {/* بيانات الدخول */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-slate-900">بيانات الدخول</h3>
                    {!editingProvider && (
                      <Button type="button" variant="outline" size="sm" onClick={generateCredentials}>
                        <Key className="h-4 w-4 ml-1" />
                        إنشاء تلقائي
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم المستخدم *</Label>
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          dir="ltr"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* الحالة */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <div>
                    <Label>حالة الحساب</Label>
                    <p className="text-sm text-slate-500">
                      {formData.is_active ? 'الحساب نشط ويمكن للمزود تسجيل الدخول' : 'الحساب معطل'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      editingProvider ? 'تحديث المزود' : 'إضافة المزود'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* البحث والجدول */}
        <Card>
          <CardHeader>
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث عن مزود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المزود</TableHead>
                    <TableHead>الشخص المسؤول</TableHead>
                    <TableHead>التواصل</TableHead>
                    <TableHead>شركات الطيران</TableHead>
                    <TableHead>العمولة</TableHead>
                    <TableHead>الإحصائيات</TableHead>
                    <TableHead>الرصيد</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {provider.logo_url ? (
                            <img src={provider.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div 
                              className="h-10 w-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: provider.brand_color || '#3B82F6' }}
                            >
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">{provider.company_name_ar}</p>
                            <p className="text-xs text-slate-500 font-mono">{provider.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{provider.contact_person}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{provider.whatsapp}</span>
                          </div>
                          {provider.email && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Mail className="h-3 w-3" />
                              <span className="text-xs">{provider.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-32">
                          {(provider.authorized_airlines || []).slice(0, 2).map((airlineId) => {
                            const airline = airlines.find(a => a.id === airlineId);
                            return airline ? (
                              <Badge key={airlineId} variant="outline" className="text-xs">
                                {airline.iata_code || airline.name_ar?.substring(0, 5)}
                              </Badge>
                            ) : null;
                          })}
                          {(provider.authorized_airlines || []).length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(provider.authorized_airlines || []).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-700">
                          ${provider.commission_value || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-slate-400" />
                            <span>{provider.total_bookings || 0} حجز</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-600">
                            <DollarSign className="h-3 w-3" />
                            <span>${(provider.total_revenue || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-semibold text-lg ${
                          (provider.balance || 0) > 0 ? 'text-green-600' : 
                          (provider.balance || 0) < 0 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          ${Math.abs(provider.balance || 0).toLocaleString()}
                          <span className="text-xs font-normal text-slate-500 block">
                            {(provider.balance || 0) >= 0 ? 'مستحق له' : 'عليه'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={provider.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {provider.is_active !== false ? 'نشط' : 'معطل'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate(createPageUrl('AdminFinance'))}
                            title="الحساب المالي"
                          >
                            <Wallet className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(provider)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(provider.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {filteredProviders.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد مزودين</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}