import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, CheckCircle2, Upload, Eye, User, Plane, FileText, Calendar, 
  DollarSign, Download, Loader2, Image as ImageIcon, Copy, Phone, Search,
  AlertTriangle, Printer
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";

export default function ProviderBookings() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [issueData, setIssueData] = useState({
    external_booking_number: '',
    ticket_number: '',
    ticket_pdf_url: '',
    notes: '',
    confirmed_return_date: '' // تاريخ العودة المؤكد من المزود
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'provider' || !user.related_entity_id) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (providerId) => {
    const [providerData, bookingsData] = await Promise.all([
      base44.entities.Provider.filter({ id: providerId }),
      base44.entities.Booking.filter({ provider_id: providerId }, '-created_date')
    ]);
    
    if (providerData.length > 0) {
      setProvider(providerData[0]);
    }
    
    setBookings(bookingsData);
    setLoading(false);
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setDialogOpen(true);
    
    if (booking.status === 'pending_issue' || booking.status === 'paid') {
      setIssueData({
        external_booking_number: '',
        ticket_number: '',
        ticket_pdf_url: booking.ticket_pdf_url || '',
        notes: '',
        confirmed_return_date: booking.return_date || '' // تاريخ العودة المحدد مسبقاً
      });
    }
  };

  const handleTicketUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIssuing(true);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setIssueData({ ...issueData, ticket_pdf_url: file_url });
      toast.success('تم رفع ملف التذكرة');
    } catch (error) {
      toast.error('فشل رفع الملف');
    }
    
    setIssuing(false);
  };

  const handleIssueTicket = async () => {
    if (!issueData.ticket_number) {
      toast.error('يرجى إدخال رقم التذكرة');
      return;
    }
    
    // التحقق من تاريخ العودة للرحلات ذهاب وعودة
    if (selectedBooking.trip_type === 'round_trip' && !issueData.confirmed_return_date) {
      toast.error('يرجى إدخال تاريخ العودة المؤكد');
      return;
    }
    
    setIssuing(true);
    
    try {
      console.log('إصدار تذكرة:', selectedBooking.booking_number);
      
      // تحديث الحجز مع تاريخ العودة المؤكد
      await base44.entities.Booking.update(selectedBooking.id, {
        status: 'issued',
        external_booking_number: issueData.external_booking_number,
        ticket_number: issueData.ticket_number,
        ticket_pdf_url: issueData.ticket_pdf_url || null,
        return_date: issueData.confirmed_return_date || selectedBooking.return_date,
        issued_at: new Date().toISOString(),
        issued_by: provider.company_name_ar,
        admin_notes: issueData.notes
      });
      
      // إذا كانت الرحلة ذهاب وعودة وتم تأكيد تاريخ العودة، نخصم من مقعد العودة
      if (selectedBooking.trip_type === 'round_trip' && issueData.confirmed_return_date) {
        await createOrUpdateReturnSeat(selectedBooking, issueData.confirmed_return_date);
      }
      
      // تحديث المقعد
      if (selectedBooking.seat_id) {
        const seatData = await base44.entities.AvailableSeat.filter({ id: selectedBooking.seat_id });
        if (seatData.length > 0) {
          await base44.entities.AvailableSeat.update(selectedBooking.seat_id, {
            booked_count: (seatData[0].booked_count || 0) + (selectedBooking.passengers_count || 1)
          });
        }
      }
      
      // إنشاء القيود المالية الكاملة
      await createCompleteFinancialEntries(selectedBooking);
      
      // إرسال إشعار واتساب للعميل مع تاريخ العودة المؤكد
      await sendWhatsAppNotification({
        ...selectedBooking,
        return_date: issueData.confirmed_return_date || selectedBooking.return_date
      });
      
      toast.success('تم إصدار التذكرة بنجاح!');
      setDialogOpen(false);
      loadData(provider.id);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ في الإصدار');
    }
    
    setIssuing(false);
  };
  
  // إنشاء أو تحديث مقعد العودة عند تأكيد تاريخ العودة
  const createOrUpdateReturnSeat = async (booking, confirmedReturnDate) => {
    try {
      // البحث عن مقعد العودة الموجود بنفس المسار والتاريخ المؤكد
      const returnSeats = await base44.entities.AvailableSeat.filter({
        provider_id: booking.provider_id,
        departure_airport_code: booking.arrival_airport_code, // العودة: من الوصول
        arrival_airport_code: booking.departure_airport_code, // العودة: إلى المغادرة
        departure_date: confirmedReturnDate,
        seat_class: booking.seat_class
      });
      
      if (returnSeats.length > 0) {
        // خصم من المقعد الموجود
        const returnSeat = returnSeats[0];
        await base44.entities.AvailableSeat.update(returnSeat.id, {
          booked_count: (returnSeat.booked_count || 0) + (booking.passengers_count || 1)
        });
        console.log('تم خصم من مقعد العودة الموجود:', returnSeat.id);
      } else {
        console.log('لا يوجد مقعد عودة منفصل - تم الخصم من تذكرة الذهاب والعودة');
      }
    } catch (error) {
      console.error('خطأ في تحديث مقعد العودة:', error);
    }
  };
  
  // إنشاء القيود المالية الكاملة عند الإصدار
  const createCompleteFinancialEntries = async (booking) => {
    try {
      const ticketAmount = booking.total_amount || 0;
      const systemCommission = booking.system_commission || provider.commission_value || 0;
      const providerAmount = booking.provider_amount || (ticketAmount - systemCommission);
      
      // جلب الحسابات
      const accounts = await base44.entities.Account.list();
      const providerAccount = accounts.find(a => 
        a.related_entity_type === 'provider' && a.related_entity_id === provider.id
      );
      const commissionAccount = accounts.find(a => 
        a.category === 'commission_revenue' || a.category === 'commission'
      );
      const salesAccount = accounts.find(a => a.category === 'ticket_sales' || a.category === 'sales');
      const walletAccount = accounts.find(a => a.category === 'cash' || a.name?.includes('المحفظة'));
      
      const timestamp = new Date().toISOString();
      const entryNumber = `JE-TKT-${Date.now()}`;
      
      // === القيد 1: من المحفظة إلى مبيعات العملاء ===
      // Wallet → Sales_Customers (قبض من العميل)
      await base44.entities.JournalEntry.create({
        entry_number: entryNumber,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        description: `إصدار تذكرة - حجز رقم ${booking.booking_number} - ${booking.customer_name}`,
        reference_type: 'ticket_issue',
        reference_id: booking.id,
        entries: [
          {
            account_name: walletAccount?.name || 'المحفظة',
            account_id: walletAccount?.id,
            debit: ticketAmount,
            credit: 0,
            description: `قبض من العميل - ${booking.customer_name}`
          },
          {
            account_name: salesAccount?.name || 'مبيعات التذاكر',
            account_id: salesAccount?.id,
            debit: 0,
            credit: ticketAmount,
            description: 'إيرادات التذكرة'
          }
        ],
        total_debit: ticketAmount,
        total_credit: ticketAmount,
        is_balanced: true,
        status: 'posted'
      });
      
      // === القيد 2: من مبيعات العملاء إلى المزود ===
      // Sales_Customers → Supplier (مستحقات المزود)
      const entryNumber2 = `JE-TKT-${Date.now()}-2`;
      await base44.entities.JournalEntry.create({
        entry_number: entryNumber2,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        description: `مستحقات المزود - حجز رقم ${booking.booking_number}`,
        reference_type: 'ticket_issue',
        reference_id: booking.id,
        entries: [
          {
            account_name: salesAccount?.name || 'مبيعات التذاكر',
            account_id: salesAccount?.id,
            debit: providerAmount,
            credit: 0,
            description: 'تحويل لحساب المزود'
          },
          {
            account_name: providerAccount?.name || `حساب المزود - ${provider.company_name_ar}`,
            account_id: providerAccount?.id,
            debit: 0,
            credit: providerAmount,
            description: 'مستحقات المزود'
          }
        ],
        total_debit: providerAmount,
        total_credit: providerAmount,
        is_balanced: true,
        status: 'posted'
      });
      
      // === القيد 3: من مبيعات العملاء إلى عمولة النظام ===
      // Sales_Customers → System_Commission
      if (systemCommission > 0) {
        const entryNumber3 = `JE-TKT-${Date.now()}-3`;
        await base44.entities.JournalEntry.create({
          entry_number: entryNumber3,
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          description: `عمولة النظام - حجز رقم ${booking.booking_number}`,
          reference_type: 'commission',
          reference_id: booking.id,
          entries: [
            {
              account_name: salesAccount?.name || 'مبيعات التذاكر',
              account_id: salesAccount?.id,
              debit: systemCommission,
              credit: 0,
              description: 'تحويل لحساب العمولات'
            },
            {
              account_name: commissionAccount?.name || 'عمولات النظام',
              account_id: commissionAccount?.id,
              debit: 0,
              credit: systemCommission,
              description: 'عمولة النظام'
            }
          ],
          total_debit: systemCommission,
          total_credit: systemCommission,
          is_balanced: true,
          status: 'posted'
        });
      }
      
      // تحديث حساب المزود
      if (providerAccount) {
        const newBalance = (providerAccount.balance || 0) + providerAmount;
        await base44.entities.Account.update(providerAccount.id, {
          balance: newBalance,
          credit_total: (providerAccount.credit_total || 0) + providerAmount
        });
        
        // إنشاء حركة الحساب للمزود
        await base44.entities.AccountTransaction.create({
          transaction_number: `TR-${Date.now()}-PRV`,
          account_id: providerAccount.id,
          account_name: providerAccount.name,
          account_number: providerAccount.account_number,
          transaction_date: timestamp,
          transaction_type: 'credit',
          amount: providerAmount,
          balance_before: providerAccount.balance || 0,
          balance_after: newBalance,
          description: `مستحقات تذكرة - ${booking.booking_number}`,
          reference_type: 'ticket_issue',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          provider_id: provider.id,
          booking_id: booking.id,
          booking_number: booking.booking_number,
          status: 'completed'
        });
      }
      
      // تحديث حساب العمولات
      if (commissionAccount && systemCommission > 0) {
        await base44.entities.Account.update(commissionAccount.id, {
          balance: (commissionAccount.balance || 0) + systemCommission,
          credit_total: (commissionAccount.credit_total || 0) + systemCommission
        });
        
        await base44.entities.AccountTransaction.create({
          transaction_number: `TR-${Date.now()}-COM`,
          account_id: commissionAccount.id,
          account_name: commissionAccount.name,
          account_number: commissionAccount.account_number,
          transaction_date: timestamp,
          transaction_type: 'credit',
          amount: systemCommission,
          balance_before: commissionAccount.balance || 0,
          balance_after: (commissionAccount.balance || 0) + systemCommission,
          description: `عمولة تذكرة - ${booking.booking_number}`,
          reference_type: 'commission',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          provider_id: provider.id,
          booking_id: booking.id,
          status: 'completed'
        });
      }
      
      // تحديث رصيد المزود
      await base44.entities.Provider.update(provider.id, {
        balance: (provider.balance || 0) + providerAmount,
        total_bookings: (provider.total_bookings || 0) + 1,
        total_revenue: (provider.total_revenue || 0) + providerAmount,
        total_commission_paid: (provider.total_commission_paid || 0) + systemCommission
      });
      
      // إنشاء معاملة مالية للمزود
      await base44.entities.ProviderTransaction.create({
        provider_id: provider.id,
        provider_name: provider.company_name_ar,
        transaction_type: 'booking_earning',
        amount: providerAmount,
        balance_before: provider.balance || 0,
        balance_after: (provider.balance || 0) + providerAmount,
        reference_type: 'booking',
        reference_id: booking.id,
        description: `إيرادات حجز رقم ${booking.booking_number} - ${booking.customer_name}`,
        status: 'completed'
      });
      
      console.log('تم إنشاء القيود المالية بنجاح');
    } catch (error) {
      console.error('خطأ في إنشاء القيود المالية:', error);
    }
  };
  
  // إرسال إشعار واتساب للعميل
  const sendWhatsAppNotification = async (booking) => {
    if (!booking.customer_whatsapp) {
      console.log('لا يوجد رقم واتساب للعميل');
      return;
    }
    
    try {
      // البحث عن بوابة العملاء النشطة
      const gateways = await base44.entities.WhatsAppGateway.filter({
        type: 'customers',
        is_active: true,
        status: 'connected'
      });
      
      if (gateways.length === 0) {
        console.log('لا توجد بوابة واتساب نشطة');
        toast.error('تعذر إرسال رسالة واتساب - لا توجد بوابة متصلة');
        return;
      }
      
      const gateway = gateways.find(g => g.is_default) || gateways[0];
      
      // إنشاء رسالة واتساب
      const message = await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        to_number: booking.customer_whatsapp,
        from_number: gateway.phone_number,
        message_type: issueData.ticket_pdf_url ? 'document' : 'text',
        content: `🎉 مرحباً ${booking.customer_name}!\n\n✅ تم إصدار تذكرتك بنجاح!\n\n📋 تفاصيل الحجز:\n━━━━━━━━━━━━━\n🔖 رقم الحجز: ${booking.booking_number}\n🎫 رقم التذكرة: ${issueData.ticket_number}\n✈️ الرحلة: ${booking.flight_number}\n📅 التاريخ: ${booking.departure_date}\n⏰ الوقت: ${booking.departure_time}\n🛫 من: ${booking.departure_city}\n🛬 إلى: ${booking.arrival_city}${booking.return_date ? '\n\n🔄 رحلة العودة:\n📅 التاريخ: ' + booking.return_date + '\n✈️ رقم الرحلة: ' + (booking.return_flight_number || '-') : ''}\n━━━━━━━━━━━━━\n\n🙏 شكراً لاختيارك خدماتنا\n✈️ نتمنى لك رحلة سعيدة!`,
        media_url: issueData.ticket_pdf_url || null,
        media_caption: issueData.ticket_pdf_url ? 'تذكرة الطيران' : null,
        related_entity_type: 'booking',
        related_entity_id: booking.id,
        gateway_id: gateway.id,
        status: 'pending'
      });
      
      console.log('تم إنشاء رسالة واتساب للعميل:', message.id);
      toast.success('سيتم إرسال رسالة واتساب للعميل');
    } catch (error) {
      console.error('خطأ في إرسال رسالة واتساب:', error);
      toast.error('تعذر إرسال رسالة واتساب');
    }
  };



  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-amber-100 text-amber-700', icon: Clock },
    paid: { label: 'مدفوع', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-purple-100 text-purple-700', icon: AlertTriangle },
    issued: { label: 'صادرة', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
  };

  const filteredBookings = bookings.filter(b => 
    b.booking_number?.includes(searchTerm) ||
    b.customer_name?.includes(searchTerm) ||
    b.flight_number?.includes(searchTerm)
  );

  const pendingBookings = filteredBookings.filter(b => b.status === 'pending_issue' || b.status === 'paid');
  const issuedBookings = filteredBookings.filter(b => b.status === 'issued');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ProviderSidebar provider={provider} stats={{ pendingBookings: pendingBookings.length }} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            إدارة الحجوزات والإصدار
          </h1>
          <p className="text-slate-600">عرض الحجوزات وإصدار التذاكر</p>
        </div>

        {/* تنبيه الحجوزات المعلقة */}
        {pendingBookings.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-amber-900">لديك {pendingBookings.length} حجوزات تنتظر الإصدار!</p>
                <p className="text-sm text-amber-700">يرجى إصدار التذاكر في أقرب وقت لإرضاء العملاء</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* البحث والتبويبات */}
        <Card>
          <CardHeader>
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث برقم الحجز أو اسم العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList className="mb-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  بانتظار الإصدار
                  {pendingBookings.length > 0 && (
                    <Badge className="bg-red-500 mr-2">{pendingBookings.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="issued">
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                  التذاكر الصادرة ({issuedBookings.length})
                </TabsTrigger>
                <TabsTrigger value="all">
                  الكل ({filteredBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <BookingsTable bookings={pendingBookings} onView={handleViewDetails} statusConfig={statusConfig} />
              </TabsContent>
              
              <TabsContent value="issued">
                <BookingsTable bookings={issuedBookings} onView={handleViewDetails} statusConfig={statusConfig} />
              </TabsContent>
              
              <TabsContent value="all">
                <BookingsTable bookings={filteredBookings} onView={handleViewDetails} statusConfig={statusConfig} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* نافذة تفاصيل الحجز */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>تفاصيل الحجز</DialogTitle>
            </DialogHeader>
            
            {selectedBooking && (
              <ScrollArea className="max-h-[75vh] pr-4">
                <div className="space-y-6">
                  {/* معلومات الحجز الأساسية */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl">
                    <div>
                      <Label className="text-slate-500 text-xs">رقم الحجز</Label>
                      <div className="flex items-center gap-2">
                        <p className="font-bold font-mono">{selectedBooking.booking_number}</p>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedBooking.booking_number, 'رقم الحجز')}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">الحالة</Label>
                      <Badge className={statusConfig[selectedBooking.status]?.color}>
                        {statusConfig[selectedBooking.status]?.label}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">المبلغ الإجمالي</Label>
                      <p className="font-bold text-green-600">${selectedBooking.total_amount}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">مستحقاتك</Label>
                      <p className="font-bold text-blue-600">${selectedBooking.provider_amount}</p>
                    </div>
                  </div>

                  {/* معلومات العميل */}
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      معلومات العميل
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-500 text-xs">الاسم</Label>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{selectedBooking.customer_name}</p>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedBooking.customer_name, 'الاسم')}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">رقم الواتساب</Label>
                        <div className="flex items-center gap-2">
                          <p dir="ltr">{selectedBooking.customer_whatsapp}</p>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedBooking.customer_whatsapp, 'الواتساب')}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {selectedBooking.agent_name && (
                        <div className="col-span-2">
                          <Label className="text-slate-500 text-xs">الوكيل</Label>
                          <p className="font-semibold">{selectedBooking.agent_name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* معلومات الرحلة */}
                  <div className="p-4 bg-purple-50 rounded-xl space-y-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      معلومات الرحلة
                      <Badge variant="outline" className="mr-auto">
                        {selectedBooking.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                      </Badge>
                    </h3>
                    
                    {/* رحلة الذهاب */}
                    <div className="p-3 bg-white rounded-lg">
                      <p className="font-semibold text-green-700 mb-2 text-sm">رحلة الذهاب</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-slate-500 text-xs">رقم الرحلة</Label>
                          <p className="font-semibold">{selectedBooking.flight_number}</p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">الشركة</Label>
                          <p>{selectedBooking.airline_name}</p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">المسار</Label>
                          <p>{selectedBooking.departure_city} ← {selectedBooking.arrival_city}</p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">التاريخ</Label>
                          <p>{selectedBooking.departure_date}</p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">الوقت</Label>
                          <p>{selectedBooking.departure_time}</p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">الدرجة</Label>
                          <Badge variant="outline">
                            {selectedBooking.seat_class === 'economy' ? 'اقتصادي' : selectedBooking.seat_class === 'business' ? 'بيزنس' : 'أولى'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* رحلة العودة - تظهر حتى لو لم يحدد تاريخ العودة */}
                    {selectedBooking.trip_type === 'round_trip' && (
                      <div className="p-3 bg-amber-50 rounded-lg border-2 border-amber-300">
                        <p className="font-bold text-amber-800 mb-2 text-sm flex items-center gap-2">
                          🔄 رحلة العودة
                          {!selectedBooking.return_date && (
                            <Badge className="bg-amber-200 text-amber-800 text-xs">يحتاج تحديد</Badge>
                          )}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-slate-500 text-xs">رقم الرحلة</Label>
                            <p className="font-semibold">{selectedBooking.return_flight_number || 'سيحدد عند الإصدار'}</p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs">المسار</Label>
                            <p>{selectedBooking.arrival_city} ← {selectedBooking.departure_city}</p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs">تاريخ العودة المطلوب</Label>
                            <p className="font-semibold text-amber-700">
                              {selectedBooking.return_date || 'غير محدد - يحدد عند الإصدار'}
                            </p>
                          </div>
                          {selectedBooking.return_departure_time && (
                            <div>
                              <Label className="text-slate-500 text-xs">وقت الإقلاع</Label>
                              <p>{selectedBooking.return_departure_time}</p>
                            </div>
                          )}
                        </div>
                        {!selectedBooking.return_date && (
                          <p className="text-xs text-amber-600 mt-3 p-2 bg-amber-100 rounded">
                            ⚠️ <strong>ملاحظة:</strong> عند الإصدار، يجب إدخال تاريخ العودة المؤكد من التذكرة
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* بيانات المسافرين */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      بيانات المسافرين ({selectedBooking.passengers_count || selectedBooking.passengers?.length || 1})
                    </h3>
                    <div className="space-y-3">
                      {selectedBooking.passengers?.map((passenger, i) => (
                        <Card key={i} className="bg-slate-50">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row gap-4">
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <Label className="text-slate-500 text-xs">الاسم الكامل</Label>
                                  <div className="flex items-center gap-1">
                                    <p className="font-semibold">{passenger.full_name}</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyToClipboard(passenger.full_name, 'الاسم')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-slate-500 text-xs">رقم الجواز</Label>
                                  <div className="flex items-center gap-1">
                                    <p className="font-mono">{passenger.passport_number}</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyToClipboard(passenger.passport_number, 'رقم الجواز')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-slate-500 text-xs">الجنسية</Label>
                                  <p>{passenger.nationality}</p>
                                </div>
                                <div>
                                  <Label className="text-slate-500 text-xs">تاريخ الميلاد</Label>
                                  <p>{passenger.date_of_birth}</p>
                                </div>
                                <div>
                                  <Label className="text-slate-500 text-xs">تاريخ الإصدار</Label>
                                  <p>{passenger.passport_issue_date}</p>
                                </div>
                                <div>
                                  <Label className="text-slate-500 text-xs">تاريخ الانتهاء</Label>
                                  <p className={new Date(passenger.passport_expiry_date) < new Date() ? 'text-red-600 font-bold' : ''}>
                                    {passenger.passport_expiry_date}
                                  </p>
                                </div>
                              </div>
                              
                              {/* صور الجواز */}
                              <div className="flex gap-2">
                                {passenger.passport_image_url && (
                                  <a href={passenger.passport_image_url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Eye className="h-4 w-4" />
                                      الجواز
                                    </Button>
                                  </a>
                                )}
                                {passenger.renewal_image_url && (
                                  <a href={passenger.renewal_image_url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Eye className="h-4 w-4" />
                                      التجديد
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* إصدار التذكرة */}
                  {(selectedBooking.status === 'pending_issue' || selectedBooking.status === 'paid') && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl space-y-4 border-2 border-purple-200">
                      <h3 className="font-bold text-purple-900 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        إصدار التذكرة
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>رقم الحجز من الشركة (PNR) *</Label>
                          <Input
                            value={issueData.external_booking_number}
                            onChange={(e) => setIssueData({ ...issueData, external_booking_number: e.target.value })}
                            placeholder="PNR / Booking Reference"
                          />
                        </div>
                        <div>
                          <Label>رقم التذكرة *</Label>
                          <Input
                            value={issueData.ticket_number}
                            onChange={(e) => setIssueData({ ...issueData, ticket_number: e.target.value })}
                            placeholder="123-4567890123"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* تاريخ العودة المؤكد - للذهاب والعودة فقط */}
                      {selectedBooking.trip_type === 'round_trip' && (
                        <div className="p-4 bg-amber-100 rounded-xl border-2 border-amber-300">
                          <Label className="text-amber-800 font-bold flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            📅 تاريخ العودة المؤكد *
                          </Label>
                          <p className="text-xs text-amber-700 mb-2">
                            أدخل تاريخ العودة الفعلي من التذكرة الصادرة
                          </p>
                          <Input
                            type="date"
                            value={issueData.confirmed_return_date}
                            onChange={(e) => setIssueData({ ...issueData, confirmed_return_date: e.target.value })}
                            className="border-amber-400 bg-white"
                            min={selectedBooking.departure_date}
                            required
                          />
                          {selectedBooking.return_date && (
                            <p className="text-xs text-amber-600 mt-2">
                              💡 التاريخ المطلوب من العميل: {selectedBooking.return_date}
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label>رفع ملف التذكرة (PDF أو صورة) - اختياري</Label>
                        <label className="cursor-pointer block mt-1">
                          <div className={`border-2 border-dashed rounded-xl p-6 transition-colors text-center ${
                            issueData.ticket_pdf_url ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                          }`}>
                            {issuing ? (
                              <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
                            ) : issueData.ticket_pdf_url ? (
                              <div className="flex items-center justify-center gap-2 text-green-600">
                                <CheckCircle2 className="h-6 w-6" />
                                <span className="font-semibold">تم رفع الملف بنجاح</span>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                                <p className="font-medium text-slate-700">اضغط لرفع ملف التذكرة</p>
                                <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG (اختياري)</p>
                              </>
                            )}
                          </div>
                          <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleTicketUpload} />
                        </label>
                      </div>

                      <div>
                        <Label>ملاحظات (اختياري)</Label>
                        <Textarea
                          value={issueData.notes}
                          onChange={(e) => setIssueData({ ...issueData, notes: e.target.value })}
                          rows={2}
                          placeholder="أي ملاحظات إضافية..."
                        />
                      </div>

                      <Button 
                        onClick={handleIssueTicket}
                        disabled={issuing || !issueData.ticket_number}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 text-lg"
                      >
                        {issuing ? (
                          <>
                            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                            جاري الإصدار...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="ml-2 h-5 w-5" />
                            تأكيد إصدار التذكرة
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* التذكرة الصادرة */}
                  {selectedBooking.status === 'issued' && selectedBooking.ticket_pdf_url && (
                    <div className="p-4 bg-green-50 rounded-xl text-center">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-2" />
                      <p className="font-bold text-green-900 mb-2">التذكرة صادرة</p>
                      <p className="text-sm text-green-700 mb-4">رقم التذكرة: {selectedBooking.ticket_number}</p>
                      <a href={selectedBooking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button className="bg-green-600 hover:bg-green-700">
                          <Download className="ml-2 h-4 w-4" />
                          تحميل التذكرة
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function BookingsTable({ bookings, onView, statusConfig }) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>لا توجد حجوزات</p>
      </div>
    );
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
            <TableHead>المسافرين</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => {
            const StatusIcon = statusConfig[booking.status]?.icon || Clock;
            return (
              <TableRow key={booking.id} className={booking.status === 'pending_issue' ? 'bg-amber-50' : ''}>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {booking.booking_number}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold">{booking.customer_name}</p>
                    <p className="text-xs text-slate-500" dir="ltr">{booking.customer_whatsapp}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold">{booking.flight_number}</p>
                    <p className="text-xs text-slate-500">
                      {booking.departure_city} → {booking.arrival_city}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p>{booking.departure_date}</p>
                    <p className="text-xs text-slate-500">{booking.departure_time}</p>
                  </div>
                </TableCell>
                <TableCell>{booking.passengers_count || 1}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold text-green-600">${booking.total_amount}</p>
                    <p className="text-xs text-blue-600">لك: ${booking.provider_amount}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusConfig[booking.status]?.color}>
                    <StatusIcon className="h-3 w-3 ml-1" />
                    {statusConfig[booking.status]?.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => onView(booking)}>
                    <Eye className="h-4 w-4 ml-1" />
                    عرض
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}