import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Zap, Info } from 'lucide-react';
import { WAHAClient } from './WAHAClientClass';

export default function WAHAConnectionTester() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    if (!url) {
      setResult({ success: false, error: 'أدخل الرابط أولاً' });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const client = new WAHAClient(url, apiKey);
      const testResult = await client.testConnection();
      setResult(testResult);
    } catch (error) {
      setResult({
        success: false,
        error: error.message || 'خطأ غير متوقع'
      });
    }

    setTesting(false);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          اختبار اتصال WAHA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            استخدم هذه الأداة لاختبار الاتصال بخادم WAHA قبل إنشاء البوابة
          </AlertDescription>
        </Alert>

        <div>
          <Label>رابط الخادم</Label>
          <Input
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000 أو https://waha.example.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            أمثلة: http://localhost:3000 | https://waha.yourdomain.com
          </p>
        </div>

        <div>
          <Label>مفتاح API (اختياري)</Label>
          <Input
            dir="ltr"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="api-key (اتركه فارغاً إذا لم تستخدم API key)"
          />
        </div>

        <Button
          onClick={runTest}
          disabled={testing || !url}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              جاري الاختبار...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 ml-2" />
              اختبار الآن
            </>
          )}
        </Button>

        {result && (
          <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            {result.success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <p className="font-semibold text-green-900">✓ الاتصال ناجح!</p>
                  <p className="text-sm text-green-700 mt-1">
                    الخادم يعمل بشكل صحيح
                  </p>
                  {result.endpoint && (
                    <p className="text-xs text-green-600 mt-1 font-mono">
                      Endpoint: {result.endpoint}
                    </p>
                  )}
                </AlertDescription>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <p className="font-semibold text-red-900">✗ فشل الاتصال</p>
                  <p className="text-sm text-red-700 mt-1">{result.error}</p>
                  {result.details && (
                    <p className="text-xs text-red-600 mt-1">{result.details}</p>
                  )}
                </AlertDescription>
              </>
            )}
          </Alert>
        )}

        <div className="p-4 bg-blue-50 rounded-lg text-sm space-y-2">
          <p className="font-semibold text-blue-900">💡 نصائح:</p>
          <ul className="list-disc mr-5 text-blue-800 space-y-1">
            <li>تأكد أن خادم WAHA يعمل</li>
            <li>الرابط يجب أن يكون بدون /api في النهاية</li>
            <li>إذا كنت تستخدم localhost، تأكد من المنفذ (Port)</li>
            <li>بعض الخوادم تحتاج API Key وبعضها لا</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}