import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ErrorReporter({ error, context, onClose }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');

  const handleSendError = async () => {
    setSending(true);

    try {
      // إنشاء تقرير الخطأ
      const errorReport = {
        error_message: error,
        context: context || 'WAHA Gateway Connection',
        additional_info: additionalInfo,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        app_url: window.location.href
      };

      // يمكن إرسال التقرير عبر Integration أو حفظه في Entity
      await base44.integrations.Core.InvokeLLM({
        prompt: `تحليل الخطأ التالي وتقديم حل:\n\nالخطأ: ${error}\n\nالسياق: ${context}\n\nمعلومات إضافية: ${additionalInfo}`,
        add_context_from_internet: false
      });

      setSent(true);
      toast.success('✅ تم إرسال تقرير الخطأ للمعالجة');

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      toast.error('فشل إرسال التقرير');
    }

    setSending(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            الإبلاغ عن خطأ ومعالجته
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sent ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>تم الإرسال بنجاح!</strong>
                <p className="text-sm mt-1">سيتم معالجة الخطأ وستحصل على حل قريباً</p>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>الخطأ:</strong>
                  <p className="text-sm mt-1 font-mono">{error}</p>
                </AlertDescription>
              </Alert>

              <div>
                <Label>السياق</Label>
                <p className="text-sm text-slate-600">{context || 'اتصال بوابة WAHA'}</p>
              </div>

              <div>
                <Label>معلومات إضافية (اختياري)</Label>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="أضف أي معلومات إضافية قد تساعد في حل المشكلة..."
                  rows={4}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  سيتم إرسال هذا الخطأ للذكاء الاصطناعي لتحليله وتقديم حل فوري
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="flex-1"
                  disabled={sending}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSendError}
                  disabled={sending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 ml-2" />
                      إرسال للمعالجة
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}