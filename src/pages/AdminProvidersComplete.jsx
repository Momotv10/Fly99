import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Pencil, Pause, Play, Upload, Loader2, Eye, MessageSquare, DollarSign } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminProvidersComplete() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name_ar: '',
    company_name_en: '',
    logo_url: '',
    brand_color: '#3B82F6',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    authorized_airlines: [],
    commission_type: 'fixed',
    commission_value: 50,
    username: '',
    password: '',
    ai_assistant_enabled: true,
    working_hours_start: '09:00',
    working_hours_end: '20:00',
    working_days: [0, 1, 2, 3, 4, 5],
    is_active: true
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    const [providersData, airlinesData] = await Promise.all([
      base44.entities.Provider.list('-created_date'),
      base44.entities.Airline.filter({ is_active: true })
    ]);
    setProviders(providersData);
    setAirlines(airlinesData);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      toast.success('تم رفع الشعار');
    } catch (error) {
      toast.error('فشل رفع الشعار');
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // التحقق من اسم المستخدم الفريد
    if (!editingProvider) {
      const existing = await base44.entities.Provider.filter({ username: formData.username });
      if (existing.length > 0) {
        toast.error('اسم المستخدم موجود بالفعل');
        return;
      }
    }
    
    if (editingProvider) {
      await base44.entities.Provider.update(editingProvider.id, formData);
      toast.success('تم تحديث المزود');
    } else {
      // إنشاء المزود
      const newProvider = await base44.entities.Provider.create({
        ...formData,
        balance: 0,
        total_bookings: 0,
        total_revenue: 0
      });
      
      // إنشاء حساب مالي للمزود
      const existingAccounts = await base44.entities.Account.filter({ account_number: '2000' });
      await base44.entities.Account.create({
        name: `المزود - ${formData.company_name_ar}`,
        name_en: `Provider - ${formData.company_name_en || formData.company_name_ar}`,
        account_number: `2000-${Date.now().toString().slice(-4)}`,
        type: 'liability',
        category: 'provider',
        related_entity_type: 'provider',
        related_entity_id: newProvider.id,
        balance: 0,
        level: 2,
        parent_account_id: existingAccounts.length > 0 ? existingAccounts[0].id : null,
        is_active: true
      });
      
      // إنشاء SystemUser للمزود
      await base44.entities.SystemUser.create({
        full_name: formData.company_name_ar,
        username: formData.username,
        password_hash: formData.password, // في الإنتاج يجب تشفيرها
        role: 'provider',
        email: formData.email,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        related_entity_id: newProvider.id,
        related_entity_type: 'provider',
        is_active: true
      });
      
      toast.success('تم إضافة المزود بنجاح وإنشاء الحساب المالي');
    }
    
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormData({
      company_name_ar: provider.company_name_ar,
      company_name_en: provider.company_name_en || '',
      logo_url: provider.logo_url || '',
      brand_color: provider.brand_color || '#3B82F6',
      contact_person: provider.contact_person,
      email: provider.email || '',
      phone: provider.phone || '',
      whatsapp: provider.whatsapp,
      address: provider.address || '',
      authorized_airlines: provider.authorized_airlines || [],
      commission_type: provider.commission_type || 'fixed',
      commission_value: provider.commission_value || 50,
      username: provider.username || '',
      password: '',
      ai_assistant_enabled: provider.ai_assistant_enabled !== false,
      working_hours_start: provider.working_hours_start || '09:00',
      working_hours_end: provider.working_hours_end || '20:00',
      working_days: provider.working_days || [0, 1, 2, 3, 4, 5],
      is_active: provider.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (provider) => {
    await base44.entities.Provider.update(provider.id, {
      is_active: !provider.is_active
    });
    loadData();
  };

  const handleToggleAI = async (provider) => {
    await base44.entities.Provider.update(provider.id, {
      ai_assistant_enabled: !provider.ai_assistant_enabled
    });
    toast.success(provider.ai_assistant_enabled ? 'تم تعطيل المساعد الذكي' : 'تم تفعيل المساعد الذكي');
    loadData();
  };

  const toggleAirline = (airlineId) => {
    const current = formData.authorized_airlines || [];
    const updated = current.includes(airlineId)
      ? current.filter(id => id !== airlineId)
      : [...current, airlineId];
    setFormData({ ...formData, authorized_airlines: updated });
  };

  const toggleDay = (day) => {
    const current = formData.working_days || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setFormData({ ...formData, working_days: updated });
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
      address: '',
      authorized_airlines: [],
      commission_type: 'fixed',
      commission_value: 50,
      username: '',
      password: '',
      ai_assistant_enabled: true,
      working_hours_start: '09:00',
      working_hours_end: '20:00',
      working_days: [0, 1, 2, 3, 4, 5],
      is_active: true
    });
  };

  const daysOfWeek = [
    { value: 6, label: 'السبت' },
    { value: 0, label: 'الأحد' },
    { value: 1, label: 'الإثنين' },
    { value: 2, label: 'الثلاثاء' },
    { value: 3, label: 'الأربعاء' },
    { value: 4, label: 'الخميس' },
    { value: 5, label: 'الجمعة' }
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">إدارة المزودين</h1>
            <p className="text-slate-600">إضافة وإدارة مزودي المقاعد</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة مزود
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProvider ? 'تعديل المزود' : 'إضافة مزود جديد'}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* المعلومات الأساسية */}
                <div className="space-y-4">
                  <h3 className="font-semibold">المعلومات الأساسية</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الاسم التجاري (عربي) *</Label>
                      <Input
                        value={formData.company_name_ar}
                        onChange={(e) => setFormData({ ...formData, company_name_ar: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>الاسم التجاري (إنجليزي)</Label>
                      <Input
                        value={formData.company_name_en}
                        onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>شعار المزود</Label>
                    <div className="mt-1">
                      {formData.logo_url ? (
                        <div className="flex items-center gap-4">
                          <img src={formData.logo_url} alt="" className="h-16 w-auto border rounded p-2" />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setFormData({ ...formData, logo_url: '' })}
                          >
                            تغيير
                          </Button>
                        </div>
                      ) : (
                        <Label className="cursor-pointer flex items-center justify-center p-6 border-2 border-dashed rounded-lg hover:bg-slate-50">
                          {uploading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          ) : (
                            <>
                              <Upload className="h-6 w-6 text-slate-400 ml-2" />
                              <span>رفع الشعار</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </Label>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>اللون الرئيسي للعلامة التجارية</Label>
                    <Input
                      type="color"
                      value={formData.brand_color}
                      onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                      className="h-12"
                    />
                  </div>
                </div>

                {/* معلومات الاتصال */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold">معلومات الاتصال</h3>
                  
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
                    <div>
                      <Label>رقم الهاتف</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>رقم الواتساب *</Label>
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        placeholder="+967xxxxxxxxx"
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>العنوان</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                {/* شركات الطيران المصرح بها */}
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold">شركات الطيران المصرح بها *</h3>
                  <p className="text-sm text-slate-600">حدد شركات الطيران التي يمكن للمزود إضافة مقاعد لها</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {airlines.map((airline) => (
                      <div key={airline.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <Checkbox
                          checked={(formData.authorized_airlines || []).includes(airline.id)}
                          onCheckedChange={() => toggleAirline(airline.id)}
                        />
                        <div className="flex items-center gap-2">
                          {airline.logo_url && (
                            <img src={airline.logo_url} alt="" className="h-6 w-6" />
                          )}
                          <Label className="cursor-pointer">{airline.name_ar}</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* العمولة */}
                <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold">عمولة النظام</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>نوع العمولة</Label>
                      <Select value={formData.commission_type} onValueChange={(v) => setFormData({ ...formData, commission_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">مبلغ مقطوع (لكل حجز)</SelectItem>
                          <SelectItem value="percentage">نسبة مئوية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>
                        {formData.commission_type === 'fixed' ? 'المبلغ ($) *' : 'النسبة (%) *'}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.commission_value}
                        onChange={(e) => setFormData({ ...formData, commission_value: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <Alert>
                    <DollarSign className="h-4 w-4" />
                    <AlertDescription>
                      العمولة ستضاف تلقائياً على سعر المزود لكل حجز
                    </AlertDescription>
                  </Alert>
                </div>

                {/* المساعد الذكي */}
                <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold">إعدادات المساعد الذكي</h3>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.ai_assistant_enabled}
                      onCheckedChange={(v) => setFormData({ ...formData, ai_assistant_enabled: v })}
                    />
                    <Label>تفعيل المساعد الذكي للمزود</Label>
                  </div>

                  {formData.ai_assistant_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>بداية ساعات العمل</Label>
                          <Input
                            type="time"
                            value={formData.working_hours_start}
                            onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>نهاية ساعات العمل</Label>
                          <Input
                            type="time"
                            value={formData.working_hours_end}
                            onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>أيام العمل</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {daysOfWeek.map((day) => (
                            <div key={day.value} className="flex items-center gap-2">
                              <Checkbox
                                checked={(formData.working_days || []).includes(day.value)}
                                onCheckedChange={() => toggleDay(day.value)}
                              />
                              <Label className="text-sm">{day.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* بيانات الدخول */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold">بيانات الدخول للنظام</h3>
                  
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
                      <Label>كلمة المرور {!editingProvider && '*'}</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingProvider ? 'اتركها فارغة للإبقاء على القديمة' : ''}
                        required={!editingProvider}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingProvider ? 'تحديث' : 'إضافة'} المزود
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المزود</TableHead>
                  <TableHead>جهة الاتصال</TableHead>
                  <TableHead>الشركات</TableHead>
                  <TableHead>العمولة</TableHead>
                  <TableHead>الرصيد</TableHead>
                  <TableHead>المساعد الذكي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => {
                  const providerName = provider.company_name_ar || provider.name || 'غير معروف';
                  const commissionValue = provider.commission_value ?? provider.commission_rate ?? 0;
                  
                  return (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {provider.logo_url ? (
                          <img src={provider.logo_url} alt="" className="h-10 w-10 rounded" />
                        ) : (
                          <div 
                            className="h-10 w-10 rounded flex items-center justify-center text-white"
                            style={{ backgroundColor: provider.brand_color || '#3B82F6' }}
                          >
                            {providerName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{providerName}</p>
                          {(provider.company_name_en || provider.name_en) && (
                            <p className="text-xs text-slate-500" dir="ltr">{provider.company_name_en || provider.name_en}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{provider.contact_person || '-'}</p>
                        <p className="text-xs text-slate-500" dir="ltr">{provider.whatsapp || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(provider.authorized_airlines || []).length} شركة
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {provider.commission_type === 'fixed' 
                          ? `$${commissionValue}` 
                          : `${commissionValue}%`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600">
                        ${provider.balance || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAI(provider)}
                        className={provider.ai_assistant_enabled ? 'text-purple-600' : 'text-slate-400'}
                      >
                        <MessageSquare className="h-4 w-4 ml-1" />
                        {provider.ai_assistant_enabled ? 'مفعّل' : 'معطّل'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge className={provider.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                        {provider.is_active ? 'نشط' : 'موقف'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleToggleStatus(provider)}
                        >
                          {provider.is_active ? (
                            <Pause className="h-4 w-4 text-amber-600" />
                          ) : (
                            <Play className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(provider)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(createPageUrl('AdminSmartProvider') + `?provider=${provider.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {providers.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p>لا يوجد مزودين</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}