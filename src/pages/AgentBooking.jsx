import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPageUrl } from "@/utils";
import { 
  User, Plane, Calendar as CalendarIcon, Upload, CheckCircle, AlertCircle,
  RefreshCw, CreditCard, Wallet, FileText, ArrowRight, Camera, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AgentBooking() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [seat, setSeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [passengersCount, setPassengersCount] = useState(1);
  const [step, setStep] = useState(1); // 1: بيانات العميل، 2: بيانات المسافرين، 3: التأكيد

  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: ''
  });

  const [passengers, setPassengers] = useState([{
    full_name: '',
    passport_number: '',
    nationality: 'YE',
    date_of_birth: null,
    passport_expiry_date: null,
    passport_image_url: ''
  }]);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (agentId) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const seatId = urlParams.get('seat_id');
      const passCount = parseInt(urlParams.get('passengers') || '1');
      
      if (!seatId) {
        navigate(createPageUrl('AgentSearch'));
        return;
      }

      const [agentData, seatData] = await Promise.all([
        base44.entities.Agent.filter({ id: agentId }),
        base44.entities.AvailableSeat.filter({ id: seatId })
      ]);
      
      if (agentData.length > 0) setAgent(agentData[0]);
      if (seatData.length > 0) setSeat(seatData[0]);
      
      setPassengersCount(passCount);
      setPassengers(Array(passCount).fill(null).map(() => ({
        full_name: '',
        passport_number: '',
        nationality: 'YE',
        date_of_birth: null,
        passport_expiry_date: null,
        passport_image_url: ''
      })));

      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const handlePassportUpload = async (index, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // استخراج البيانات بالذكاء الاصطناعي
      toast.info('جاري استخراج بيانات الجواز...');
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            full_name: { type: 'string' },
            passport_number: { type: 'string' },
            nationality: { type: 'string' },
            date_of_birth: { type: 'string' },
            passport_expiry_date: { type: 'string' }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const data = result.output;
        const newPassengers = [...passengers];
        newPassengers[index] = {
          ...newPassengers[index],
          full_name: data.full_name || newPassengers[index].full_name,
          passport_number: data.passport_number || newPassengers[index].passport_number,
          nationality: data.nationality || newPassengers[index].nationality,
          date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : newPassengers[index].date_of_birth,
          passport_expiry_date: data.passport_expiry_date ? new Date(data.passport_expiry_date) : newPassengers[index].passport_expiry_date,
          passport_image_url: file_url
        };
        setPassengers(newPassengers);
        toast.success('تم استخراج بيانات الجواز بنجاح');
      } else {
        // حفظ الصورة فقط
        const newPassengers = [...passengers];
        newPassengers[index].passport_image_url = file_url;
        setPassengers(newPassengers);
        toast.info('تم رفع صورة الجواز - يرجى إدخال البيانات يدوياً');
      }
    } catch (error) {
      toast.error('فشل رفع صورة الجواز');
    }
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const validateStep = () => {
    if (step === 1) {
      if (!customerData.name || !customerData.phone) {
        toast.error('يرجى إدخال اسم ورقم هاتف العميل');
        return false;
      }
    } else if (step === 2) {
      for (let i = 0; i < passengers.length; i++) {
        if (!passengers[i].full_name || !passengers[i].passport_number) {
          toast.error(`يرجى إدخال بيانات المسافر ${i + 1}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    const totalAmount = seat.total_price * passengersCount;
    const systemCommission = seat.system_commission || 30;
    const agentCommission = (systemCommission * (agent.commission_percentage || 0)) / 100;
    const providerAmount = totalAmount - systemCommission;
    
    // التحقق من الرصيد
    if ((agent?.balance || 0) < totalAmount) {
      toast.error(`رصيدك غير كافٍ! المطلوب: $${totalAmount} - المتاح: $${agent?.balance || 0}`);
      return;
    }

    setSubmitting(true);
    try {
      // إنشاء أو جلب العميل
      let customerId = null;
      const existingCustomers = await base44.entities.Customer.filter({ phone: customerData.phone });
      
      if (existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
      } else {
        const newCustomer = await base44.entities.Customer.create({
          full_name: customerData.name,
          phone: customerData.phone,
          email: customerData.email,
          whatsapp: customerData.whatsapp || customerData.phone
        });
        customerId = newCustomer.id;
      }

      // إنشاء الحجز
      const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;
      const booking = await base44.entities.Booking.create({
        booking_number: bookingNumber,
        customer_id: customerId,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_email: customerData.email,
        customer_whatsapp: customerData.whatsapp,
        seat_id: seat.id,
        provider_id: seat.provider_id,
        provider_name: seat.provider_name,
        agent_id: agent.id,
        agent_name: agent.name,
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
        ticket_price: seat.total_price,
        system_commission: systemCommission,
        agent_commission: agentCommission,
        total_amount: totalAmount,
        provider_amount: providerAmount,
        payment_method: 'agent_balance',
        payment_status: 'paid',
        status: 'pending_issue',
        booking_source: 'agent',
        terms_accepted: true
      });

      // خصم المبلغ من رصيد الوكيل
      const newBalance = (agent.balance || 0) - totalAmount + agentCommission;
      await base44.entities.Agent.update(agent.id, {
        balance: newBalance,
        total_bookings: (agent.total_bookings || 0) + 1,
        total_sales: (agent.total_sales || 0) + totalAmount,
        total_commission: (agent.total_commission || 0) + agentCommission
      });

      // تسجيل معاملة الخصم
      await base44.entities.AgentTransaction.create({
        agent_id: agent.id,
        agent_name: agent.name,
        transaction_type: 'booking_payment',
        amount: totalAmount,
        balance_before: agent.balance,
        balance_after: newBalance - agentCommission,
        reference_type: 'booking',
        reference_id: bookingNumber,
        description: `حجز تذكرة ${seat.flight_number} - ${customerData.name}`,
        source: 'web',
        status: 'completed'
      });

      // تسجيل معاملة العمولة
      if (agentCommission > 0) {
        await base44.entities.AgentTransaction.create({
          agent_id: agent.id,
          agent_name: agent.name,
          transaction_type: 'commission',
          amount: agentCommission,
          balance_before: newBalance - agentCommission,
          balance_after: newBalance,
          reference_type: 'booking',
          reference_id: bookingNumber,
          description: `عمولة حجز ${bookingNumber}`,
          source: 'web',
          status: 'completed'
        });
      }

      // تحديث المقاعد المحجوزة
      await base44.entities.AvailableSeat.update(seat.id, {
        booked_count: (seat.booked_count || 0) + passengersCount
      });

      // إنشاء القيود المالية للوكيل
      await createAgentFinancialEntries(booking, totalAmount, systemCommission, agentCommission, providerAmount);

      toast.success('تم إنشاء الحجز بنجاح!');
      navigate(createPageUrl('AgentBookings'));

    } catch (error) {
      toast.error('فشل إنشاء الحجز: ' + error.message);
    }
    setSubmitting(false);
  };

  const createAgentFinancialEntries = async (booking, totalAmount, systemCommission, agentCommission, providerAmount) => {
    try {
      // جلب الحسابات
      const agentSalesAccount = await base44.entities.Account.filter({ 
        category: 'sales',
        name: { $regex: 'مبيعات الوكلاء' }
      });

      const providerAccount = await base44.entities.Account.filter({
        related_entity_type: 'provider',
        related_entity_id: booking.provider_id
      });

      const systemCommissionAccount = await base44.entities.Account.filter({
        category: 'commission_revenue'
      });

      const agentAccount = await base44.entities.Account.filter({
        related_entity_type: 'agent',
        related_entity_id: agent.id
      });

      // 1. من حساب الوكيل → حساب "مبيعات الوكلاء"
      if (agentAccount.length > 0 && agentSalesAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentAccount[0].id,
          account_name: agentAccount[0].name,
          transaction_type: 'credit',
          amount: totalAmount,
          description: `دفع حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          agent_id: agent.id
        });

        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          account_name: agentSalesAccount[0].name,
          transaction_type: 'debit',
          amount: totalAmount,
          description: `استلام دفع من الوكيل ${agent.name} - حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          agent_id: agent.id
        });
      }

      // 2. من حساب "مبيعات الوكلاء" → حساب المزود
      if (agentSalesAccount.length > 0 && providerAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          account_name: agentSalesAccount[0].name,
          transaction_type: 'credit',
          amount: providerAmount,
          description: `تحويل للمزود ${booking.provider_name}`,
          reference_type: 'booking',
          reference_id: booking.id,
          provider_id: booking.provider_id
        });

        await base44.entities.AccountTransaction.create({
          account_id: providerAccount[0].id,
          account_name: providerAccount[0].name,
          transaction_type: 'debit',
          amount: providerAmount,
          description: `استحقاق من حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          provider_id: booking.provider_id
        });

        // تحديث رصيد المزود
        const currentProvider = await base44.entities.Provider.filter({ id: booking.provider_id });
        if (currentProvider.length > 0) {
          await base44.entities.Provider.update(booking.provider_id, {
            balance: (currentProvider[0].balance || 0) + providerAmount
          });
        }
      }

      // 3. من حساب "مبيعات الوكلاء" → حساب "عمولة النظام"
      if (agentSalesAccount.length > 0 && systemCommissionAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          account_name: agentSalesAccount[0].name,
          transaction_type: 'credit',
          amount: systemCommission,
          description: `عمولة النظام من حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id
        });

        await base44.entities.AccountTransaction.create({
          account_id: systemCommissionAccount[0].id,
          account_name: systemCommissionAccount[0].name,
          transaction_type: 'debit',
          amount: systemCommission,
          description: `عمولة من حجز وكيل ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id
        });
      }

      console.log('✅ تم إنشاء القيود المالية للوكيل بنجاح');
    } catch (error) {
      console.error('❌ خطأ في إنشاء القيود المالية:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="text-center p-8">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p>الرحلة غير متاحة</p>
          <Button className="mt-4" onClick={() => navigate(createPageUrl('AgentSearch'))}>
            العودة للبحث
          </Button>
        </Card>
      </div>
    );
  }

  const totalAmount = seat.total_price * passengersCount;
  const hasEnoughBalance = (agent?.balance || 0) >= totalAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* الخطوات */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all
                ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > s ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* النموذج */}
          <div className="lg:col-span-2">
            {/* الخطوة 1: بيانات العميل */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    بيانات العميل
                  </CardTitle>
                  <CardDescription>أدخل بيانات العميل الذي يتم الحجز له</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم العميل *</Label>
                      <Input
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        placeholder="الاسم الكامل"
                      />
                    </div>
                    <div>
                      <Label>رقم الهاتف *</Label>
                      <Input
                        value={customerData.phone}
                        onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                        placeholder="+967..."
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={customerData.email}
                        onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>واتساب</Label>
                      <Input
                        value={customerData.whatsapp}
                        onChange={(e) => setCustomerData({ ...customerData, whatsapp: e.target.value })}
                        placeholder="نفس رقم الهاتف إذا فارغ"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* الخطوة 2: بيانات المسافرين */}
            {step === 2 && (
              <div className="space-y-4">
                {passengers.map((passenger, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          المسافر {index + 1}
                        </CardTitle>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files[0] && handlePassportUpload(index, e.target.files[0])}
                          className="hidden"
                          id={`passport-${index}`}
                        />
                        <label htmlFor={`passport-${index}`}>
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>
                              <Camera className="h-4 w-4 ml-1" />
                              رفع صورة الجواز
                            </span>
                          </Button>
                        </label>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الاسم الكامل (كما في الجواز) *</Label>
                          <Input
                            value={passenger.full_name}
                            onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                            placeholder="AHMED MOHAMMED ALI"
                            dir="ltr"
                            className="uppercase"
                          />
                        </div>
                        <div>
                          <Label>رقم الجواز *</Label>
                          <Input
                            value={passenger.passport_number}
                            onChange={(e) => updatePassenger(index, 'passport_number', e.target.value)}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
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
                              <SelectItem value="YE">اليمن</SelectItem>
                              <SelectItem value="SA">السعودية</SelectItem>
                              <SelectItem value="AE">الإمارات</SelectItem>
                              <SelectItem value="EG">مصر</SelectItem>
                              <SelectItem value="JO">الأردن</SelectItem>
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
                                  : 'اختر'
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
                          <Label>انتهاء الجواز</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <CalendarIcon className="h-4 w-4 ml-2" />
                                {passenger.passport_expiry_date 
                                  ? format(passenger.passport_expiry_date, 'dd/MM/yyyy')
                                  : 'اختر'
                                }
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={passenger.passport_expiry_date}
                                onSelect={(date) => updatePassenger(index, 'passport_expiry_date', date)}
                                disabled={(date) => date < new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {passenger.passport_image_url && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          تم رفع صورة الجواز
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* الخطوة 3: التأكيد */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    مراجعة وتأكيد الحجز
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* ملخص الرحلة */}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold mb-3">تفاصيل الرحلة</h4>
                    <div className="flex items-center gap-4">
                      {seat.airline_logo && (
                        <img src={seat.airline_logo} className="h-12 w-12 rounded-lg" />
                      )}
                      <div className="flex-1">
                        <p className="font-bold">{seat.airline_name} - {seat.flight_number}</p>
                        <p className="text-slate-600">{seat.departure_city} ← {seat.arrival_city}</p>
                        <p className="text-sm text-slate-500">
                          {seat.departure_date && format(new Date(seat.departure_date), 'd MMMM yyyy', { locale: ar })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ملخص العميل */}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold mb-3">بيانات العميل</h4>
                    <p><strong>الاسم:</strong> {customerData.name}</p>
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  </div>

                  {/* ملخص المسافرين */}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold mb-3">المسافرون ({passengersCount})</h4>
                    {passengers.map((p, i) => (
                      <p key={i}>{i + 1}. {p.full_name} - {p.passport_number}</p>
                    ))}
                  </div>

                  {/* تحذير الرصيد */}
                  {!hasEnoughBalance && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-semibold text-red-800">رصيدك غير كافٍ!</p>
                        <p className="text-sm text-red-600">
                          المطلوب: ${totalAmount} - المتاح: ${agent?.balance || 0}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* أزرار التنقل */}
            <div className="flex justify-between mt-6">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  السابق
                </Button>
              )}
              {step < 3 ? (
                <Button onClick={handleNext} className="mr-auto" style={{ backgroundColor: agent?.brand_color }}>
                  التالي
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={submitting || !hasEnoughBalance}
                  className="mr-auto"
                  style={{ backgroundColor: agent?.brand_color }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري الحجز...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 ml-2" />
                      تأكيد ودفع ${totalAmount}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* ملخص الحجز */}
          <div>
            <Card className="sticky top-24">
              <CardHeader className="bg-slate-50 rounded-t-xl">
                <CardTitle className="text-lg">ملخص الحجز</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-3">
                  {seat.airline_logo && (
                    <img src={seat.airline_logo} className="h-10 w-10 rounded-lg" />
                  )}
                  <div>
                    <p className="font-bold">{seat.flight_number}</p>
                    <p className="text-sm text-slate-500">{seat.airline_name}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span>{seat.departure_city}</span>
                  <Plane className="h-4 w-4 text-blue-600" />
                  <span>{seat.arrival_city}</span>
                </div>

                <div className="text-center text-sm text-slate-500">
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
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>الإجمالي</span>
                    <span className="text-green-600">${totalAmount}</span>
                  </div>
                </div>

                <Separator />

                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>رصيدك الحالي</span>
                    <span className={hasEnoughBalance ? 'text-green-600' : 'text-red-600'}>
                      ${agent?.balance || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>بعد الحجز</span>
                    <span>${Math.max(0, (agent?.balance || 0) - totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}