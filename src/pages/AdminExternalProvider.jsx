import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Settings, Globe, DollarSign, Users, Plus, Trash2, ExternalLink,
  Save, Loader2, Search, Eye, MessageSquare, Upload, CheckCircle,
  AlertTriangle, Clock, Plane, User, Phone, Mail, Send, Image,
  FileText, Brain, Sparkles, RefreshCw, TrendingUp, CreditCard, 
  BarChart3, Activity, Wallet
} from 'lucide-react';

export default function AdminExternalProvider() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    is_enabled: true,
    auto_search: true,
    commission_per_booking: 30,
    commission_type: 'fixed',
    commission_percentage: 5,
    search_sites: []
  });

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending_issue');

  // Employees State
  const [employees, setEmployees] = useState([]);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    username: '',
    password_hash: '',
    role: 'ticket_specialist',
    is_active: true,
    notification_enabled: true
  });

  // New Site Dialog
  const [newSiteDialogOpen, setNewSiteDialogOpen] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', url: '', logo_url: '', is_active: true, priority: 1 });

  // Ticket Issue State
  const [ticketForm, setTicketForm] = useState({
    externalBookingNumber: '',
    ticketNumber: '',
    ticketPdfUrl: ''
  });

  // Chat State
  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'bookings') {
      loadBookings();
    }
  }, [filterStatus, activeTab]);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadSettings(),
      loadBookings(),
      loadEmployees()
    ]);
    setLoading(false);
  };

  const loadSettings = async () => {
    const data = await base44.entities.ExternalProviderSettings.filter({ setting_type: 'general' });
    if (data.length > 0) {
      setSettings({
        ...settings,
        ...data[0],
        search_sites: data[0].search_sites || getDefaultSites()
      });
    } else {
      setSettings({
        ...settings,
        search_sites: getDefaultSites()
      });
    }
  };

  const getDefaultSites = () => [
    { name: 'Booking.com', url: 'https://www.booking.com/flights', logo_url: 'https://cf.bstatic.com/static/img/favicon/favicon-32x32.png', is_active: true, priority: 1 },
    { name: 'Skyscanner', url: 'https://www.skyscanner.com', logo_url: 'https://www.skyscanner.com/favicon.ico', is_active: true, priority: 2 },
    { name: 'Kayak', url: 'https://www.kayak.com', logo_url: 'https://www.kayak.com/favicon.ico', is_active: true, priority: 3 },
    { name: 'Google Flights', url: 'https://www.google.com/flights', logo_url: 'https://www.google.com/favicon.ico', is_active: true, priority: 4 },
    { name: 'Expedia', url: 'https://www.expedia.com', logo_url: 'https://www.expedia.com/favicon.ico', is_active: false, priority: 5 }
  ];

  const loadBookings = async () => {
    let query = {};
    if (filterStatus !== 'all') {
      query.status = filterStatus;
    }
    const data = await base44.entities.ExternalProviderBooking.filter(query, '-created_date', 100);
    setBookings(data);
  };

  const loadEmployees = async () => {
    const data = await base44.entities.ExternalProviderEmployee.list('-created_date', 50);
    setEmployees(data);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const existingSettings = await base44.entities.ExternalProviderSettings.filter({ setting_type: 'general' });
    
    const settingsData = {
      setting_type: 'general',
      is_enabled: settings.is_enabled,
      auto_search: settings.auto_search,
      commission_per_booking: settings.commission_per_booking,
      commission_type: settings.commission_type,
      commission_percentage: settings.commission_percentage,
      search_sites: settings.search_sites
    };

    if (existingSettings.length > 0) {
      await base44.entities.ExternalProviderSettings.update(existingSettings[0].id, settingsData);
    } else {
      await base44.entities.ExternalProviderSettings.create(settingsData);
    }

    toast.success('تم حفظ الإعدادات');
    setSaving(false);
  };

  const handleAddSite = () => {
    if (!newSite.name || !newSite.url) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    
    setSettings({
      ...settings,
      search_sites: [...settings.search_sites, { ...newSite, priority: settings.search_sites.length + 1 }]
    });
    setNewSite({ name: '', url: '', logo_url: '', is_active: true, priority: 1 });
    setNewSiteDialogOpen(false);
  };

  const handleRemoveSite = (index) => {
    setSettings({
      ...settings,
      search_sites: settings.search_sites.filter((_, i) => i !== index)
    });
  };

  const handleToggleSite = (index) => {
    const updatedSites = [...settings.search_sites];
    updatedSites[index].is_active = !updatedSites[index].is_active;
    setSettings({ ...settings, search_sites: updatedSites });
  };

  const handleDiscoverSites = async () => {
    toast.info('جاري البحث عن مواقع الحجز...');
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: 'أعطني قائمة بأفضل 10 مواقع حجز تذاكر الطيران عالمياً مع روابطها',
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          sites: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                url: { type: "string" },
                description: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (result.sites) {
      const newSites = result.sites.map((site, i) => ({
        name: site.name,
        url: site.url,
        logo_url: '',
        is_active: false,
        priority: settings.search_sites.length + i + 1
      }));

      // فلترة المواقع الموجودة
      const existingUrls = settings.search_sites.map(s => s.url);
      const uniqueNewSites = newSites.filter(s => !existingUrls.includes(s.url));

      setSettings({
        ...settings,
        search_sites: [...settings.search_sites, ...uniqueNewSites]
      });

      toast.success(`تم العثور على ${uniqueNewSites.length} موقع جديد`);
    }
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.full_name || !employeeForm.whatsapp || !employeeForm.username) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }

    if (editingEmployee) {
      await base44.entities.ExternalProviderEmployee.update(editingEmployee.id, employeeForm);
      toast.success('تم تحديث بيانات الموظف');
    } else {
      await base44.entities.ExternalProviderEmployee.create(employeeForm);
      toast.success('تم إضافة الموظف');
    }

    setEmployeeDialogOpen(false);
    resetEmployeeForm();
    loadEmployees();
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      full_name: employee.full_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      whatsapp: employee.whatsapp || '',
      username: employee.username || '',
      password_hash: '',
      role: employee.role || 'ticket_specialist',
      is_active: employee.is_active !== false,
      notification_enabled: employee.notification_enabled !== false
    });
    setEmployeeDialogOpen(true);
  };

  const resetEmployeeForm = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      full_name: '',
      email: '',
      phone: '',
      whatsapp: '',
      username: '',
      password_hash: '',
      role: 'ticket_specialist',
      is_active: true,
      notification_enabled: true
    });
  };

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
    setTicketForm({
      externalBookingNumber: booking.external_booking_number || '',
      ticketNumber: booking.ticket_number || '',
      ticketPdfUrl: booking.ticket_pdf_url || ''
    });
    setBookingDialogOpen(true);
  };

  const handleIssueTicket = async () => {
    if (!ticketForm.ticketNumber) {
      toast.error('يرجى إدخال رقم التذكرة');
      return;
    }

    const systemUser = JSON.parse(localStorage.getItem('systemUser') || '{}');

    await base44.entities.ExternalProviderBooking.update(selectedBooking.id, {
      status: 'issued',
      external_booking_number: ticketForm.externalBookingNumber,
      ticket_number: ticketForm.ticketNumber,
      ticket_pdf_url: ticketForm.ticketPdfUrl,
      issued_at: new Date().toISOString(),
      issued_by: systemUser.full_name || systemUser.username
    });

    toast.success('تم إصدار التذكرة وإرسالها للعميل');
    setBookingDialogOpen(false);
    loadBookings();
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
      sender: 'admin',
      message: chatMessage,
      timestamp: new Date().toISOString(),
      type: 'text'
    });

    await base44.entities.ExternalProviderBooking.update(selectedBooking.id, {
      chat_messages: messages
    });

    setSelectedBooking({ ...selectedBooking, chat_messages: messages });
    setChatMessage('');
    
    // إرسال عبر واتساب
    // await sendWhatsAppMessage(selectedBooking.customer_whatsapp, chatMessage);
  };

  const statusConfig = {
    pending_payment: { label: 'بانتظار الدفع', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    paid: { label: 'مدفوع', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
    pending_issue: { label: 'بانتظار الإصدار', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    processing: { label: 'جاري المعالجة', color: 'bg-purple-100 text-purple-700', icon: Loader2 },
    issued: { label: 'تم الإصدار', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">المزود الخارجي الذكي</h1>
              <p className="text-slate-600">البحث التلقائي في مواقع الحجز الخارجية</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">إجمالي الحجوزات</p>
                  <p className="text-3xl font-bold">{bookings.length}</p>
                </div>
                <Plane className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">بانتظار الإصدار</p>
                  <p className="text-3xl font-bold">
                    {bookings.filter(b => b.status === 'pending_issue').length}
                  </p>
                </div>
                <AlertTriangle className="h-10 w-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">تم الإصدار</p>
                  <p className="text-3xl font-bold">
                    {bookings.filter(b => b.status === 'issued').length}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">إجمالي المبيعات</p>
                  <p className="text-3xl font-bold">
                    ${bookings.filter(b => b.status === 'issued').reduce((sum, b) => sum + (b.total_price || 0), 0).toLocaleString()}
                  </p>
                </div>
                <Wallet className="h-10 w-10 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
            <TabsTrigger value="bookings">
              <Plane className="h-4 w-4 ml-2" />
              الحجوزات
            </TabsTrigger>
            <TabsTrigger value="employees">
              <Users className="h-4 w-4 ml-2" />
              الموظفين
            </TabsTrigger>
            <TabsTrigger value="finance">
              <Wallet className="h-4 w-4 ml-2" />
              المالية
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 ml-2" />
              الإعدادات
            </TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>طلبات إصدار التذاكر</CardTitle>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending_issue">بانتظار الإصدار</SelectItem>
                      <SelectItem value="processing">جاري المعالجة</SelectItem>
                      <SelectItem value="issued">تم الإصدار</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
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
                      const status = statusConfig[booking.status] || statusConfig.pending_payment;
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={booking.id}>
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
                            <Button variant="ghost" size="sm" onClick={() => handleViewBooking(booking)}>
                              <Eye className="h-4 w-4" />
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
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>موظفو إصدار التذاكر</CardTitle>
                  <Button onClick={() => { resetEmployeeForm(); setEmployeeDialogOpen(true); }}>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة موظف
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>اسم المستخدم</TableHead>
                      <TableHead>واتساب</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{emp.full_name}</p>
                              <p className="text-xs text-slate-500">{emp.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{emp.username}</TableCell>
                        <TableCell dir="ltr">{emp.whatsapp}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {emp.role === 'supervisor' ? 'مشرف' : 'مختص إصدار'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {emp.is_active ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEditEmployee(emp)}>
                            تعديل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    ملخص مالي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="p-6 bg-green-50 rounded-2xl">
                      <p className="text-green-600 text-sm mb-2">إجمالي الإيرادات</p>
                      <p className="text-3xl font-bold text-green-700">
                        ${bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + (b.total_price || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-6 bg-blue-50 rounded-2xl">
                      <p className="text-blue-600 text-sm mb-2">إجمالي العمولات</p>
                      <p className="text-3xl font-bold text-blue-700">
                        ${bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + (b.system_commission || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-6 bg-purple-50 rounded-2xl">
                      <p className="text-purple-600 text-sm mb-2">تكلفة المصدر</p>
                      <p className="text-3xl font-bold text-purple-700">
                        ${bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + (b.source_price || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>آخر العمليات المالية</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الحجز</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>سعر المصدر</TableHead>
                        <TableHead>العمولة</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.filter(b => b.payment_status === 'paid').slice(0, 10).map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono font-bold">{b.booking_number}</TableCell>
                          <TableCell>{b.customer_name}</TableCell>
                          <TableCell>
                            {b.paid_at && format(new Date(b.paid_at), 'd MMM yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell>${b.source_price}</TableCell>
                          <TableCell className="text-green-600 font-semibold">${b.system_commission}</TableCell>
                          <TableCell className="font-bold">${b.total_price}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">مكتمل</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-6">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    الإعدادات العامة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <h4 className="font-semibold">تفعيل المزود الخارجي</h4>
                      <p className="text-sm text-slate-500">البحث في المواقع الخارجية عند عدم توفر رحلات</p>
                    </div>
                    <Switch
                      checked={settings.is_enabled}
                      onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <h4 className="font-semibold">البحث التلقائي</h4>
                      <p className="text-sm text-slate-500">البحث تلقائياً عند عدم وجود نتائج</p>
                    </div>
                    <Switch
                      checked={settings.auto_search}
                      onCheckedChange={(v) => setSettings({ ...settings, auto_search: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Commission Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    إعدادات العمولة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>نوع العمولة</Label>
                      <Select 
                        value={settings.commission_type} 
                        onValueChange={(v) => setSettings({ ...settings, commission_type: v })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                          <SelectItem value="percentage">نسبة مئوية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>
                        {settings.commission_type === 'fixed' ? 'مبلغ العمولة بالدولار' : 'نسبة العمولة %'}
                      </Label>
                      <Input
                        type="number"
                        value={settings.commission_type === 'fixed' ? settings.commission_per_booking : settings.commission_percentage}
                        onChange={(e) => {
                          if (settings.commission_type === 'fixed') {
                            setSettings({ ...settings, commission_per_booking: Number(e.target.value) });
                          } else {
                            setSettings({ ...settings, commission_percentage: Number(e.target.value) });
                          }
                        }}
                        min="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertDescription>
                      مثال: رحلة بسعر $670 + عمولة ${settings.commission_type === 'fixed' ? settings.commission_per_booking : Math.round(670 * settings.commission_percentage / 100)} = 
                      <strong className="text-green-600"> ${settings.commission_type === 'fixed' ? 670 + settings.commission_per_booking : Math.round(670 * (1 + settings.commission_percentage / 100))} للعميل</strong>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Search Sites */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      مواقع البحث
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleDiscoverSites}>
                        <Sparkles className="h-4 w-4 ml-2" />
                        اكتشاف بالذكاء الاصطناعي
                      </Button>
                      <Button onClick={() => setNewSiteDialogOpen(true)}>
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة موقع
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {settings.search_sites.map((site, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-xl">
                        <div className="flex items-center gap-4">
                          {site.logo_url ? (
                            <img src={site.logo_url} alt="" className="h-8 w-8 object-contain" />
                          ) : (
                            <Globe className="h-8 w-8 text-slate-400" />
                          )}
                          <div>
                            <p className="font-semibold">{site.name}</p>
                            <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                              {site.url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={site.is_active}
                            onCheckedChange={() => handleToggleSite(index)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveSite(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving} size="lg">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                  حفظ الإعدادات
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Details Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الحجز - {selectedBooking?.booking_number}</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Flight Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    بيانات الرحلة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">المنصة المصدر</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold">{selectedBooking.source_platform}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-500">رابط الحجز</Label>
                      <a 
                        href={selectedBooking.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline mt-1"
                      >
                        فتح الرابط
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <div>
                      <Label className="text-slate-500">شركة الطيران</Label>
                      <p className="font-semibold mt-1">{selectedBooking.flight_data?.airline_name}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">رقم الرحلة</Label>
                      <p className="font-mono font-semibold mt-1">{selectedBooking.flight_data?.flight_number}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">المسار</Label>
                      <p className="font-semibold mt-1">
                        {selectedBooking.flight_data?.departure_city} ← {selectedBooking.flight_data?.arrival_city}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500">التاريخ</Label>
                      <p className="font-semibold mt-1">{selectedBooking.flight_data?.departure_date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Passengers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    بيانات المسافرين ({selectedBooking.passengers?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedBooking.passengers?.map((passenger, index) => (
                      <div key={index} className="p-4 border rounded-xl">
                        <div className="flex items-start gap-4">
                          {passenger.photo_url ? (
                            <img src={passenger.photo_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          ) : (
                            <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center">
                              <User className="h-8 w-8 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-slate-500 text-xs">الاسم</Label>
                              <p className="font-semibold">{passenger.full_name}</p>
                            </div>
                            <div>
                              <Label className="text-slate-500 text-xs">رقم الجواز</Label>
                              <p className="font-mono">{passenger.passport_number}</p>
                            </div>
                            <div>
                              <Label className="text-slate-500 text-xs">الجنسية</Label>
                              <p>{passenger.nationality}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {passenger.passport_image_url && (
                              <a href={passenger.passport_image_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <Image className="h-4 w-4 ml-1" />
                                  الجواز
                                </Button>
                              </a>
                            )}
                            {passenger.renewal_image_url && (
                              <a href={passenger.renewal_image_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <FileText className="h-4 w-4 ml-1" />
                                  التجديد
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

              {/* Payment Info */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-700">المبلغ المدفوع</p>
                      <p className="text-3xl font-bold text-green-600">${selectedBooking.total_price}</p>
                    </div>
                    <Badge className={statusConfig[selectedBooking.status]?.color}>
                      {statusConfig[selectedBooking.status]?.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Issue Ticket */}
              {selectedBooking.status === 'pending_issue' && (
                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-700">إصدار التذكرة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>رقم الحجز الخارجي</Label>
                        <Input
                          value={ticketForm.externalBookingNumber}
                          onChange={(e) => setTicketForm({ ...ticketForm, externalBookingNumber: e.target.value })}
                          className="mt-1"
                          placeholder="رقم الحجز من الموقع"
                        />
                      </div>
                      <div>
                        <Label>رقم التذكرة *</Label>
                        <Input
                          value={ticketForm.ticketNumber}
                          onChange={(e) => setTicketForm({ ...ticketForm, ticketNumber: e.target.value })}
                          className="mt-1"
                          placeholder="رقم التذكرة الصادرة"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>ملف التذكرة</Label>
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
                              رفع
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    <Button onClick={handleIssueTicket} className="w-full bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 ml-2" />
                      تأكيد الإصدار وإرسال للعميل
                    </Button>
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
                  <ScrollArea className="h-64 border rounded-xl p-4 mb-4">
                    {(selectedBooking.chat_messages || []).map((msg, index) => (
                      <div
                        key={index}
                        className={`mb-3 flex ${msg.sender === 'admin' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] p-3 rounded-xl ${
                          msg.sender === 'admin' 
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
                      placeholder="اكتب رسالة..."
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

      {/* Employee Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>الاسم الكامل *</Label>
              <Input
                value={employeeForm.full_name}
                onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label>رقم واتساب للإشعارات *</Label>
              <Input
                value={employeeForm.whatsapp}
                onChange={(e) => setEmployeeForm({ ...employeeForm, whatsapp: e.target.value })}
                className="mt-1"
                dir="ltr"
                placeholder="+967..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>اسم المستخدم *</Label>
                <Input
                  value={employeeForm.username}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>{editingEmployee ? 'كلمة مرور جديدة' : 'كلمة المرور *'}</Label>
                <Input
                  type="password"
                  value={employeeForm.password_hash}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, password_hash: e.target.value })}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label>الدور</Label>
              <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm({ ...employeeForm, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket_specialist">مختص إصدار التذاكر</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label>إشعارات واتساب</Label>
              <Switch
                checked={employeeForm.notification_enabled}
                onCheckedChange={(v) => setEmployeeForm({ ...employeeForm, notification_enabled: v })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)} className="flex-1">
                إلغاء
              </Button>
              <Button onClick={handleSaveEmployee} className="flex-1">
                {editingEmployee ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Site Dialog */}
      <Dialog open={newSiteDialogOpen} onOpenChange={setNewSiteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موقع بحث</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>اسم الموقع *</Label>
              <Input
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                className="mt-1"
                placeholder="مثل: Booking.com"
              />
            </div>
            <div>
              <Label>رابط الموقع *</Label>
              <Input
                value={newSite.url}
                onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                className="mt-1"
                dir="ltr"
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>رابط الشعار</Label>
              <Input
                value={newSite.logo_url}
                onChange={(e) => setNewSite({ ...newSite, logo_url: e.target.value })}
                className="mt-1"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setNewSiteDialogOpen(false)} className="flex-1">
                إلغاء
              </Button>
              <Button onClick={handleAddSite} className="flex-1">
                إضافة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}