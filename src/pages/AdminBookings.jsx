import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Eye, Download, Clock, CheckCircle2, XCircle, AlertCircle, MessageSquare, Globe, Plane } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";

export default function AdminBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [externalBookings, setExternalBookings] = useState([]);
  const [flights, setFlights] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingType, setBookingType] = useState('all');

  useEffect(() => {
    checkAuth();
    loadData();
    
    // Check URL params for status filter
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status) setStatusFilter(status);
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [bookingsData, externalData] = await Promise.all([
      base44.entities.Booking.list('-created_date', 100),
      base44.entities.ExternalProviderBooking.list('-created_date', 100)
    ]);
    
    setBookings(bookingsData);
    setExternalBookings(externalData);

    // Load flights
    const flightIds = [...new Set(bookingsData.map(b => b.flight_id).filter(Boolean))];
    const flightsMap = {};
    for (const id of flightIds) {
      const flightData = await base44.entities.Flight.filter({ id });
      if (flightData.length > 0) {
        flightsMap[id] = flightData[0];
      }
    }
    setFlights(flightsMap);
    setLoading(false);
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'تم الدفع', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-amber-100 text-amber-700', icon: Clock },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
    refunded: { label: 'مسترد', color: 'bg-gray-100 text-gray-700', icon: AlertCircle }
  };

  const filteredInternalBookings = bookings.filter(b => {
    const matchSearch = 
      b.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_name?.includes(searchTerm) ||
      b.customer_phone?.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });
  
  const filteredExternalBookings = externalBookings.filter(b => {
    const matchSearch = 
      b.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_name?.includes(searchTerm) ||
      b.customer_whatsapp?.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">الحجوزات</h1>
          <p className="text-slate-600">إدارة ومتابعة جميع الحجوزات</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث برقم الحجز أو اسم العميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending_payment">بانتظار الدفع</SelectItem>
                  <SelectItem value="paid">تم الدفع</SelectItem>
                  <SelectItem value="pending_issue">بانتظار الإصدار</SelectItem>
                  <SelectItem value="issued">تم الإصدار</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  الكل ({filteredInternalBookings.length + filteredExternalBookings.length})
                </TabsTrigger>
                <TabsTrigger value="internal">
                  <Plane className="h-4 w-4 ml-2" />
                  حجوزات داخلية ({filteredInternalBookings.length})
                </TabsTrigger>
                <TabsTrigger value="external">
                  <Globe className="h-4 w-4 ml-2" />
                  مزود خارجي ({filteredExternalBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <div className="space-y-4">
                  {filteredInternalBookings.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-slate-700">حجوزات داخلية</h3>
                      <InternalBookingsTable bookings={filteredInternalBookings} flights={flights} statusConfig={statusConfig} />
                    </div>
                  )}
                  {filteredExternalBookings.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-slate-700 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        حجوزات المزود الخارجي
                      </h3>
                      <ExternalBookingsTable bookings={filteredExternalBookings} statusConfig={statusConfig} />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="internal">
                <InternalBookingsTable bookings={filteredInternalBookings} flights={flights} statusConfig={statusConfig} />
              </TabsContent>

              <TabsContent value="external">
                <ExternalBookingsTable bookings={filteredExternalBookings} statusConfig={statusConfig} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// جدول الحجوزات الداخلية
function InternalBookingsTable({ bookings, flights, statusConfig }) {
  if (bookings.length === 0) {
    return <div className="text-center py-8 text-slate-500">لا توجد حجوزات داخلية</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الحجز</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الرحلة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العودة</TableHead>
                    <TableHead>المسافرون</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => {
                    const flight = flights[booking.flight_id];
                    const status = statusConfig[booking.status] || statusConfig.pending_payment;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div>
                            <Badge variant="outline" className="font-mono text-xs">{booking.booking_number}</Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {booking.created_date && format(new Date(booking.created_date), 'dd/MM/yyyy', { locale: ar })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{booking.customer_name}</p>
                            <p className="text-sm text-slate-500" dir="ltr">{booking.customer_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {flight ? (
                            <div>
                              <p className="font-semibold">{flight.flight_number}</p>
                              <p className="text-sm text-slate-500">
                                {flight.departure_city} ← {flight.arrival_city}
                              </p>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {flight?.departure_date && (
                            <div>
                              <p>{format(new Date(flight.departure_date), 'dd MMM', { locale: ar })}</p>
                              <p className="text-sm text-slate-500">{flight.departure_time}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking.trip_type === 'round_trip' && booking.return_date ? (
                            <div>
                              <p className="font-semibold text-blue-600">{format(new Date(booking.return_date), 'dd MMM', { locale: ar })}</p>
                              <p className="text-xs text-slate-500">
                                {booking.return_flight_number || 'رحلة عودة'}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">ذهاب فقط</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{booking.passengers_count} مسافر</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {booking.total_amount?.toLocaleString()} ر.س
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link to={createPageUrl('AdminBookingDetails') + '?id=' + booking.id}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {booking.ticket_pdf_url && (
                              <a href={booking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            <a href={`https://wa.me/${booking.customer_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon">
                                <MessageSquare className="h-4 w-4 text-green-600" />
                              </Button>
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
  );
}

// جدول حجوزات المزود الخارجي
function ExternalBookingsTable({ bookings, statusConfig }) {
  if (bookings.length === 0) {
    return <div className="text-center py-8 text-slate-500">لا توجد حجوزات من المزود الخارجي</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>رقم الحجز</TableHead>
            <TableHead>المنصة</TableHead>
            <TableHead>العميل</TableHead>
            <TableHead>الرحلة</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>المسافرون</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => {
            const status = statusConfig[booking.status] || statusConfig.pending_payment;
            const StatusIcon = status.icon;
            const flightData = booking.flight_data || {};

            return (
              <TableRow key={booking.id} className="bg-blue-50/50">
                <TableCell>
                  <div>
                    <Badge variant="outline" className="font-mono text-xs bg-white">
                      {booking.booking_number}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      خارجي
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-blue-700">{booking.source_platform}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold">{booking.customer_name}</p>
                    <p className="text-sm text-slate-500" dir="ltr">{booking.customer_whatsapp}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold">{flightData.airline_name || '-'}</p>
                    <p className="text-sm text-slate-500">
                      {flightData.departure_city} ← {flightData.arrival_city}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {flightData.departure_date && (
                    <div>
                      <p>{format(new Date(flightData.departure_date), 'dd MMM', { locale: ar })}</p>
                      <p className="text-sm text-slate-500">{flightData.departure_time}</p>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{booking.passenger_count || 1} مسافر</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold text-green-600">${booking.total_price}</p>
                    <p className="text-xs text-slate-500">مصدر: ${booking.source_price}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={status.color}>
                    <StatusIcon className="h-3 w-3 ml-1" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Link to={createPageUrl('AdminBookingDetails') + '?id=' + booking.id + '&type=external'}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {booking.source_url && (
                      <a href={booking.source_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="text-blue-600">
                          <Globe className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}