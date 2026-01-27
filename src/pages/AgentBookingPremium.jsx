import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import PassportScanner from '@/components/booking/PassportScanner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Plane, CheckCircle, AlertCircle, Loader2, CreditCard, 
  ArrowRight, Wallet, FileText, Calendar, MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AgentBookingPremium() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [seat, setSeat] = useState(null);
  const [externalFlight, setExternalFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [passengersCount, setPassengersCount] = useState(1);

  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: ''
  });

  const [passengers, setPassengers] = useState([]);
  const [currentPassengerIndex, setCurrentPassengerIndex] = useState(0);

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
    const urlParams = new URLSearchParams(window.location.search);
    const seatId = urlParams.get('seat_id');
    const externalFlightData = urlParams.get('external_flight');
    const passCount = parseInt(urlParams.get('passengers') || '1');
    
    setPassengersCount(passCount);
    setPassengers(Array(passCount).fill(null).map(() => ({})));

    const agentData = await base44.entities.Agent.filter({ id: agentId });
    if (agentData.length > 0) setAgent(agentData[0]);

    if (seatId) {
      const seatData = await base44.entities.AvailableSeat.filter({ id: seatId });
      if (seatData.length > 0) setSeat(seatData[0]);
    } else if (externalFlightData) {
      setExternalFlight(JSON.parse(decodeURIComponent(externalFlightData)));
    }

    setLoading(false);
  };

  const handlePassengerDataComplete = (data) => {
    const newPassengers = [...passengers];
    newPassengers[currentPassengerIndex] = data;
    setPassengers(newPassengers);

    if (currentPassengerIndex < passengersCount - 1) {
      setCurrentPassengerIndex(currentPassengerIndex + 1);
    } else {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    const flight = seat || externalFlight;
    const isExternal = !!externalFlight;
    const totalAmount = (flight.total_price || flight.price_per_person) * passengersCount;
    const systemCommission = isExternal ? externalFlight.system_commission : (seat.system_commission || 30);
    const providerAmount = totalAmount - systemCommission;

    if ((agent?.balance || 0) < totalAmount) {
      toast.error(`رصيدك غير كافٍ! المطلوب: $${totalAmount} - المتاح: $${agent?.balance || 0}`);
      return;
    }

    setSubmitting(true);
    try {
      // إنشاء أو جلب العميل
      let customerId;
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

      const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;
      const agentCommission = (systemCommission * (agent.commission_percentage || 0)) / 100;

      if (isExternal) {
        // حجز خارجي
        await base44.entities.ExternalProviderBooking.create({
          booking_number: bookingNumber,
          source_platform: externalFlight.source_platform,
          source_url: externalFlight.source_url,
          source_price: externalFlight.source_price,
          system_commission: systemCommission,
          total_price: totalAmount,
          price_per_person: externalFlight.price_per_person,
          passenger_count: passengersCount,
          customer_id: customerId,
          customer_name: customerData.name,
          customer_phone: customerData.phone,
          customer_whatsapp: customerData.whatsapp,
          customer_email: customerData.email,
          agent_id: agent.id,
          agent_name: agent.name,
          flight_data: externalFlight.flight_data,
          passengers,
          payment_status: 'paid',
          payment_method: 'agent_balance',
          status: 'pending_issue',
          booking_source: 'agent'
        });
      } else {
        // حجز داخلي
        await base44.entities.Booking.create({
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
          return_date: seat.return_fixed_date,
          return_flight_id: seat.return_flight_id,
          return_flight_number: seat.return_flight_number,
          trip_type: seat.trip_type,
          seat_class: seat.seat_class,
          passengers,
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

        // تحديث المقاعد
        await base44.entities.AvailableSeat.update(seat.id, {
          booked_count: (seat.booked_count || 0) + passengersCount
        });
      }

      // خصم من رصيد الوكيل
      const newBalance = (agent.balance || 0) - totalAmount + agentCommission;
      await base44.entities.Agent.update(agent.id, {
        balance: newBalance,
        total_bookings: (agent.total_bookings || 0) + 1,
        total_sales: (agent.total_sales || 0) + totalAmount,
        total_commission: (agent.total_commission || 0) + agentCommission
      });

      // تسجيل المعاملات
      await base44.entities.AgentTransaction.create({
        agent_id: agent.id,
        agent_name: agent.name,
        transaction_type: 'booking_payment',
        amount: totalAmount,
        balance_before: agent.balance,
        balance_after: newBalance - agentCommission,
        reference_type: 'booking',
        reference_id: bookingNumber,
        description: `حجز ${bookingNumber} - ${customerData.name}`,
        status: 'completed'
      });

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
          status: 'completed'
        });
      }

      // إنشاء القيود المالية
      await createAgentFinancialEntries(bookingNumber, totalAmount, systemCommission, providerAmount);

      toast.success('تم إنشاء الحجز بنجاح!');
      navigate(createPageUrl('AgentBookings'));

    } catch (error) {
      console.error(error);
      toast.error('فشل إنشاء الحجز');
    }
    setSubmitting(false);
  };

  const createAgentFinancialEntries = async (bookingNumber, totalAmount, systemCommission, providerAmount) => {
    try {
      const agentSalesAccount = await base44.entities.Account.filter({ 
        name: { $regex: 'مبيعات الوكلاء' }
      });

      const providerAccount = await base44.entities.Account.filter({
        related_entity_type: 'provider',
        related_entity_id: (seat?.provider_id || externalFlight?.provider_id)
      });

      const commissionAccount = await base44.entities.Account.filter({
        name: { $regex: 'عمولة النظام' }
      });

      const agentAccount = await base44.entities.Account.filter({
        related_entity_type: 'agent',
        related_entity_id: agent.id
      });

      // 1. من حساب الوكيل → مبيعات الوكلاء
      if (agentAccount.length > 0 && agentSalesAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentAccount[0].id,
          transaction_type: 'credit',
          amount: totalAmount,
          description: `دفع حجز ${bookingNumber}`,
          reference_type: 'booking',
          reference_number: bookingNumber,
          agent_id: agent.id
        });

        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          transaction_type: 'debit',
          amount: totalAmount,
          description: `حجز ${bookingNumber}`,
          reference_type: 'booking',
          reference_number: bookingNumber,
          agent_id: agent.id
        });
      }

      // 2. من مبيعات الوكلاء → المزود
      if (agentSalesAccount.length > 0 && providerAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          transaction_type: 'credit',
          amount: providerAmount,
          description: `تحويل للمزود - ${bookingNumber}`,
          provider_id: seat?.provider_id
        });

        await base44.entities.AccountTransaction.create({
          account_id: providerAccount[0].id,
          transaction_type: 'debit',
          amount: providerAmount,
          description: `استحقاق ${bookingNumber}`,
          provider_id: seat?.provider_id
        });
      }

      // 3. من مبيعات الوكلاء → عمولة النظام
      if (agentSalesAccount.length > 0 && commissionAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: agentSalesAccount[0].id,
          transaction_type: 'credit',
          amount: systemCommission,
          description: `عمولة ${bookingNumber}`
        });

        await base44.entities.AccountTransaction.create({
          account_id: commissionAccount[0].id,
          transaction_type: 'debit',
          amount: systemCommission,
          description: `عمولة ${bookingNumber}`
        });
      }
    } catch (error) {
      console.error('خطأ القيود المالية:', error);
    }
  };

  const flight = seat || externalFlight;
  if (loading || !flight) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalAmount = (flight.total_price || flight.price_per_person) * passengersCount;
  const hasEnoughBalance = (agent?.balance || 0) >= totalAmount;
  const steps = [
    { num: 1, title: 'بيانات العميل', icon: User },
    { num: 2, title: 'بيانات المسافرين', icon: FileText },
    { num: 3, title: 'التأكيد', icon: CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* خطوات التقدم */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                step >= s.num 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 text-slate-500'
              }`}>
                <s.icon className="h-4 w-4" />
                <span className="text-sm font-semibold hidden md:inline">{s.title}</span>
                <span className="md:hidden">{s.num}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-1 ${step > s.num ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* المحتوى الرئيسي */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* الخطوة 1: بيانات العميل */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card className="shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        بيانات العميل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>اسم العميل *</Label>
                          <Input
                            value={customerData.name}
                            onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                            placeholder="الاسم الكامل"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>رقم الهاتف *</Label>
                          <Input
                            value={customerData.phone}
                            onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                            placeholder="+967..."
                            dir="ltr"
                            className="mt-1"
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
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>واتساب</Label>
                          <Input
                            value={customerData.whatsapp}
                            onChange={(e) => setCustomerData({ ...customerData, whatsapp: e.target.value })}
                            placeholder="اختياري"
                            dir="ltr"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => {
                          if (!customerData.name || !customerData.phone) {
                            toast.error('يرجى إدخال الاسم ورقم الهاتف');
                            return;
                          }
                          setStep(2);
                        }}
                        className="w-full h-12 mt-4"
                        style={{ backgroundColor: agent?.brand_color }}
                      >
                        التالي
                        <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* الخطوة 2: بيانات المسافرين */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card className="shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          المسافر {currentPassengerIndex + 1} من {passengersCount}
                        </CardTitle>
                        <Progress value={((currentPassengerIndex + 1) / passengersCount) * 100} className="w-32" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <PassportScanner
                        passengerIndex={currentPassengerIndex}
                        initialData={passengers[currentPassengerIndex]}
                        onScanComplete={handlePassengerDataComplete}
                      />
                      
                      {currentPassengerIndex > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPassengerIndex(currentPassengerIndex - 1)}
                          className="mt-4"
                        >
                          المسافر السابق
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* الخطوة 3: التأكيد */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card className="shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        مراجعة وتأكيد الحجز
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {/* بيانات العميل */}
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <h4 className="font-semibold mb-3">العميل</h4>
                        <p><strong>الاسم:</strong> {customerData.name}</p>
                        <p><strong>الهاتف:</strong> {customerData.phone}</p>
                      </div>

                      {/* المسافرون */}
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <h4 className="font-semibold mb-3">المسافرون ({passengersCount})</h4>
                        {passengers.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                            <span>{i + 1}. {p.full_name}</span>
                            <span className="text-sm text-slate-500">{p.passport_number}</span>
                          </div>
                        ))}
                      </div>

                      {!hasEnoughBalance ? (
                        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                            <div>
                              <p className="font-bold text-red-800">رصيدك غير كافٍ</p>
                              <p className="text-sm text-red-600">
                                المطلوب: ${totalAmount} | المتاح: ${agent?.balance || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="w-full h-14 text-lg"
                          style={{ backgroundColor: agent?.brand_color }}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                              جاري الحجز...
                            </>
                          ) : (
                            <>
                              <Wallet className="h-5 w-5 ml-2" />
                              تأكيد ودفع ${totalAmount}
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                        className="w-full"
                      >
                        السابق
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ملخص الرحلة */}
          <div>
            <Card className="sticky top-24 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-slate-900 to-blue-900 text-white">
                <CardTitle>ملخص الحجز</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {flight.airline_logo && (
                  <div className="flex items-center gap-3">
                    <img src={flight.airline_logo} className="h-12 w-12 rounded-lg" />
                    <div>
                      <p className="font-bold">{flight.flight_number || flight.flight_data?.flight_number}</p>
                      <p className="text-sm text-slate-500">{flight.airline_name || flight.flight_data?.airline_name}</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">المسار</span>
                    <span className="font-semibold">
                      {flight.departure_city || flight.flight_data?.departure_city} ← {flight.arrival_city || flight.flight_data?.arrival_city}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">التاريخ</span>
                    <span className="font-semibold">
                      {flight.departure_date || flight.flight_data?.departure_date}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">المسافرون</span>
                    <span className="font-semibold">{passengersCount}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>سعر الشخص</span>
                    <span>${flight.total_price || flight.price_per_person}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>الإجمالي</span>
                    <span className="text-green-600">${totalAmount}</span>
                  </div>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between text-sm">
                    <span>رصيدك الحالي</span>
                    <span className={hasEnoughBalance ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      ${agent?.balance || 0}
                    </span>
                  </div>
                  {hasEnoughBalance && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>بعد الحجز</span>
                      <span className="text-slate-600">
                        ${(agent?.balance || 0) - totalAmount}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}