import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, Upload, Eye, EyeOff, Loader2, Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminProvidersNew() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    whatsapp_group_id: '',
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

  const DAYS_OF_WEEK = [
    { value: 0, label: 'الأحد' },
    { value: 1, label: 'الاثنين' },
    { value: 2, label: 'الثلاثاء' },
    { value: 3, label: 'الأربعاء' },
    { value: 4, label: 'الخميس' },
    { value: 5, label: 'الجمعة' },
    { value: 6, label: 'السبت' }
  ];

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
    const [providersData, airlinesData] = await Promise.all([
      base44.entities.Provider.list('-created_date'),
      base44.entities.Airline.filter({ is_active: true })
    ]);
    setProviders(providersData);
    setAirlines(airlinesData);
    setLoading(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      setUploading(false);
    }
  };

  const toggleAirline = (airlineId) => {
    const current = formData.authorized_airlines || [];
    if (current.includes(airlineId)) {
      setFormData({ ...formData, authorized_airlines: current.filter(id => id !== airlineId) });
    } else {
      setFormData({ ...formData, authorized_airlines: [...current, airlineId] });
    }
  };

  const toggleDay = (day) => {
    const current = formData.working_days || [];
    if (current.includes(day)) {
      setFormData({ ...formData, working_days: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, working_days: [...current, day].sort() });
    }
  };

  const generateCredentials = () => {
    const username = `provider_${Date.now().toString(36)}`;
    const password = Math.random().toString(36).slice(-8);
    setFormData({ ...formData, username, password });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingProvider) {
      await base44.entities.Provider.update(editingProvider.id, formData);
      toast.success('تم تحديث المزود بنجاح');
    } else {
      // Create provider
      const provider = await base44.entities.Provider.create(formData);
      
      // Create financial account for provider
      await base44.entities.Account.create({
        name: `حساب المزود - ${formData.company_name_ar}`,
        name_en: `Provider Account - ${formData.company_name_en || formData.company_name_ar}`,
        type: 'liability',
        category: 'provider',
        related_entity_type: 'provider',
        related_entity_id: provider.id,
        balance: 0,
        is_active: true
      });
      
      toast.success('تم إضافة المزود بنجاح');
    }

    setDialogOpen(false);
    resetForm();
    loadData();
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
      authorized_airlines: provider.authorized_airlines || [],
      commission_type: provider.commission_type || 'fixed',
      commission_value: provider.commission_value || 50,
      username: provider.username || '',
      password: provider.password || '',
      ai_assistant_enabled: provider.ai_assistant_enabled !== false,
      working_hours_start: provider.working_hours_start || '09:00',
      working_hours_end: provider.working_hours_end || '20:00',
      working_days: provider.working_days || [0, 1, 2, 3, 4, 5],
      is_active: provider.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف المزود؟')) {
      await base44.entities.Provider.delete(id);
      toast.success('تم حذف المزود');
      loadData();
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
    setShowPassword(false);
  };

  const filteredProviders = providers.filter(p =>
    p.company_name_ar?.includes(searchTerm) ||
    p.company_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contact_person?.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة المزودين</h1>
            <p className="text-slate-600">إضافة وإدارة مكاتب السفريات والسياحة</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة مزود
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProvider ? 'تعديل المزود' : 'إضافة مزود جديد'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    معلومات الشركة
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الاسم التجاري (عربي) *</Label>
                      <Input
                        value={formData.company_name_ar}
                        onChange={(e) => setFormData({ ...formData, company_name_ar: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>الاسم التجاري (إنجليزي)</Label>
                      <Input
                        value={formData.company_name_en}
                        onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>شعار الشركة</Label>
                      <div className="mt-1">
                        {formData.logo_url ? (
                          <div className="flex items-center gap-4">
                            <img src={formData.logo_url} alt="Logo" className="h-16 w-auto object-contain border rounded p-2" />
                            <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, logo_url: '' })}>
                              تغيير
                            </Button>
                          </div>
                        ) : (
                          <Label className="cursor-pointer flex items-center justify-center p-4 border-2 border-dashed rounded-lg hover:bg-slate-50">
                            {uploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            ) : (
                              <>
                                <Upload className="h-6 w-6 text-slate-400 ml-2" />
                                <span className="text-sm text-slate-600">رفع الشعار</span>
                              </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          </Label>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>اللون الرئيسي للعلامة التجارية</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="color"
                          value={formData.brand_color}
                          onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                          className="w-14 h-9 p-1"
                        />
                        <Input
                          value={formData.brand_color}
                          onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                          dir="ltr"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>العنوان</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    معلومات التواصل
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الشخص المسؤول *</Label>
                      <Input
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>رقم الهاتف</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>رقم الواتساب *</Label>
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        dir="ltr"
                        className="mt-1"
                        required
                        placeholder="+967..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label>معرف مجموعة الواتساب (اختياري)</Label>
                    <Input
                      value={formData.whatsapp_group_id}
                      onChange={(e) => setFormData({ ...formData, whatsapp_group_id: e.target.value })}
                      dir="ltr"
                      className="mt-1"
                      placeholder="لربط المزود بمجموعة واتساب"
                    />
                  </div>
                </div>

                {/* Airlines */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-slate-900">شركات الطيران المعتمدة</h3>
                  <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 rounded-lg">
                    {airlines.map((airline) => (
                      <label key={airline.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(formData.authorized_airlines || []).includes(airline.id)}
                          onCheckedChange={() => toggleAirline(airline.id)}
                        />
                        <span className="text-sm">{airline.name_ar} ({airline.iata_code})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Commission */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    العمولة
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>نوع العمولة</Label>
                      <Select value={formData.commission_type} onValueChange={(v) => setFormData({ ...formData, commission_type: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">مبلغ ثابت لكل حجز</SelectItem>
                          <SelectItem value="percentage">نسبة مئوية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>قيمة العمولة *</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          value={formData.commission_value}
                          onChange={(e) => setFormData({ ...formData, commission_value: Number(e.target.value) })}
                          required
                          min="0"
                        />
                        <span className="flex items-center px-3 bg-slate-100 rounded text-sm">
                          {formData.commission_type === 'percentage' ? '%' : '$'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Login Credentials */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">بيانات الدخول</h3>
                    {!editingProvider && (
                      <Button type="button" variant="outline" size="sm" onClick={generateCredentials}>
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
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور *</Label>
                      <div className="relative mt-1">
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

                {/* AI Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-slate-900">إعدادات المساعد الذكي</h3>
                  
                  <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-lg">
                    <Switch
                      checked={formData.ai_assistant_enabled}
                      onCheckedChange={(v) => setFormData({ ...formData, ai_assistant_enabled: v })}
                    />
                    <Label>تفعيل المساعد الذكي للتواصل التلقائي</Label>
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
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>نهاية ساعات العمل</Label>
                          <Input
                            type="time"
                            value={formData.working_hours_end}
                            onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-3 block">أيام العمل</Label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={(formData.working_days || []).includes(day.value)}
                                onCheckedChange={() => toggleDay(day.value)}
                              />
                              <span className="text-sm">{day.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>حساب نشط</Label>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingProvider ? 'تحديث' : 'إضافة'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن مزود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {providers.length} مزود
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشعار</TableHead>
                  <TableHead>اسم الشركة</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>الواتساب</TableHead>
                  <TableHead>الشركات المعتمدة</TableHead>
                  <TableHead>العمولة</TableHead>
                  <TableHead>الرصيد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      {provider.logo_url ? (
                        <img src={provider.logo_url} alt="" className="h-10 w-auto object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded flex items-center justify-center" style={{ backgroundColor: provider.brand_color || '#3B82F6' }}>
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{provider.company_name_ar}</p>
                        {provider.company_name_en && <p className="text-sm text-slate-500">{provider.company_name_en}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{provider.contact_person}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{provider.whatsapp}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(provider.authorized_airlines || []).slice(0, 2).map((airlineId) => {
                          const airline = airlines.find(a => a.id === airlineId);
                          return airline ? (
                            <Badge key={airlineId} variant="outline" className="text-xs">{airline.iata_code}</Badge>
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
                      {provider.commission_type === 'percentage' 
                        ? `${provider.commission_value}%`
                        : `$${provider.commission_value}`
                      }
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600">${provider.balance || 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={provider.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {provider.is_active ? 'نشط' : 'متوقف'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}