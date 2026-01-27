import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Clock, CheckCircle, AlertTriangle, Download, Eye, FileText,
  Calendar, MapPin, Users, Ticket, Loader2, ExternalLink, Globe,
  CreditCard, Phone, ChevronLeft
} from 'lucide-react';

export default function CustomerBookings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [externalBookings, setExternalBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    const userData = await base44.auth.me();
    setUser(userData);
    await loadBookings(userData.email);
  };

  const loadBookings = async (email) => {
    setLoading(true);
    
    // تحميل الحجوزات العادية
    const normalBookings = await base44.entities.Booking.filter(
      { customer_email: email },
      '-created_date',
      50
    );
    
    // تحميل حجوزات المزود الخارجي
    const extBookings = await base44.entities.ExternalProviderBooking.filter(
      { customer_email: email },
      '-created_date',
      50
    );

    setBookings(normalBookings.map(b => ({ ...b, booking_type: 'internal' })));
    setExternalBookings(extBookings.map(b => ({ ...b, booking_type: 'external' })));
    setLoading(false);
  };

  const allBookings = [...bookings, ...externalBookings].sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date)
  );

  const filteredBookings = activeTab === 'all' 
    ? allBookings 
    : allBookings.filter(b => b.status === activeTab);

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'مدفوع', color: 'bg-blue-100 text-blue-700', icon: CreditCard },
    pending_issue: { label: 'قيد الإصدار', color: 'bg-orange-100 text-orange-700', icon: Clock },
    processing: { label: 'جاري المعالجة', color: 'bg-purple-100 text-purple-700', icon: Loader2 },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    refunded: { label: 'مسترد', color: 'bg-slate-100 text-slate-700', icon: CreditCard }
  };

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">جاري تحميل حجوزاتك...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ModernHeader />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">حجوزاتي</h1>
            <p className="text-slate-600">
              مرحباً {user?.full_name}، هنا يمكنك متابعة جميع حجوزاتك
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-4 text-center">
                <p className="text-4xl font-bold">{allBookings.length}</p>
                <p className="text-blue-100">إجمالي الحجوزات</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-4 text-center">
                <p className="text-4xl font-bold">
                  {allBookings.filter(b => b.status === 'issued').length}
                </p>
                <p className="text-green-100">تم الإصدار</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-4 text-center">
                <p className="text-4xl font-bold">
                  {allBookings.filter(b => ['pending_issue', 'processing'].includes(b.status)).length}
                </p>
                <p className="text-orange-100">قيد الإصدار</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-4 text-center">
                <p className="text-4xl font-bold">{externalBookings.length}</p>
                <p className="text-purple-100">حجوزات خارجية</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="pending_issue">قيد الإصدار</TabsTrigger>
              <TabsTrigger value="issued">تم الإصدار</TabsTrigger>
              <TabsTrigger value="cancelled">ملغي</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredBookings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Ticket className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد حجوزات</h3>
                    <p className="text-slate-500 mb-6">لم تقم بأي حجز بعد</p>
                    <Button onClick={() => navigate(createPageUrl('Home'))}>
                      <Plane className="h-5 w-5 ml-2" />
                      احجز رحلتك الآن
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredBookings.map((booking, index) => {
                      const status = statusConfig[booking.status] || statusConfig.pending_payment;
                      const StatusIcon = status.icon;
                      const flightData = booking.flight_data || booking;
                      const isExternal = booking.booking_type === 'external';

                      return (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className={`overflow-hidden hover:shadow-lg transition-shadow ${
                            isExternal ? 'ring-2 ring-purple-200' : ''
                          }`}>
                            {isExternal && (
                              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-1.5 text-white text-sm flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5" />
                                حجز من {booking.source_platform}
                              </div>
                            )}
                            <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                    {flightData.airline_logo ? (
                                      <img src={flightData.airline_logo} alt="" className="h-10 w-10 object-contain" />
                                    ) : (
                                      <Plane className="h-6 w-6 text-slate-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-lg">
                                      {flightData.departure_city || flightData.departure_airport_code} 
                                      <ChevronLeft className="inline h-4 w-4 mx-2" />
                                      {flightData.arrival_city || flightData.arrival_airport_code}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {flightData.airline_name} - {flightData.flight_number}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {flightData.departure_date && format(parseISO(flightData.departure_date), 'd MMM yyyy', { locale: ar })}
                                      </span>
                                      <span className="font-mono">#{booking.booking_number}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-left">
                                    <Badge className={status.color}>
                                      <StatusIcon className="h-3 w-3 ml-1" />
                                      {status.label}
                                    </Badge>
                                    <p className="text-2xl font-bold mt-2">${booking.total_price || booking.total_amount}</p>
                                  </div>
                                  
                                  <Button 
                                    variant="outline" 
                                    onClick={() => handleViewBooking(booking)}
                                  >
                                    <Eye className="h-4 w-4 ml-2" />
                                    التفاصيل
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Booking Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الحجز - {selectedBooking?.booking_number}</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Flight Info */}
              <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    {(selectedBooking.flight_data?.airline_logo || selectedBooking.airline_logo) && (
                      <img 
                        src={selectedBooking.flight_data?.airline_logo || selectedBooking.airline_logo} 
                        alt="" 
                        className="h-12 w-12 rounded-xl bg-white p-1" 
                      />
                    )}
                    <div>
                      <p className="font-bold text-lg">
                        {selectedBooking.flight_data?.airline_name || selectedBooking.airline_name}
                      </p>
                      <p className="text-blue-200">
                        {selectedBooking.flight_data?.flight_number || selectedBooking.flight_number}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {selectedBooking.flight_data?.departure_city || selectedBooking.departure_city}
                      </p>
                      <p className="text-blue-200">
                        {selectedBooking.flight_data?.departure_time || selectedBooking.departure_time}
                      </p>
                    </div>
                    <Plane className="h-6 w-6 rotate-[270deg]" />
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {selectedBooking.flight_data?.arrival_city || selectedBooking.arrival_city}
                      </p>
                      <p className="text-blue-200">
                        {selectedBooking.flight_data?.arrival_time || selectedBooking.arrival_time}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span>حالة الحجز</span>
                <Badge className={statusConfig[selectedBooking.status]?.color}>
                  {statusConfig[selectedBooking.status]?.label}
                </Badge>
              </div>

              {/* Ticket */}
              {selectedBooking.status === 'issued' && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        <div>
                          <p className="font-semibold text-green-800">تم إصدار التذكرة</p>
                          {selectedBooking.ticket_number && (
                            <p className="text-sm text-green-600">رقم التذكرة: {selectedBooking.ticket_number}</p>
                          )}
                        </div>
                      </div>
                      {(selectedBooking.ticket_pdf_url) && (
                        <a href={selectedBooking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button className="bg-green-600 hover:bg-green-700">
                            <Download className="h-4 w-4 ml-2" />
                            تحميل التذكرة
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pending Message */}
              {['pending_issue', 'processing'].includes(selectedBooking.status) && (
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="font-semibold text-orange-800">تذكرتك قيد الإصدار</p>
                        <p className="text-sm text-orange-600">
                          سيتم إرسال التذكرة إلى رقم الواتساب الخاص بك فور الانتهاء
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Price */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span>المبلغ الإجمالي</span>
                <span className="text-2xl font-bold text-green-600">
                  ${selectedBooking.total_price || selectedBooking.total_amount}
                </span>
              </div>

              {/* Contact */}
              {selectedBooking.customer_whatsapp && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Phone className="h-4 w-4" />
                  سيتم التواصل معك على: {selectedBooking.customer_whatsapp}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ModernFooter />
    </div>
  );
}