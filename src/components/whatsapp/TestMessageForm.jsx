import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, Info, Phone, ContactRound } from 'lucide-react';
import { WAHAClient } from './WAHAClientClass';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function TestMessageForm({ gateway, onClose }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('مرحباً، هذه رسالة تجريبية من نظام الحجوزات 🎫');
  const [sending, setSending] = useState(false);

  const formatPhone = (value) => {
    // إزالة كل شيء ما عدا الأرقام
    return value.replace(/\D/g, '');
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSend = async () => {
    if (!phone || !message) {
      toast.error('أدخل الرقم والرسالة');
      return;
    }

    if (gateway.status !== 'connected') {
      toast.error('❌ البوابة غير متصلة - اضغط اتصال أولاً');
      return;
    }

    setSending(true);

    try {
      const client = new WAHAClient(
        gateway.waha_server_url,
        gateway.waha_api_key
      );

      await client.sendText('default', phone, message);

      toast.success('✅ تم إرسال الرسالة بنجاح');
      
      if (gateway.id) {
        await base44.entities.WhatsAppGateway.update(gateway.id, {
          messages_sent: (gateway.messages_sent || 0) + 1,
          last_test_at: new Date().toISOString()
        });
      }

      onClose();
    } catch (error) {
      console.error('خطأ الإرسال:', error);
      toast.error(`❌ فشل الإرسال: ${error.message}`);
    }

    setSending(false);
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          أرسل رسالة تجريبية للتأكد من عمل البوابة بشكل صحيح
        </AlertDescription>
      </Alert>

      <div>
        <Label className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          رقم الواتساب
        </Label>
        <Input
          dir="ltr"
          value={phone}
          onChange={handlePhoneChange}
          placeholder="967xxxxxxxxx"
          className="text-left font-mono"
        />
        <p className="text-xs text-slate-500 mt-1">
          أدخل الرقم بدون + أو 00 (مثال: 967770123456)
        </p>
      </div>

      <div>
        <Label className="flex items-center gap-2">
          <ContactRound className="h-4 w-4" />
          نص الرسالة
        </Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب الرسالة التجريبية هنا..."
          rows={5}
        />
        <p className="text-xs text-slate-500 mt-1">
          عدد الأحرف: {message.length}
        </p>
      </div>

      {gateway.phone_number && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            سيتم الإرسال من: <span className="font-mono font-semibold">{gateway.phone_number}</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-2">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="flex-1"
          disabled={sending}
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSend}
          disabled={!phone || !message || sending}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 ml-2" />
              إرسال الرسالة
            </>
          )}
        </Button>
      </div>
    </div>
  );
}