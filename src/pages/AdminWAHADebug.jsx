import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { toast } from 'sonner';

export default function AdminWAHADebug() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState('');

  const loadGateway = async () => {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({
        type: 'customers',
        is_active: true
      });
      
      if (gateways[0]) {
        setServerUrl(gateways[0].waha_server_url);
        setApiKey(gateways[0].waha_api_key);
        toast.success('تم تحميل بيانات البوابة');
      }
    } catch (error) {
      toast.error('فشل التحميل');
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setResults('');
    let output = '';

    try {
      const client = new WAHAClient(serverUrl, apiKey);
      
      output += '🔄 اختبار الاتصال...\n\n';
      
      // 1. اختبار الاتصال الأساسي
      output += '1️⃣ اختبار الاتصال الأساسي:\n';
      try {
        const testResult = await client.testConnection();
        output += `✅ ${JSON.stringify(testResult, null, 2)}\n\n`;
      } catch (error) {
        output += `❌ ${error.message}\n\n`;
      }
      
      // 2. الحصول على الجلسة
      output += '2️⃣ الحصول على الجلسة:\n';
      try {
        const session = await client.getSession('default');
        output += `✅ الجلسة: ${JSON.stringify(session, null, 2)}\n\n`;
      } catch (error) {
        output += `❌ ${error.message}\n\n`;
      }
      
      // 3. جميع endpoints الممكنة للرسائل
      const endpoints = [
        '/api/messages?session=default&limit=10',
        '/api/default/messages?limit=10',
        '/api/sessions/default/messages?limit=10',
        '/messages?session=default&limit=10',
        '/api/default/chats'
      ];
      
      for (let i = 0; i < endpoints.length; i++) {
        output += `${i + 3}️⃣ اختبار: ${endpoints[i]}\n`;
        try {
          const response = await client.request(endpoints[i]);
          output += `✅ استجابة (${typeof response}):\n`;
          output += JSON.stringify(response, null, 2).substring(0, 500) + '...\n\n';
        } catch (error) {
          output += `❌ ${error.message}\n\n`;
        }
        setResults(output);
      }
      
      output += '\n✅ انتهى الاختبار';
      setResults(output);
      
    } catch (error) {
      output += `\n❌ خطأ عام: ${error.message}`;
      setResults(output);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 WAHA Debug Tool
          </h1>
          <p className="text-gray-600">اختبار وتشخيص الاتصال بخادم WAHA</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>بيانات الاتصال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Server URL</Label>
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>
            
            <div>
              <Label>API Key</Label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                placeholder="your-api-key"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={loadGateway} variant="outline">
                تحميل من البوابة
              </Button>
              <Button onClick={testConnection} disabled={testing || !serverUrl || !apiKey}>
                {testing ? 'جاري الاختبار...' : 'بدء الاختبار'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>النتائج</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={results}
                readOnly
                className="font-mono text-xs h-96"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}