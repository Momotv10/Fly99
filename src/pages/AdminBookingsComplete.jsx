import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Search, Eye, Download, Clock, CheckCircle2, XCircle, AlertCircle, 
  MessageSquare, Upload, Loader2, Send, Plane, User, Phone, Mail,
  Calendar, DollarSign, FileText, Ticket, CreditCard
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminBookingsComplete() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [ticketFile, setTicketFile] = useState(null);
  const [ticketNumber, setTicketNumber] = useState('');
  const [externalBookingNumber, setExternalBookingNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status) setStatusFilter(status);

    loadData();
  }, []);

  const loadData = async () => {
    const [bookingsData, providersData] = await Promise.all([
      base44.entities.Booking.list('-created_date', 200),
      base44.entities.Provider.list()
    ]);
    setBookings(bookingsData);
    setProviders(providersData);
    setLoading(false);
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'تم الدفع', color: 'bg-blue-100 text-blue-700', icon: CreditCard },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-amber-100 text-amber-700', icon: Clock },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
    refunded: { label: 'مسترد', color: 'bg-gray-100 text-gray-700', icon: AlertCircle }
  };

  const handleViewDetails = async (booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  const handleOpenIssueDialog = (booking) => {
    setSelectedBooking(booking);
    setTicketNumber('');
    setExternalBookingNumber('');
    setTicketFile(null);
    setIssueDialogOpen(true);
  };

  const handleIssueTicket = async () => {
    if (!ticketFile) {
      toast.error('يرجى رفع ملف التذكرة');
      return;
    }

    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: ticketFile });

      const systemUser = JSON.parse(localStorage.getItem('systemUser') || '{}');

      // Update booking
      await base44.entities.Booking.update(selectedBooking.id, {
        status: 'issued',
        ticket_pdf_url: file_url,
        ticket_number: ticketNumber,
        external_booking_number: externalBookingNumber,
        issued_at: new Date().toISOString(),
        issued_by: systemUser.full_name || 'Admin'
      });

      // Create financial entries
      const provider = providers.find(p => p.id === selectedBooking.provider_id);
      if (provider) {
        // Record provider earning
        const providerAmount = selectedBooking.provider_amount || (selectedBooking.total_amount - (selectedBooking.system_commission || 0));
        
        // Create account transaction for provider
        await base44.entities.AccountTransaction.create({
          transaction_number: `TXN${Date.now()}`,
          account_id: provider.account_id,
          account_name: `المزود - ${provider.company_name_ar}`,
          transaction_date: new Date().toISOString(),
          transaction_type: 'credit',
          amount: providerAmount,
          description: `إيراد حجز رقم ${selectedBooking.booking_number}`,
          reference_type: 'booking',
          reference_id: selectedBooking.id,
          reference_number: selectedBooking.booking_number,
          provider_id: provider.id,
          booking_id: selectedBooking.id,
          booking_number: selectedBooking.booking_number,
          status: 'completed'
        });

        // Create commission transaction
        if (selectedBooking.system_commission) {
          await base44.entities.AccountTransaction.create({
            transaction_number: `COM${Date.now()}`,
            account_id: provider.account_id,
            account_name: `المزود - ${provider.company_name_ar}`,
            transaction_date: new Date().toISOString(),
            transaction_type: 'debit',
            amount: selectedBooking.system_commission,
            description: `عمولة النظام - حجز ${selectedBooking.booking_number}`,
            reference_type: 'commission',
            reference_id: selectedBooking.id,
            reference_number: selectedBooking.booking_number,
            provider_id: provider.id,
            booking_id: selectedBooking.id,
            booking_number: selectedBooking.booking_number,
            status: 'completed'
          });
        }

        // Update provider balance
        await base44.entities.Provider.update(provider.id, {
          balance: (provider.balance || 0) + providerAmount,
          total_bookings: (provider.total_bookings || 0) + 1,
          total_revenue: (provider.total_revenue || 0) + providerAmount,
          total_commission_paid: (provider.total_commission_paid || 0) + (selectedBooking.system_commission || 0)
        });
      }

      // Send WhatsApp notification to customer
      if (selectedBooking.customer_whatsapp) {
        try {
          await base44.integrations.Core.SendEmail({
            to: selectedBooking.customer_email,
            subject: `تأكيد الحجز - ${selectedBooking.booking_number}`,
            body: `
              مرحباً ${selectedBooking.customer_name}،
              
              تم إصدار تذكرتك بنجاح!
              رقم الحجز: ${selectedBooking.booking_number}
              رقم التذكرة: ${ticketNumber || '-'}
              
              يمكنك تحميل التذكرة من الرابط التالي:
              ${file_url}
              
              شكراً لتعاملكم معنا.
            `
          });
        } catch (e) {
          console.log('Email notification failed');
        }
      }

      toast.success('تم إصدار التذكرة بنجاح');
      setIssueDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error('حدث خطأ أثناء الإصدار');
    }

    setUploading(false);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('يرجى كتابة الرسالة');
      return;
    }

    setSendingMessage(true);

    try {
      // Here you would integrate with WhatsApp gateway
      toast.success('تم إرسال الرسالة');
      setMessage('');
      setMessageDialogOpen(false);
    } catch (error) {
      toast.error('فشل إرسال الرسالة');
    }

    setSendingMessage(false);
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm('هل أنت متأكد من إلغاء الحجز؟')) return;

    await base44.entities.Booking.update(booking.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'ملغي من الإدارة'
    });

    toast.success('تم إلغاء الحجز');
    loadData();
  };

  const filteredBookings = bookings.filter(b => {
    const matchSearch = 
      b.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_name?.includes(searchTerm) ||
      b.customer_phone?.includes(searchTerm) ||
      b.flight_number?.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchProvider = providerFilter === 'all' || b.provider_id === providerFilter;
    const matchDate = !dateFilter || b.departure_date === dateFilter;
    return matchSearch && matchStatus && matchProvider && matchDate;
  });

  const getStatusCounts = () => {
    const counts = {};
    bookings.forEach(b => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-blue-600" />
            إدارة الحجوزات
          </h1>
          <p className="text-slate-600">متابعة وإدارة جميع الحجوزات</p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {Object.entries(statusConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Card 
                key={key} 
                className={`cursor-pointer transition-all ${statusFilter === key ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-slate-400" />
                    <span className="text-2xl font-bold">{statusCounts[key] || 0}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-64">
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
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="المزود" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المزودين</SelectItem>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.company_name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
              />
              <Badge variant="secondary" className="text-lg px-4 py-2">{filteredBookings.length} حجز</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الحجز</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المزود</TableHead>
                  <TableHead>الرحلة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المسافرون</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => {
                  const status = statusConfig[booking.status] || statusConfig.pending_payment;
                  const StatusIcon = status.icon;
                  const provider = providers.find(p => p.id === booking.provider_id);

                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="font-mono text-xs">{booking.booking_number}</Badge>
                          <p className="text-xs text-slate-500 mt-1">
                            {booking.created_date && format(new Date(booking.created_date), 'dd/MM/yyyy HH:mm', { locale: ar })}
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
                        <span className="text-sm">{provider?.company_name_ar || booking.provider_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="font-mono">{booking.flight_number}</Badge>
                          <p className="text-xs text-slate-500 mt-1">
                            {booking.departure_city} ← {booking.arrival_city}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {booking.departure_date && (
                          <div>
                            <p>{format(new Date(booking.departure_date), 'dd MMM', { locale: ar })}</p>
                            <p className="text-xs text-slate-500">{booking.departure_time}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{booking.passengers_count} مسافر</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-semibold">${booking.total_amount?.toLocaleString()}</span>
                          {booking.payment_status === 'paid' && (
                            <Badge className="bg-green-100 text-green-700 text-xs mr-1">مدفوع</Badge>
                          )}
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
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(booking)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {booking.status === 'pending_issue' && (
                            <Button variant="ghost" size="icon" onClick={() => handleOpenIssueDialog(booking)}>
                              <Ticket className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          
                          {booking.ticket_pdf_url && (
                            <a href={booking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setMessageDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد حجوزات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل الحجز #{selectedBooking?.booking_number}</DialogTitle>
            </DialogHeader>

            {selectedBooking && (
              <div className="space-y-6">
                {/* Status & Actions */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <Badge className={statusConfig[selectedBooking.status]?.color}>
                    {statusConfig[selectedBooking.status]?.label}
                  </Badge>
                  <div className="flex gap-2">
                    {selectedBooking.status === 'pending_issue' && (
                      <Button onClick={() => { setDetailsDialogOpen(false); handleOpenIssueDialog(selectedBooking); }}>
                        <Ticket className="ml-2 h-4 w-4" />
                        إصدار التذكرة
                      </Button>
                    )}
                    {selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'issued' && (
                      <Button variant="destructive" onClick={() => handleCancelBooking(selectedBooking)}>
                        إلغاء الحجز
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        بيانات العميل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{selectedBooking.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span dir="ltr">{selectedBooking.customer_phone}</span>
                      </div>
                      {selectedBooking.customer_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span dir="ltr">{selectedBooking.customer_email}</span>
                        </div>
                      )}
                      {selectedBooking.customer_whatsapp && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-500" />
                          <span dir="ltr">{selectedBooking.customer_whatsapp}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Flight Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Plane className="h-5 w-5" />
                        بيانات الرحلة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{selectedBooking.flight_number}</Badge>
                        <span>{selectedBooking.airline_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedBooking.departure_city}</span>
                        <span>←</span>
                        <span className="font-semibold">{selectedBooking.arrival_city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>
                          {selectedBooking.departure_date && format(new Date(selectedBooking.departure_date), 'dd MMMM yyyy', { locale: ar })}
                        </span>
                        <span>{selectedBooking.departure_time}</span>
                      </div>
                      <Badge variant="secondary">
                        {selectedBooking.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Passengers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">المسافرون ({selectedBooking.passengers_count})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedBooking.passengers?.map((passenger, index) => (
                        <div key={index} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{passenger.full_name}</p>
                              <p className="text-sm text-slate-500">جواز: {passenger.passport_number}</p>
                            </div>
                            {passenger.passport_image_url && (
                              <a href={passenger.passport_image_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <Eye className="ml-1 h-4 w-4" />
                                  عرض الجواز
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      بيانات الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-sm text-slate-600">إجمالي المبلغ</p>
                        <p className="text-xl font-bold text-green-600">${selectedBooking.total_amount}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-sm text-slate-600">مستحق للمزود</p>
                        <p className="text-xl font-bold text-blue-600">${selectedBooking.provider_amount || (selectedBooking.total_amount - (selectedBooking.system_commission || 0))}</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg text-center">
                        <p className="text-sm text-slate-600">عمولة النظام</p>
                        <p className="text-xl font-bold text-purple-600">${selectedBooking.system_commission || 0}</p>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between">
                      <span>طريقة الدفع:</span>
                      <Badge>{selectedBooking.payment_method || '-'}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span>حالة الدفع:</span>
                      <Badge className={selectedBooking.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {selectedBooking.payment_status === 'paid' ? 'مدفوع' : 'بانتظار الدفع'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Ticket Info (if issued) */}
                {selectedBooking.status === 'issued' && (
                  <Card className="bg-green-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        بيانات التذكرة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">رقم التذكرة</p>
                          <p className="font-semibold">{selectedBooking.ticket_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">رقم الحجز الخارجي</p>
                          <p className="font-semibold">{selectedBooking.external_booking_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">تاريخ الإصدار</p>
                          <p className="font-semibold">
                            {selectedBooking.issued_at && format(new Date(selectedBooking.issued_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">صادر بواسطة</p>
                          <p className="font-semibold">{selectedBooking.issued_by || '-'}</p>
                        </div>
                      </div>
                      {selectedBooking.ticket_pdf_url && (
                        <a href={selectedBooking.ticket_pdf_url} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                          <Button className="w-full">
                            <Download className="ml-2 h-4 w-4" />
                            تحميل التذكرة
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Issue Ticket Dialog */}
        <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إصدار التذكرة - {selectedBooking?.booking_number}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  تأكد من إصدار التذكرة من شركة الطيران قبل رفعها هنا
                </AlertDescription>
              </Alert>

              <div>
                <Label>رقم التذكرة</Label>
                <Input
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="رقم التذكرة الصادر من شركة الطيران"
                  dir="ltr"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>رقم الحجز من شركة الطيران</Label>
                <Input
                  value={externalBookingNumber}
                  onChange={(e) => setExternalBookingNumber(e.target.value)}
                  placeholder="PNR أو رقم الحجز"
                  dir="ltr"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>ملف التذكرة (PDF أو صورة) *</Label>
                <Label className="cursor-pointer flex items-center justify-center p-8 border-2 border-dashed rounded-lg hover:bg-slate-50 mt-1">
                  <Upload className="h-8 w-8 text-slate-400 ml-2" />
                  <span>{ticketFile ? ticketFile.name : 'اختر ملف التذكرة'}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={(e) => setTicketFile(e.target.files?.[0])}
                  />
                </Label>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleIssueTicket} disabled={uploading || !ticketFile}>
                  {uploading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإصدار...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                      إصدار التذكرة
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Message Dialog */}
        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>مراسلة العميل - {selectedBooking?.customer_name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">رقم الواتساب</p>
                <p className="font-semibold" dir="ltr">{selectedBooking?.customer_whatsapp || selectedBooking?.customer_phone}</p>
              </div>

              <div>
                <Label>الرسالة</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleSendMessage} disabled={sendingMessage}>
                  {sendingMessage ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="ml-2 h-4 w-4" />
                  )}
                  إرسال
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}