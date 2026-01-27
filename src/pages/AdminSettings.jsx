import React, { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from '@/api/base44Client';
import { 
  Shield, Key, Download, Database, RefreshCw, CheckCircle2,
  AlertTriangle, Lock, Loader2, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('كلمات المرور الجديدة غير متطابقة');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      const systemUser = JSON.parse(localStorage.getItem('systemUser'));
      
      // التحقق من كلمة المرور الحالية
      const users = await base44.entities.SystemUser.filter({ 
        id: systemUser.id,
        role: 'admin' 
      });
      
      if (users.length === 0 || (users[0].password !== currentPassword && users[0].password_hash !== currentPassword)) {
        toast.error('كلمة المرور الحالية غير صحيحة');
        setLoading(false);
        return;
      }

      // تحديث كلمة المرور
      await base44.entities.SystemUser.update(systemUser.id, {
        password: newPassword,
        password_hash: newPassword
      });

      // تحديث localStorage
      const updatedUser = { ...systemUser, password: newPassword };
      localStorage.setItem('systemUser', JSON.stringify(updatedUser));

      toast.success('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('فشل تغيير كلمة المرور');
    }
    setLoading(false);
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      // جلب جميع البيانات
      const [
        bookings,
        customers,
        agents,
        providers,
        airlines,
        airports,
        flights,
        seats,
        transactions
      ] = await Promise.all([
        base44.entities.Booking.list('-created_date', 5000),
        base44.entities.Customer.list('-created_date', 5000),
        base44.entities.Agent.list('-created_date', 1000),
        base44.entities.Provider.list('-created_date', 1000),
        base44.entities.Airline.list('name_ar', 1000),
        base44.entities.Airport.list('name_ar', 1000),
        base44.entities.Flight.list('-created_date', 5000),
        base44.entities.AvailableSeat.list('-created_date', 5000),
        base44.entities.AccountTransaction.list('-created_date', 5000)
      ]);

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          bookings,
          customers,
          agents,
          providers,
          airlines,
          airports,
          flights,
          seats,
          transactions
        },
        stats: {
          total_bookings: bookings.length,
          total_customers: customers.length,
          total_agents: agents.length,
          total_providers: providers.length,
          total_revenue: bookings
            .filter(b => b.payment_status === 'paid')
            .reduce((sum, b) => sum + (b.total_amount || 0), 0)
        }
      };

      // تحويل إلى JSON وتنزيل
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('تم إنشاء النسخة الاحتياطية بنجاح');
    } catch (error) {
      toast.error('فشل إنشاء النسخة الاحتياطية');
    }
    setBackupLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">الإعدادات</h1>
          <p className="text-slate-600">إدارة الحساب والأمان والنسخ الاحتياطي</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* تغيير كلمة المرور */}
          <Card className="shadow-xl border-0">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">تغيير كلمة المرور</CardTitle>
                  <CardDescription>قم بتحديث كلمة المرور الخاصة بك</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 text-sm">
                  تأكد من حفظ كلمة المرور الجديدة في مكان آمن
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">كلمة المرور الحالية</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10 h-11"
                      dir="ltr"
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-semibold">كلمة المرور الجديدة</Label>
                  <div className="relative mt-1">
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10 h-11"
                      placeholder="6 أحرف على الأقل"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">تأكيد كلمة المرور</Label>
                  <div className="relative mt-1">
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10 h-11"
                      dir="ltr"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      إخفاء كلمات المرور
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      إظهار كلمات المرور
                    </>
                  )}
                </button>
              </div>

              <Button 
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 ml-2" />
                    تحديث كلمة المرور
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* النسخ الاحتياطي */}
          <Card className="shadow-xl border-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-xl">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">النسخ الاحتياطي</CardTitle>
                  <CardDescription>حفظ نسخة احتياطية من البيانات</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <Alert className="bg-blue-50 border-blue-200">
                <Database className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                  سيتم تصدير جميع البيانات إلى ملف JSON يمكنك حفظه
                </AlertDescription>
              </Alert>

              <div className="space-y-3 text-sm">
                <p className="text-slate-600 font-medium">سيتم نسخ:</p>
                <ul className="space-y-2 mr-5">
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    جميع الحجوزات والتذاكر
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    بيانات العملاء والوكلاء
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    المزودين والرحلات
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    المطارات وشركات الطيران
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    المعاملات المالية
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">اسم الملف</span>
                  <span className="text-xs text-slate-500 font-mono">
                    backup-{new Date().toISOString().split('T')[0]}.json
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  سيتم تنزيل الملف تلقائياً بعد الإنشاء
                </p>
              </div>

              <Button 
                onClick={handleBackup}
                disabled={backupLoading}
                className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {backupLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 ml-2" />
                    إنشاء نسخة احتياطية
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* معلومات إضافية */}
        <Card className="mt-6 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              نصائح الأمان
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <Shield className="h-8 w-8 text-blue-600 mb-3" />
                <h4 className="font-semibold mb-2">كلمة مرور قوية</h4>
                <p className="text-sm text-slate-600">
                  استخدم أحرف كبيرة وصغيرة وأرقام ورموز
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <Database className="h-8 w-8 text-green-600 mb-3" />
                <h4 className="font-semibold mb-2">نسخ احتياطي دوري</h4>
                <p className="text-sm text-slate-600">
                  قم بإنشاء نسخة احتياطية أسبوعياً على الأقل
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <Lock className="h-8 w-8 text-amber-600 mb-3" />
                <h4 className="font-semibold mb-2">لا تشارك البيانات</h4>
                <p className="text-sm text-slate-600">
                  احفظ معلومات الدخول في مكان آمن
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}