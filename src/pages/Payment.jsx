import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CreditCard, Wallet, Building2, Banknote, Lock, Shield, CheckCircle2, Loader2, AlertCircle, Plane, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { externalProviderAI } from '@/components/ai/ExternalProviderAI';
import { createPageUrl } from "@/utils";

export default function Payment() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [error, setError] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingReceipt(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReceiptImage(file_url);
      toast.success('تم رفع إشعار الإيداع بنجاح');
    } catch (err) {
      toast.error('فشل رفع الصورة');
    }
    setUploadingReceipt(false);
  };

  useEffect(() => {
    loadBooking();
  }, []);

  const loadBooking = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking_id');
    const bookingType = urlParams.get('type'); // 'internal' or 'external'
    const amount = urlParams.get('amount');

    if (bookingId && bookingType) {
      if (bookingType === 'external') {
        const bookings = await base44.entities.ExternalProviderBooking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking({ ...bookings[0], booking_type: 'external' });
        }
      } else {
        const bookings = await base44.entities.Booking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking({ ...bookings[0], booking_type: 'internal' });
          
          // Load flight details for internal booking
          if (bookings[0].flight_id) {
            const flights = await base44.entities.Flight.filter({ id: bookings[0].flight_id });
            if (flights.length > 0) {
              setFlight(flights[0]);
            }
          }
        }
      }
    }
    setLoading(false);
  };

  const handlePayment = async () => {
    if (!selectedGateway) {
      toast.error('يرجى اختيار المحفظة للدفع');
      return;
    }
    
    if (!receiptImage) {
      toast.error('يرجى رفع صورة إشعار الإيداع');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const paymentRef = `PAY${Date.now().toString().slice(-8)}`;

      if (booking.booking_type === 'external') {
        // تحديث ExternalProviderBooking - معلقة حتى تأكيد المدير
        await base44.entities.ExternalProviderBooking.update(booking.id, {
          payment_status: 'pending',
          status: 'pending_payment',
          payment_method: 'wallet',
          payment_reference: paymentRef,
          payment_proof_url: receiptImage
        });

        toast.success('تم إرسال إثبات الدفع! بانتظار تأكيد مدير النظام');
        navigate(createPageUrl('BookingConfirmation') + '?booking_id=' + booking.id + '&type=external');
        
      } else {
        await base44.entities.Booking.update(booking.id, {
          status: 'pending_payment',
          payment_status: 'pending',
          payment_method: 'wallet',
          payment_reference: paymentRef,
          payment_proof_url: receiptImage
        });

        toast.success('تم إرسال إثبات الدفع! بانتظار تأكيد مدير النظام');
        navigate(createPageUrl('BookingConfirmation') + '?booking_id=' + booking.id + '&type=internal');
      }

    } catch (error) {
      console.error('Payment error:', error);
      setError('حدث خطأ أثناء معالجة الدفع. يرجى المحاولة مرة أخرى.');
      setProcessing(false);
    }
  };

  const [paymentGateways, setPaymentGateways] = useState([]);
  
  useEffect(() => {
    loadPaymentGateways();
  }, []);
  
  const loadPaymentGateways = async () => {
    const gateways = await base44.entities.PaymentGateway.filter({ is_active: true });
    setPaymentGateways(gateways);
  };

  // عرض المحافظ المفعلة فقط من قبل المدير
  const activeGateways = paymentGateways.filter(g => g.is_active);

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

  const totalAmount = booking.total_price || booking.total_amount || 0;
  const isExternal = booking.booking_type === 'external';
  const flightData = booking.flight_data || flight || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      <ModernHeader />

      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold text-slate-900 mb-2">إتمام الدفع</h1>
            <p className="text-lg text-slate-600">رقم الحجز: <span className="font-mono font-bold">{booking.booking_number}</span></p>
            {isExternal && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Globe className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-600">حجز من {booking.source_platform}</span>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payment Gateways - المحافظ المفعلة فقط */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    اختر المحفظة للدفع
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    اختر المحفظة المناسبة وقم بتحويل المبلغ ثم ارفع صورة الإشعار
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {activeGateways.length > 0 ? (
                    <>
                      {/* قائمة المحافظ */}
                      <div className="space-y-3">
                        {activeGateways.map((gateway) => (
                          <button
                            key={gateway.id}
                            onClick={() => setSelectedGateway(gateway)}
                            className={`w-full text-right p-4 rounded-xl border-2 transition-all ${
                              selectedGateway?.id === gateway.id
                                ? 'border-blue-500 bg-blue-50 shadow-lg'
                                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              {gateway.logo_url ? (
                                <img src={gateway.logo_url} alt={gateway.name} className="h-12 w-12 rounded-lg" />
                              ) : (
                                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Wallet className="h-6 w-6 text-blue-600" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-bold text-lg">{gateway.name}</p>
                                {gateway.description && (
                                  <p className="text-sm text-slate-500">{gateway.description}</p>
                                )}
                              </div>
                              {selectedGateway?.id === gateway.id && (
                                <CheckCircle2 className="h-6 w-6 text-blue-600" />
                              )}
                            </div>
                            
                            <div className="bg-white rounded-lg p-3 text-sm space-y-2">
                              {gateway.account_name && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">اسم المستفيد:</span>
                                  <span className="font-semibold">{gateway.account_name}</span>
                                </div>
                              )}
                              {gateway.account_number && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">رقم الحساب:</span>
                                  <span className="font-mono font-semibold" dir="ltr">{gateway.account_number}</span>
                                </div>
                              )}
                            </div>
                            
                            {gateway.instructions && (
                              <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                                {gateway.instructions}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      {/* رفع إشعار الإيداع */}
                      <div>
                        <Label className="block mb-2 font-semibold">صورة إشعار الإيداع *</Label>
                        <div 
                          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                            receiptImage 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                          }`}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptUpload}
                            className="hidden"
                            id="receipt-upload"
                          />
                          {receiptImage ? (
                            <div className="space-y-3">
                              <img 
                                src={receiptImage} 
                                alt="إشعار الإيداع" 
                                className="max-h-40 mx-auto rounded-lg shadow"
                              />
                              <div className="flex items-center justify-center gap-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">تم رفع الإشعار بنجاح</span>
                              </div>
                              <label htmlFor="receipt-upload">
                                <Button type="button" variant="outline" size="sm" asChild>
                                  <span>تغيير الصورة</span>
                                </Button>
                              </label>
                            </div>
                          ) : (
                            <label htmlFor="receipt-upload" className="cursor-pointer block">
                              <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                                <CreditCard className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="font-medium text-slate-700">اضغط لرفع صورة الإشعار</p>
                              <p className="text-sm text-slate-500 mt-1">PNG, JPG حتى 5MB</p>
                            </label>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Wallet className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد محافظ متاحة</h3>
                      <p className="text-slate-500">يرجى التواصل مع الدعم الفني</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Notice */}
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <Shield className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">دفع آمن ومحمي</p>
                  <p className="text-sm text-green-600">بياناتك محمية بتشفير SSL 256-bit</p>
                </div>
                <Lock className="h-5 w-5 text-green-600 mr-auto" />
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="sticky top-28 shadow-xl">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-xl">
                    <CardTitle>ملخص الطلب</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {flightData.airline_logo ? (
                          <img src={flightData.airline_logo} alt="" className="h-12 w-12 rounded-xl object-contain bg-white p-1" />
                        ) : (
                          <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Plane className="h-6 w-6 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold">{flightData.airline_name}</p>
                          <p className="text-sm text-slate-500 font-mono">{flightData.flight_number}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 space-y-1">
                        <p className="font-semibold">
                          {flightData.departure_city} ← {flightData.arrival_city}
                        </p>
                        {flightData.departure_date && (
                          <p className="text-slate-500">
                            {format(parseISO(flightData.departure_date), 'd MMMM yyyy', { locale: ar })}
                          </p>
                        )}
                        <p className="text-slate-500">
                          المسافرون: {booking.passenger_count || booking.passengers_count || 1}
                        </p>
                        {(flightData.trip_type === 'round_trip' || booking.trip_type === 'round_trip') && (flightData.return_date || booking.return_date) && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs text-blue-600 font-semibold mb-1">🔄 رحلة العودة</p>
                            <p className="text-sm text-slate-600">
                              {format(parseISO(flightData.return_date || booking.return_date), 'd MMMM yyyy', { locale: ar })}
                            </p>
                            {(flightData.return_flight_number || booking.return_flight_number) && (
                              <p className="text-xs text-slate-500">
                                رحلة {flightData.return_flight_number || booking.return_flight_number}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {isExternal ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">سعر الرحلة</span>
                            <span>${booking.source_price}</span>
                          </div>
                          <div className="flex justify-between text-sm text-green-600">
                            <span>عمولة النظام</span>
                            <span>${booking.system_commission}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">سعر التذاكر</span>
                            <span>${booking.ticket_price}</span>
                          </div>
                          {booking.include_visa && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>خدمة الفيزا</span>
                              <span>${booking.visa_price}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Separator />

                    <div className="flex justify-between text-xl font-bold">
                      <span>الإجمالي</span>
                      <span className="text-green-600">${totalAmount}</span>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-xl"
                      onClick={handlePayment}
                      disabled={processing || !selectedGateway || !receiptImage}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                          جاري المعالجة...
                        </>
                      ) : (
                        <>
                          <Lock className="ml-2 h-5 w-5" />
                          دفع ${totalAmount}
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span>دفع آمن ومحمي SSL 256-bit</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <ModernFooter />
    </div>
  );
}