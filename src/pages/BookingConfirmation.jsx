import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  CheckCircle, Plane, Calendar, Users, Phone, Home, Eye,
  Download, Share2, MessageSquare, Clock, Sparkles, Globe
} from 'lucide-react';

export default function BookingConfirmation() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    loadBooking();
    
    // Confetti animation
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }, 500);
  }, []);

  const loadBooking = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking_id');
    const bookingType = urlParams.get('type');
    
    if (bookingId && bookingType) {
      if (bookingType === 'external') {
        const bookings = await base44.entities.ExternalProviderBooking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking(bookings[0]);
          setIsExternal(true);
        }
      } else {
        const bookings = await base44.entities.Booking.filter({ id: bookingId });
        if (bookings.length > 0) {
          setBooking(bookings[0]);
        }
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold mb-4">الحجز غير موجود</h2>
            <Button onClick={() => navigate(createPageUrl('Home'))}>
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const flightData = booking.flight_data || booking;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white" dir="rtl">
      <ModernHeader />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500 rounded-full mb-6 shadow-2xl">
              <CheckCircle className="h-14 w-14 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-green-700 mb-3">
              تم تأكيد حجزك بنجاح!
            </h1>
            <p className="text-xl text-slate-600">
              رقم الحجز: <span className="font-mono font-bold text-green-600">{booking.booking_number}</span>
            </p>
          </motion.div>

          {/* Booking Details */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="mb-6 shadow-xl">
              {isExternal && (
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-white text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  حجز من {booking.source_platform}
                </div>
              )}
              <CardContent className="p-8">
                {/* Flight Info */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                  {flightData.airline_logo && (
                    <img src={flightData.airline_logo} alt="" className="h-16 w-16 rounded-2xl object-contain bg-slate-50 p-2" />
                  )}
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{flightData.airline_name}</h3>
                    <p className="text-slate-500 font-mono">{flightData.flight_number}</p>
                  </div>
                </div>

                {/* Route */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-slate-500 text-sm mb-1">من</p>
                    <p className="text-xl font-bold">{flightData.departure_city}</p>
                    <p className="text-sm text-slate-400">{flightData.departure_time}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <Plane className="h-6 w-6 text-blue-500 rotate-[270deg]" />
                  </div>
                  <div className="text-left">
                    <p className="text-slate-500 text-sm mb-1">إلى</p>
                    <p className="text-xl font-bold">{flightData.arrival_city}</p>
                    <p className="text-sm text-slate-400">{flightData.arrival_time}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">تاريخ المغادرة</p>
                      <p className="font-semibold">
                        {flightData.departure_date && format(parseISO(flightData.departure_date), 'd MMMM yyyy', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">عدد المسافرين</p>
                      <p className="font-semibold">{booking.passenger_count || booking.passengers_count || 1}</p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between p-6 bg-green-50 rounded-2xl border-2 border-green-200">
                  <span className="text-lg">المبلغ المدفوع</span>
                  <span className="text-3xl font-bold text-green-600">
                    ${booking.total_price || booking.total_amount}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Status Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Clock className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg text-blue-900 mb-2">تذكرتك قيد الإصدار</h3>
                    <p className="text-blue-700 mb-3">
                      سيتم إصدار تذكرتك خلال الدقائق القادمة وإرسالها إلى رقم الواتساب:
                    </p>
                    <div className="flex items-center gap-2 bg-white p-3 rounded-lg">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <span className="font-mono font-semibold" dir="ltr">{booking.customer_whatsapp}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex gap-4"
          >
            <Button 
              onClick={() => navigate(createPageUrl('CustomerBookings'))}
              className="flex-1 h-14 text-lg"
            >
              <Eye className="h-5 w-5 ml-2" />
              عرض حجوزاتي
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate(createPageUrl('Home'))}
              className="flex-1 h-14 text-lg"
            >
              <Home className="h-5 w-5 ml-2" />
              الصفحة الرئيسية
            </Button>
          </motion.div>

          {/* Thank You Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-12 p-8 bg-gradient-to-r from-slate-50 to-blue-50 rounded-3xl"
          >
            <Sparkles className="h-8 w-8 text-blue-600 mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              شكراً لاختيارك خدماتنا
            </h3>
            <p className="text-lg text-slate-600 mb-2">
              نفخر بأنك عميل لدينا
            </p>
            <p className="text-slate-500">
              نتمنى لك رحلة سعيدة وممتعة ✈️
            </p>
          </motion.div>
        </div>
      </main>

      <ModernFooter />
    </div>
  );
}