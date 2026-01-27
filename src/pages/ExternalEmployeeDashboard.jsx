import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Plane, Clock, CheckCircle, AlertTriangle, Eye, Upload, Send,
  MessageSquare, User, Phone, Globe, ExternalLink, LogOut, Settings,
  FileText, Image, Loader2, DollarSign, Users
} from 'lucide-react';

export default function ExternalEmployeeDashboard() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending_issue');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const [ticketForm, setTicketForm] = useState({
    externalBookingNumber: '',
    ticketNumber: '',
    ticketPdfUrl: '',
    confirmedReturnDate: ''
  });

  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (employee) {
      loadBookings();
    }
  }, [employee, filterStatus]);

  const checkAuth = async () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=external_employee');
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'external_employee' && user.role !== 'ticket_specialist' && user.role !== 'supervisor') {
      navigate(createPageUrl('SystemLogin') + '?type=external_employee');
      return;
    }
    
    setEmployee(user);
    setLoading(false);

    // تحديث حالة الاتصال
    if (user.related_entity_id) {
      await base44.entities.ExternalProviderEmployee.update(user.related_entity_id, {
        is_online: true,
        last_activity: new Date().toISOString()
      });
    }
  };

  const loadBookings = async () => {
    let query = {};
    if (filterStatus !== 'all') {
      query.status = filterStatus;
    }
    const data = await base44.entities.ExternalProviderBooking.filter(query, '-created_date', 100);
    setBookings(data);
  };

  const handleLogout = async () => {
    // تحديث حالة عدم الاتصال
    if (employee?.related_entity_id) {
      await base44.entities.ExternalProviderEmployee.update(employee.related_entity_id, {
        is_online: false,
        last_activity: new Date().toISOString()
      });
    }
    localStorage.removeItem('systemUser');
    navigate(createPageUrl('Home'));
  };

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
    setTicketForm({
      externalBookingNumber: booking.external_booking_number || '',
      ticketNumber: booking.ticket_number || '',
      ticketPdfUrl: booking.ticket_pdf_url || '',
      confirmedReturnDate: booking.flight_data?.return_date || ''
    });
    setDialogOpen(true);
  };

  const handleIssueTicket = async () => {
    if (!ticketForm.ticketNumber) {
      toast.error('يرجى إدخال رقم التذكرة');
      return;
    }

    if (!ticketForm.externalBookingNumber) {
      toast.error('يرجى إدخال رقم الحجز (PNR)');
      return;
    }

    // التحقق من تاريخ العودة للرحلات ذهاب وعودة
    if (selectedBooking.flight_data?.trip_type === 'round_trip' && !ticketForm.confirmedReturnDate) {
      toast.error('يرجى إدخال تاريخ العودة المؤكد');
      return;
    }

    // تحديث بيانات الرحلة مع تاريخ العودة المؤكد
    const updatedFlightData = {
      ...selectedBooking.flight_data,
      return_date: ticketForm.confirmedReturnDate || selectedBooking.flight_data?.return_date
    };

    await base44.entities.ExternalProviderBooking.update(selectedBooking.id, {
      status: 'issued',
      external_booking_number: ticketForm.externalBookingNumber,
      ticket_number: ticketForm.ticketNumber,
      ticket_pdf_url: ticketForm.ticketPdfUrl,
      flight_data: updatedFlightData,
      issued_at: new Date().toISOString(),
      issued_by: employee?.full_name || employee?.username,
      issued_by_employee_id: employee?.related_entity_id
    });

    // تحديث إحصائيات الموظف
    if (employee?.related_entity_id) {
      const empData = await base44.entities.ExternalProviderEmployee.filter({ id: employee.related_entity_id });
      if (empData.length > 0) {
        await base44.entities.ExternalProviderEmployee.update(employee.related_entity_id, {
          total_issued: (empData[0].total_issued || 0) + 1
        });
      }
    }
    
    // إنشاء القيود المالية للمزود الخارجي
    await createExternalProviderFinancialEntries(selectedBooking);

    // إرسال إشعار واتساب للعميل
    await sendExternalTicketNotification(selectedBooking);

    toast.success('تم إصدار التذكرة وإرسالها للعميل');
    setDialogOpen(false);
    loadBookings();
  };
  
  // إنشاء القيود المالية للمزود الخارجي عند الإصدار
  const createExternalProviderFinancialEntries = async (booking) => {
    try {
      const sourcePrice = booking.source_price || 0;
      const systemCommission = booking.system_commission || 0;
      const totalPrice = booking.total_price || 0;
      
      const accounts = await base44.entities.Account.list();
      const commissionAccount = accounts.find(a => 
        a.category === 'commission_revenue' || a.category === 'commission'
      );
      const externalProviderAccount = accounts.find(a => 
        a.category === 'provider' && a.name?.includes('خارجي')
      ) || accounts.find(a => a.category === 'payable');
      const salesAccount = accounts.find(a => a.category === 'ticket_sales' || a.category === 'sales');
      const walletAccount = accounts.find(a => a.category === 'cash' || a.name?.includes('المحفظة'));
      
      const timestamp = new Date().toISOString();
      
      // القيد 1: استلام من العميل
      await base44.entities.JournalEntry.create({
        entry_number: `JE-EXT-${Date.now()}`,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        description: `إصدار تذكرة مزود خارجي - حجز رقم ${booking.booking_number}`,
        reference_type: 'ticket_issue',
        reference_id: booking.id,
        entries: [
          {
            account_name: walletAccount?.name || 'المحفظة',
            debit: totalPrice,
            credit: 0,
            description: 'قبض من العميل'
          },
          {
            account_name: salesAccount?.name || 'المبيعات',
            debit: 0,
            credit: totalPrice,
            description: 'إيرادات التذكرة'
          }
        ],
        total_debit: totalPrice,
        total_credit: totalPrice,
        is_balanced: true,
        status: 'posted'
      });
      
      // القيد 2: تكلفة المزود الخارجي
      if (sourcePrice > 0) {
        await base44.entities.JournalEntry.create({
          entry_number: `JE-EXT-${Date.now()}-2`,
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          description: `تكلفة مزود خارجي - ${booking.source_platform} - حجز ${booking.booking_number}`,
          reference_type: 'ticket_issue',
          reference_id: booking.id,
          entries: [
            {
              account_name: salesAccount?.name || 'المبيعات',
              debit: sourcePrice,
              credit: 0,
              description: 'تكلفة المزود الخارجي'
            },
            {
              account_name: externalProviderAccount?.name || 'مستحقات المزودين الخارجيين',
              debit: 0,
              credit: sourcePrice,
              description: `مستحقات ${booking.source_platform}`
            }
          ],
          total_debit: sourcePrice,
          total_credit: sourcePrice,
          is_balanced: true,
          status: 'posted'
        });
      }
      
      // القيد 3: عمولة النظام
      if (systemCommission > 0 && commissionAccount) {
        await base44.entities.JournalEntry.create({
          entry_number: `JE-EXT-${Date.now()}-3`,
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          description: `عمولة النظام - حجز خارجي ${booking.booking_number}`,
          reference_type: 'commission',
          reference_id: booking.id,
          entries: [
            {
              account_name: salesAccount?.name || 'المبيعات',
              debit: systemCommission,
              credit: 0,
              description: 'تحويل العمولة'
            },
            {
              account_name: commissionAccount.name,
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
        
        // تحديث حساب العمولات
        await base44.entities.Account.update(commissionAccount.id, {
          balance: (commissionAccount.balance || 0) + systemCommission,
          credit_total: (commissionAccount.credit_total || 0) + systemCommission
        });
        
        await base44.entities.AccountTransaction.create({
          transaction_number: `TR-${Date.now()}-EXT`,
          account_id: commissionAccount.id,
          account_name: commissionAccount.name,
          transaction_date: timestamp,
          transaction_type: 'credit',
          amount: systemCommission,
          balance_before: commissionAccount.balance || 0,
          balance_after: (commissionAccount.balance || 0) + systemCommission,
          description: `عمولة تذكرة خارجية - ${booking.booking_number}`,
          reference_type: 'commission',
          reference_id: booking.id,
          status: 'completed'
        });
      }
      
      // ربط القيد المالي بالحجز
      await base44.entities.ExternalProviderBooking.update(booking.id, {
        financial_entry_id: `JE-EXT-${Date.now()}`
      });
      
      console.log('تم إنشاء القيود المالية للمزود الخارجي');
    } catch (error) {
      console.error('خطأ في إنشاء القيود المالية:', error);
    }
  };

  // إرسال إشعار واتساب للعميل بعد إصدار تذكرة المزود الخارجي
  const sendExternalTicketNotification = async (booking) => {
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
      const flightInfo = booking.flight_data || {};
      
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        to_number: booking.customer_whatsapp,
        from_number: gateway.phone_number,
        message_type: ticketForm.ticketPdfUrl ? 'document' : 'text',
        content: `🎉 مرحباً ${booking.customer_name}!\n\n✅ تم إصدار تذكرتك بنجاح!\n\n📋 تفاصيل الرحلة:\n━━━━━━━━━━━━━\n🔖 رقم الحجز: ${booking.booking_number}\n🎫 رقم التذكرة: ${ticketForm.ticketNumber}\n✈️ شركة الطيران: ${flightInfo.airline_name || 'غير محدد'}\n🛫 الرحلة: ${flightInfo.flight_number || 'غير محدد'}\n📅 التاريخ: ${flightInfo.departure_date || 'غير محدد'}\n⏰ الوقت: ${flightInfo.departure_time || 'غير محدد'}\n🏙️ من: ${flightInfo.departure_city || ''} → ${flightInfo.arrival_city || ''}${flightInfo.return_date ? '\n\n🔄 رحلة العودة:\n📅 التاريخ: ' + flightInfo.return_date : ''}\n━━━━━━━━━━━━━\n\n🙏 شكراً لاختيارك خدماتنا\n✈️ نتمنى لك رحلة سعيدة!`,
        media_url: ticketForm.ticketPdfUrl || null,
        media_caption: ticketForm.ticketPdfUrl ? 'تذكرة الطيران' : null,
        related_entity_type: 'booking',
        related_entity_id: booking.id,
        gateway_id: gateway.id,
        status: 'pending'
      });
      console.log('تم إنشاء رسالة واتساب للعميل');
      toast.success('سيتم إرسال رسالة واتساب للعميل');
    } catch (error) {
      console.error('خطأ في إرسال إشعار واتساب:', error);
      toast.error('تعذر إرسال رسالة واتساب');
    }
  };

  const handleUploadTicket = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setTicketForm({ ...ticketForm, ticketPdfUrl: file_url });
      toast.success('تم رفع التذكرة');
    }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim() || !selectedBooking) return;

    const messages = selectedBooking.chat_messages || [];
    messages.push({
      sender: 'employee',
      message: chatMessage,
      timestamp: new Date().toISOString(),
      type: 'text'
    });

    await base44.entities.ExternalProviderBooking.update(selectedBooking.id, {
      chat_messages: messages
    });

    setSelectedBooking({ ...selectedBooking, chat_messages: messages });
    setChatMessage('');
  };

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    if (employee?.related_entity_id) {
      await base44.entities.ExternalProviderEmployee.update(employee.related_entity_id, {
        password_hash: passwordForm.new
      });
      toast.success('تم تغيير كلمة المرور');
      setChangePasswordOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    }
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'مدفوع', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    processing: { label: 'جاري المعالجة', color: 'bg-purple-100 text-purple-700', icon: Loader2 },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
  };

  const pendingCount = bookings.filter(b => b.status === 'pending_issue').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
                <Plane className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">لوحة إصدار التذاكر</h1>
                <p className="text-sm text-slate-500">المزود الخارجي الذكي</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left">
                <p className="font-semibold">{employee?.full_name}</p>
                <p className="text-xs text-slate-500">{employee?.role === 'supervisor' ? 'مشرف' : 'مختص إصدار'}</p>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => setChangePasswordOpen(true)}>
                <Settings className="h-5 w-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5 text-red-500" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold text-orange-700">{pendingCount}</p>
                  <p className="text-sm text-orange-600">بانتظار الإصدار</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{bookings.filter(b => b.status === 'issued').length}</p>
                  <p className="text-sm text-slate-500">تم الإصدار</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{bookings.length}</p>
                  <p className="text-sm text-slate-500">إجمالي الحجوزات</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">
                    ${bookings.filter(b => b.status === 'issued').reduce((sum, b) => sum + (b.total_price || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">إجمالي المبيعات</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                طلبات إصدار التذاكر
              </CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending_issue">بانتظار الإصدار</SelectItem>
                  <SelectItem value="issued">تم الإصدار</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الحجز</TableHead>
                  <TableHead>المنصة</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>الرحلة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const status = statusConfig[booking.status] || statusConfig.pending_issue;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={booking.id} className={booking.status === 'pending_issue' ? 'bg-orange-50' : ''}>
                      <TableCell>
                        <span className="font-mono font-bold">{booking.booking_number}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-blue-500" />
                          <span>{booking.source_platform}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.customer_name}</p>
                          <p className="text-xs text-slate-500">{booking.customer_whatsapp}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{booking.flight_data?.departure_city} ← {booking.flight_data?.arrival_city}</p>
                          <p className="text-slate-500">{booking.flight_data?.departure_date}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-green-600">${booking.total_price}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant={booking.status === 'pending_issue' ? 'default' : 'ghost'} 
                          size="sm" 
                          onClick={() => handleViewBooking(booking)}
                          className={booking.status === 'pending_issue' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                        >
                          {booking.status === 'pending_issue' ? 'معالجة' : <Eye className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {bookings.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Plane className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد حجوزات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الحجز - {selectedBooking?.booking_number}</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Source Link - Most Important - معلومات المزود الخارجي */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Globe className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-blue-900">معلومات المزود الخارجي</h3>
                      <p className="text-sm text-blue-600">منصة الحجز: {selectedBooking.source_platform}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-slate-500 text-xs">اسم المنصة</Label>
                        <p className="font-semibold">{selectedBooking.source_platform}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">سعر الموقع الأصلي</Label>
                        <p className="font-semibold text-green-600">${selectedBooking.source_price}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">عمولة النظام</Label>
                        <p className="font-semibold">${selectedBooking.system_commission}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">السعر للعميل</Label>
                        <p className="font-bold text-blue-600">${selectedBooking.total_price}</p>
                      </div>
                    </div>
                    
                    {selectedBooking.source_url && (
                      <div className="pt-3 border-t">
                        <Label className="text-slate-500 text-xs block mb-2">رابط الحجز الأصلي</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            value={selectedBooking.source_url} 
                            readOnly 
                            className="flex-1 text-xs font-mono bg-slate-50"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedBooking.source_url);
                              toast.success('تم نسخ الرابط');
                            }}
                          >
                            نسخ
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* روابط البحث المتعددة */}
                  <div className="space-y-3">
                    {selectedBooking.source_url ? (
                      <a 
                        href={selectedBooking.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 w-full"
                      >
                        <ExternalLink className="h-5 w-5" />
                        🎯 فتح رابط الحجز المباشر
                      </a>
                    ) : (
                      <div className="bg-amber-100 text-amber-700 px-6 py-4 rounded-xl text-center">
                        <p className="font-semibold">⚠️ رابط المصدر غير متوفر</p>
                      </div>
                    )}
                    
                    {/* روابط بحث بديلة */}
                    {selectedBooking.flight_data && (
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <a 
                          href={`https://www.kayak.com/flights/${selectedBooking.flight_data?.departure_airport_code},nearby-${selectedBooking.flight_data?.arrival_airport_code},nearby/${selectedBooking.flight_data?.departure_date}${selectedBooking.flight_data?.return_date ? '/' + selectedBooking.flight_data.return_date : ''}?sort=bestflight_a`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 hover:bg-orange-200"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Kayak
                        </a>
                        <a 
                          href={`https://www.google.com/travel/flights?q=flights%20from%20${selectedBooking.flight_data?.departure_airport_code}%20to%20${selectedBooking.flight_data?.arrival_airport_code}%20on%20${selectedBooking.flight_data?.departure_date}${selectedBooking.flight_data?.return_date ? '%20return%20' + selectedBooking.flight_data.return_date : ''}&curr=USD`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 hover:bg-blue-200"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Google Flights
                        </a>
                        <a 
                          href={`https://www.skyscanner.com/transport/flights/${selectedBooking.flight_data?.departure_airport_code}/${selectedBooking.flight_data?.arrival_airport_code}/${selectedBooking.flight_data?.departure_date?.replace(/-/g, '')}${selectedBooking.flight_data?.return_date ? '/' + selectedBooking.flight_data.return_date?.replace(/-/g, '') : ''}/`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-cyan-100 text-cyan-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 hover:bg-cyan-200"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Skyscanner
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Flight Info - Full Details with Return */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                    <Plane className="h-5 w-5" />
                    بيانات الرحلة الكاملة
                    <Badge className={selectedBooking.flight_data?.trip_type === 'round_trip' ? 'bg-blue-600' : 'bg-green-600'}>
                      {selectedBooking.flight_data?.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Outbound Flight */}
                  <div className="mb-6">
                    <h4 className="font-bold text-green-700 mb-3 flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      ✈️ رحلة الذهاب
                    </h4>
                    <div className="grid grid-cols-4 gap-4 p-4 bg-green-50 rounded-xl">
                      <div>
                        <Label className="text-slate-500 text-xs">شركة الطيران</Label>
                        <div className="flex items-center gap-2 mt-1">
                          {selectedBooking.flight_data?.airline_logo && (
                            <img src={selectedBooking.flight_data.airline_logo} alt="" className="h-6 w-6" />
                          )}
                          <p className="font-semibold">{selectedBooking.flight_data?.airline_name}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">رقم الرحلة</Label>
                        <p className="font-mono font-bold text-lg mt-1">{selectedBooking.flight_data?.flight_number}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">تاريخ الذهاب</Label>
                        <p className="font-semibold mt-1">{selectedBooking.flight_data?.departure_date}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">وقت الإقلاع</Label>
                        <p className="font-bold text-lg mt-1">{selectedBooking.flight_data?.departure_time || '--:--'}</p>
                      </div>
                      <div className="col-span-4">
                        <Label className="text-slate-500 text-xs">المسار</Label>
                        <p className="font-semibold mt-1 text-lg">
                          {selectedBooking.flight_data?.departure_city} ({selectedBooking.flight_data?.departure_airport_code}) 
                          <span className="mx-2">→</span>
                          {selectedBooking.flight_data?.arrival_city} ({selectedBooking.flight_data?.arrival_airport_code})
                        </p>
                      </div>
                      {selectedBooking.flight_data?.duration && (
                        <div>
                          <Label className="text-slate-500 text-xs">مدة الرحلة</Label>
                          <p className="font-semibold mt-1">{selectedBooking.flight_data?.duration}</p>
                        </div>
                      )}
                      {selectedBooking.flight_data?.stops !== undefined && (
                        <div>
                          <Label className="text-slate-500 text-xs">التوقفات</Label>
                          <p className="font-semibold mt-1">{selectedBooking.flight_data?.stops === 0 ? 'مباشرة' : `${selectedBooking.flight_data?.stops} توقف`}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Return Flight - إذا كانت ذهاب وعودة */}
                  {selectedBooking.flight_data?.trip_type === 'round_trip' && (
                    <div className="mb-6">
                      <h4 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                        <Plane className="h-4 w-4 rotate-180" />
                        🔄 رحلة العودة
                      </h4>
                      <div className="grid grid-cols-4 gap-4 p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
                        <div>
                          <Label className="text-slate-500 text-xs">رقم رحلة العودة</Label>
                          <p className="font-mono font-bold text-lg mt-1 text-amber-700">
                            {selectedBooking.flight_data?.return_flight_number || 'غير محدد'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">تاريخ العودة</Label>
                          <p className="font-bold text-lg mt-1 text-amber-700">
                            {selectedBooking.flight_data?.return_date || 'غير محدد'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">وقت إقلاع العودة</Label>
                          <p className="font-bold text-lg mt-1 text-amber-700">
                            {selectedBooking.flight_data?.return_departure_time || '--:--'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">وقت وصول العودة</Label>
                          <p className="font-bold mt-1">
                            {selectedBooking.flight_data?.return_arrival_time || '--:--'}
                          </p>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-slate-500 text-xs">مسار العودة</Label>
                          <p className="font-semibold mt-1 text-lg text-amber-700">
                            {selectedBooking.flight_data?.arrival_city} ({selectedBooking.flight_data?.arrival_airport_code}) 
                            <span className="mx-2">→</span>
                            {selectedBooking.flight_data?.departure_city} ({selectedBooking.flight_data?.departure_airport_code})
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* معلومات إضافية */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                    <div>
                      <Label className="text-slate-500 text-xs">الدرجة</Label>
                      <Badge className="mt-1">
                        {selectedBooking.flight_data?.seat_class === 'economy' ? 'اقتصادية' : 
                         selectedBooking.flight_data?.seat_class === 'business' ? 'رجال أعمال' : 'الأولى'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">الأمتعة</Label>
                      <p className="font-semibold mt-1">{selectedBooking.flight_data?.baggage_allowance || '23 كجم'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">عدد المسافرين</Label>
                      <p className="font-bold text-lg mt-1">{selectedBooking.passenger_count || 1}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Confirmation from Admin */}
              <Card className={selectedBooking.payment_status === 'paid' ? 'border-2 border-green-300 bg-green-50' : 'border-2 border-yellow-300 bg-yellow-50'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    تأكيد الدفع من مدير النظام
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">حالة الدفع</Label>
                      <Badge className={selectedBooking.payment_status === 'paid' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}>
                        {selectedBooking.payment_status === 'paid' ? '✅ مؤكد ومدفوع' : '⏳ بانتظار التأكيد'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">طريقة الدفع</Label>
                      <p className="font-semibold mt-1">{selectedBooking.payment_method || 'غير محدد'}</p>
                    </div>
                    {selectedBooking.paid_at && (
                      <div>
                        <Label className="text-slate-500 text-xs">تاريخ ووقت التأكيد</Label>
                        <p className="font-semibold mt-1">{format(new Date(selectedBooking.paid_at), 'yyyy-MM-dd HH:mm', { locale: ar })}</p>
                      </div>
                    )}
                    {selectedBooking.payment_reference && (
                      <div>
                        <Label className="text-slate-500 text-xs">رقم مرجع الدفع</Label>
                        <p className="font-mono font-semibold mt-1">{selectedBooking.payment_reference}</p>
                      </div>
                    )}
                    {selectedBooking.payment_proof_url && (
                      <div className="col-span-2">
                        <Label className="text-slate-500 text-xs">إثبات الدفع</Label>
                        <a href={selectedBooking.payment_proof_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="mt-1">
                            <Eye className="h-4 w-4 ml-2" />
                            عرض إثبات الدفع
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Passengers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    بيانات المسافرين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedBooking.passengers?.map((passenger, index) => (
                      <div key={index} className="p-4 border rounded-xl">
                        <div className="flex items-start gap-4">
                          {passenger.photo_url ? (
                            <img src={passenger.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                          ) : (
                            <div className="h-20 w-20 rounded-lg bg-slate-100 flex items-center justify-center">
                              <User className="h-10 w-10 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-lg">{passenger.full_name}</h4>
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-slate-500">رقم الجواز:</span>
                                <span className="font-mono mr-2">{passenger.passport_number}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">الجنسية:</span>
                                <span className="mr-2">{passenger.nationality}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">تاريخ الميلاد:</span>
                                <span className="mr-2">{passenger.date_of_birth}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {passenger.passport_image_url && (
                              <a href={passenger.passport_image_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="w-full">
                                  <Image className="h-4 w-4 ml-1" />
                                  صورة الجواز
                                </Button>
                              </a>
                            )}
                            {passenger.renewal_image_url && (
                              <a href={passenger.renewal_image_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="w-full">
                                  <FileText className="h-4 w-4 ml-1" />
                                  صورة التجديد
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Visa */}
              {selectedBooking.visa_image_url && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-amber-600" />
                        <span className="font-semibold">صورة الفيزا متوفرة</span>
                      </div>
                      <a href={selectedBooking.visa_image_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">
                          <Eye className="h-4 w-4 ml-2" />
                          عرض الفيزا
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-700">المبلغ المدفوع من العميل</p>
                      <p className="text-3xl font-bold text-green-600">${selectedBooking.total_price}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-slate-500">سعر الموقع: ${selectedBooking.source_price}</p>
                      <p className="text-sm text-slate-500">عمولة النظام: ${selectedBooking.system_commission}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issue Ticket - مع حقل تاريخ العودة المؤكد */}
              {selectedBooking.status === 'pending_issue' && (
                <Card className="border-2 border-orange-300 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-700">⚡ إصدار التذكرة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>رقم الحجز من الموقع (PNR) *</Label>
                        <Input
                          value={ticketForm.externalBookingNumber}
                          onChange={(e) => setTicketForm({ ...ticketForm, externalBookingNumber: e.target.value })}
                          className="mt-1"
                          placeholder="PNR / Confirmation Number"
                        />
                      </div>
                      <div>
                        <Label>رقم التذكرة *</Label>
                        <Input
                          value={ticketForm.ticketNumber}
                          onChange={(e) => setTicketForm({ ...ticketForm, ticketNumber: e.target.value })}
                          className="mt-1"
                          placeholder="Ticket Number"
                        />
                      </div>
                    </div>

                    {/* تاريخ العودة المؤكد - للذهاب والعودة فقط */}
                    {selectedBooking.flight_data?.trip_type === 'round_trip' && (
                      <div className="p-4 bg-amber-100 rounded-xl border border-amber-300">
                        <Label className="text-amber-800 font-bold">📅 تاريخ العودة المؤكد *</Label>
                        <p className="text-xs text-amber-700 mb-2">أدخل تاريخ العودة الفعلي من التذكرة</p>
                        <Input
                          type="date"
                          value={ticketForm.confirmedReturnDate || selectedBooking.flight_data?.return_date || ''}
                          onChange={(e) => setTicketForm({ ...ticketForm, confirmedReturnDate: e.target.value })}
                          className="mt-1 border-amber-400"
                          min={selectedBooking.flight_data?.departure_date}
                        />
                      </div>
                    )}

                    <div>
                      <Label>ملف التذكرة (PDF أو صورة)</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          value={ticketForm.ticketPdfUrl}
                          onChange={(e) => setTicketForm({ ...ticketForm, ticketPdfUrl: e.target.value })}
                          placeholder="رابط ملف التذكرة"
                          className="flex-1"
                        />
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleUploadTicket}
                          className="hidden"
                          id="ticket-upload"
                        />
                        <label htmlFor="ticket-upload">
                          <Button type="button" variant="outline" asChild>
                            <span>
                              <Upload className="h-4 w-4 ml-2" />
                              رفع ملف
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    <Button onClick={handleIssueTicket} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-5 w-5 ml-2" />
                      تأكيد الإصدار وإرسال التذكرة للعميل
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Issued Ticket View */}
              {selectedBooking.status === 'issued' && (
                <Card className="bg-green-50 border-green-300">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="font-bold text-green-700">تم إصدار التذكرة</p>
                      <p className="text-sm text-slate-500">رقم التذكرة: {selectedBooking.ticket_number}</p>
                      {selectedBooking.ticket_pdf_url && (
                        <a href={selectedBooking.ticket_pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button className="mt-4">
                            <FileText className="h-4 w-4 ml-2" />
                            عرض التذكرة
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chat */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    المحادثة مع العميل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48 border rounded-xl p-4 mb-4">
                    {(selectedBooking.chat_messages || []).map((msg, index) => (
                      <div
                        key={index}
                        className={`mb-3 flex ${msg.sender !== 'customer' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] p-3 rounded-xl ${
                          msg.sender !== 'customer' 
                            ? 'bg-blue-100 text-blue-900' 
                            : 'bg-slate-100'
                        }`}>
                          <p>{msg.message}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {msg.timestamp && format(new Date(msg.timestamp), 'HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="اكتب رسالة للعميل..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <Button onClick={handleSendChat}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>كلمة المرور الحالية</Label>
              <Input
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>تأكيد كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="mt-1"
              />
            </div>

            <Button onClick={handleChangePassword} className="w-full">
              تغيير كلمة المرور
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}