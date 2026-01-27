import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Wallet, Upload, CheckCircle2, Loader2, AlertCircle, Plane, 
  Phone, Copy, ArrowRight, Shield, Clock, Info
} from 'lucide-react';
import { createPageUrl } from "@/utils";

export default function PaymentGateways() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [gateways, setGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState('select'); // select, details, upload, confirm
  const [receiptImage, setReceiptImage] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [analyzingReceipt, setAnalyzingReceipt] = useState(false);
  const [receiptAnalysis, setReceiptAnalysis] = useState(null);
  const [contactPhone, setContactPhone] = useState('');
  const [confirmContact, setConfirmContact] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking_id');
    const bookingType = urlParams.get('type');

    // جلب بوابات الدفع النشطة
    const gatewaysData = await base44.entities.PaymentGateway.filter({ 
      is_active: true 
    });
    setGateways(gatewaysData);

    // جلب بيانات الحجز
    if (bookingId && bookingType) {
      if (bookingType === 'external') {
        const bookings = await base44.entities.ExternalProviderBooking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking({ ...bookings[0], booking_type: 'external' });
          setContactPhone(bookings[0].customer_whatsapp || '');
        }
      } else {
        const bookings = await base44.entities.Booking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking({ ...bookings[0], booking_type: 'internal' });
          setContactPhone(bookings[0].customer_whatsapp || bookings[0].customer_phone || '');
        }
      }
    }
    setLoading(false);
  };

  const handleSelectGateway = (gateway) => {
    setSelectedGateway(gateway);
    setStep('details');
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingReceipt(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReceiptImage(file_url);
      toast.success('تم رفع إشعار الإيداع بنجاح');
      
      // تحليل الإشعار
      setAnalyzingReceipt(true);
      try {
        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: `حلل صورة إشعار الدفع هذه واستخرج المعلومات التالية:
          - اسم المستفيد (recipient_name)
          - رقم حساب المستفيد (recipient_account)
          - المبلغ (amount)
          - العملة (currency)
          - رقم العملية أو المرجع (reference)
          - التاريخ والوقت (datetime)
          - اسم المرسل (sender_name)
          
          أعد البيانات بتنسيق JSON فقط.`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              recipient_name: { type: "string" },
              recipient_account: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              reference: { type: "string" },
              datetime: { type: "string" },
              sender_name: { type: "string" },
              is_valid_receipt: { type: "boolean" }
            }
          }
        });
        
        setReceiptAnalysis(analysis);
        
        // التحقق من المطابقة
        const expectedAmount = booking?.total_price || booking?.total_amount;
        const amountMatch = Math.abs((analysis.amount || 0) - expectedAmount) < 1;
        const accountMatch = selectedGateway?.account_number && 
          analysis.recipient_account?.includes(selectedGateway.account_number.slice(-4));
        
        if (!amountMatch) {
          toast.warning('المبلغ في الإشعار قد لا يطابق المبلغ المطلوب');
        }
        
      } catch (err) {
        console.error('Error analyzing receipt:', err);
      }
      setAnalyzingReceipt(false);
      setStep('upload');
      
    } catch (err) {
      toast.error('فشل رفع الصورة');
    }
    setUploadingReceipt(false);
  };

  const handleConfirmPayment = async () => {
    if (!receiptImage) {
      toast.error('يرجى رفع صورة إشعار الإيداع');
      return;
    }

    setProcessing(true);
    try {
      const paymentRef = `PAY${Date.now().toString().slice(-8)}`;
      
      // تحديث الحجز
      if (booking.booking_type === 'external') {
        await base44.entities.ExternalProviderBooking.update(booking.id, {
          status: 'paid',
          payment_status: 'paid',
          payment_method: selectedGateway?.name || 'wallet',
          payment_reference: paymentRef,
          payment_proof_url: receiptImage,
          paid_at: new Date().toISOString(),
          customer_whatsapp: contactPhone
        });
      } else {
        await base44.entities.Booking.update(booking.id, {
          status: 'pending_issue',
          payment_status: 'paid',
          payment_method: selectedGateway?.name || 'wallet',
          payment_reference: paymentRef,
          payment_proof_url: receiptImage,
          customer_whatsapp: contactPhone
        });
      }

      toast.success('تم تأكيد الدفع! جاري معالجة طلبك');
      navigate(createPageUrl('BookingConfirmation') + '?booking_id=' + booking.id + '&type=' + booking.booking_type);
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('حدث خطأ أثناء معالجة الدفع');
      setProcessing(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const totalAmount = booking?.total_price || booking?.total_amount || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <ModernHeader />
        <div className="pt-24 pb-16 text-center">
          <AlertCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-700">الحجز غير موجود</h1>
        </div>
        <ModernFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      <ModernHeader />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* العنوان */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold text-slate-900 mb-2">إتمام الدفع</h1>
            <p className="text-lg text-slate-600">رقم الحجز: <span className="font-mono font-bold">{booking.booking_number}</span></p>
          </motion.div>

          {/* خطوات الدفع */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {['اختيار المحفظة', 'تفاصيل الدفع', 'رفع الإشعار', 'تأكيد'].map((label, index) => {
              const steps = ['select', 'details', 'upload', 'confirm'];
              const isActive = steps.indexOf(step) >= index;
              const isCurrent = steps[index] === step;
              return (
                <div key={index} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm mr-2 hidden md:block ${isActive ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                    {label}
                  </span>
                  {index < 3 && <ArrowRight className="h-4 w-4 mx-2 text-slate-300" />}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* المحتوى الرئيسي */}
            <div className="lg:col-span-2">
              {/* خطوة اختيار المحفظة */}
              {step === 'select' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-blue-600" />
                      اختر طريقة الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {gateways.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>لا توجد طرق دفع متاحة حالياً</AlertDescription>
                      </Alert>
                    ) : (
                      gateways.map((gateway) => (
                        <motion.button
                          key={gateway.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectGateway(gateway)}
                          className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50 transition-all flex items-center gap-4 text-right"
                        >
                          {gateway.logo_url ? (
                            <img src={gateway.logo_url} alt={gateway.name} className="h-12 w-12 rounded-xl object-contain" />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                              <Wallet className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-lg text-slate-900">{gateway.name}</p>
                            <p className="text-sm text-slate-500">{gateway.description || 'محفظة إلكترونية'}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-400" />
                        </motion.button>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {/* خطوة تفاصيل الدفع */}
              {step === 'details' && selectedGateway && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {selectedGateway.logo_url ? (
                          <img src={selectedGateway.logo_url} alt="" className="h-8 w-8 rounded-lg" />
                        ) : (
                          <Wallet className="h-5 w-5 text-blue-600" />
                        )}
                        {selectedGateway.name}
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
                        تغيير
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* تعليمات الدفع */}
                    <Alert className="bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        {selectedGateway.instructions || 'قم بتحويل المبلغ إلى الحساب المذكور أدناه ثم ارفع صورة الإشعار'}
                      </AlertDescription>
                    </Alert>

                    {/* بيانات الحساب */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                      <h4 className="font-bold text-slate-900 mb-3">بيانات التحويل</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-3 border">
                          <Label className="text-slate-500 text-xs">اسم المستفيد</Label>
                          <div className="flex items-center justify-between mt-1">
                            <p className="font-bold">{selectedGateway.account_name || 'غير محدد'}</p>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(selectedGateway.account_name, 'اسم المستفيد')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-3 border">
                          <Label className="text-slate-500 text-xs">رقم الحساب / المحفظة</Label>
                          <div className="flex items-center justify-between mt-1">
                            <p className="font-bold font-mono" dir="ltr">{selectedGateway.account_number || 'غير محدد'}</p>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(selectedGateway.account_number, 'رقم الحساب')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-100 rounded-lg p-4 text-center">
                        <Label className="text-green-700 text-sm">المبلغ المطلوب تحويله</Label>
                        <p className="text-3xl font-black text-green-700 mt-1">${totalAmount}</p>
                      </div>
                    </div>

                    {/* رفع الإشعار */}
                    <div>
                      <Label className="block mb-2 font-bold">صورة إشعار الإيداع *</Label>
                      <label className="cursor-pointer block">
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                          receiptImage 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptUpload}
                            className="hidden"
                          />
                          {uploadingReceipt ? (
                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                          ) : receiptImage ? (
                            <div className="space-y-3">
                              <img 
                                src={receiptImage} 
                                alt="إشعار الإيداع" 
                                className="max-h-48 mx-auto rounded-lg shadow"
                              />
                              <div className="flex items-center justify-center gap-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">تم رفع الإشعار بنجاح</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                              <p className="font-medium text-slate-700">اضغط لرفع صورة الإشعار</p>
                              <p className="text-sm text-slate-500 mt-1">PNG, JPG حتى 5MB</p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* خطوة رفع الإشعار والتحليل */}
              {step === 'upload' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      مراجعة بيانات الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* صورة الإشعار */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <img 
                        src={receiptImage} 
                        alt="إشعار الإيداع" 
                        className="max-h-64 mx-auto rounded-lg shadow"
                      />
                    </div>

                    {/* نتائج التحليل */}
                    {analyzingReceipt ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-2" />
                        <p className="text-slate-600">جاري تحليل الإشعار...</p>
                      </div>
                    ) : receiptAnalysis && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-900">البيانات المستخرجة</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {receiptAnalysis.recipient_name && (
                            <div className="bg-white p-3 rounded-lg border">
                              <Label className="text-slate-500 text-xs">اسم المستفيد</Label>
                              <p className="font-semibold">{receiptAnalysis.recipient_name}</p>
                            </div>
                          )}
                          {receiptAnalysis.amount && (
                            <div className="bg-white p-3 rounded-lg border">
                              <Label className="text-slate-500 text-xs">المبلغ</Label>
                              <p className="font-semibold">{receiptAnalysis.amount} {receiptAnalysis.currency}</p>
                            </div>
                          )}
                          {receiptAnalysis.reference && (
                            <div className="bg-white p-3 rounded-lg border">
                              <Label className="text-slate-500 text-xs">رقم المرجع</Label>
                              <p className="font-semibold font-mono">{receiptAnalysis.reference}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* رقم التواصل */}
                    <div>
                      <Label className="font-bold">رقم التواصل للمتابعة *</Label>
                      <p className="text-sm text-slate-500 mb-2">سيتم التواصل معك على هذا الرقم في حال وجود أي استفسار</p>
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="967XXXXXXXXX"
                        dir="ltr"
                        className="text-lg"
                      />
                    </div>

                    {/* زر التأكيد */}
                    <Button 
                      onClick={handleConfirmPayment}
                      disabled={processing || !contactPhone}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                          جاري المعالجة...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="ml-2 h-5 w-5" />
                          تأكيد الدفع
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-slate-500 text-center">
                      بالضغط على "تأكيد الدفع" فإنك توافق على أن البيانات المرفقة صحيحة
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ملخص الحجز */}
            <div className="lg:col-span-1">
              <Card className="sticky top-28 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-xl">
                  <CardTitle>ملخص الحجز</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Plane className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold">{booking.flight_data?.airline_name || booking.airline_name}</p>
                        <p className="text-sm text-slate-500 font-mono">{booking.flight_data?.flight_number || booking.flight_number}</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 space-y-1">
                      <p className="font-semibold">
                        {booking.flight_data?.departure_city || booking.departure_city} ← {booking.flight_data?.arrival_city || booking.arrival_city}
                      </p>
                      <p className="text-slate-500">
                        المسافرون: {booking.passenger_count || booking.passengers_count || 1}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-xl font-bold">
                    <span>الإجمالي</span>
                    <span className="text-green-600">${totalAmount}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>معاملاتك آمنة ومحمية</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ModernFooter />
    </div>
  );
}