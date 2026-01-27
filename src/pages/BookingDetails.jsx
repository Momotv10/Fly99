import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { 
  User, Plane, Calendar as CalendarIcon, Upload, CheckCircle, AlertCircle,
  Camera, Loader2, Shield, CreditCard, Phone, Mail, ChevronLeft, ChevronRight,
  FileText, AlertTriangle, Sparkles, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const COUNTRY_CODES = [
  { code: '+967', country: 'اليمن', flag: '🇾🇪' },
  { code: '+966', country: 'السعودية', flag: '🇸🇦' },
  { code: '+971', country: 'الإمارات', flag: '🇦🇪' },
  { code: '+20', country: 'مصر', flag: '🇪🇬' },
  { code: '+962', country: 'الأردن', flag: '🇯🇴' },
  { code: '+968', country: 'عمان', flag: '🇴🇲' },
  { code: '+974', country: 'قطر', flag: '🇶🇦' },
  { code: '+973', country: 'البحرين', flag: '🇧🇭' },
  { code: '+965', country: 'الكويت', flag: '🇰🇼' }
];

export default function BookingDetails() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [seat, setSeat] = useState(null);
  const [passengersCount, setPassengersCount] = useState(1);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [processingPassport, setProcessingPassport] = useState(null);

  const [passengers, setPassengers] = useState([{
    full_name: '',
    passport_number: '',
    nationality: 'YE',
    date_of_birth: null,
    passport_expiry_date: null,
    passport_image_url: '',
    renewal_image_url: '',
    has_renewal: false,
    photo_url: ''
  }]);

  const [contactInfo, setContactInfo] = useState({
    countryCode: '+967',
    whatsapp: '',
    email: ''
  });

  const [visaInfo, setVisaInfo] = useState({
    hasVisa: false,
    wantsVisa: false,
    acceptsResponsibility: false
  });

  const [paymentGateways, setPaymentGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        toast.info('يرجى تسجيل الدخول أولاً');
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);

      // تعبئة بيانات الاتصال من الملف الشخصي
      if (userData.email) {
        setContactInfo(prev => ({ ...prev, email: userData.email }));
      }

      // جلب بيانات الرحلة
      const urlParams = new URLSearchParams(window.location.search);
      const seatId = urlParams.get('seat_id');
      const passCount = parseInt(urlParams.get('passengers') || '1');

      if (!seatId) {
        navigate(createPageUrl('SearchResults'));
        return;
      }

      const seatData = await base44.entities.AvailableSeat.filter({ id: seatId });
      if (seatData.length === 0) {
        toast.error('الرحلة غير متاحة');
        navigate(createPageUrl('SearchResults'));
        return;
      }

      setSeat(seatData[0]);
      setPassengersCount(passCount);
      setPassengers(Array(passCount).fill(null).map(() => ({
        full_name: '',
        passport_number: '',
        nationality: 'YE',
        date_of_birth: null,
        passport_expiry_date: null,
        passport_image_url: '',
        renewal_image_url: '',
        has_renewal: false,
        photo_url: ''
      })));

      // جلب بوابات الدفع
      const gateways = await base44.entities.PaymentGateway.filter({ is_active: true }, 'display_order');
      setPaymentGateways(gateways);
      if (gateways.length > 0) {
        setSelectedGateway(gateways[0]);
      }

      setLoading(false);
    } catch (e) {
      console.error('Error:', e);
      setLoading(false);
    }
  };

  const handlePassportUpload = async (index, file) => {
    setProcessingPassport(index);
    
    try {
      toast.info('جاري رفع وتحليل صورة الجواز...');
      
      // رفع الصورة
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // تحليل الجواز بالذكاء الاصطناعي
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `حلل صورة جواز السفر هذه واستخرج البيانات التالية بدقة:
        - الاسم الكامل (باللاتينية كما في الجواز)
        - رقم الجواز
        - الجنسية (رمز الدولة)
        - تاريخ الميلاد
        - تاريخ انتهاء الجواز
        
        تحقق هل الجواز:
        1. هل هذه فعلاً صورة جواز سفر؟
        2. هل الجواز منتهي الصلاحية؟
        
        أرجع JSON:
        {
          "is_passport": true/false,
          "data": {
            "full_name": "الاسم",
            "passport_number": "الرقم",
            "nationality": "YE/SA/...",
            "date_of_birth": "YYYY-MM-DD",
            "passport_expiry_date": "YYYY-MM-DD"
          },
          "is_expired": true/false,
          "confidence": 0-100
        }`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            is_passport: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                passport_number: { type: 'string' },
                nationality: { type: 'string' },
                date_of_birth: { type: 'string' },
                passport_expiry_date: { type: 'string' }
              }
            },
            is_expired: { type: 'boolean' },
            confidence: { type: 'number' }
          }
        }
      });

      if (!result.is_passport) {
        toast.error('الصورة المرفقة ليست صورة جواز سفر. يرجى رفع صورة واضحة للجواز.');
        setProcessingPassport(null);
        return;
      }

      const newPassengers = [...passengers];
      newPassengers[index] = {
        ...newPassengers[index],
        full_name: result.data?.full_name || '',
        passport_number: result.data?.passport_number || '',
        nationality: result.data?.nationality || 'YE',
        date_of_birth: result.data?.date_of_birth ? new Date(result.data.date_of_birth) : null,
        passport_expiry_date: result.data?.passport_expiry_date ? new Date(result.data.passport_expiry_date) : null,
        passport_image_url: file_url
      };
      setPassengers(newPassengers);

      if (result.is_expired) {
        toast.warning('⚠️ الجواز منتهي الصلاحية! يمكنك إضافة صورة التجديد إذا وجدت.');
      } else {
        toast.success('✅ تم استخراج بيانات الجواز بنجاح!');
      }

    } catch (e) {
      toast.error('فشل في تحليل الجواز');
      console.error(e);
    }

    setProcessingPassport(null);
  };

  const handleRenewalUpload = async (index, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newPassengers = [...passengers];
      newPassengers[index].renewal_image_url = file_url;
      newPassengers[index].has_renewal = true;
      setPassengers(newPassengers);
      toast.success('تم رفع صورة التجديد');
    } catch (e) {
      toast.error('فشل رفع الصورة');
    }
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const validateStep = () => {
    if (step === 1) {
      for (let i = 0; i < passengers.length; i++) {
        if (!passengers[i].full_name || !passengers[i].passport_number || !passengers[i].passport_image_url) {
          toast.error(`يرجى إكمال بيانات المسافر ${i + 1} ورفع صورة الجواز`);
          return false;
        }
      }
    } else if (step === 2) {
      if (!contactInfo.whatsapp) {
        toast.error('يرجى إدخال رقم الواتساب');
        return false;
      }
      if (!visaInfo.hasVisa && !visaInfo.wantsVisa && !visaInfo.acceptsResponsibility) {
        toast.error('يرجى تأكيد حالة الفيزا أو قبول المسؤولية');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!selectedGateway) {
      toast.error('يرجى اختيار طريقة الدفع');
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = seat.total_price * passengersCount;
      const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;

      // إنشاء أو تحديث بيانات العميل
      let customerId = null;
      const existingCustomers = await base44.entities.Customer.filter({ email: user.email });
      
      if (existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
        await base44.entities.Customer.update(customerId, {
          whatsapp: contactInfo.countryCode + contactInfo.whatsapp
        });
      } else {
        const customer = await base44.entities.Customer.create({
          full_name: user.full_name || passengers[0].full_name,
          email: user.email,
          phone: contactInfo.countryCode + contactInfo.whatsapp,
          whatsapp: contactInfo.countryCode + contactInfo.whatsapp
        });
        customerId = customer.id;
      }

      // إنشاء الحجز
      const booking = await base44.entities.Booking.create({
        booking_number: bookingNumber,
        customer_id: customerId,
        customer_name: passengers[0].full_name,
        customer_phone: contactInfo.countryCode + contactInfo.whatsapp,
        customer_email: contactInfo.email || user.email,
        customer_whatsapp: contactInfo.countryCode + contactInfo.whatsapp,
        seat_id: seat.id,
        provider_id: seat.provider_id,
        provider_name: seat.provider_name,
        flight_id: seat.flight_id,
        flight_number: seat.flight_number,
        airline_name: seat.airline_name,
        airline_logo: seat.airline_logo,
        departure_airport_code: seat.departure_airport_code,
        departure_city: seat.departure_city,
        arrival_airport_code: seat.arrival_airport_code,
        arrival_city: seat.arrival_city,
        departure_date: seat.departure_date,
        departure_time: seat.departure_time,
        seat_class: seat.seat_class,
        passengers: passengers.map(p => ({
          ...p,
          date_of_birth: p.date_of_birth ? format(p.date_of_birth, 'yyyy-MM-dd') : null,
          passport_expiry_date: p.passport_expiry_date ? format(p.passport_expiry_date, 'yyyy-MM-dd') : null
        })),
        passengers_count: passengersCount,
        has_visa: visaInfo.hasVisa,
        include_visa: visaInfo.wantsVisa,
        visa_responsibility_accepted: visaInfo.acceptsResponsibility,
        ticket_price: seat.total_price,
        system_commission: seat.system_commission || 0,
        total_amount: totalAmount,
        provider_amount: seat.price_outbound * passengersCount,
        payment_method: selectedGateway.provider,
        payment_status: 'pending',
        status: 'pending_payment',
        booking_source: 'website',
        terms_accepted: true,
        contact_preference: 'whatsapp'
      });

      // تحديث المقاعد
      await base44.entities.AvailableSeat.update(seat.id, {
        booked_count: (seat.booked_count || 0) + passengersCount
      });

      toast.success('تم إنشاء الحجز بنجاح!');
      navigate(createPageUrl('Payment') + `?booking_id=${booking.id}`);

    } catch (e) {
      toast.error('فشل إنشاء الحجز: ' + e.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">جاري تحميل بيانات الرحلة...</p>
        </div>
      </div>
    );
  }

  if (!seat) return null;

  const totalAmount = seat.total_price * passengersCount;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      <ModernHeader />
      
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4">
              {[
                { num: 1, label: 'بيانات المسافرين' },
                { num: 2, label: 'معلومات الاتصال' },
                { num: 3, label: 'الدفع' }
              ].map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className={`flex flex-col items-center ${step >= s.num ? 'text-blue-600' : 'text-slate-400'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                      step > s.num ? 'bg-green-500 text-white' :
                      step === s.num ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' :
                      'bg-slate-200 text-slate-500'
                    }`}>
                      {step > s.num ? <CheckCircle className="h-6 w-6" /> : s.num}
                    </div>
                    <span className="text-sm mt-2 font-medium">{s.label}</span>
                  </div>
                  {i < 2 && <div className={`w-20 h-1 mx-4 rounded ${step > s.num ? 'bg-green-500' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {/* Step 1: Passengers */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card className="mb-4 border-blue-200 bg-blue-50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-900">رفع صورة الجواز = تعبئة تلقائية!</p>
                          <p className="text-sm text-blue-700">الذكاء الاصطناعي سيستخرج البيانات تلقائياً</p>
                        </div>
                      </CardContent>
                    </Card>

                    {passengers.map((passenger, index) => (
                      <Card key={index} className="mb-4 overflow-hidden">
                        <CardHeader className="bg-slate-50">
                          <CardTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            المسافر {index + 1}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          {/* Passport Upload */}
                          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-400 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => e.target.files[0] && handlePassportUpload(index, e.target.files[0])}
                              className="hidden"
                              id={`passport-${index}`}
                              disabled={processingPassport === index}
                            />
                            <label htmlFor={`passport-${index}`} className="cursor-pointer block">
                              {processingPassport === index ? (
                                <div className="py-4">
                                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-3" />
                                  <p className="font-medium text-blue-600">جاري تحليل الجواز بالذكاء الاصطناعي...</p>
                                </div>
                              ) : passenger.passport_image_url ? (
                                <div className="flex items-center justify-center gap-4">
                                  <img src={passenger.passport_image_url} alt="Passport" className="h-20 w-20 object-cover rounded-lg" />
                                  <div className="text-right">
                                    <p className="text-green-600 font-semibold flex items-center gap-2">
                                      <CheckCircle className="h-5 w-5" />
                                      تم رفع صورة الجواز
                                    </p>
                                    <p className="text-sm text-slate-500">اضغط لتغيير الصورة</p>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Camera className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                                  <p className="font-semibold text-slate-700 mb-1">ارفع صورة الجواز</p>
                                  <p className="text-sm text-slate-500">سيتم استخراج البيانات تلقائياً</p>
                                </>
                              )}
                            </label>
                          </div>

                          {/* Passenger Data */}
                          {passenger.passport_image_url && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                <p className="text-sm text-green-700 mb-1">✨ البيانات المستخرجة</p>
                                <p className="text-xs text-green-600">راجع البيانات وعدّلها إذا لزم الأمر</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                  <Label>الاسم الكامل (كما في الجواز) *</Label>
                                  <Input
                                    value={passenger.full_name}
                                    onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                                    placeholder="AHMED MOHAMMED ALI"
                                    dir="ltr"
                                    className="uppercase text-lg font-medium"
                                  />
                                </div>
                                <div>
                                  <Label>رقم الجواز *</Label>
                                  <Input
                                    value={passenger.passport_number}
                                    onChange={(e) => updatePassenger(index, 'passport_number', e.target.value)}
                                    dir="ltr"
                                    className="font-mono"
                                  />
                                </div>
                                <div>
                                  <Label>الجنسية</Label>
                                  <Select 
                                    value={passenger.nationality}
                                    onValueChange={(v) => updatePassenger(index, 'nationality', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="YE">🇾🇪 اليمن</SelectItem>
                                      <SelectItem value="SA">🇸🇦 السعودية</SelectItem>
                                      <SelectItem value="AE">🇦🇪 الإمارات</SelectItem>
                                      <SelectItem value="EG">🇪🇬 مصر</SelectItem>
                                      <SelectItem value="JO">🇯🇴 الأردن</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>تاريخ الميلاد</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full justify-start">
                                        <CalendarIcon className="h-4 w-4 ml-2" />
                                        {passenger.date_of_birth 
                                          ? format(passenger.date_of_birth, 'dd/MM/yyyy')
                                          : 'اختر التاريخ'
                                        }
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={passenger.date_of_birth}
                                        onSelect={(date) => updatePassenger(index, 'date_of_birth', date)}
                                        disabled={(date) => date > new Date()}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div>
                                  <Label>تاريخ انتهاء الجواز</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        className={`w-full justify-start ${
                                          passenger.passport_expiry_date && passenger.passport_expiry_date < new Date()
                                            ? 'border-red-300 bg-red-50'
                                            : ''
                                        }`}
                                      >
                                        <CalendarIcon className="h-4 w-4 ml-2" />
                                        {passenger.passport_expiry_date 
                                          ? format(passenger.passport_expiry_date, 'dd/MM/yyyy')
                                          : 'اختر التاريخ'
                                        }
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={passenger.passport_expiry_date}
                                        onSelect={(date) => updatePassenger(index, 'passport_expiry_date', date)}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>

                              {/* Expired Passport Warning */}
                              {passenger.passport_expiry_date && passenger.passport_expiry_date < new Date() && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                  <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-semibold text-red-800">الجواز منتهي الصلاحية!</p>
                                      <p className="text-sm text-red-600 mb-3">إذا كان لديك تجديد في صفحة أخرى، يمكنك رفع صورته</p>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => e.target.files[0] && handleRenewalUpload(index, e.target.files[0])}
                                        className="hidden"
                                        id={`renewal-${index}`}
                                      />
                                      <label htmlFor={`renewal-${index}`}>
                                        <Button type="button" variant="outline" size="sm" asChild>
                                          <span>
                                            <Upload className="h-4 w-4 ml-2" />
                                            رفع صورة التجديد
                                          </span>
                                        </Button>
                                      </label>
                                      {passenger.renewal_image_url && (
                                        <span className="text-green-600 text-sm mr-2">✓ تم رفع التجديد</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </motion.div>
                )}

                {/* Step 2: Contact & Visa */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    {/* Contact Info */}
                    <Card className="mb-4">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Phone className="h-5 w-5 text-blue-600" />
                          معلومات الاتصال
                        </CardTitle>
                        <CardDescription>سنرسل لك التذكرة والتحديثات عبر الواتساب</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>رقم الواتساب *</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={contactInfo.countryCode}
                              onValueChange={(v) => setContactInfo({ ...contactInfo, countryCode: v })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COUNTRY_CODES.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.flag} {c.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={contactInfo.whatsapp}
                              onChange={(e) => setContactInfo({ ...contactInfo, whatsapp: e.target.value })}
                              placeholder="771234567"
                              dir="ltr"
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>البريد الإلكتروني</Label>
                          <Input
                            type="email"
                            value={contactInfo.email}
                            onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                            dir="ltr"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Visa Info */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-green-600" />
                          معلومات الفيزا
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <Checkbox
                              checked={visaInfo.hasVisa}
                              onCheckedChange={(v) => setVisaInfo({ ...visaInfo, hasVisa: v, wantsVisa: false })}
                            />
                            <div>
                              <p className="font-medium">لدي فيزا سارية</p>
                              <p className="text-sm text-slate-500">أؤكد أن لدي فيزا دخول سارية</p>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <Checkbox
                              checked={visaInfo.wantsVisa}
                              onCheckedChange={(v) => setVisaInfo({ ...visaInfo, wantsVisa: v, hasVisa: false })}
                            />
                            <div>
                              <p className="font-medium">أريد إضافة خدمة إصدار الفيزا</p>
                              <p className="text-sm text-slate-500">سيتم إضافة رسوم إصدار الفيزا</p>
                            </div>
                          </label>

                          {!visaInfo.hasVisa && !visaInfo.wantsVisa && (
                            <label className="flex items-start gap-3 p-4 border border-amber-300 bg-amber-50 rounded-xl cursor-pointer">
                              <Checkbox
                                checked={visaInfo.acceptsResponsibility}
                                onCheckedChange={(v) => setVisaInfo({ ...visaInfo, acceptsResponsibility: v })}
                              />
                              <div>
                                <p className="font-medium text-amber-900">أتحمل المسؤولية</p>
                                <p className="text-sm text-amber-700">
                                  أقر بأنني مسؤول عن الفيزا ولا يحق لي استرجاع التذكرة في حال عدم وجود فيزا
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Step 3: Payment */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-green-600" />
                          اختر طريقة الدفع
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {paymentGateways.map((gateway) => (
                            <button
                              key={gateway.id}
                              onClick={() => setSelectedGateway(gateway)}
                              className={`p-4 border-2 rounded-xl text-right transition-all ${
                                selectedGateway?.id === gateway.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {gateway.logo_url ? (
                                  <img src={gateway.logo_url} alt="" className="h-10 w-10 rounded-lg" />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <CreditCard className="h-5 w-5" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold">{gateway.name}</p>
                                  <p className="text-sm text-slate-500">{gateway.type}</p>
                                </div>
                                {selectedGateway?.id === gateway.id && (
                                  <CheckCircle className="h-5 w-5 text-blue-600 mr-auto" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>

                        {selectedGateway?.instructions_ar && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm text-slate-600">{selectedGateway.instructions_ar}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-6">
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ChevronRight className="h-4 w-4 ml-2" />
                    السابق
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={handleNext} className="mr-auto">
                    التالي
                    <ChevronLeft className="h-4 w-4 mr-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="mr-auto bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        جاري إنشاء الحجز...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 ml-2" />
                        تأكيد ومتابعة الدفع - ${totalAmount}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Booking Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-xl">
                  <CardTitle>ملخص الحجز</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Flight Info */}
                  <div className="flex items-center gap-3">
                    {seat.airline_logo ? (
                      <img src={seat.airline_logo} alt="" className="h-12 w-12 rounded-lg" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Plane className="h-6 w-6 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{seat.airline_name}</p>
                      <p className="text-sm text-slate-500">{seat.flight_number}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-lg font-bold">{seat.departure_city}</p>
                      <p className="text-sm text-slate-500">{seat.departure_time}</p>
                    </div>
                    <Plane className="h-5 w-5 text-blue-600" />
                    <div className="text-center">
                      <p className="text-lg font-bold">{seat.arrival_city}</p>
                      <p className="text-sm text-slate-500">{seat.arrival_time}</p>
                    </div>
                  </div>

                  <div className="text-center py-2 bg-slate-50 rounded-lg">
                    <CalendarIcon className="h-4 w-4 inline ml-2 text-slate-500" />
                    {seat.departure_date && format(new Date(seat.departure_date), 'd MMMM yyyy', { locale: ar })}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>سعر التذكرة</span>
                      <span>${seat.total_price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>عدد المسافرين</span>
                      <span>{passengersCount}</span>
                    </div>
                    {visaInfo.wantsVisa && (
                      <div className="flex justify-between text-amber-600">
                        <span>رسوم الفيزا</span>
                        <span>سيتم تحديدها</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>الإجمالي</span>
                    <span className="text-2xl text-green-600">${totalAmount}</span>
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      دفع آمن ومشفر 100%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <ModernFooter />
    </div>
  );
}