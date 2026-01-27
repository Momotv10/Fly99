import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plane, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";

export default function SystemLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState('admin');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    if (type && ['admin', 'agent', 'provider', 'external_employee'].includes(type)) {
      setUserType(type);
    }
  }, []);

  const typeLabels = {
    admin: { title: 'مدير النظام', description: 'لوحة التحكم الرئيسية للنظام' },
    agent: { title: 'وكيل مبيعات', description: 'بوابة الوكلاء لإدارة الحجوزات' },
    provider: { title: 'مزود خدمة', description: 'بوابة المزودين لإدارة الرحلات والمقاعد' },
    external_employee: { title: 'موظف الإصدار', description: 'لوحة إصدار تذاكر المزود الخارجي' }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check hardcoded credentials first
    if (userType === 'admin' && username === 'admin' && password === 'admin123') {
      // Create/update admin user in system
      const existingAdmins = await base44.entities.SystemUser.filter({ username: 'admin', role: 'admin' });
      let adminUser;
      
      if (existingAdmins.length === 0) {
        adminUser = await base44.entities.SystemUser.create({
          full_name: 'مدير النظام',
          username: 'admin',
          password: 'admin123',
          password_hash: 'admin123',
          role: 'admin',
          permissions: ['all'],
          is_active: true,
          last_login: new Date().toISOString()
        });
      } else {
        adminUser = existingAdmins[0];
        await base44.entities.SystemUser.update(adminUser.id, { last_login: new Date().toISOString() });
      }
      
      localStorage.setItem('systemUser', JSON.stringify(adminUser));
      navigate(createPageUrl('AdminDashboard'));
      return;
    }

    if (userType === 'agent' && username === 'agent' && password === 'agent') {
      const existingAgents = await base44.entities.SystemUser.filter({ username: 'agent', role: 'agent' });
      let agentUser;
      
      if (existingAgents.length === 0) {
        agentUser = await base44.entities.SystemUser.create({
          full_name: 'وكيل مبيعات',
          username: 'agent',
          password: 'agent',
          role: 'agent',
          is_active: true,
          last_login: new Date().toISOString()
        });
      } else {
        agentUser = existingAgents[0];
        await base44.entities.SystemUser.update(agentUser.id, { last_login: new Date().toISOString() });
      }
      
      localStorage.setItem('systemUser', JSON.stringify(agentUser));
      navigate(createPageUrl('AgentDashboard'));
      return;
    }

    if (userType === 'provider' && username === 'pro' && password === 'pro') {
      const existingProviders = await base44.entities.SystemUser.filter({ username: 'pro', role: 'provider' });
      let providerUser;
      
      if (existingProviders.length === 0) {
        providerUser = await base44.entities.SystemUser.create({
          full_name: 'مزود خدمة',
          username: 'pro',
          password: 'pro',
          role: 'provider',
          is_active: true,
          last_login: new Date().toISOString()
        });
      } else {
        providerUser = existingProviders[0];
        await base44.entities.SystemUser.update(providerUser.id, { last_login: new Date().toISOString() });
      }
      
      localStorage.setItem('systemUser', JSON.stringify(providerUser));
      navigate(createPageUrl('ProviderDashboard'));
      return;
    }

    // البحث في موظفي المزود الخارجي
    if (userType === 'external_employee') {
      const employees = await base44.entities.ExternalProviderEmployee.filter({ 
        username,
        is_active: true
      });
      
      if (employees.length > 0 && employees[0].password_hash === password) {
        const emp = employees[0];
        const systemUser = {
          id: emp.id,
          full_name: emp.full_name,
          username: emp.username,
          role: emp.role || 'ticket_specialist',
          related_entity_id: emp.id,
          related_entity_type: 'external_employee'
        };
        
        localStorage.setItem('systemUser', JSON.stringify(systemUser));
        
        await base44.entities.ExternalProviderEmployee.update(emp.id, {
          last_login: new Date().toISOString()
        });
        
        navigate(createPageUrl('ExternalEmployeeDashboard'));
        setLoading(false);
        return;
      }
    }

    // Check database for other users - البحث بدون تصفية role
    const users = await base44.entities.SystemUser.filter({ 
      username
    });

    // التحقق من وجود المستخدم وتطابق كلمة المرور والدور
    const matchedUser = users.find(u => 
      (u.password_hash === password || u.password === password) &&
      u.is_active !== false
    );

    if (matchedUser) {
      const user = matchedUser;
      
      // تحديث آخر تسجيل دخول
      await base44.entities.SystemUser.update(user.id, { 
        last_login: new Date().toISOString(),
        login_count: (user.login_count || 0) + 1
      });

      // تحديث في Agent/Provider
      if (user.related_entity_id && user.related_entity_type) {
        const entityName = user.related_entity_type === 'agent' ? 'Agent' : 'Provider';
        await base44.entities[entityName].update(user.related_entity_id, {
          last_login: new Date().toISOString(),
          login_count: (user.login_count || 0) + 1
        });

        // إرسال رسالة ترحيب للمرة الأولى
        if ((user.login_count || 0) === 0) {
          const entity = user.related_entity_type === 'agent' 
            ? await base44.entities.Agent.filter({ id: user.related_entity_id })
            : await base44.entities.Provider.filter({ id: user.related_entity_id });
          
          if (entity.length > 0 && entity[0].whatsapp) {
            const welcomeMessage = `مرحباً بك في نظام ${user.related_entity_type === 'agent' ? 'الوكلاء' : 'المزودين'}! 🎉

بيانات الدخول:
• اليوزر: ${username}
• الباسورد: ${password}

⚠️ يُنصح بتغيير كلمة المرور من الإعدادات

رابط النظام: ${window.location.origin}${createPageUrl(user.related_entity_type === 'agent' ? 'AgentDashboard' : 'ProviderDashboard')}

نتمنى لك تجربة موفقة! 🚀`;

            try {
              await base44.integrations.Core.SendEmail({
                to: entity[0].email || 'support@example.com',
                subject: 'مرحباً بك في النظام',
                body: welcomeMessage
              });
            } catch (e) {
              console.log('Failed to send welcome message');
            }
          }
        }
      }
      
      localStorage.setItem('systemUser', JSON.stringify(user));
      
      switch (user.role) {
        case 'admin':
        case 'employee':
          navigate(createPageUrl('AdminDashboard'));
          break;
        case 'agent':
          navigate(createPageUrl('AgentDashboard'));
          break;
        case 'provider':
          navigate(createPageUrl('ProviderDashboard'));
          break;
        case 'external_employee':
        case 'ticket_specialist':
        case 'supervisor':
          navigate(createPageUrl('ExternalEmployeeDashboard'));
          break;
      }
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 bg-blue-100 rounded-2xl w-fit mb-4">
            <Plane className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">{typeLabels[userType].title}</CardTitle>
          <CardDescription>{typeLabels[userType].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pr-10"
                  placeholder="أدخل اسم المستخدم"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  placeholder="أدخل كلمة المرور"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-slate-500 mb-2">أو سجل دخول كـ:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(typeLabels).map((type) => (
                <Button
                  key={type}
                  variant={userType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUserType(type)}
                  className="text-xs"
                >
                  {typeLabels[type].title}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}