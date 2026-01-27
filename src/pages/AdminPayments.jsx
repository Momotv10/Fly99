import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Clock, CheckCircle2, XCircle, Eye, Loader2, Image, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PaymentGatewayManager from '@/components/payment/PaymentGatewayManager';
import { PaymentVerificationService } from '@/components/payment/PaymentVerificationAI';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";

export default function AdminPayments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    // جلب الحجوزات الداخلية المعلقة
    const internalBookings = await base44.entities.Booking.filter({
      payment_status: 'pending'
    }, '-created_date');
    
    // جلب الحجوزات الخارجية المعلقة
    const externalBookings = await base44.entities.ExternalProviderBooking.filter({
      payment_status: 'pending'
    }, '-created_date');
    
    // دمج الحجوزات مع وضع علامة للتمييز
    const allBookings = [
      ...internalBookings.map(b => ({ ...b, booking_type: 'internal' })),
      ...externalBookings.map(b => ({ ...b, booking_type: 'external' }))
    ];
    
    // ترتيب حسب التاريخ
    allBookings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    setPendingPayments(allBookings);
    setLoading(false);
  };

  const handleVerifyAll = async () => {
    setVerifying('all');
    const results = await PaymentVerificationService.processPendingPayments();
    const verified = results.filter(r => r.verification?.verified).length;
    toast.success(`تم التحقق من ${verified} دفعة من أصل ${results.length}`);
    loadPendingPayments();
    setVerifying(null);
  };

  const handleManualApprove = async (booking) => {
    setVerifying(booking.id);
    try {
      // تحديث حسب نوع الحجز
      if (booking.booking_type === 'external') {
        await base44.entities.ExternalProviderBooking.update(booking.id, {
          payment_status: 'paid',
          status: 'pending_issue',
          paid_at: new Date().toISOString()
        });
      } else {
        await base44.entities.Booking.update(booking.id, {
          payment_status: 'paid',
          status: 'pending_issue'
        });
      }

      // إنشاء القيود المالية التلقائية
      await createFinancialEntries(booking);

      toast.success('تم تأكيد الدفع وإنشاء القيود المالية');
      loadPendingPayments();
    } catch (error) {
      toast.error('فشل تأكيد الدفع');
    }
    setVerifying(null);
  };

  const createFinancialEntries = async (booking) => {
    try {
      // 1. من حساب المحفظة → حساب "مبيعات العملاء"
      const walletAccount = await base44.entities.Account.filter({ 
        category: 'payment_gateway',
        name: { $regex: 'محفظة|wallet' }
      });
      
      const customerSalesAccount = await base44.entities.Account.filter({ 
        category: 'sales',
        name: { $regex: 'مبيعات العملاء' }
      });

      const providerAccount = await base44.entities.Account.filter({
        related_entity_type: 'provider',
        related_entity_id: booking.provider_id
      });

      const systemCommissionAccount = await base44.entities.Account.filter({
        category: 'commission_revenue',
        name: { $regex: 'عمولة النظام|System Commission' }
      });

      // القيد الأول: من المحفظة إلى مبيعات العملاء
      if (walletAccount.length > 0 && customerSalesAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: walletAccount[0].id,
          account_name: walletAccount[0].name,
          transaction_type: 'credit',
          amount: booking.total_amount,
          balance_before: walletAccount[0].balance,
          balance_after: (walletAccount[0].balance || 0) + booking.total_amount,
          description: `دفع حجز ${booking.booking_number} - ${booking.customer_name}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          related_account_id: customerSalesAccount[0].id,
          related_account_name: customerSalesAccount[0].name
        });

        await base44.entities.AccountTransaction.create({
          account_id: customerSalesAccount[0].id,
          account_name: customerSalesAccount[0].name,
          transaction_type: 'debit',
          amount: booking.total_amount,
          balance_before: customerSalesAccount[0].balance,
          balance_after: (customerSalesAccount[0].balance || 0) + booking.total_amount,
          description: `استلام دفع حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          related_account_id: walletAccount[0].id,
          related_account_name: walletAccount[0].name
        });

        // تحديث رصيد حساب المبيعات
        await base44.entities.Account.update(customerSalesAccount[0].id, {
          balance: (customerSalesAccount[0].balance || 0) + booking.total_amount
        });
      }

      // القيد الثاني: من مبيعات العملاء إلى حساب المزود
      if (customerSalesAccount.length > 0 && providerAccount.length > 0) {
        const providerAmount = booking.provider_amount || (booking.total_amount - booking.system_commission);
        
        await base44.entities.AccountTransaction.create({
          account_id: customerSalesAccount[0].id,
          account_name: customerSalesAccount[0].name,
          transaction_type: 'credit',
          amount: providerAmount,
          balance_before: (customerSalesAccount[0].balance || 0) + booking.total_amount,
          balance_after: (customerSalesAccount[0].balance || 0) + booking.total_amount - providerAmount,
          description: `تحويل لحساب المزود ${booking.provider_name} - حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          provider_id: booking.provider_id,
          related_account_id: providerAccount[0].id,
          related_account_name: providerAccount[0].name
        });

        await base44.entities.AccountTransaction.create({
          account_id: providerAccount[0].id,
          account_name: providerAccount[0].name,
          transaction_type: 'debit',
          amount: providerAmount,
          balance_before: providerAccount[0].balance,
          balance_after: (providerAccount[0].balance || 0) + providerAmount,
          description: `استحقاق من حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          provider_id: booking.provider_id,
          related_account_id: customerSalesAccount[0].id,
          related_account_name: customerSalesAccount[0].name
        });

        // تحديث رصيد المزود
        await base44.entities.Provider.update(booking.provider_id, {
          balance: (providerAccount[0].balance || 0) + providerAmount
        });
      }

      // القيد الثالث: من مبيعات العملاء إلى عمولة النظام
      if (customerSalesAccount.length > 0 && systemCommissionAccount.length > 0 && booking.system_commission > 0) {
        await base44.entities.AccountTransaction.create({
          account_id: customerSalesAccount[0].id,
          account_name: customerSalesAccount[0].name,
          transaction_type: 'credit',
          amount: booking.system_commission,
          description: `عمولة النظام من حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          related_account_id: systemCommissionAccount[0].id,
          related_account_name: systemCommissionAccount[0].name
        });

        await base44.entities.AccountTransaction.create({
          account_id: systemCommissionAccount[0].id,
          account_name: systemCommissionAccount[0].name,
          transaction_type: 'debit',
          amount: booking.system_commission,
          description: `عمولة من حجز ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          related_account_id: customerSalesAccount[0].id,
          related_account_name: customerSalesAccount[0].name
        });

        // تحديث رصيد حساب العمولة
        await base44.entities.Account.update(systemCommissionAccount[0].id, {
          balance: (systemCommissionAccount[0].balance || 0) + booking.system_commission
        });
      }

      console.log('✅ تم إنشاء القيود المالية بنجاح');
    } catch (error) {
      console.error('❌ خطأ في إنشاء القيود المالية:', error);
    }
  };

  const [rejectReason, setRejectReason] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);

  const handleRejectClick = (booking) => {
    setBookingToReject(booking);
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectReason) {
      toast.error('يرجى ذكر سبب الرفض');
      return;
    }

    if (bookingToReject.booking_type === 'external') {
      await base44.entities.ExternalProviderBooking.update(bookingToReject.id, {
        payment_status: 'failed',
        status: 'cancelled',
        cancellation_reason: rejectReason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin'
      });
    } else {
      await base44.entities.Booking.update(bookingToReject.id, {
        payment_status: 'failed',
        status: 'cancelled',
        cancellation_reason: rejectReason,
        cancelled_at: new Date().toISOString()
      });

      // إرجاع المقاعد المحجوزة
      if (bookingToReject.seat_id) {
        const seats = await base44.entities.AvailableSeat.filter({ id: bookingToReject.seat_id });
        if (seats.length > 0) {
          await base44.entities.AvailableSeat.update(bookingToReject.seat_id, {
            booked_count: Math.max(0, (seats[0].booked_count || 0) - (bookingToReject.passengers_count || 1))
          });
        }
      }
    }

    toast.success('تم رفض الدفع وإلغاء الحجز');
    setRejectDialogOpen(false);
    setRejectReason('');
    setBookingToReject(null);
    loadPendingPayments();
  };
  
  const handleViewDetails = (booking) => {
    setSelectedPayment(booking);
    setDetailsDialogOpen(true);
  };

  const statusConfig = {
    pending: { label: 'معلق', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'مدفوع', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { label: 'فشل', color: 'bg-red-100 text-red-700', icon: XCircle }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">إدارة المدفوعات</h1>
          <p className="text-slate-600">إدارة بوابات الدفع والتحقق من المدفوعات</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              مدفوعات معلقة
              {pendingPayments.length > 0 && (
                <Badge className="bg-yellow-500 mr-2">{pendingPayments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              بوابات الدفع
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>المدفوعات المعلقة</CardTitle>
                  <Button 
                    onClick={handleVerifyAll}
                    disabled={verifying === 'all' || pendingPayments.length === 0}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {verifying === 'all' ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري التحقق...
                      </>
                    ) : (
                      'التحقق التلقائي (AI)'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>لا توجد مدفوعات معلقة</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الحجز</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الرحلة</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>إثبات الدفع</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPayments.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {booking.booking_number}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold">{booking.customer_name}</p>
                              <p className="text-xs text-slate-500">{booking.customer_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{booking.flight_number}</p>
                              <p className="text-xs text-slate-500">
                                {booking.departure_city} → {booking.arrival_city}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              ${booking.total_amount}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{booking.payment_method}</Badge>
                          </TableCell>
                          <TableCell>
                            {booking.created_date && 
                              format(new Date(booking.created_date), 'dd MMM HH:mm', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            {booking.payment_proof_url ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetails(booking)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Eye className="h-4 w-4 ml-1" />
                                عرض
                              </Button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleViewDetails(booking)}
                                title="عرض التفاصيل"
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-green-600"
                                onClick={() => handleManualApprove(booking)}
                                title="الموافقة"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleRejectClick(booking)}
                                title="الرفض"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gateways">
            <PaymentGatewayManager />
          </TabsContent>
        </Tabs>
        
        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفض الدفع</DialogTitle>
            </DialogHeader>
            
            {bookingToReject && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="font-semibold">حجز رقم: {bookingToReject.booking_number}</p>
                  <p className="text-sm text-slate-600">العميل: {bookingToReject.customer_name}</p>
                </div>

                <div>
                  <Label>سبب الرفض *</Label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="مثال: صورة الإشعار غير واضحة"
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="flex-1">
                    إلغاء
                  </Button>
                  <Button variant="destructive" onClick={handleReject} className="flex-1">
                    <XCircle className="h-4 w-4 ml-2" />
                    تأكيد الرفض
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تفاصيل الدفع الكاملة</DialogTitle>
            </DialogHeader>
            
            {selectedPayment && (
              <div className="space-y-6">
                {/* معلومات الحجز */}
                <Card className="bg-slate-50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">رقم الحجز</p>
                        <p className="font-mono font-bold">{selectedPayment.booking_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">العميل</p>
                        <p className="font-semibold">{selectedPayment.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">رقم الهاتف</p>
                        <p dir="ltr">{selectedPayment.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">البريد الإلكتروني</p>
                        <p className="text-sm">{selectedPayment.customer_email}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* معلومات الدفع */}
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">طريقة الدفع</p>
                        <Badge>{selectedPayment.payment_method}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">المبلغ</p>
                        <p className="font-bold text-green-600 text-xl">${selectedPayment.total_amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">رقم المرجع</p>
                        <p className="font-mono text-sm">{selectedPayment.payment_reference || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">التاريخ</p>
                        <p className="text-sm">
                          {selectedPayment.created_date && 
                            format(new Date(selectedPayment.created_date), 'dd MMMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* إثبات الدفع */}
                {selectedPayment.payment_proof_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Image className="h-5 w-5 text-blue-600" />
                        إثبات الدفع
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <img 
                          src={selectedPayment.payment_proof_url} 
                          alt="إثبات الدفع" 
                          className="w-full rounded-lg shadow-lg"
                        />
                        <div className="flex gap-2 mt-4">
                          <a 
                            href={selectedPayment.payment_proof_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1"
                          >
                            <Button variant="outline" className="w-full">
                              <Eye className="h-4 w-4 ml-2" />
                              فتح بحجم كامل
                            </Button>
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* أزرار الإجراءات */}
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleManualApprove(selectedPayment);
                      setDetailsDialogOpen(false);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                    الموافقة على الدفع
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setBookingToReject(selectedPayment);
                      setDetailsDialogOpen(false);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض الدفع
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}