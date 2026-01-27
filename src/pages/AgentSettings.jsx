import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPageUrl } from "@/utils";
import { Settings, Key, User, Mail, Phone, Save, Shield, RefreshCw, Eye, EyeOff, Plus, Trash2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { AgentIPMiddleware } from '@/components/api/AgentIPMiddleware';

export default function AgentSettings() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [systemUser, setSystemUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    contact_person: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [currentIP, setCurrentIP] = useState(null);
  const [newIPInput, setNewIPInput] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('systemUser');
    if (!user) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const userData = JSON.parse(user);
    setSystemUser(userData);
    loadData(userData.related_entity_id);
  }, []);

  const loadData = async (agentId) => {
    try {
      const agentData = await base44.entities.Agent.filter({ id: agentId });
      if (agentData.length > 0) {
        setAgent(agentData[0]);
        setFormData({
          contact_person: agentData[0].contact_person || '',
          email: agentData[0].email || '',
          phone: agentData[0].phone || '',
          whatsapp: agentData[0].whatsapp || '',
          address: agentData[0].address || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
      
      // جلب IP الحالي
      const ip = await AgentIPMiddleware.getCurrentIP();
      setCurrentIP(ip);
      
      setLoading(false);
    } catch (e) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await base44.entities.Agent.update(agent.id, {
        contact_person: formData.contact_person,
        email: formData.email,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        address: formData.address
      });

      // تحديث SystemUser
      const users = await base44.entities.SystemUser.filter({ related_entity_id: agent.id });
      if (users.length > 0) {
        await base44.entities.SystemUser.update(users[0].id, {
          full_name: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          whatsapp: formData.whatsapp
        });
      }

      toast.success('تم حفظ التغييرات');
    } catch (e) {
      toast.error('فشل الحفظ');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword) {
      toast.error('يرجى إدخال كلمة المرور الحالية والجديدة');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    if (formData.currentPassword !== systemUser.password_hash) {
      toast.error('كلمة المرور الحالية غير صحيحة');
      return;
    }

    setSaving(true);
    try {
      // تحديث SystemUser
      const users = await base44.entities.SystemUser.filter({ related_entity_id: agent.id });
      if (users.length > 0) {
        await base44.entities.SystemUser.update(users[0].id, {
          password_hash: formData.newPassword
        });

        // تحديث Agent
        await base44.entities.Agent.update(agent.id, {
          password_hash: formData.newPassword
        });

        // تحديث localStorage
        const updatedUser = { ...systemUser, password_hash: formData.newPassword };
        localStorage.setItem('systemUser', JSON.stringify(updatedUser));
        setSystemUser(updatedUser);

        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        toast.success('تم تغيير كلمة المرور بنجاح');
      }
    } catch (e) {
      toast.error('فشل تغيير كلمة المرور');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">الإعدادات</h1>
            <p className="text-slate-600">إدارة معلوماتك الشخصية وإعدادات الحساب</p>
          </div>

          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
              <TabsTrigger value="security">الأمان</TabsTrigger>
            </TabsList>

            {/* Profile */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    معلومات الملف الشخصي
                  </CardTitle>
                  <CardDescription>تحديث معلومات الاتصال الخاصة بك</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم المسؤول</Label>
                      <Input
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
                      <Label>رقم الواتساب</Label>
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>العنوان</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving}>
                    <Save className="h-4 w-4 ml-2" />
                    حفظ التغييرات
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security */}
            <TabsContent value="security">
              <div className="space-y-6">
                {/* تغيير كلمة المرور */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      تغيير كلمة المرور
                    </CardTitle>
                    <CardDescription>قم بتحديث كلمة المرور الخاصة بك</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>كلمة المرور الحالية</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label>كلمة المرور الجديدة</Label>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <Label>تأكيد كلمة المرور</Label>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        dir="ltr"
                      />
                    </div>

                    <Button onClick={handleChangePassword} disabled={saving}>
                      <Key className="h-4 w-4 ml-2" />
                      تغيير كلمة المرور
                    </Button>
                  </CardContent>
                </Card>
                
                {/* إدارة القائمة البيضاء للـ IP */}
                {agent?.api_enabled && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-600" />
                        إدارة القائمة البيضاء للـ IP
                      </CardTitle>
                      <CardDescription>
                        عناوين IP المسموح لها بالوصول لـ API
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* IP الحالي */}
                      {currentIP && (
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-500">عنوان IP الحالي</p>
                              <p className="font-mono font-bold" dir="ltr">{currentIP}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                const result = await AgentIPMiddleware.addIPToWhitelist(agent.id, currentIP);
                                if (result.success) {
                                  toast.success(result.message);
                                  loadData(agent.id);
                                } else {
                                  toast.error(result.error);
                                }
                              }}
                              disabled={agent.api_whitelist_ips?.includes(currentIP)}
                            >
                              {agent.api_whitelist_ips?.includes(currentIP) ? 'مضاف بالفعل' : 'إضافة IP الحالي'}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* قائمة IPs المسموحة */}
                      <div>
                        <Label className="mb-2 block">عناوين IP المسموحة</Label>
                        <div className="space-y-2">
                          {(agent.api_whitelist_ips || []).map((ip, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <span className="font-mono" dir="ltr">{ip}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  const result = await AgentIPMiddleware.removeIPFromWhitelist(agent.id, ip);
                                  if (result.success) {
                                    toast.success(result.message);
                                    loadData(agent.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                          
                          {(!agent.api_whitelist_ips || agent.api_whitelist_ips.length === 0) && (
                            <p className="text-sm text-slate-500 text-center py-4">
                              لا توجد عناوين IP مضافة - جميع العناوين مسموحة حالياً
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* إضافة IP يدوياً */}
                      <div>
                        <Label>إضافة IP جديد</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newIPInput}
                            onChange={(e) => setNewIPInput(e.target.value)}
                            placeholder="مثال: 192.168.1.1"
                            dir="ltr"
                          />
                          <Button
                            onClick={async () => {
                              if (!newIPInput) {
                                toast.error('يرجى إدخال عنوان IP');
                                return;
                              }
                              const result = await AgentIPMiddleware.addIPToWhitelist(agent.id, newIPInput);
                              if (result.success) {
                                toast.success(result.message);
                                setNewIPInput('');
                                loadData(agent.id);
                              } else {
                                toast.error(result.error);
                              }
                            }}
                          >
                            <Plus className="h-4 w-4 ml-2" />
                            إضافة
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}