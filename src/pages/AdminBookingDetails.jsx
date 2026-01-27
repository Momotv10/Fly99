import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  ArrowRight, Plane, Users, CreditCard, FileText, Upload, 
  CheckCircle2, Clock, XCircle, AlertCircle, MessageSquare, Download 
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminBookingDetails() {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueData, setIssueData] = useState({
    external_booking_number: '',
    ticket_number: '',
    ticket_pdf_url: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type');

    if (id) {
      // تحميل من الجدول المناسب
      if (type === 'external') {
        const bookings = await base44.entities.ExternalProviderBooking.filter({ id });
        if (bookings.length > 0) {
          setBooking({ ...bookings[0], isExternal: true });
        }
      } else {
        const bookings = await base44.entities.Booking.filter({ id });
        if (bookings.length > 0) {
          setBooking(bookings[0]);
          
          if (bookings[0].flight_id) {
            const flights = await base44.entities.Flight.filter({ id: bookings[0].flight_id });
            if (flights.length > 0) {
              setFlight(flights[0]);
            }
          }
          
          // تحميل رحلة العودة إذا وجدت
          if (bookings[0].return_flight_id) {
            const returnFlights = await base44.entities.Flight.filter({ id: bookings[0].return_flight_id });
            if (returnFlights.length > 0) {
              setFlight(prev => ({ ...prev, returnFlight: returnFlights[0] }));
            }
          }
        }
      }
    }
    setLoading(false);
  };

  const handleTicketUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setIssueData({ ...issueData, ticket_pdf_url: file_url });
      setUploading(false);
    }
  };

  const handleIssueTicket = async () => {
    if (!issueData.external_booking_number || !issueData.ticket_number) {
      toast.error('يرجى إدخال رقم الحجز ورقم التذكرة');
      return;
    }

    await base44.entities.Booking.update(booking.id, {
      status: 'issued',
      external_booking_number: issueData.external_booking_number,
      ticket_number: issueData.ticket_number,
      ticket_pdf_url: issueData.ticket_pdf_url
    });

    toast.success('تم إصدار التذكرة بنجاح');
    setIssueDialogOpen(false);
    loadData();
  };

  const handleCancelBooking = async () => {
    if (confirm('هل أنت متأكد من إلغاء الحجز؟')) {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      
      // Return seats to flight
      if (flight) {
        await base44.entities.Flight.update(flight.id, {
          available_seats: (flight.available_seats || 0) + (booking.passengers_count || 1)
        });
      }

      toast.success('تم إلغاء الحجز');
      loadData();
    }
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    paid: { label: 'تم الدفع', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    refunded: { label: 'مسترد', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: AlertCircle }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <AdminSidebar />
        <div className="lg:mr-64 p-6 text-center">
          <h1 className="text-2xl font-bold text-slate-700">الحجز غير موجود</h1>
        </div>
      </div>
    );
  }

  const status = statusConfig[booking.status] || statusConfig.pending_payment;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AdminBookings'))}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">تفاصيل الحجز</h1>
            <p className="text-slate-600 font-mono">{booking.booking_number}</p>
          </div>
          <Badge className={`${status.color} border text-lg px-4 py-2`}>
            <StatusIcon className="h-4 w-4 ml-2" />
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Flight Info - Internal */}
            {!booking.isExternal && flight && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-blue-600" />
                    معلومات الرحلة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-xl">
                    <h4 className="font-semibold text-green-800 mb-3">رحلة الذهاب</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">شركة الطيران</p>
                        <p className="font-semibold">{flight.airline_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">رقم الرحلة</p>
                        <p className="font-semibold">{flight.flight_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">من</p>
                        <p className="font-semibold">{flight.departure_city} ({flight.departure_airport_code})</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">إلى</p>
                        <p className="font-semibold">{flight.arrival_city} ({flight.arrival_airport_code})</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">تاريخ المغادرة</p>
                        <p className="font-semibold">
                          {booking.departure_date && format(new Date(booking.departure_date), 'dd MMMM yyyy', { locale: ar })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">وقت المغادرة</p>
                        <p className="font-semibold">{booking.departure_time}</p>
                      </div>
                    </div>
                  </div>
                  
                  {booking.trip_type === 'round_trip' && booking.return_date && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <h4 className="font-semibold text-blue-800 mb-3">رحلة العودة</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-slate-500">رقم رحلة العودة</p>
                          <p className="font-semibold">{booking.return_flight_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">تاريخ العودة</p>
                          <p className="font-semibold text-blue-700">
                            {format(new Date(booking.return_date), 'dd MMMM yyyy', { locale: ar })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">وقت الإقلاع</p>
                          <p className="font-semibold">{booking.return_departure_time || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Flight Info - External */}
            {booking.isExternal && booking.flight_data && (
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    معلومات الرحلة - مزود خارجي
                    <Badge className="mr-auto">{booking.source_platform}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">شركة الطيران</p>
                      <p className="font-semibold">{booking.flight_data.airline_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">رقم الرحلة</p>
                      <p className="font-semibold">{booking.flight_data.flight_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">المسار</p>
                      <p className="font-semibold">
                        {booking.flight_data.departure_city} ← {booking.flight_data.arrival_city}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">تاريخ المغادرة</p>
                      <p className="font-semibold">{booking.flight_data.departure_date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">وقت المغادرة</p>
                      <p className="font-semibold">{booking.flight_data.departure_time}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">الدرجة</p>
                      <Badge>{booking.flight_data.seat_class}</Badge>
                    </div>
                  </div>
                  
                  {booking.flight_data.trip_type === 'round_trip' && (
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <p className="text-sm font-semibold text-blue-800 mb-2">رحلة العودة</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-500">التاريخ:</span>
                          <span className="font-semibold mr-2">{booking.flight_data.return_date}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">الوقت:</span>
                          <span className="font-semibold mr-2">{booking.flight_data.return_departure_time}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {booking.source_url && (
                    <a href={booking.source_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full border-blue-300 text-blue-700">
                        <Globe className="h-4 w-4 ml-2" />
                        فتح الحجز في {booking.source_platform}
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Passengers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  المسافرون ({booking.passengers_count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {booking.passengers?.map((passenger, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-xl">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-slate-500">الاسم</p>
                          <p className="font-semibold">{passenger.full_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">رقم الجواز</p>
                          <p className="font-semibold font-mono">{passenger.passport_number}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">الجنسية</p>
                          <p className="font-semibold">{passenger.nationality}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">انتهاء الجواز</p>
                          <p className="font-semibold">{passenger.passport_expiry_date}</p>
                        </div>
                      </div>
                      {passenger.passport_image_url && (
                        <div className="mt-4 flex gap-4">
                          <a href={passenger.passport_image_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 ml-1" />
                              صورة الجواز
                            </Button>
                          </a>
                          {passenger.renewal_image_url && (
                            <a href={passenger.renewal_image_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 ml-1" />
                                وثيقة التجديد
                              </Button>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ticket Info (if issued) */}
            {booking.status === 'issued' && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="h-5 w-5" />
                    معلومات التذكرة الصادرة
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-green-700">رقم الحجز الخارجي</p>
                    <p className="font-semibold font-mono">{booking.external_booking_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">رقم التذكرة</p>
                    <p className="font-semibold font-mono">{booking.ticket_number}</p>
                  </div>
                  {booking.ticket_pdf_url && (
                    <div className="col-span-2">
                      <a href={booking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100">
                          <Download className="h-4 w-4 ml-2" />
                          تحميل التذكرة
                        </Button>
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>معلومات العميل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">الاسم</p>
                  <p className="font-semibold">{booking.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">البريد الإلكتروني</p>
                  <p className="font-semibold text-sm">{booking.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">الهاتف</p>
                  <p className="font-semibold" dir="ltr">{booking.customer_phone}</p>
                </div>
                <a href={`https://wa.me/${booking.customer_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="h-4 w-4 ml-2" />
                    تواصل عبر الواتساب
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  معلومات الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">سعر التذكرة</span>
                  <span className="font-semibold">{booking.ticket_price?.toLocaleString()} ر.س</span>
                </div>
                {booking.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">الضرائب</span>
                    <span className="font-semibold">{booking.tax_amount?.toLocaleString()} ر.س</span>
                  </div>
                )}
                {booking.include_visa && (
                  <div className="flex justify-between text-green-600">
                    <span>التأشيرة</span>
                    <span className="font-semibold">{booking.visa_price?.toLocaleString()} ر.س</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>المجموع</span>
                  <span className="text-blue-600">{booking.total_amount?.toLocaleString()} ر.س</span>
                </div>
                <div className="pt-2">
                  <Badge className={booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {booking.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {booking.status === 'pending_issue' && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-4 w-4 ml-2" />
                        إصدار التذكرة
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>إصدار التذكرة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>رقم الحجز من شركة الطيران</Label>
                          <Input
                            value={issueData.external_booking_number}
                            onChange={(e) => setIssueData({ ...issueData, external_booking_number: e.target.value })}
                            placeholder="ABC-123-XYZ"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <Label>رقم التذكرة</Label>
                          <Input
                            value={issueData.ticket_number}
                            onChange={(e) => setIssueData({ ...issueData, ticket_number: e.target.value })}
                            placeholder="TKT-987654"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <Label>ملف التذكرة (PDF)</Label>
                          <div className="mt-1">
                            {issueData.ticket_pdf_url ? (
                              <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700">تم رفع الملف</span>
                              </div>
                            ) : (
                              <Label className="cursor-pointer flex items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-slate-50">
                                <Upload className="h-5 w-5 text-slate-400" />
                                <span className="text-sm text-slate-600">
                                  {uploading ? 'جاري الرفع...' : 'رفع ملف التذكرة'}
                                </span>
                                <input type="file" className="hidden" accept=".pdf" onChange={handleTicketUpload} />
                              </Label>
                            )}
                          </div>
                        </div>
                        <Button onClick={handleIssueTicket} className="w-full">
                          تأكيد الإصدار
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="destructive" className="w-full" onClick={handleCancelBooking}>
                    <XCircle className="h-4 w-4 ml-2" />
                    إلغاء الحجز
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}