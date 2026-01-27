import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Upload, Eye, Smartphone, CreditCard } from 'lucide-react';
import { toast } from "sonner";

// محاكي الدفع الذكي - بدون API حقيقي
// يحاكي عملية الدفع عبر المحافظ اليمنية باستخدام OCR

export default function PaymentSimulator({ bookingId, amount, gateway, onSuccess }) {
  const [step, setStep] = useState(1); // 1: تعليمات, 2: رفع إيصال, 3: تحقق
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [receiptImage, setReceiptImage] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReceiptImage(file_url);
      toast.success('تم رفع الإيصال');
      setStep(3);
      
      // بدء التحقق التلقائي
      await verifyPayment(file_url);
    } catch (error) {
      toast.error('فشل رفع الإيصال');
    }
    
    setUploading(false);
  };

  const verifyPayment = async (imageUrl) => {
    setVerifying(true);
    
    try {
      // استخدام OCR الذكي للتحقق
      const verification = await base44.integrations.Core.InvokeLLM({
        prompt: `حلل صورة إيصال الدفع هذه بدقة واستخرج المعلومات:

المبلغ المتوقع: $${amount}
رقم الحساب المتوقع: ${gateway.account_number}

استخرج من الصورة:
1. المبلغ المحول (بالدولار أو الريال)
2. رقم الحساب المستلم
3. تاريخ ووقت التحويل
4. رقم العملية/المرجع
5. اسم المحفظة (جيب/جوالي/إلخ)
6. حالة العملية (ناجحة/فاشلة)

تحقق:
- هل المبلغ مطابق أو أكبر؟
- هل رقم الحساب صحيح؟
- هل العملية ناجحة؟`,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            amount: { type: "number" },
            amount_in_yer: { type: "number" },
            account_number: { type: "string" },
            transaction_date: { type: "string" },
            transaction_time: { type: "string" },
            reference_number: { type: "string" },
            wallet_name: { type: "string" },
            transaction_status: { type: "string" },
            amount_matches: { type: "boolean" },
            account_matches: { type: "boolean" },
            is_successful: { type: "boolean" },
            is_valid: { type: "boolean" },
            confidence: { type: "number" },
            notes: { type: "string" }
          }
        }
      });
      
      setVerificationResult(verification);
      
      if (verification.is_valid && verification.is_successful) {
        // تحديث الحجز
        await base44.entities.Booking.update(bookingId, {
          payment_status: 'paid',
          payment_reference: verification.reference_number,
          payment_proof_url: imageUrl,
          status: 'pending_issue'
        });
        
        // تحديث بوابة الدفع
        await base44.entities.PaymentGateway.update(gateway.id, {
          total_transactions: (gateway.total_transactions || 0) + 1,
          total_amount: (gateway.total_amount || 0) + amount
        });
        
        toast.success('تم التحقق من الدفع بنجاح!');
        
        if (onSuccess) {
          onSuccess(verification);
        }
      } else {
        toast.error('فشل التحقق من الدفع - يرجى المحاولة مرة أخرى');
      }
    } catch (error) {
      toast.error('حدث خطأ في التحقق');
      setVerificationResult({
        is_valid: false,
        notes: 'حدث خطأ في التحليل'
      });
    }
    
    setVerifying(false);
  };

  return (
    <div className="space-y-6">
      {/* الخطوة 1: التعليمات */}
      {step === 1 && (
        <Card>
          <CardHeader style={{ backgroundColor: '#FF6B00', color: 'white' }}>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              الدفع عبر {gateway.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold mb-2">المبلغ المطلوب:</p>
              <p className="text-3xl font-bold text-blue-600">${amount}</p>
              <p className="text-sm text-slate-600 mt-1">
                ≈ {(amount * 250).toLocaleString()} ريال يمني (تقريباً)
              </p>
            </div>

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2 text-sm" dangerouslySetInnerHTML={{ __html: gateway.instructions_ar?.replace(/\n/g, '<br/>') }} />
              </AlertDescription>
            </Alert>

            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="font-semibold text-green-800 mb-1">معلومات التحويل:</p>
              <p className="text-sm" dir="ltr">رقم الحساب: <span className="font-mono font-bold">{gateway.account_number}</span></p>
              <p className="text-sm">باسم: <span className="font-semibold">{gateway.account_name}</span></p>
            </div>

            <Button 
              onClick={() => setStep(2)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              لقد قمت بالدفع - التالي
            </Button>
          </CardContent>
        </Card>
      )}

      {/* الخطوة 2: رفع الإيصال */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>رفع إيصال الدفع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertDescription>
                يرجى رفع صورة واضحة لإيصال الدفع من تطبيق المحفظة
              </AlertDescription>
            </Alert>

            <label className="cursor-pointer block">
              <div className="border-2 border-dashed rounded-lg p-12 hover:bg-slate-50 transition-colors text-center">
                {uploading ? (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
                    <p>جاري رفع الإيصال...</p>
                  </>
                ) : receiptImage ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="font-semibold">تم رفع الإيصال</p>
                    <img src={receiptImage} alt="" className="max-w-xs mx-auto mt-4 rounded border" />
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                    <p className="font-semibold mb-2">اضغط لرفع صورة الإيصال</p>
                    <p className="text-sm text-slate-500">PNG, JPG حتى 5MB</p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={handleReceiptUpload}
                disabled={uploading}
              />
            </label>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setStep(1)}
                className="flex-1"
              >
                رجوع
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* الخطوة 3: التحقق */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>التحقق من الدفع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifying ? (
              <div className="text-center py-12">
                <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-500 mb-4" />
                <p className="font-semibold text-lg">جاري التحقق من الدفع...</p>
                <p className="text-sm text-slate-500 mt-2">الذكاء الاصطناعي يقرأ ويحلل الإيصال</p>
              </div>
            ) : verificationResult ? (
              <div>
                {verificationResult.is_valid ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    <p className="text-2xl font-bold text-green-700 mb-2">تم التحقق بنجاح!</p>
                    <p className="text-slate-600">تم تأكيد دفعتك وسيتم معالجة حجزك</p>
                    
                    <div className="mt-6 p-4 bg-green-50 rounded-lg text-right space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">المبلغ المحول:</span>
                        <span className="font-semibold">${verificationResult.amount}</span>
                      </div>
                      {verificationResult.amount_in_yer && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">بالريال:</span>
                          <span className="font-semibold">{verificationResult.amount_in_yer} ريال</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-600">رقم العملية:</span>
                        <span className="font-mono">{verificationResult.reference_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">التاريخ:</span>
                        <span>{verificationResult.transaction_date} {verificationResult.transaction_time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">نسبة الثقة:</span>
                        <Badge>{Math.round(verificationResult.confidence * 100)}%</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                    <p className="text-2xl font-bold text-red-700 mb-2">فشل التحقق</p>
                    <p className="text-slate-600 mb-4">{verificationResult.notes}</p>
                    
                    <div className="space-y-2 text-sm text-right p-4 bg-red-50 rounded-lg">
                      {!verificationResult.amount_matches && (
                        <p className="text-red-600">• المبلغ غير مطابق</p>
                      )}
                      {!verificationResult.account_matches && (
                        <p className="text-red-600">• رقم الحساب غير صحيح</p>
                      )}
                      {!verificationResult.is_successful && (
                        <p className="text-red-600">• العملية غير ناجحة</p>
                      )}
                    </div>
                    
                    <Button 
                      onClick={() => {
                        setStep(2);
                        setReceiptImage(null);
                        setVerificationResult(null);
                      }}
                      className="mt-4"
                    >
                      رفع إيصال جديد
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {receiptImage && !verifying && !verificationResult && (
              <div className="text-center">
                <img src={receiptImage} alt="" className="max-w-md mx-auto rounded border mb-4" />
                <Button 
                  onClick={() => verifyPayment(receiptImage)}
                  className="bg-blue-600"
                >
                  بدء التحقق
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}