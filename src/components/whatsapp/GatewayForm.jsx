import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, XCircle, Activity, AlertCircle } from 'lucide-react';
import { WAHAClient } from './WAHAClientClass';
import ErrorReporter from './ErrorReporter';
import { toast } from "sonner";

export default function GatewayForm({ gateway, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: gateway?.name || '',
    type: gateway?.type || 'customers',
    waha_server_url: gateway?.waha_server_url || '',
    waha_api_key: gateway?.waha_api_key || '',
    is_default: gateway?.is_default || false,
    is_active: gateway?.is_active !== false
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showErrorReporter, setShowErrorReporter] = useState(false);
  const [lastError, setLastError] = useState(null);

  const handleTest = async () => {
    if (!formData.waha_server_url) {
      toast.error('أدخل رابط الخادم أولاً');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setLastError(null);

    try {
      const client = new WAHAClient(
        formData.waha_server_url,
        formData.waha_api_key || ''
      );
      
      const result = await client.testConnection();
      
      if (!result.success) {
        setLastError(result.error);
        setTestResult(result);
        toast.error(`❌ ${result.error}`);
        setTesting(false);
        return;
      }

      setTestResult({ success: true });
      toast.success('✅ الاتصال بالخادم ناجح - جاهز للحفظ');
      
    } catch (error) {
      console.error('Test error:', error);
      const errorMsg = error.message || 'فشل الاتصال';
      setLastError(errorMsg);
      setTestResult({
        success: false,
        error: errorMsg,
        details: 'تحقق من الرابط ومفتاح API'
      });
      toast.error('❌ ' + errorMsg);
    }
    
    setTesting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.waha_server_url || !formData.waha_api_key) {
      toast.error('املأ جميع الحقول المطلوبة');
      return;
    }

    if (!testResult?.success) {
      toast.error('يجب اختبار الاتصال بنجاح أولاً');
      return;
    }

    try {
      const saveData = {
        ...formData,
        session_id: 'default',
        status: 'disconnected'
      };
      
      await onSave(saveData);
    } catch (error) {
      toast.error('فشل الحفظ: ' + error.message);
    }
  };

  const typeOptions = {
    customers: {
      name: 'العملاء',
      desc: 'إرسال التذاكر والإشعارات للعملاء'
    },
    providers: {
      name: 'المزودين',
      desc: 'التواصل الذكي التلقائي مع المزودين'
    },
    employees: {
      name: 'الموظفين',
      desc: 'التواصل الداخلي والإشعارات للموظفين'
    }
  };

  return (
    <>
      {showErrorReporter && lastError && (
        <ErrorReporter
          error={lastError}
          context={`WAHA Gateway: ${formData.name} | URL: ${formData.waha_server_url}`}
          onClose={() => setShowErrorReporter(false)}
        />
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>اسم البوابة *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="بوابة العملاء الرئيسية"
          required
        />
      </div>

      <div>
        <Label>نوع البوابة *</Label>
        <Select 
          value={formData.type}
          onValueChange={(v) => setFormData({...formData, type: v})}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(typeOptions).map(([key, info]) => (
              <SelectItem key={key} value={key}>
                <div>
                  <p className="font-semibold">{info.name}</p>
                  <p className="text-xs text-slate-500">{info.desc}</p>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm font-semibold mb-2">⚙️ إعدادات خادم WAHA</p>
        <p className="text-xs text-slate-600">
          كل بوابة يجب أن يكون لها خادم WAHA مستقل خاص بها
        </p>
      </div>

      <div>
        <Label>رابط خادم WAHA (URL) *</Label>
        <Input
          dir="ltr"
          value={formData.waha_server_url}
          onChange={(e) => setFormData({...formData, waha_server_url: e.target.value})}
          placeholder="https://waha.example.com/api"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          مثال: https://waha.yemencode.info/api
        </p>
      </div>

      <div>
        <Label>مفتاح API (API Key) *</Label>
        <Input
          dir="ltr"
          type="password"
          value={formData.waha_api_key}
          onChange={(e) => setFormData({...formData, waha_api_key: e.target.value})}
          placeholder="your-api-key-here"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          المفتاح السري للوصول إلى خادم WAHA
        </p>
      </div>

      {testResult && (
        <Alert className={testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>✅ نجح الاتصال بالخادم!</strong>
                <p className="text-sm mt-1">يمكنك الحفظ الآن واستخدام البوابة</p>
              </AlertDescription>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>❌ فشل الاتصال</strong>
                <p className="text-sm mt-1">{testResult.error}</p>
                {testResult.details && (
                  <p className="text-xs mt-1">{testResult.details}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowErrorReporter(true)}
                  className="mt-2 text-red-600 border-red-300"
                >
                  <AlertCircle className="h-3 w-3 ml-1" />
                  إرسال الخطأ للمعالجة
                </Button>
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handleTest}
        disabled={!formData.waha_server_url || !formData.waha_api_key || testing}
        className="w-full"
      >
        {testing ? (
          <>
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            جاري اختبار الاتصال...
          </>
        ) : (
          <>
            <Activity className="h-4 w-4 ml-2" />
            اختبار الاتصال بخادم WAHA
          </>
        )}
      </Button>

      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded">
        <Switch
          checked={formData.is_default}
          onCheckedChange={(v) => setFormData({...formData, is_default: v})}
        />
        <Label>جعلها البوابة الافتراضية لهذا النوع</Label>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button 
          type="submit" 
          className="bg-green-600 hover:bg-green-700"
          disabled={!testResult?.success}
        >
          {gateway ? 'تحديث البوابة' : 'حفظ البوابة'}
        </Button>
      </div>
    </form>
    </>
  );
}