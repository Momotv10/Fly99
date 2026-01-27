import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Pencil, Trash2, Search, User, Phone, Mail, Key, Eye, EyeOff,
  Upload, DollarSign, TrendingUp, Wallet, RefreshCw, Copy, CheckCircle,
  Building2, MapPin, Calendar, FileText, Shield, Link2, AlertCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositNote, setDepositNote] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, totalBalance: 0, totalCommission: 0 });

  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    logo_url: '',
    brand_color: '#3B82F6',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    country: '',
    commission_percentage: 10,
    balance: 0,
    credit_limit: 0,
    username: '',
    password_hash: '',
    api_enabled: false,
    notes: '',
    is_active: true
  });

  useEffect(() => {
    checkAuth();
    loadAgents();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadAgents = async () => {
    setLoading(true);
    const data = await base44.entities.Agent.list('-created_date');
    setAgents(data);
    
    // حساب الإحصائيات
    setStats({
      total: data.length,
      active: data.filter(a => a.is_active !== false).length,
      totalBalance: data.reduce((sum, a) => sum + (a.balance || 0), 0),
      totalCommission: data.reduce((sum, a) => sum + (a.total_commission || 0), 0)
    });
    
    setLoading(false);
  };

  const generateCredentials = () => {
    const username = `agent_${Date.now().toString(36)}`;
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    setFormData({ ...formData, username, password_hash: password });
  };

  const generateApiKeys = () => {
    const apiKey = `AK_${Date.now()}_${Math.random().toString(36).slice(-12).toUpperCase()}`;
    const apiSecret = `AS_${Math.random().toString(36).slice(-16).toUpperCase()}${Math.random().toString(36).slice(-16).toUpperCase()}`;
    setFormData({ ...formData, api_key: apiKey, api_secret: apiSecret });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      toast.success('تم رفع الشعار');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingAgent) {
        // تحديث الوكيل
        await base44.entities.Agent.update(editingAgent.id, formData);
        
        // تحديث SystemUser
        const systemUsers = await base44.entities.SystemUser.filter({ related_entity_id: editingAgent.id });
        if (systemUsers.length > 0) {
          await base44.entities.SystemUser.update(systemUsers[0].id, {
            full_name: formData.name,
            username: formData.username,
            password_hash: formData.password_hash,
            email: formData.email,
            phone: formData.phone,
            whatsapp: formData.whatsapp,
            is_active: formData.is_active
          });
        }
        
        toast.success('تم تحديث الوكيل بنجاح');
      } else {
        // إنشاء وكيل جديد
        const apiKey = `AK_${Date.now()}_${Math.random().toString(36).slice(-12).toUpperCase()}`;
        const apiSecret = `AS_${Math.random().toString(36).slice(-16).toUpperCase()}`;
        
        const agent = await base44.entities.Agent.create({
          ...formData,
          api_key: apiKey,
          api_secret: apiSecret
        });
        
        // إنشاء SystemUser للوكيل
        await base44.entities.SystemUser.create({
          full_name: formData.name,
          username: formData.username,
          password_hash: formData.password_hash,
          email: formData.email,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          role: 'agent',
          related_entity_id: agent.id,
          related_entity_type: 'agent',
          is_active: formData.is_active
        });
        
        // إنشاء حساب مالي للوكيل
        const accountNumber = `AGT-${String(agents.length + 1).padStart(4, '0')}`;
        const account = await base44.entities.Account.create({
          account_number: accountNumber,
          name: `حساب الوكيل - ${formData.name}`,
          name_en: `Agent Account - ${formData.name_en || formData.name}`,
          type: 'liability',
          category: 'agent',
          related_entity_type: 'agent',
          related_entity_id: agent.id,
          balance: formData.balance || 0,
          is_active: true
        });
        
        // تحديث الوكيل بمعرف الحساب
        await base44.entities.Agent.update(agent.id, { account_id: account.id });

        // إرسال رسالة ترحيب عبر WAHA
        try {
          // البحث عن أي بوابة متصلة
          let gateways = await base44.entities.WhatsAppGateway.filter({ status: 'connected' });
          if (gateways.length === 0) {
            gateways = await base44.entities.WhatsAppGateway.filter({ is_active: true });
          }
          
          if (gateways.length > 0 && formData.whatsapp) {
            const gateway = gateways[0];
            const loginUrl = `${window.location.origin}${createPageUrl('SystemLogin')}?type=agent`;
            const welcomeMessage = `🎉 مرحباً بك في نظام حجز الطيران!

تم إنشاء حسابك بنجاح كوكيل مبيعات.

📋 بيانات الدخول:
• اسم المستخدم: ${formData.username}
• كلمة المرور: ${formData.password_hash}

🔗 رابط تسجيل الدخول:
${loginUrl}

⚠️ يُرجى تغيير كلمة المرور فور أول تسجيل دخول.

نتمنى لك تجربة موفقة! 🚀`;

            const phoneNumber = formData.whatsapp.replace(/\D/g, '');
            const response = await fetch(`${gateway.waha_server_url}/api/sendText`, {
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
            
            if (response.ok) {
              toast.success('تم إرسال رسالة ترحيب للوكيل عبر واتساب');
            }
          }
        } catch (wahaError) {
          console.log('فشل إرسال رسالة واتساب:', wahaError);
        }
        
        toast.success('تم إضافة الوكيل وإنشاء حسابه المالي');
      }
      
      setDialogOpen(false);
      resetForm();
      loadAgents();
    } catch (error) {
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const handleDeposit = async () => {
    if (!selectedAgent || depositAmount <= 0) return;
    
    try {
      const balanceBefore = selectedAgent.balance || 0;
      const balanceAfter = balanceBefore + depositAmount;
      
      // تحديث رصيد الوكيل
      await base44.entities.Agent.update(selectedAgent.id, {
        balance: balanceAfter
      });
      
      // تسجيل العملية
      await base44.entities.AgentTransaction.create({
        agent_id: selectedAgent.id,
        agent_name: selectedAgent.name,
        transaction_type: 'deposit',
        amount: depositAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_type: 'deposit',
        description: `إيداع رصيد للوكيل`,
        notes: depositNote,
        source: 'admin',
        status: 'completed'
      });
      
      // تحديث الحساب المالي إن وجد
      if (selectedAgent.account_id) {
        const accounts = await base44.entities.Account.filter({ id: selectedAgent.account_id });
        if (accounts.length > 0) {
          await base44.entities.Account.update(accounts[0].id, {
            balance: balanceAfter
          });
        }
      }
      
      toast.success(`تم إيداع ${depositAmount} بنجاح`);
      setDepositDialogOpen(false);
      setDepositAmount(0);
      setDepositNote('');
      setSelectedAgent(null);
      loadAgents();
    } catch (error) {
      toast.error('فشل الإيداع: ' + error.message);
    }
  };

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || '',
      name_en: agent.name_en || '',
      logo_url: agent.logo_url || '',
      brand_color: agent.brand_color || '#3B82F6',
      contact_person: agent.contact_person || '',
      email: agent.email || '',
      phone: agent.phone || '',
      whatsapp: agent.whatsapp || '',
      address: agent.address || '',
      city: agent.city || '',
      country: agent.country || '',
      commission_percentage: agent.commission_percentage || 0,
      balance: agent.balance || 0,
      credit_limit: agent.credit_limit || 0,
      username: agent.username || '',
      password_hash: agent.password_hash || '',
      api_enabled: agent.api_enabled || false,
      api_key: agent.api_key || '',
      api_secret: agent.api_secret || '',
      notes: agent.notes || '',
      is_active: agent.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (agent) => {
    if (confirm(`هل أنت متأكد من حذف الوكيل "${agent.name}"؟ سيتم حذف جميع البيانات المرتبطة.`)) {
      try {
        // حذف SystemUser
        const systemUsers = await base44.entities.SystemUser.filter({ related_entity_id: agent.id });
        for (const user of systemUsers) {
          await base44.entities.SystemUser.delete(user.id);
        }
        
        // حذف الحساب المالي
        if (agent.account_id) {
          await base44.entities.Account.delete(agent.account_id);
        }
        
        await base44.entities.Agent.delete(agent.id);
        toast.success('تم حذف الوكيل');
        loadAgents();
      } catch (error) {
        toast.error('فشل الحذف: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setEditingAgent(null);
    setLogoFile(null);
    setFormData({
      name: '',
      name_en: '',
      logo_url: '',
      brand_color: '#3B82F6',
      contact_person: '',
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      city: '',
      country: '',
      commission_percentage: 10,
      balance: 0,
      credit_limit: 0,
      username: '',
      password_hash: '',
      api_enabled: false,
      notes: '',
      is_active: true
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('تم النسخ');
  };

  const filteredAgents = agents.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.phone?.includes(searchTerm) ||
    a.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        {/* العنوان والإحصائيات */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">إدارة الوكلاء</h1>
              <p className="text-slate-600">إدارة وكلاء المبيعات وحساباتهم المالية</p>
            </div>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة وكيل جديد
            </Button>
          </div>

          {/* بطاقات الإحصائيات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">إجمالي الوكلاء</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">الوكلاء النشطون</p>
                    <p className="text-2xl font-bold text-green-900">{stats.active}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-xl">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">إجمالي الأرصدة</p>
                    <p className="text-2xl font-bold text-purple-900">${stats.totalBalance.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600 font-medium">إجمالي العمولات</p>
                    <p className="text-2xl font-bold text-amber-900">${stats.totalCommission.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* جدول الوكلاء */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو الهاتف أو اليوزر..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button variant="outline" onClick={loadAgents}>
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوكيل</TableHead>
                    <TableHead>المسؤول</TableHead>
                    <TableHead>التواصل</TableHead>
                    <TableHead>العمولة</TableHead>
                    <TableHead>الرصيد</TableHead>
                    <TableHead>الحجوزات</TableHead>
                    <TableHead>API</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {agent.logo_url ? (
                            <img src={agent.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover border" />
                          ) : (
                            <div 
                              className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: agent.brand_color || '#3B82F6' }}
                            >
                              {agent.name?.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">{agent.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{agent.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{agent.contact_person}</p>
                        {agent.city && <p className="text-xs text-slate-500">{agent.city}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{agent.whatsapp || agent.phone}</span>
                          </div>
                          {agent.email && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Mail className="h-3 w-3" />
                              <span className="text-xs truncate max-w-[120px]">{agent.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          {agent.commission_percentage || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-left">
                          <p className={`font-bold ${(agent.balance || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${(agent.balance || 0).toLocaleString()}
                          </p>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-blue-600 p-0"
                            onClick={() => { setSelectedAgent(agent); setDepositDialogOpen(true); }}
                          >
                            <DollarSign className="h-3 w-3 ml-1" />
                            إيداع
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <p className="font-bold">{agent.total_bookings || 0}</p>
                          <p className="text-xs text-slate-500">حجز</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={agent.api_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                          {agent.api_enabled ? 'مفعّل' : 'معطّل'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={agent.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {agent.is_active !== false ? 'نشط' : 'موقوف'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)} title="تعديل">
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(agent)} title="حذف">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredAgents.length === 0 && !loading && (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">لا يوجد وكلاء</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة أول وكيل
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة إضافة/تعديل وكيل */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {editingAgent ? 'تعديل الوكيل' : 'إضافة وكيل جديد'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                  <TabsTrigger value="financial">المالية</TabsTrigger>
                  <TabsTrigger value="login">الدخول</TabsTrigger>
                  <TabsTrigger value="api">API</TabsTrigger>
                </TabsList>

                {/* البيانات الأساسية */}
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* رفع الشعار */}
                    <div className="md:col-span-1">
                      <Label>شعار الوكيل</Label>
                      <div className="mt-2 flex flex-col items-center gap-3">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="" className="h-24 w-24 rounded-xl object-cover border-2" />
                        ) : (
                          <div 
                            className="h-24 w-24 rounded-xl flex items-center justify-center text-white text-3xl font-bold"
                            style={{ backgroundColor: formData.brand_color }}
                          >
                            {formData.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label htmlFor="logo-upload">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="h-4 w-4 ml-1" />
                              رفع شعار
                            </span>
                          </Button>
                        </label>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">اللون:</Label>
                          <input
                            type="color"
                            value={formData.brand_color}
                            onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                            className="h-8 w-12 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* الاسم والمعلومات */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الاسم التجاري (عربي) *</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="مثال: وكالة السفر الذهبية"
                            required
                          />
                        </div>
                        <div>
                          <Label>الاسم التجاري (إنجليزي)</Label>
                          <Input
                            value={formData.name_en}
                            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                            placeholder="Golden Travel Agency"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>اسم المسؤول *</Label>
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
                            placeholder="967XXXXXXXXX"
                            dir="ltr"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>العنوان</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>المدينة</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>الدولة</Label>
                      <Input
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </TabsContent>

                {/* المالية */}
                <TabsContent value="financial" className="space-y-4 mt-4">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-900">آلية العمولة</p>
                          <p className="text-sm text-blue-700">
                            يحصل الوكيل على نسبة من عمولة النظام عند إصدار كل تذكرة. 
                            مثلاً: إذا كانت عمولة النظام 10$ ونسبة الوكيل 20%، يحصل على 2$.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>نسبة العمولة من عمولة النظام (%)</Label>
                      <Input
                        type="number"
                        value={formData.commission_percentage}
                        onChange={(e) => setFormData({ ...formData, commission_percentage: Number(e.target.value) })}
                        min="0"
                        max="100"
                      />
                      <p className="text-xs text-slate-500 mt-1">النسبة المئوية التي يحصل عليها الوكيل من عمولة النظام</p>
                    </div>
                    <div>
                      <Label>حد الائتمان ($)</Label>
                      <Input
                        type="number"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                        min="0"
                      />
                      <p className="text-xs text-slate-500 mt-1">المبلغ المسموح بالسحب منه (0 = لا يوجد حد)</p>
                    </div>
                  </div>

                  {!editingAgent && (
                    <div>
                      <Label>الرصيد الافتتاحي ($)</Label>
                      <Input
                        type="number"
                        value={formData.balance}
                        onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                        min="0"
                      />
                    </div>
                  )}
                </TabsContent>

                {/* بيانات الدخول */}
                <TabsContent value="login" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">بيانات الدخول للوكيل</h3>
                      <p className="text-sm text-slate-500">سيستخدمها الوكيل للدخول إلى لوحته</p>
                    </div>
                    {!editingAgent && (
                      <Button type="button" variant="outline" onClick={generateCredentials}>
                        <Key className="h-4 w-4 ml-1" />
                        إنشاء تلقائي
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم المستخدم *</Label>
                      <div className="relative">
                        <Input
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          dir="ltr"
                          required
                          className="pl-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => copyToClipboard(formData.username)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>كلمة المرور *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.password_hash}
                          onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                          dir="ltr"
                          required
                          className="pl-20"
                        />
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(formData.password_hash)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                    <Label>الحساب نشط</Label>
                  </div>
                </TabsContent>

                {/* API */}
                <TabsContent value="api" className="space-y-4 mt-4">
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Link2 className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-900">ربط API للوكيل</p>
                          <p className="text-sm text-amber-700">
                            يتيح للوكيل ربط نظامه أو تطبيقه بنظامنا لتنفيذ عمليات البحث والحجز والإصدار تلقائياً.
                            مناسب للمحافظ البنكية والتطبيقات.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.api_enabled}
                        onCheckedChange={(v) => setFormData({ ...formData, api_enabled: v })}
                      />
                      <Label>تفعيل ربط API</Label>
                    </div>
                    <Button type="button" variant="outline" onClick={generateApiKeys}>
                      <Key className="h-4 w-4 ml-1" />
                      إنشاء مفاتيح جديدة
                    </Button>
                  </div>

                  {formData.api_enabled && (
                    <div className="space-y-4">
                      <div>
                        <Label>API Key</Label>
                        <div className="relative">
                          <Input value={formData.api_key || ''} readOnly dir="ltr" className="pl-10 bg-slate-50" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute left-1 top-1/2 -translate-y-1/2"
                            onClick={() => copyToClipboard(formData.api_key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>API Secret</Label>
                        <div className="relative">
                          <Input value={formData.api_secret || ''} readOnly dir="ltr" className="pl-10 bg-slate-50" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute left-1 top-1/2 -translate-y-1/2"
                            onClick={() => copyToClipboard(formData.api_secret)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button type="submit">{editingAgent ? 'حفظ التعديلات' : 'إضافة الوكيل'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* نافذة الإيداع */}
        <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إيداع رصيد للوكيل</DialogTitle>
            </DialogHeader>
            {selectedAgent && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  {selectedAgent.logo_url ? (
                    <img src={selectedAgent.logo_url} className="h-12 w-12 rounded-lg" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{selectedAgent.name}</p>
                    <p className="text-sm text-slate-500">الرصيد الحالي: ${selectedAgent.balance?.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div>
                  <Label>مبلغ الإيداع ($)</Label>
                  <Input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    placeholder="سبب الإيداع..."
                    rows={2}
                  />
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    الرصيد بعد الإيداع: <strong>${((selectedAgent.balance || 0) + depositAmount).toLocaleString()}</strong>
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>إلغاء</Button>
                  <Button onClick={handleDeposit} disabled={depositAmount <= 0}>
                    <DollarSign className="h-4 w-4 ml-1" />
                    تأكيد الإيداع
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}