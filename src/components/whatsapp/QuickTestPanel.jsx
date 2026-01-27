import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { WAHAClient } from './WAHAClientClass';
import { toast } from "sonner";

export default function QuickTestPanel({ gateways }) {
  const [selectedGateway, setSelectedGateway] = useState('');
  const [phone, setPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const connectedGateways = gateways.filter(g => g.status === 'connected' && g.is_active);

  const handleQuickTest = async () => {
    if (!selectedGateway || !phone) {
      toast.error('اختر بوابة وأدخل الرقم');
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const gateway = gateways.find(g => g.id === selectedGateway);
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);

      await client.sendText(
        'default', // WAHA Core يستخدم 'default' دائماً
        phone,
        '✅ اختبار سريع - البوابة تعمل بنجاح!'
      );

      setResult({ success: true });
      toast.success('✅ تم الإرسال بنجاح');

      // تحديث العداد
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        messages_sent: (gateway.messages_sent || 0) + 1
      });
    } catch (error) {
      setResult({ success: false, error: error.message });
      toast.error('❌ فشل الإرسال');
    }

    setTesting(false);
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          اختبار سريع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>اختر البوابة</Label>
          <Select value={selectedGateway} onValueChange={setSelectedGateway}>
            <SelectTrigger>
              <SelectValue placeholder="اختر بوابة متصلة" />
            </SelectTrigger>
            <SelectContent>
              {connectedGateways.length === 0 ? (
                <SelectItem value="none" disabled>لا توجد بوابات متصلة</SelectItem>
              ) : (
                connectedGateways.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.phone_number})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>رقم الواتساب</Label>
          <Input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="967xxxxxxxxx"
          />
        </div>

        {result && (
          <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            {result.success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  تم الإرسال بنجاح!
                </AlertDescription>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {result.error}
                </AlertDescription>
              </>
            )}
          </Alert>
        )}

        <Button
          onClick={handleQuickTest}
          disabled={!selectedGateway || !phone || testing}
          className="w-full bg-blue-600"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 ml-2" />
              اختبار سريع
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}