import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { 
  Search, Ticket, Plane, Calendar, User, Download, Eye,
  RefreshCw, Filter, Printer, FileText, CheckCircle, Clock,
  AlertCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AgentBookings() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      const [agentData, bookingsData] = await Promise.all([
        base44.entities.Agent.filter({ id: agentId }),
        base44.entities.Booking.filter({ agent_id: agentId }, '-created_date', 100)
      ]);
      
      if (agentData.length > 0) setAgent(agentData[0]);
      setBookings(bookingsData);
      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_payment: { label: 'بانتظار الدفع', class: 'bg-yellow-100 text-yellow-700', icon: Clock },
      paid: { label: 'مدفوع', class: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      pending_issue: { label: 'بانتظار الإصدار', class: 'bg-orange-100 text-orange-700', icon: Clock },
      issued: { label: 'صادرة', class: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'ملغية', class: 'bg-red-100 text-red-700', icon: XCircle },
      refunded: { label: 'مسترجعة', class: 'bg-slate-100 text-slate-700', icon: RefreshCw }
    };
    const config = statusConfig[status] || { label: status, class: 'bg-slate-100', icon: AlertCircle };
    const Icon = config.icon;
    return (
      <Badge className={`${config.class} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.flight_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handlePrintTicket = (booking) => {
    if (booking.ticket_pdf_url) {
      window.open(booking.ticket_pdf_url, '_blank');
    } else {
      toast.error('التذكرة غير متاحة للطباعة بعد');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">حجوزاتي</h1>
            <p className="text-slate-600">إدارة ومتابعة جميع الحجوزات</p>
          </div>
          <Button 
            style={{ backgroundColor: agent?.brand_color }}
            onClick={() => navigate(createPageUrl('AgentSearch'))}
          >
            <Ticket className="h-4 w-4 ml-2" />
            حجز جديد
          </Button>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">الكل</p>
                  <p className="text-2xl font-bold">{bookings.length}</p>
                </div>
                <Ticket className="h-8 w-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">معلقة</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {bookings.filter(b => ['pending_payment', 'paid', 'pending_issue'].includes(b.status)).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">صادرة</p>
                  <p className="text-2xl font-bold text-green-600">
                    {bookings.filter(b => b.status === 'issued').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">ملغية</p>
                  <p className="text-2xl font-bold text-red-600">
                    {bookings.filter(b => b.status === 'cancelled').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* الفلاتر */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو رقم الحجز أو رقم الرحلة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="حالة الحجز" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending_payment">بانتظار الدفع</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="pending_issue">بانتظار الإصدار</SelectItem>
                  <SelectItem value="issued">صادرة</SelectItem>
                  <SelectItem value="cancelled">ملغية</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => loadData(agent?.id)}>
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* جدول الحجوزات */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>رقم الحجز</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الرحلة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>العمولة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="hover:bg-slate-50">
                      <TableCell>
                        <p className="font-mono font-semibold">{booking.booking_number || '-'}</p>
                        <p className="text-xs text-slate-500">
                          {booking.created_date && format(new Date(booking.created_date), 'd MMM', { locale: ar })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-xs text-slate-500">{booking.passengers_count} مسافر</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {booking.airline_logo && (
                            <img src={booking.airline_logo} alt="" className="h-6 w-6 rounded" />
                          )}
                          <div>
                            <p className="font-medium">{booking.flight_number}</p>
                            <p className="text-xs text-slate-500">
                              {booking.departure_city} ← {booking.arrival_city}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {booking.departure_date && format(new Date(booking.departure_date), 'd MMM yyyy', { locale: ar })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">${booking.total_amount}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-green-600 font-semibold">${booking.agent_commission || 0}</p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(booking.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { setSelectedBooking(booking); setDetailsOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {booking.status === 'issued' && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handlePrintTicket(booking)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12">
                <Ticket className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">لا توجد حجوزات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة تفاصيل الحجز */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تفاصيل الحجز</DialogTitle>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-6">
                {/* معلومات الرحلة */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4 mb-4">
                    {selectedBooking.airline_logo && (
                      <img src={selectedBooking.airline_logo} alt="" className="h-12 w-12 rounded-lg" />
                    )}
                    <div>
                      <p className="font-bold text-lg">{selectedBooking.airline_name}</p>
                      <p className="text-slate-500">{selectedBooking.flight_number}</p>
                    </div>
                    <div className="mr-auto">
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{selectedBooking.departure_city}</p>
                      <p className="text-sm text-slate-500">{selectedBooking.departure_time}</p>
                    </div>
                    <Plane className="h-6 w-6 text-blue-600" />
                    <div className="text-center">
                      <p className="text-2xl font-bold">{selectedBooking.arrival_city}</p>
                      <p className="text-sm text-slate-500">{selectedBooking.arrival_time}</p>
                    </div>
                  </div>
                </div>

                {/* معلومات العميل */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">العميل</p>
                    <p className="font-semibold">{selectedBooking.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">عدد المسافرين</p>
                    <p className="font-semibold">{selectedBooking.passengers_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">تاريخ السفر</p>
                    <p className="font-semibold">
                      {selectedBooking.departure_date && format(new Date(selectedBooking.departure_date), 'd MMMM yyyy', { locale: ar })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">رقم الحجز</p>
                    <p className="font-mono font-semibold">{selectedBooking.booking_number}</p>
                  </div>
                </div>

                {/* المبالغ */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span>المبلغ الإجمالي</span>
                    <span className="font-bold">${selectedBooking.total_amount}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>عمولتك</span>
                    <span className="font-bold">${selectedBooking.agent_commission || 0}</span>
                  </div>
                </div>

                {/* الإجراءات */}
                <div className="flex gap-3">
                  {selectedBooking.status === 'issued' && selectedBooking.ticket_pdf_url && (
                    <Button className="flex-1" onClick={() => handlePrintTicket(selectedBooking)}>
                      <Printer className="h-4 w-4 ml-2" />
                      طباعة التذكرة
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                    إغلاق
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}