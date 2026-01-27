import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import PassportOCRUploader from '@/components/ai/PassportOCR';
import { 
  User, Ticket, Users as UsersIcon, Settings, 
  Plus, Pencil, Trash2, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";

export default function CustomerProfile() {
  const [customer, setCustomer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [savedPassengers, setSavedPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState(null);

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async () => {
    try {
      const user = await base44.auth.me();
      
      // جلب أو إنشاء بيانات العميل
      let customerData = await base44.entities.Customer.filter({ email: user.email });
      
      if (customerData.length === 0) {
        const newCustomer = await base44.entities.Customer.create({
          full_name: user.full_name,
          email: user.email,
          auth_provider: 'email',
          is_active: true,
          total_bookings: 0,
          total_spent: 0,
          preferred_language: 'ar',
          saved_passengers: []
        });
        setCustomer(newCustomer);
        customerData = [newCustomer];
      } else {
        setCustomer(customerData[0]);
      }
      
      // جلب الحجوزات
      const customerId = customerData[0].id;
      const bookingsData = await base44.entities.Booking.filter({ 
        customer_id: customerId 
      }, '-created_date');
      setBookings(bookingsData);
      
      setSavedPassengers(customerData[0].saved_passengers || []);
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
    
    setLoading(false);
  };

  const handleSavePassenger = async (passengerData) => {
    const updated = editingPassenger
      ? savedPassengers.map(p => p === editingPassenger ? passengerData : p)
      : [...savedPassengers, passengerData];
    
    await base44.entities.Customer.update(customer.id, {
      saved_passengers: updated
    });
    
    setSavedPassengers(updated);
    setDialogOpen(false);
    setEditingPassenger(null);
    toast.success('تم حفظ بيانات المسافر');
  };

  const handleDeletePassenger = async (passenger) => {
    if (confirm('هل أنت متأكد من حذف المسافر؟')) {
      const updated = savedPassengers.filter(p => p !== passenger);
      await base44.entities.Customer.update(customer.id, {
        saved_passengers: updated
      });
      setSavedPassengers(updated);
      toast.success('تم حذف المسافر');
    }
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-amber-100 text-amber-700' },
    paid: { label: 'مدفوع', color: 'bg-blue-100 text-blue-700' },
    pending_issue: { label: 'قيد الإصدار', color: 'bg-purple-100 text-purple-700' },
    issued: { label: 'مصدرة', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700' }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">حسابي</h1>

          <Tabs defaultValue="bookings" className="space-y-6">
            <TabsList>
              <TabsTrigger value="bookings">
                <Ticket className="h-4 w-4 ml-2" />
                حجوزاتي
              </TabsTrigger>
              <TabsTrigger value="passengers">
                <UsersIcon className="h-4 w-4 ml-2" />
                المسافرون المحفوظون
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 ml-2" />
                الإعدادات
              </TabsTrigger>
            </TabsList>

            {/* الحجوزات */}
            <TabsContent value="bookings">
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {booking.airline_logo && (
                            <img src={booking.airline_logo} alt="" className="h-12 w-12" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">{booking.flight_number}</p>
                              <Badge className="font-mono">{booking.booking_number}</Badge>
                            </div>
                            <p className="text-slate-600 mt-1">
                              {booking.departure_city} → {booking.arrival_city}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              <span>📅 {booking.departure_date}</span>
                              <span>🕐 {booking.departure_time}</span>
                              <span>👥 {booking.passengers_count} مسافر</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-left">
                          <p className="text-2xl font-bold text-green-600">${booking.total_amount}</p>
                          <Badge className={`mt-2 ${statusConfig[booking.status]?.color}`}>
                            {statusConfig[booking.status]?.label}
                          </Badge>
                          {booking.status === 'issued' && booking.ticket_pdf_url && (
                            <Button className="mt-3 w-full" variant="outline">
                              عرض التذكرة
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {bookings.length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Ticket className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500 mb-4">ليس لديك حجوزات بعد</p>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        ابحث عن رحلات
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* المسافرون المحفوظون */}
            <TabsContent value="passengers">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>المسافرون المحفوظون</CardTitle>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="ml-2 h-4 w-4" />
                          إضافة مسافر
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>إضافة مسافر جديد</DialogTitle>
                        </DialogHeader>
                        <PassportOCRUploader 
                          onDataExtracted={handleSavePassenger}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {savedPassengers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <UsersIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>لم تقم بحفظ أي مسافرين بعد</p>
                      <p className="text-sm mt-2">احفظ بيانات المسافرين لتسهيل الحجز المستقبلي</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedPassengers.map((passenger, index) => (
                        <Card key={index} className="bg-slate-50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {passenger.photo_url && (
                                <img 
                                  src={passenger.photo_url} 
                                  alt="" 
                                  className="h-16 w-16 rounded-lg border"
                                />
                              )}
                              <div className="flex-1">
                                <p className="font-semibold">{passenger.full_name}</p>
                                <p className="text-sm text-slate-500 font-mono">{passenger.passport_number}</p>
                                <p className="text-xs text-slate-400 mt-1">{passenger.nationality}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => {
                                  setEditingPassenger(passenger);
                                  setDialogOpen(true);
                                }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePassenger(passenger)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* الإعدادات */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>إعدادات الحساب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الاسم الكامل</Label>
                      <Input value={customer?.full_name || ''} readOnly />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input value={customer?.email || ''} readOnly />
                    </div>
                    <div>
                      <Label>رقم الهاتف</Label>
                      <Input 
                        value={customer?.phone || ''} 
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>واتساب</Label>
                      <Input 
                        value={customer?.whatsapp || ''} 
                        onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-4">إحصائيات الحساب</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-slate-600">إجمالي الحجوزات</p>
                        <p className="text-2xl font-bold text-blue-600">{customer?.total_bookings || 0}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-slate-600">إجمالي المصروفات</p>
                        <p className="text-2xl font-bold text-green-600">${customer?.total_spent || 0}</p>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                    حفظ التغييرات
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  );
}