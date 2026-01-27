import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Upload, AlertCircle } from 'lucide-react';
import { toast } from "sonner";

// نظام التحقق من الدفع بالذكاء الاصطناعي
export const PaymentVerificationService = {
  
  // التحقق من صورة إيصال الدفع
  async verifyPaymentReceipt(imageUrl, expectedAmount, expectedAccount) {
    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `حلل صورة إيصال الدفع هذه واستخرج المعلومات التالية:

التحقق المطلوب:
- المبلغ المتوقع: ${expectedAmount}
- رقم الحساب المتوقع: ${expectedAccount}

استخرج من الصورة:
1. المبلغ المحول
2. رقم الحساب المستلم
3. تاريخ ووقت التحويل
4. رقم العملية/المرجع
5. اسم المرسل (إن وجد)

تحقق هل:
- المبلغ مطابق أو أكبر من المتوقع؟
- رقم الحساب مطابق؟`,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            amount: { type: "number" },
            account_number: { type: "string" },
            transaction_date: { type: "string" },
            transaction_time: { type: "string" },
            reference_number: { type: "string" },
            sender_name: { type: "string" },
            amount_matches: { type: "boolean" },
            account_matches: { type: "boolean" },
            is_valid: { type: "boolean" },
            confidence: { type: "number" },
            notes: { type: "string" }
          }
        }
      });

      return {
        success: true,
        data: analysis,
        verified: analysis.is_valid && analysis.amount_matches && analysis.account_matches
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        verified: false
      };
    }
  },

  // معالجة الدفعات المعلقة
  async processPendingPayments() {
    const pendingBookings = await base44.entities.Booking.filter({
      payment_status: 'pending',
      payment_proof_url: { $exists: true, $ne: '' }
    });

    const results = [];
    
    for (const booking of pendingBookings) {
      const gateway = await base44.entities.PaymentGateway.filter({ id: booking.payment_gateway_id });
      if (gateway.length === 0) continue;
      
      const gatewayData = gateway[0];
      
      if (gatewayData.verification_method === 'ai_ocr') {
        const verification = await this.verifyPaymentReceipt(
          booking.payment_proof_url,
          booking.total_amount,
          gatewayData.account_number
        );
        
        results.push({
          booking_id: booking.id,
          booking_number: booking.booking_number,
          verification
        });
        
        if (verification.verified) {
          // تحديث حالة الحجز
          await base44.entities.Booking.update(booking.id, {
            payment_status: 'paid',
            payment_reference: verification.data.reference_number,
            status: 'pending_issue'
          });
          
          // إنشاء قيد مالي
          await this.createPaymentJournalEntry(booking, gatewayData, verification.data);
        }
      }
    }
    
    return results;
  },

  // إنشاء قيد مالي للدفع
  async createPaymentJournalEntry(booking, gateway, verificationData) {
    const entryNumber = `PAY-${Date.now()}`;
    
    await base44.entities.JournalEntry.create({
      entry_number: entryNumber,
      entry_date: new Date().toISOString().split('T')[0],
      description: `دفعة حجز ${booking.booking_number} عبر ${gateway.name}`,
      reference_type: 'payment',
      reference_id: booking.id,
      entries: [
        {
          account_id: gateway.account_id,
          account_name: gateway.name,
          debit: booking.total_amount,
          credit: 0,
          description: `استلام دفعة - مرجع: ${verificationData.reference_number}`
        },
        {
          account_id: 'sales',
          account_name: 'مبيعات التذاكر',
          debit: 0,
          credit: booking.total_amount,
          description: `مبيعات تذكرة ${booking.booking_number}`
        }
      ],
      total_debit: booking.total_amount,
      total_credit: booking.total_amount,
      is_balanced: true,
      status: 'posted'
    });
  }
};

// مكون التحقق من الدفع
export default function PaymentVerificationPanel({ bookingId }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // تحديث الحجز برابط الإيصال
      await base44.entities.Booking.update(bookingId, {
        payment_proof_url: file_url
      });
      
      // بدء التحقق
      await verifyPayment(file_url);
    } catch (error) {
      toast.error('فشل رفع الإيصال');
    }
    
    setUploading(false);
  };

  const verifyPayment = async (imageUrl) => {
    setVerifying(true);
    
    try {
      const booking = await base44.entities.Booking.filter({ id: bookingId });
      if (booking.length === 0) {
        throw new Error('الحجز غير موجود');
      }
      
      const bookingData = booking[0];
      
      // جلب بوابة الدفع
      const gateway = await base44.entities.PaymentGateway.list();
      const activeGateway = gateway.find(g => g.is_active);
      
      if (!activeGateway) {
        throw new Error('لا توجد بوابة دفع نشطة');
      }
      
      const verification = await PaymentVerificationService.verifyPaymentReceipt(
        imageUrl,
        bookingData.total_amount,
        activeGateway.account_number
      );
      
      setResult(verification);
      
      if (verification.verified) {
        toast.success('تم التحقق من الدفع بنجاح');
      } else {
        toast.error('فشل التحقق من الدفع');
      }
    } catch (error) {
      toast.error(error.message);
      setResult({ success: false, error: error.message });
    }
    
    setVerifying(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          التحقق من الدفع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && (
          <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg hover:bg-slate-50">
            {uploading || verifying ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <span className="text-sm text-slate-600">
                  {uploading ? 'جاري رفع الإيصال...' : 'جاري التحقق...'}
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600">ارفع صورة إيصال الدفع</span>
                <span className="text-xs text-slate-400 mt-1">سيتم التحقق تلقائياً</span>
              </>
            )}
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleUploadReceipt}
              disabled={uploading || verifying}
            />
          </label>
        )}
        
        {result && (
          <div className={`p-4 rounded-lg ${result.verified ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.verified ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <span className="font-semibold text-green-800">تم التحقق بنجاح</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  <span className="font-semibold text-red-800">فشل التحقق</span>
                </>
              )}
            </div>
            
            {result.data && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">المبلغ:</span>
                  <span className={result.data.amount_matches ? 'text-green-600' : 'text-red-600'}>
                    {result.data.amount} {result.data.amount_matches ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الحساب:</span>
                  <span className={result.data.account_matches ? 'text-green-600' : 'text-red-600'}>
                    {result.data.account_number} {result.data.account_matches ? '✓' : '✗'}
                  </span>
                </div>
                {result.data.reference_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">رقم المرجع:</span>
                    <span>{result.data.reference_number}</span>
                  </div>
                )}
                {result.data.transaction_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">التاريخ:</span>
                    <span>{result.data.transaction_date} {result.data.transaction_time}</span>
                  </div>
                )}
                {result.data.confidence && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">نسبة الثقة:</span>
                    <Badge variant="outline">{Math.round(result.data.confidence * 100)}%</Badge>
                  </div>
                )}
                {result.data.notes && (
                  <p className="text-slate-500 mt-2">{result.data.notes}</p>
                )}
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => setResult(null)}
            >
              رفع إيصال جديد
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}