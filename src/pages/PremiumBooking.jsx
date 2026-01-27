import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import PassportScanner from '@/components/booking/PassportScanner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plane, Users, CreditCard, CheckCircle, ChevronRight, ChevronLeft,
  FileText, AlertTriangle, Phone, Upload, Loader2, Shield, Globe,
  User, Calendar, Sparkles, ArrowLeftRight, Clock, MapPin
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+966', country: 'السعودية', flag: '🇸🇦' },
  { code: '+967', country: 'اليمن', flag: '🇾🇪' },
  { code: '+971', country: 'الإمارات', flag: '🇦🇪' },
  { code: '+973', country: 'البحرين', flag: '🇧🇭' },
  { code: '+974', country: 'قطر', flag: '🇶🇦' },
  { code: '+968', country: 'عمان', flag: '🇴🇲' },
  { code: '+965', country: 'الكويت', flag: '🇰🇼' },
  { code: '+20', country: 'مصر', flag: '🇪🇬' },
  { code: '+962', country: 'الأردن', flag: '🇯🇴' },
  { code: '+90', country: 'تركيا', flag: '🇹🇷' },
];

export default function PremiumBooking() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [user, setUser] = useState(null);
  
  // Flight Data
  const [flight, setFlight] = useState(null);
  const [isExternal, setIsExternal] = useState(false);
  const [passengersCount, setPassengersCount] = useState(1);
  
  // Passengers Data
  const [passengers, setPassengers] = useState([]);
  const [currentPassenger, setCurrentPassenger] = useState(0);
  
  // Visa & Contact
  const [hasVisa, setHasVisa] = useState(null);
  const [visaImage, setVisaImage] = useState(null);
  const [visaResponsibility, setVisaResponsibility] = useState(false);
  const [includeVisaService, setIncludeVisaService] = useState(false);
  
  const [countryCode, setCountryCode] = useState('+967');
  const [whatsapp, setWhatsapp] = useState('');
  
  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    // التحقق من تسجيل الدخول
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      toast.info('يرجى تسجيل الدخول لإتمام الحجز');
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    const userData = await base44.auth.me();
    setUser(userData);

    // جلب بيانات الرحلة
    const params = new URLSearchParams(window.location.search);
    const seatId = params.get('seat_id');
    const externalFlightData = params.get('external_flight');
    const pCount = parseInt(params.get('passengers') || '1');
    
    setPassengersCount(pCount);
    setPassengers(Array(pCount).fill(null));

    if (externalFlightData) {
      // رحلة من مزود خارجي
      const flightData = JSON.parse(decodeURIComponent(externalFlightData));
      setFlight(flightData);
      setIsExternal(true);
    } else if (seatId) {
      // رحلة داخلية - نحمل كامل بيانات الرحلة بما فيها بيانات العودة
      const seats = await base44.entities.AvailableSeat.filter({ id: seatId });
      if (seats.length > 0) {
        console.log('✅ Flight loaded:', seats[0]);
        console.log('✅ Trip type:', seats[0].trip_type);
        console.log('✅ Return date:', seats[0].return_date);
        console.log('✅ Return flight number:', seats[0].return_flight_number);
        setFlight(seats[0]);
      }
    }

    setLoading(false);
  };

  const handlePassengerComplete = (data) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[currentPassenger] = data;
    setPassengers(updatedPassengers);

    if (currentPassenger < passengersCount - 1) {
      setCurrentPassenger(currentPassenger + 1);
    } else {
      setCurrentStep(2);
    }
  };

  const handleVisaUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVisaImage(file_url);
      toast.success('تم رفع صورة الفيزا');
    }
  };

  const handleSubmit = async () => {
    if (!termsAccepted) {
      toast.error('يرجى الموافقة على الشروط والأحكام');
      return;
    }

    if (!whatsapp) {
      toast.error('يرجى إدخال رقم الواتساب');
      return;
    }

    setProcessing(true);

    try {
      const fullWhatsapp = countryCode + whatsapp;

      // إنشاء العميل إذا لم يكن موجوداً
      let customer = await base44.entities.Customer.filter({ email: user.email });
      let customerId;

      if (customer.length === 0) {
        const newCustomer = await base44.entities.Customer.create({
          full_name: user.full_name,
          email: user.email,
          whatsapp: fullWhatsapp,
          auth_provider: 'email'
        });
        customerId = newCustomer.id;
      } else {
        customerId = customer[0].id;
        await base44.entities.Customer.update(customerId, { whatsapp: fullWhatsapp });
      }

      // حساب السعر الصحيح
      const ticketPrice = flight.display_price || flight.total_price;
      const totalPrice = ticketPrice * passengersCount;

      if (isExternal) {
        // حجز من مزود خارجي - يحتوي على كامل بيانات الذهاب والعودة
        const booking = await base44.entities.ExternalProviderBooking.create({
          booking_number: `EXT${Date.now().toString().slice(-8)}`,
          source_platform: flight.source_platform || 'متعدد المصادر',
          source_url: flight.source_url,
          source_price: flight.source_price * passengersCount,
          system_commission: flight.total_commission,
          total_price: totalPrice,
          price_per_person: ticketPrice,
          passenger_count: passengersCount,
          customer_id: customerId,
          customer_name: user.full_name,
          customer_email: user.email,
          customer_whatsapp: fullWhatsapp,
          flight_data: {
            airline_name: flight.airline_name,
            airline_logo: flight.airline_logo,
            airline_code: flight.airline_code,
            flight_number: flight.flight_number,
            departure_airport: flight.departure_airport,
            departure_airport_code: flight.departure_airport_code,
            departure_city: flight.departure_city,
            arrival_airport: flight.arrival_airport,
            arrival_airport_code: flight.arrival_airport_code,
            arrival_city: flight.arrival_city,
            departure_date: flight.departure_date,
            departure_time: flight.departure_time,
            arrival_time: flight.arrival_time,
            duration: flight.duration,
            stops: flight.stops,
            seat_class: flight.seat_class,
            trip_type: flight.trip_type,
            baggage_allowance: flight.baggage_allowance,
            // بيانات العودة - مهمة جداً للذهاب والعودة
            return_date: flight.return_date,
            return_flight_number: flight.return_flight_number,
            return_departure_time: flight.return_departure_time,
            return_arrival_time: flight.return_arrival_time
          },
          passengers: passengers,
          has_visa: hasVisa,
          visa_image_url: visaImage,
          visa_responsibility_accepted: visaResponsibility,
          include_visa_service: includeVisaService,
          visa_service_price: includeVisaService ? (flight.visa_price || 0) : 0,
          status: 'pending_payment',
          booking_source: 'website'
        });

        // الانتقال لصفحة الدفع
        navigate(createPageUrl('Payment') + `?type=external&booking_id=${booking.id}&amount=${totalPrice}`);
      } else {
        // حجز داخلي - يحتوي على كامل بيانات الذهاب والعودة
        // حساب تاريخ العودة الفعلي من البيانات المتاحة
        const actualReturnDate = flight.return_date || flight.actual_return_date || 
          (flight.return_flight?.departure_date) || null;
        
        const booking = await base44.entities.Booking.create({
          booking_number: `BK${Date.now().toString().slice(-8)}`,
          customer_id: customerId,
          customer_name: user.full_name,
          customer_email: user.email,
          customer_whatsapp: fullWhatsapp,
          seat_id: flight.id,
          provider_id: flight.provider_id,
          provider_name: flight.provider_name,
          flight_id: flight.flight_id,
          flight_number: flight.flight_number,
          airline_name: flight.airline_name,
          airline_logo: flight.airline_logo,
          departure_airport_code: flight.departure_airport_code,
          departure_city: flight.departure_city,
          arrival_airport_code: flight.arrival_airport_code,
          arrival_city: flight.arrival_city,
          departure_date: flight.departure_date,
          departure_time: flight.departure_time,
          // بيانات العودة - مهمة للذهاب والعودة - نأخذها من أي مصدر متاح
          return_date: actualReturnDate,
          return_flight_id: flight.return_flight_id || flight.return_flight?.flight_id,
          return_flight_number: flight.return_flight_number || flight.return_flight?.flight_number,
          return_departure_time: flight.return_departure_time || flight.return_flight?.departure_time,
          return_arrival_time: flight.return_arrival_time || flight.return_flight?.arrival_time,
          trip_type: flight.trip_type,
          seat_class: flight.seat_class,
          passengers: passengers,
          passengers_count: passengersCount,
          include_visa: includeVisaService,
          visa_price: includeVisaService ? (flight.visa_price || 0) : 0,
          has_visa: hasVisa,
          visa_responsibility_accepted: visaResponsibility,
          // السعر الإجمالي الواحد (لا يتم تفكيكه للعميل)
          ticket_price: ticketPrice,
          system_commission: flight.system_commission,
          total_amount: totalPrice,
          provider_amount: (flight.provider_earning || 0) * passengersCount,
          status: 'pending_payment',
          terms_accepted: true,
          booking_source: 'website'
        });

        navigate(createPageUrl('Payment') + `?type=internal&booking_id=${booking.id}&amount=${totalPrice}`);
      }

    } catch (error) {
      console.error('Booking error:', error);
      toast.error('حدث خطأ أثناء إنشاء الحجز');
    }

    setProcessing(false);
  };

  const steps = [
    { id: 1, title: 'بيانات المسافرين', icon: Users },
    { id: 2, title: 'الفيزا والتواصل', icon: FileText },
    { id: 3, title: 'التأكيد والدفع', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">جاري تحميل بيانات الحجز...</p>
        </div>
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">لم يتم العثور على الرحلة</h2>
            <p className="text-slate-500 mb-4">يرجى العودة والبحث مرة أخرى</p>
            <Button onClick={() => navigate(createPageUrl('Home'))}>
              العودة للصفحة الرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ModernHeader />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      currentStep >= step.id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <step.icon className="h-6 w-6" />
                      )}
                    </div>
                    <span className={`font-semibold ${currentStep >= step.id ? 'text-blue-600' : 'text-slate-400'}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 rounded ${currentStep > step.id ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Flight Summary - عرض كامل لتفاصيل الذهاب والعودة */}
          <Card className="mb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white border-0 overflow-hidden shadow-2xl">
            {/* شريط نوع الرحلة */}
            <div className="bg-white/10 px-4 py-2 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4" />
                <span className="font-medium">
                  {flight.trip_type === 'round_trip' ? 'رحلة ذهاب وعودة' : 'رحلة ذهاب فقط'}
                </span>
              </div>
              <Badge className="bg-white/20 text-white">
                {flight.seat_class === 'economy' ? 'اقتصادية' : flight.seat_class === 'business' ? 'رجال أعمال' : 'الدرجة الأولى'}
              </Badge>
            </div>
            
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  {flight.airline_logo ? (
                    <img src={flight.airline_logo} alt="" className="h-16 w-16 rounded-2xl bg-white p-2 shadow-lg" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Plane className="h-8 w-8" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-bold">{flight.airline_name}</h3>
                    <p className="text-blue-200 font-mono">{flight.flight_number}</p>
                    {flight.duration && (
                      <div className="flex items-center gap-1 text-blue-200 text-sm mt-1">
                        <Clock className="h-3 w-3" />
                        {flight.duration}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center md:text-left bg-white/10 backdrop-blur rounded-2xl p-4">
                  <p className="text-sm text-blue-200 mb-1">السعر الإجمالي</p>
                  <p className="text-4xl font-bold">${(flight.display_price || flight.total_price) * passengersCount}</p>
                  <p className="text-sm text-blue-200">{passengersCount} مسافر × ${flight.display_price || flight.total_price}</p>
                </div>
              </div>
              
              {/* رحلة الذهاب */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="h-5 w-5 text-green-300" />
                  <span className="font-bold text-lg">رحلة الذهاب</span>
                </div>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-green-300" />
                    </div>
                    <p className="text-3xl font-bold">{flight.departure_city || flight.departure_airport_code}</p>
                    <p className="text-blue-200">{flight.departure_time}</p>
                    {flight.departure_date && (
                      <p className="text-sm text-blue-300 mt-1">
                        {format(parseISO(flight.departure_date), 'EEEE d MMMM yyyy', { locale: ar })}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-0.5 bg-white/30 relative">
                      <Plane className="h-5 w-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white rotate-[-90deg]" />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-red-300" />
                    </div>
                    <p className="text-3xl font-bold">{flight.arrival_city || flight.arrival_airport_code}</p>
                    <p className="text-blue-200">{flight.arrival_time}</p>
                  </div>
                </div>
              </div>

              {/* رحلة العودة - تظهر للذهاب والعودة حتى لو لم يحدد المزود تاريخ العودة */}
              {(flight.trip_type === 'round_trip' || flight.return_flight) && (
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Plane className="h-5 w-5 text-amber-300 rotate-180" />
                    <span className="font-bold text-lg">رحلة العودة</span>
                  </div>
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-green-300" />
                      </div>
                      <p className="text-3xl font-bold">
                        {flight.arrival_city || flight.arrival_airport_code}
                      </p>
                      <p className="text-blue-200">
                        {flight.return_departure_time || flight.return_flight?.departure_time || '--:--'}
                      </p>
                      <p className="text-sm text-blue-300 mt-1">
                        {flight.return_date 
                          ? format(parseISO(flight.return_date), 'EEEE d MMMM yyyy', { locale: ar })
                          : flight.return_flight?.departure_date 
                            ? format(parseISO(flight.return_flight.departure_date), 'EEEE d MMMM yyyy', { locale: ar })
                            : flight.actual_return_date
                              ? format(parseISO(flight.actual_return_date), 'EEEE d MMMM yyyy', { locale: ar })
                              : 'سيتم تحديده بناءً على جدول الرحلات'
                        }
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-0.5 bg-white/30 relative">
                        <Plane className="h-5 w-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white rotate-[90deg]" />
                      </div>
                      {(flight.return_flight_number || flight.return_flight?.flight_number) && (
                        <span className="text-xs text-blue-200 mt-1">
                          {flight.return_flight_number || flight.return_flight?.flight_number}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-red-300" />
                      </div>
                      <p className="text-3xl font-bold">
                        {flight.departure_city || flight.departure_airport_code}
                      </p>
                      <p className="text-blue-200">
                        {flight.return_arrival_time || flight.return_flight?.arrival_time || '--:--'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 1: Passengers */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>بيانات المسافر {currentPassenger + 1} من {passengersCount}</CardTitle>
                      <Badge variant="outline">{currentPassenger + 1}/{passengersCount}</Badge>
                    </div>
                    <Progress value={(currentPassenger / passengersCount) * 100} className="mt-2" />
                  </CardHeader>
                  <CardContent>
                    <PassportScanner 
                      onScanComplete={handlePassengerComplete}
                      passengerIndex={currentPassenger}
                      initialData={passengers[currentPassenger]}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Visa & Contact */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>الفيزا ومعلومات التواصل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Visa Section */}
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        هل لديك فيزا/تصريح دخول؟
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setHasVisa(true)}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            hasVisa === true 
                              ? 'border-green-500 bg-green-50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <CheckCircle className={`h-8 w-8 mx-auto mb-2 ${hasVisa === true ? 'text-green-500' : 'text-slate-300'}`} />
                          <p className="font-semibold">نعم، لدي فيزا</p>
                        </button>
                        <button
                          onClick={() => setHasVisa(false)}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            hasVisa === false 
                              ? 'border-amber-500 bg-amber-50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <AlertTriangle className={`h-8 w-8 mx-auto mb-2 ${hasVisa === false ? 'text-amber-500' : 'text-slate-300'}`} />
                          <p className="font-semibold">لا، ليس لدي</p>
                        </button>
                      </div>

                      {hasVisa === true && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-4 border rounded-xl"
                        >
                          <Label>رفع صورة الفيزا</Label>
                          <div className="mt-2 flex items-center gap-4">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleVisaUpload}
                              className="hidden"
                              id="visa-upload"
                            />
                            <label htmlFor="visa-upload">
                              <Button type="button" variant="outline" asChild>
                                <span>
                                  <Upload className="h-4 w-4 ml-2" />
                                  اختيار صورة
                                </span>
                              </Button>
                            </label>
                            {visaImage && (
                              <div className="flex items-center gap-2">
                                <img src={visaImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {hasVisa === false && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          {flight.visa_service_enabled && (
                            <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-xl">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <Checkbox 
                                  checked={includeVisaService}
                                  onCheckedChange={setIncludeVisaService}
                                />
                                <div>
                                  <p className="font-semibold">إضافة خدمة الفيزا</p>
                                  <p className="text-sm text-slate-500">
                                    {flight.visa_service_name || 'فيزا'} - ${flight.visa_price || 0} للشخص
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}

                          {!includeVisaService && (
                            <Alert className="bg-amber-50 border-amber-200">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              <AlertDescription>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <Checkbox 
                                    checked={visaResponsibility}
                                    onCheckedChange={setVisaResponsibility}
                                  />
                                  <span className="text-amber-800">
                                    أتحمل مسؤولية الحصول على الفيزا وأوافق على عدم إرجاع قيمة التذكرة في حال عدم السفر
                                  </span>
                                </label>
                              </AlertDescription>
                            </Alert>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* WhatsApp */}
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        رقم الواتساب للتواصل
                      </h4>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-36">
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
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                          placeholder="7XXXXXXXX"
                          className="flex-1"
                          dir="ltr"
                        />
                      </div>
                      <p className="text-sm text-slate-500">
                        سيتم إرسال التذكرة وتحديثات الحجز على هذا الرقم
                      </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                        <ChevronRight className="h-4 w-4 ml-2" />
                        رجوع
                      </Button>
                      <Button 
                        onClick={() => setCurrentStep(3)} 
                        className="flex-1"
                        disabled={hasVisa === null || (!hasVisa && !includeVisaService && !visaResponsibility) || !whatsapp}
                      >
                        التالي
                        <ChevronLeft className="h-4 w-4 mr-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>مراجعة وتأكيد الحجز</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Passengers Summary */}
                    <div>
                      <h4 className="font-semibold mb-4">المسافرون</h4>
                      <div className="space-y-2">
                        {passengers.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <User className="h-5 w-5 text-slate-400" />
                            <div className="flex-1">
                              <p className="font-medium">{p?.full_name}</p>
                              <p className="text-sm text-slate-500">جواز: {p?.passport_number}</p>
                            </div>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price Summary - سعر واحد إجمالي كما تعرضه شركات الطيران */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex justify-between mb-2">
                        <span>سعر التذكرة {flight.trip_type === 'round_trip' ? '(ذهاب + إياب)' : '(ذهاب)'} × {passengersCount}</span>
                        <span>${(flight.display_price || flight.total_price) * passengersCount}</span>
                      </div>
                      {includeVisaService && (
                        <div className="flex justify-between mb-2">
                          <span>خدمة الفيزا × {passengersCount}</span>
                          <span>${(flight.visa_price || 0) * passengersCount}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t font-bold text-lg">
                        <span>الإجمالي</span>
                        <span className="text-green-600">
                          ${(flight.display_price || flight.total_price) * passengersCount + (includeVisaService ? (flight.visa_price || 0) * passengersCount : 0)}
                        </span>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="p-4 border rounded-xl">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox 
                          checked={termsAccepted}
                          onCheckedChange={setTermsAccepted}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">أوافق على الشروط والأحكام</p>
                          <p className="text-sm text-slate-500">
                            بالمتابعة، أوافق على شروط الحجز وسياسة الإلغاء والاسترجاع
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                        <ChevronRight className="h-4 w-4 ml-2" />
                        رجوع
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        className="flex-1 h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
                        disabled={!termsAccepted || processing}
                      >
                        {processing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Shield className="h-5 w-5 ml-2" />
                            متابعة للدفع
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <ModernFooter />
    </div>
  );
}