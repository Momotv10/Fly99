import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Pencil, Trash2, Search, Users, Phone, Key, Eye, EyeOff, 
  DollarSign, Loader2, CheckCircle2, Mail
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function ProviderAgents() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    username: '',
    password: '',
    balance: 0,
    credit_limit: 0,
    commission_percentage: 0,
    is_active: true
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
    const [providerData, agentsData] = await Promise.all([
      base44.entities.Provider.filter({ id: providerId }),
      base44.entities.ProviderAgent.filter({ provider_id: providerId }, '-created_date')
    ]);
    
    if (providerData.length > 0) {
      setProvider(providerData[0]);
    }
    
    setAgents(agentsData);
    setLoading(false);
  };

  const generateCredentials = () => {
    const username = `${provider?.username || 'pro'}_agent_${Date.now().toString(36)}`;
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    setFormData({ ...formData, username, password });
    toast.success('تم إنشاء بيانات الدخول');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingAgent) {
        await base44.entities.ProviderAgent.update(editingAgent.id, {
          ...formData,
          password_hash: formData.password
        });
        toast.success('تم تحديث الوكيل بنجاح');
      } else {
        // إنشاء الوكيل
        const agent = await base44.entities.ProviderAgent.create({
          ...formData,
          provider_id: provider.id,
          provider_name: provider.company_name_ar,
          password_hash: formData.password,
          total_bookings: 0,
          total_sales: 0,
          total_commission: 0
        });
        
        // إنشاء حساب مالي للوكيل
        const account = await base44.entities.Account.create({
          name: `وكيل ${provider.company_name_ar} - ${formData.name}`,
          type: 'asset',
          category: 'agent',
          related_entity_type: 'provider_agent',
          related_entity_id: agent.id,
          balance: formData.balance || 0,
          is_system: false,
          is_active: true
        });
        
        // تحديث الوكيل بمعرف الحساب
        await base44.entities.ProviderAgent.update(agent.id, {
          account_id: account.id
        });
        
        // إرسال رسالة ترحيب
        await sendWelcomeMessage(formData);
        
        toast.success('تم إضافة الوكيل بنجاح');
      }
      
      setDialogOpen(false);
      resetForm();
      loadData(provider.id);
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
        const loginUrl = `${window.location.origin}${createPageUrl('SystemLogin')}?type=agent`;
        const welcomeMessage = `🎉 مرحباً بك كوكيل معتمد لـ ${provider.company_name_ar}!

تم إنشاء حسابك بنجاح.

📋 بيانات الدخول:
• اسم المستخدم: ${data.username}
• كلمة المرور: ${data.password}
• الرصيد الافتتاحي: $${data.balance || 0}

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
      }
    } catch (error) {
      console.log('فشل إرسال رسالة واتساب:', error);
    }
  };

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      whatsapp: agent.whatsapp || '',
      username: agent.username || '',
      password: agent.password_hash || '',
      balance: agent.balance || 0,
      credit_limit: agent.credit_limit || 0,
      commission_percentage: agent.commission_percentage || 0,
      is_active: agent.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف الوكيل؟')) {
      await base44.entities.ProviderAgent.delete(id);
      toast.success('تم حذف الوكيل');
      loadData(provider.id);
    }
  };

  const resetForm = () => {
    setEditingAgent(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      username: '',
      password: '',
      balance: 0,
      credit_limit: 0,
      commission_percentage: 0,
      is_active: true
    });
  };

  const filteredAgents = agents.filter(a => 
    a.name?.includes(searchTerm) ||
    a.phone?.includes(searchTerm) ||
    a.username?.includes(searchTerm)
  );

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-6 w-6" />
              إدارة الوكلاء
            </h1>
            <p className="text-slate-600">إدارة الوكلاء التابعين لك</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة وكيل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAgent ? 'تعديل الوكيل' : 'إضافة وكيل جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* المعلومات الأساسية */}
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">المعلومات الأساسية</h3>
                  
                  <div>
                    <Label>اسم الوكيل *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
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
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* الإعدادات المالية */}
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">الإعدادات المالية</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>الرصيد الافتتاحي</Label>
                      <div className="relative">
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.balance}
                          onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                          className="pr-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>حد الائتمان</Label>
                      <div className="relative">
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.credit_limit}
                          onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                          className="pr-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>نسبة العمولة %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.commission_percentage}
                        onChange={(e) => setFormData({ ...formData, commission_percentage: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                {/* بيانات الدخول */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold">بيانات الدخول</h3>
                    {!editingAgent && (
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
                      {formData.is_active ? 'الحساب نشط' : 'الحساب معطل'}
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
                      editingAgent ? 'تحديث' : 'إضافة'
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
                placeholder="بحث عن وكيل..."
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
                    <TableHead>الوكيل</TableHead>
                    <TableHead>التواصل</TableHead>
                    <TableHead>الرصيد</TableHead>
                    <TableHead>العمولة</TableHead>
                    <TableHead>الإحصائيات</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{agent.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{agent.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{agent.whatsapp}</span>
                          </div>
                          {agent.email && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Mail className="h-3 w-3" />
                              <span className="text-xs">{agent.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={`font-semibold ${agent.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${(agent.balance || 0).toLocaleString()}
                        </p>
                        {agent.credit_limit > 0 && (
                          <p className="text-xs text-slate-500">حد: ${agent.credit_limit}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.commission_percentage || 0}%</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{agent.total_bookings || 0} حجز</p>
                          <p className="text-xs text-slate-500">${(agent.total_sales || 0).toLocaleString()}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={agent.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {agent.is_active !== false ? 'نشط' : 'معطل'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(agent.id)}>
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
              <div className="text-center py-12 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد وكلاء</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة أول وكيل
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}