import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from '@/api/base44Client';
import PaymentGatewayManager from '@/components/payment/PaymentGatewayManager';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";
import {
  CreditCard, Clock, CheckCircle2, XCircle, Eye, Loader2, 
  Image as ImageIcon, FileText, DollarSign, Plane, Globe
} from 'lucide-react';

export default function AdminPaymentsComplete() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    const internalBookings = await base44.entities.Booking.filter({
      payment_status: 'pending'
    }, '-created_date');
    
    const externalBookings = await base44.entities.ExternalProviderBooking.filter({
      payment_status: 'pending'
    }, '-created_date');
    
    const allBookings = [
      ...internalBookings.map(b => ({ ...b, booking_type: 'internal' })),
      ...externalBookings.map(b => ({ ...b, booking_type: 'external' }))
    ];
    
    allBookings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    setPendingPayments(allBookings);
    setLoading(false);
  };

  const handleManualApprove = async (booking) => {
    setVerifying(booking.id);
    try {
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

      await createFinancialEntries(booking);

      toast.success('تم تأكيد الدفع وإنشاء القيود المالية');
      loadPendingPayments();
    } catch (error) {
      toast.error('فشل تأكيد الدفع');
    }
    setVerifying(null);
  };

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

  const createFinancialEntries = async (booking) => {
    try {
      const walletAccount = (await base44.entities.Account.filter({ 
        category: 'payment_gateway'
      }))[0];
      
      const customerSalesAccount = (await base44.entities.Account.filter({ 
        name: { $regex: 'مبيعات العملاء' }
      }))[0];

      const systemCommissionAccount = (await base44.entities.Account.filter({
        category: 'commission_revenue'
      }))[0];

      const totalAmount = booking.total_price || booking.total_amount;
      const systemCommission = booking.system_commission || 30;
      const providerAmount = totalAmount - systemCommission;

      // 1. من المحفظة → مبيعات العملاء
      if (walletAccount && customerSalesAccount) {
        await base44.entities.AccountTransaction.create({
          account_id: walletAccount.id,
          transaction_type: 'debit',
          amount: totalAmount,
          description: `استلام دفع ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id
        });

        await base44.entities.AccountTransaction.create({
          account_id: customerSalesAccount.id,
          transaction_type: 'debit',
          amount: totalAmount,
          description: `دفع ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id
        });
      }

      // 2. من مبيعات العملاء → المزود
      if (booking.provider_id && booking.booking_type !== 'external') {
        const providerAccount = (await base44.entities.Account.filter({
          related_entity_type: 'provider',
          related_entity_id: booking.provider_id
        }))[0];

        if (providerAccount && customerSalesAccount) {
          await base44.entities.AccountTransaction.create({
            account_id: customerSalesAccount.id,
            transaction_type: 'credit',
            amount: providerAmount,
            description: `تحويل للمزود ${booking.provider_name}`,
            provider_id: booking.provider_id
          });

          await base44.entities.AccountTransaction.create({
            account_id: providerAccount.id,
            transaction_type: 'debit',
            amount: providerAmount,
            description: `استحقاق ${booking.booking_number}`,
            provider_id: booking.provider_id
          });

          await base44.entities.Provider.update(booking.provider_id, {
            balance: (providerAccount.balance || 0) + providerAmount
          });
        }
      }

      // 3. من مبيعات العملاء → عمولة النظام
      if (systemCommissionAccount && customerSalesAccount) {
        await base44.entities.AccountTransaction.create({
          account_id: customerSalesAccount.id,
          transaction_type: 'credit',
          amount: systemCommission,
          description: `عمولة ${booking.booking_number}`
        });

        await base44.entities.AccountTransaction.create({
          account_id: systemCommissionAccount.id,
          transaction_type: 'debit',
          amount: systemCommission,
          description: `عمولة ${booking.booking_number}`
        });

        await base44.entities.Account.update(systemCommissionAccount.id, {
          balance: (systemCommissionAccount.balance || 0) + systemCommission
        });
      }

      console.log('✅ تم إنشاء القيود المالية بنجاح');
    } catch (error) {
      console.error('❌ خطأ في إنشاء القيود المالية:', error);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-4 lg:p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">إدارة المدفوعات</h1>
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
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  المدفوعات بانتظار التأكيد
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>لا توجد مدفوعات معلقة</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نوع</TableHead>
                        <TableHead>رقم الحجز</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الرحلة</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>إثبات</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPayments.map((booking) => (
                        <TableRow key={booking.id} className="hover:bg-slate-50">
                          <TableCell>
                            <Badge className={booking.booking_type === 'external' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                              {booking.booking_type === 'external' ? (
                                <><Globe className="h-3 w-3 ml-1" />خارجي</>
                              ) : (
                                <><Plane className="h-3 w-3 ml-1" />داخلي</>
                              )}
                            </Badge>
                          </TableCell>
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
                              <p className="font-medium">
                                {booking.flight_number || booking.flight_data?.flight_number}
                              </p>
                              <p className="text-xs text-slate-500">
                                {booking.booking_type === 'external' 
                                  ? `${booking.flight_data?.departure_city} → ${booking.flight_data?.arrival_city}`
                                  : `${booking.departure_city} → ${booking.arrival_city}`
                                }
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              ${booking.total_price || booking.total_amount}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{booking.payment_method || 'wallet'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-600">
                              {booking.created_date && 
                                format(new Date(booking.created_date), 'dd MMM', { locale: ar })}
                              <br />
                              {booking.created_date &&
                                format(new Date(booking.created_date), 'HH:mm', { locale: ar })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {booking.payment_proof_url ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(booking.payment_proof_url, '_blank')}
                                className="text-blue-600"
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
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleManualApprove(booking)}
                                disabled={verifying === booking.id}
                              >
                                {verifying === booking.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleRejectClick(booking)}
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
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                رفض الدفع
              </DialogTitle>
            </DialogHeader>
            
            {bookingToReject && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="font-semibold">حجز رقم: {bookingToReject.booking_number}</p>
                  <p className="text-sm text-slate-600">العميل: {bookingToReject.customer_name}</p>
                  <p className="text-sm text-red-600">المبلغ: ${bookingToReject.total_price || bookingToReject.total_amount}</p>
                </div>

                <div>
                  <Label>سبب الرفض *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="مثال: صورة الإشعار غير واضحة، رقم الحساب غير صحيح..."
                    className="mt-1 h-24"
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                تفاصيل الدفع الكاملة
              </DialogTitle>
            </DialogHeader>
            
            {selectedPayment && (
              <div className="space-y-6">
                {/* نوع الحجز */}
                <div className="flex items-center gap-2">
                  <Badge className={selectedPayment.booking_type === 'external' ? 'bg-purple-600' : 'bg-blue-600'}>
                    {selectedPayment.booking_type === 'external' ? '🌐 حجز خارجي' : '✈️ حجز داخلي'}
                  </Badge>
                  {selectedPayment.booking_type === 'external' && selectedPayment.source_platform && (
                    <Badge variant="outline">{selectedPayment.source_platform}</Badge>
                  )}
                </div>

                {/* معلومات الحجز */}
                <Card className="bg-slate-50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-500 text-xs">رقم الحجز</Label>
                        <p className="font-mono font-bold">{selectedPayment.booking_number}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">العميل</Label>
                        <p className="font-semibold">{selectedPayment.customer_name}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">الهاتف</Label>
                        <p dir="ltr" className="font-mono">{selectedPayment.customer_phone}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">البريد</Label>
                        <p className="text-sm">{selectedPayment.customer_email || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* معلومات الرحلة */}
                <Card className="border-blue-200">
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="text-lg">تفاصيل الرحلة</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {selectedPayment.booking_type === 'external' ? (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-slate-500 text-xs">شركة الطيران</Label>
                            <p className="font-semibold">{selectedPayment.flight_data?.airline_name}</p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs">رقم الرحلة</Label>
                            <p className="font-mono font-bold">{selectedPayment.flight_data?.flight_number}</p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs">نوع الرحلة</Label>
                            <Badge className={selectedPayment.flight_data?.trip_type === 'round_trip' ? 'bg-blue-600' : 'bg-green-600'}>
                              {selectedPayment.flight_data?.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <Label className="text-slate-500 text-xs">المسار</Label>
                          <p className="font-semibold text-lg">
                            {selectedPayment.flight_data?.departure_city} ({selectedPayment.flight_data?.departure_airport_code})
                            <span className="mx-2">→</span>
                            {selectedPayment.flight_data?.arrival_city} ({selectedPayment.flight_data?.arrival_airport_code})
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-500 text-xs">تاريخ الذهاب</Label>
                            <p className="font-semibold">{selectedPayment.flight_data?.departure_date}</p>
                            <p className="text-sm text-slate-500">{selectedPayment.flight_data?.departure_time}</p>
                          </div>
                          {selectedPayment.flight_data?.trip_type === 'round_trip' && (
                            <div className="bg-amber-50 p-3 rounded-lg">
                              <Label className="text-amber-700 text-xs font-bold">تاريخ العودة</Label>
                              <p className="font-semibold text-amber-700">{selectedPayment.flight_data?.return_date || 'غير محدد'}</p>
                              <p className="text-sm text-amber-600">{selectedPayment.flight_data?.return_departure_time}</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-500 text-xs">المسار</Label>
                            <p className="font-semibold">{selectedPayment.departure_city} → {selectedPayment.arrival_city}</p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs">التاريخ</Label>
                            <p className="font-semibold">{selectedPayment.departure_date}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {/* معلومات الدفع */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      معلومات الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-500 text-xs">طريقة الدفع</Label>
                        <Badge>{selectedPayment.payment_method || 'wallet'}</Badge>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs">المبلغ الإجمالي</Label>
                        <p className="font-bold text-green-600 text-2xl">
                          ${selectedPayment.total_price || selectedPayment.total_amount}
                        </p>
                      </div>
                      {selectedPayment.payment_reference && (
                        <div>
                          <Label className="text-slate-500 text-xs">رقم المرجع</Label>
                          <p className="font-mono text-sm">{selectedPayment.payment_reference}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-slate-500 text-xs">تاريخ الطلب</Label>
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
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-green-700">
                        <ImageIcon className="h-5 w-5" />
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
                        <a 
                          href={selectedPayment.payment_proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-4 block"
                        >
                          <Button variant="outline" className="w-full">
                            <Eye className="h-4 w-4 ml-2" />
                            فتح بحجم كامل
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* أزرار الإجراءات */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700 h-14 text-lg"
                    onClick={() => {
                      handleManualApprove(selectedPayment);
                      setDetailsDialogOpen(false);
                    }}
                    disabled={verifying === selectedPayment.id}
                  >
                    {verifying === selectedPayment.id ? (
                      <>
                        <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                        جاري التأكيد...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 ml-2" />
                        تأكيد الدفع
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1 h-14 text-lg"
                    onClick={() => {
                      setBookingToReject(selectedPayment);
                      setDetailsDialogOpen(false);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-5 w-5 ml-2" />
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