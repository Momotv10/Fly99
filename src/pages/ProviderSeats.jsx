import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Pencil, Pause, Play, Trash2, Plane, Calendar, DollarSign, 
  Search, AlertTriangle, CheckCircle2, Target, Loader2, Eye
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { format, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from "sonner";
import { autoFlightPairing } from '@/components/provider/AutoFlightPairing';

export default function ProviderSeats() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [seats, setSeats] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [flights, setFlights] = useState([]);
  const [suggestedFlights, setSuggestedFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    airline_id: '',
    flight_id: '',
    departure_date: '',
    departure_time: '',
    arrival_time: '',
    seat_class: 'economy',
    available_count: 5,
    trip_type: 'round_trip',
    // السعر الإجمالي للتذكرة (ذهاب + إياب أو ذهاب فقط)
    round_trip_price: 0,
    one_way_base_price: 0,
    // السماح ببيع "ذهاب فقط" من تذكرة ذهاب وعودة
    allow_one_way_purchase: false,
    one_way_price: 0,
    return_policy: 'open',
    return_window_months: 12,
    return_fixed_date: '',
    return_start_date: ''
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
    const [providerData, seatsData, allFlights] = await Promise.all([
      base44.entities.Provider.filter({ id: providerId }),
      base44.entities.AvailableSeat.filter({ provider_id: providerId }, '-created_date'),
      base44.entities.Flight.filter({ is_active: true })
    ]);
    
    if (providerData.length > 0) {
      setProvider(providerData[0]);
      
      // جلب شركات الطيران المصرح بها
      const authorizedAirlines = providerData[0].authorized_airlines || [];
      if (authorizedAirlines.length > 0) {
        const airlinesData = await base44.entities.Airline.filter({ 
          id: { $in: authorizedAirlines },
          is_active: true 
        });
        setAirlines(airlinesData);
        
        // فلترة الرحلات حسب شركات الطيران المصرح بها
        const authorizedFlights = allFlights.filter(f => authorizedAirlines.includes(f.airline_id));
        setFlights(authorizedFlights);
        
        // الرحلات المقترحة (التي لم يضف لها مقاعد)
        const existingSeatFlightIds = seatsData.map(s => s.flight_id);
        const suggested = authorizedFlights.filter(f => !existingSeatFlightIds.includes(f.id));
        setSuggestedFlights(suggested);
      }
    }
    
    setSeats(seatsData);
    setLoading(false);
  };

  const loadFlights = async (airlineId) => {
    const flightsData = flights.filter(f => f.airline_id === airlineId);
    return flightsData;
  };

  const handleAirlineChange = async (airlineId) => {
    const airlineFlights = flights.filter(f => f.airline_id === airlineId);
    setFormData({ ...formData, airline_id: airlineId, flight_id: '' });
  };

  const handleFlightChange = async (flightId) => {
    const flight = flights.find(f => f.id === flightId);
    if (flight) {
      const airline = airlines.find(a => a.id === flight.airline_id);
      setFormData({
        ...formData,
        flight_id: flightId,
        flight_number: flight.flight_number,
        airline_name: airline?.name_ar,
        airline_logo: airline?.logo_url,
        departure_airport_code: flight.departure_airport_code,
        departure_city: flight.departure_city,
        arrival_airport_code: flight.arrival_airport_code,
        arrival_city: flight.arrival_city,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time
      });
    }
  };

  const calculateTotal = () => {
    // السعر الأساسي حسب نوع الرحلة
    const base = formData.trip_type === 'one_way' 
      ? parseFloat(formData.one_way_base_price || 0)
      : parseFloat(formData.round_trip_price || 0);
    
    const commission = provider?.commission_value || 0;
    const total = base + commission;
    const providerEarning = base;
    
    // حساب سعر الذهاب فقط إذا كان مسموحاً
    let oneWayTotal = 0;
    if (formData.trip_type === 'round_trip' && formData.allow_one_way_purchase) {
      oneWayTotal = parseFloat(formData.one_way_price || 0) + commission;
    }
    
    return { total, commission, providerEarning, oneWayTotal };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    if (!provider) return;
    
    const { total, commission, providerEarning, oneWayTotal } = calculateTotal();
    
    // جلب معرف الرحلة الأصلي ورحلة العودة إن وجدت
    const selectedFlight = flights.find(f => f.id === formData.flight_id);
    const returnFlight = selectedFlight?.return_flight_id ? 
      flights.find(f => f.id === selectedFlight.return_flight_id) : null;

    // إنشاء رقم مقعد فريد
    const seatNumber = `S${Date.now().toString().slice(-8)}`;
    
    const seatData = {
      seat_number: seatNumber,
      provider_id: provider.id,
      provider_name: provider.company_name_ar,
      airline_id: formData.airline_id,
      airline_name: formData.airline_name,
      airline_logo: formData.airline_logo,
      flight_id: formData.flight_id,
      flight_number: formData.flight_number,
      departure_airport_id: selectedFlight?.departure_airport_id,
      departure_airport_code: formData.departure_airport_code,
      departure_airport_name: selectedFlight?.departure_airport_name,
      departure_city: formData.departure_city,
      departure_country: selectedFlight?.departure_country,
      arrival_airport_id: selectedFlight?.arrival_airport_id,
      arrival_airport_code: formData.arrival_airport_code,
      arrival_airport_name: selectedFlight?.arrival_airport_name,
      arrival_city: formData.arrival_city,
      arrival_country: selectedFlight?.arrival_country,
      departure_date: formData.departure_date,
      departure_time: formData.departure_time,
      arrival_time: formData.arrival_time,
      seat_class: formData.seat_class,
      available_count: formData.available_count,
      booked_count: editingSeat?.booked_count || 0,
      trip_type: formData.trip_type,
      // الأسعار الجديدة
      round_trip_price: formData.trip_type === 'round_trip' ? formData.round_trip_price : 0,
      one_way_base_price: formData.trip_type === 'one_way' ? formData.one_way_base_price : 0,
      allow_one_way_purchase: formData.trip_type === 'round_trip' ? (formData.allow_one_way_purchase || false) : false,
      one_way_price: formData.trip_type === 'round_trip' ? (formData.one_way_price || 0) : 0,
      system_commission: commission,
      total_price: total,
      provider_earning: providerEarning,
      return_policy: formData.return_policy,
      return_window_months: formData.return_window_months,
      return_fixed_date: formData.return_fixed_date,
      return_start_date: formData.return_start_date,
      return_flight_id: returnFlight?.id || selectedFlight?.return_flight_id,
      return_flight_number: returnFlight?.flight_number || selectedFlight?.return_flight_number,
      status: 'active',
      source: 'provider'
    };
    
    try {
      if (editingSeat) {
        await base44.entities.AvailableSeat.update(editingSeat.id, seatData);
        toast.success('تم تحديث المقاعد');
      } else {
        await base44.entities.AvailableSeat.create(seatData);
        toast.success('تم إضافة المقاعد بنجاح! ستظهر للعملاء الآن');
        
        // البحث التلقائي عن رحلات قابلة للربط
        if (formData.flight_id && formData.trip_type === 'round_trip') {
          await autoFlightPairing.findAndCreatePairs(formData.flight_id);
        }
      }
      
      setDialogOpen(false);
      resetForm();
      loadData(provider.id);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
    
    setSaving(false);
  };

  const handleToggleStatus = async (seat) => {
    await base44.entities.AvailableSeat.update(seat.id, {
      status: seat.status === 'active' ? 'paused' : 'active'
    });
    toast.success(seat.status === 'active' ? 'تم إيقاف المقاعد' : 'تم تفعيل المقاعد');
    loadData(provider.id);
  };

  const handleEdit = (seat) => {
    setEditingSeat(seat);
    setFormData({
      airline_id: seat.airline_id || '',
      flight_id: seat.flight_id || '',
      flight_number: seat.flight_number,
      airline_name: seat.airline_name,
      airline_logo: seat.airline_logo,
      departure_airport_code: seat.departure_airport_code,
      departure_city: seat.departure_city,
      arrival_airport_code: seat.arrival_airport_code,
      arrival_city: seat.arrival_city,
      departure_date: seat.departure_date || '',
      departure_time: seat.departure_time || '',
      arrival_time: seat.arrival_time || '',
      seat_class: seat.seat_class || 'economy',
      available_count: seat.available_count || 5,
      trip_type: seat.trip_type || 'round_trip',
      round_trip_price: seat.round_trip_price || 0,
      one_way_base_price: seat.one_way_base_price || 0,
      allow_one_way_purchase: seat.allow_one_way_purchase || false,
      one_way_price: seat.one_way_price || 0,
      return_policy: seat.return_policy || 'open',
      return_window_months: seat.return_window_months || 12,
      return_fixed_date: seat.return_fixed_date || '',
      return_start_date: seat.return_start_date || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (seatId) => {
    if (confirm('هل أنت متأكد من حذف المقاعد؟')) {
      await base44.entities.AvailableSeat.delete(seatId);
      toast.success('تم حذف المقاعد');
      loadData(provider.id);
    }
  };

  const resetForm = () => {
    setEditingSeat(null);
    setFormData({
      airline_id: '',
      flight_id: '',
      departure_date: '',
      departure_time: '',
      arrival_time: '',
      seat_class: 'economy',
      available_count: 5,
      trip_type: 'round_trip',
      round_trip_price: 0,
      one_way_base_price: 0,
      allow_one_way_purchase: false,
      one_way_price: 0,
      return_policy: 'open',
      return_window_months: 12,
      return_fixed_date: '',
      return_start_date: ''
    });
  };

  const { total, commission, providerEarning, oneWayTotal } = calculateTotal();

  const filteredSeats = seats.filter(s => 
    s.flight_number?.includes(searchTerm) ||
    s.departure_city?.includes(searchTerm) ||
    s.arrival_city?.includes(searchTerm)
  );

  const activeSeats = filteredSeats.filter(s => s.status === 'active');
  const pausedSeats = filteredSeats.filter(s => s.status === 'paused');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ProviderSidebar provider={provider} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Plane className="h-6 w-6" />
              إدارة المقاعد
            </h1>
            <p className="text-slate-600">إضافة وتعديل المقاعد المتاحة للحجز</p>
          </div>
          <Button 
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="ml-2 h-4 w-4" />
            إضافة مقاعد جديدة
          </Button>
        </div>

        {/* الرحلات المقترحة */}
        {suggestedFlights.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <Target className="h-5 w-5" />
                رحلات مقترحة لإضافة مقاعد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestedFlights.slice(0, 6).map((flight) => {
                  const airline = airlines.find(a => a.id === flight.airline_id);
                  return (
                    <div 
                      key={flight.id}
                      className="p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
                      onClick={() => {
                        handleAirlineChange(flight.airline_id);
                        setTimeout(() => handleFlightChange(flight.id), 100);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {airline?.logo_url && (
                          <img src={airline.logo_url} alt="" className="h-8 w-8" />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold">{flight.flight_number}</p>
                          <p className="text-xs text-slate-500">
                            {flight.departure_city} → {flight.arrival_city}
                          </p>
                        </div>
                        <Plus className="h-5 w-5 text-amber-600" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* البحث والتبويبات */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن رحلة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-100 text-green-700">
                  {activeSeats.length} نشط
                </Badge>
                <Badge className="bg-slate-100 text-slate-700">
                  {pausedSeats.length} متوقف
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active">
              <TabsList className="mb-4">
                <TabsTrigger value="active">المقاعد النشطة ({activeSeats.length})</TabsTrigger>
                <TabsTrigger value="paused">المتوقفة ({pausedSeats.length})</TabsTrigger>
                <TabsTrigger value="all">الكل ({filteredSeats.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                <SeatsTable 
                  seats={activeSeats} 
                  airlines={airlines}
                  onEdit={handleEdit}
                  onToggle={handleToggleStatus}
                  onDelete={handleDelete}
                />
              </TabsContent>
              
              <TabsContent value="paused">
                <SeatsTable 
                  seats={pausedSeats} 
                  airlines={airlines}
                  onEdit={handleEdit}
                  onToggle={handleToggleStatus}
                  onDelete={handleDelete}
                />
              </TabsContent>
              
              <TabsContent value="all">
                <SeatsTable 
                  seats={filteredSeats} 
                  airlines={airlines}
                  onEdit={handleEdit}
                  onToggle={handleToggleStatus}
                  onDelete={handleDelete}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* نافذة إضافة/تعديل المقاعد */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSeat ? 'تعديل المقاعد' : 'إضافة مقاعد جديدة'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* اختيار الشركة والرحلة */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 border-b pb-2">معلومات الرحلة</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>شركة الطيران *</Label>
                    <Select value={formData.airline_id} onValueChange={handleAirlineChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="اختر الشركة" />
                      </SelectTrigger>
                      <SelectContent>
                        {airlines.map((airline) => (
                          <SelectItem key={airline.id} value={airline.id}>
                            <div className="flex items-center gap-2">
                              {airline.logo_url && <img src={airline.logo_url} alt="" className="h-5 w-5" />}
                              {airline.name_ar}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>الرحلة *</Label>
                    <Select 
                      value={formData.flight_id} 
                      onValueChange={handleFlightChange}
                      disabled={!formData.airline_id}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="اختر الرحلة" />
                      </SelectTrigger>
                      <SelectContent>
                        {flights.filter(f => f.airline_id === formData.airline_id).map((flight) => (
                          <SelectItem key={flight.id} value={flight.id}>
                            {flight.flight_number} - {flight.departure_city} → {flight.arrival_city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.flight_id && (
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      {formData.airline_logo && <img src={formData.airline_logo} alt="" className="h-10 w-10" />}
                      <div>
                        <p className="font-bold text-lg">{formData.flight_number}</p>
                        <p className="text-slate-600">{formData.departure_city} ← {formData.arrival_city}</p>
                        <p className="text-sm text-slate-500">{formData.departure_time} - {formData.arrival_time}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* تفاصيل المقاعد */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 border-b pb-2">تفاصيل المقاعد</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>تاريخ المغادرة *</Label>
                    <Input
                      type="date"
                      value={formData.departure_date}
                      onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label>درجة المقعد *</Label>
                    <Select value={formData.seat_class} onValueChange={(v) => setFormData({ ...formData, seat_class: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">اقتصادي - Economy</SelectItem>
                        <SelectItem value="business">بيزنس - Business</SelectItem>
                        <SelectItem value="first">أولى - First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>عدد المقاعد *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.available_count}
                      onChange={(e) => setFormData({ ...formData, available_count: parseInt(e.target.value) })}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>نوع الرحلة *</Label>
                  <Select value={formData.trip_type} onValueChange={(v) => setFormData({ ...formData, trip_type: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_way">ذهاب فقط</SelectItem>
                      <SelectItem value="round_trip">ذهاب وعودة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* الأسعار - نظام تسعير شركات الطيران الحقيقية */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 border-b pb-2">التسعير</h3>
                
                {/* تذكرة ذهاب فقط */}
                {formData.trip_type === 'one_way' && (
                  <div>
                    <Label>سعر التذكرة (ذهاب فقط) *</Label>
                    <p className="text-xs text-slate-500 mb-2">السعر الإجمالي الذي سيدفعه العميل (بدون العمولة)</p>
                    <div className="relative mt-1">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="number"
                        min="0"
                        value={formData.one_way_base_price}
                        onChange={(e) => setFormData({ ...formData, one_way_base_price: parseFloat(e.target.value) || 0 })}
                        required
                        className="pr-10"
                        placeholder="مثال: 350"
                      />
                    </div>
                  </div>
                )}

                {/* تذكرة ذهاب وعودة */}
                {formData.trip_type === 'round_trip' && (
                  <>
                    <div>
                      <Label>السعر الإجمالي للتذكرة (ذهاب + إياب) *</Label>
                      <p className="text-xs text-slate-500 mb-2">سعر التذكرة الكاملة كما تبيعها شركة الطيران (بدون العمولة)</p>
                      <div className="relative mt-1">
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          min="0"
                          value={formData.round_trip_price}
                          onChange={(e) => setFormData({ ...formData, round_trip_price: parseFloat(e.target.value) || 0 })}
                          required
                          className="pr-10"
                          placeholder="مثال: 500"
                        />
                      </div>
                    </div>

                    {/* خيار بيع ذهاب فقط من تذكرة ذهاب وعودة */}
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Label className="text-amber-900">السماح ببيع "ذهاب فقط"؟</Label>
                          <p className="text-xs text-amber-700">هل تسمح للعميل بشراء الذهاب فقط من هذه التذكرة؟</p>
                        </div>
                        <Switch
                          checked={formData.allow_one_way_purchase}
                          onCheckedChange={(checked) => setFormData({ ...formData, allow_one_way_purchase: checked })}
                        />
                      </div>
                      
                      {formData.allow_one_way_purchase && (
                        <div className="mt-3 pt-3 border-t border-amber-200">
                          <Label>سعر "الذهاب فقط" *</Label>
                          <p className="text-xs text-amber-700 mb-2">عادةً يكون أعلى من نصف سعر الذهاب والعودة</p>
                          <div className="relative mt-1">
                            <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                            <Input
                              type="number"
                              min="0"
                              value={formData.one_way_price}
                              onChange={(e) => setFormData({ ...formData, one_way_price: parseFloat(e.target.value) || 0 })}
                              required
                              className="pr-10 border-amber-300"
                              placeholder="مثال: 360"
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            💡 مثال: إذا كانت التذكرة ذهاب+عودة = 500$، يمكن أن يكون سعر الذهاب فقط = 360$
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ملخص الأسعار */}
                <div className="p-4 bg-green-50 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">سعرك (أرباحك):</span>
                    <span className="font-semibold">${providerEarning}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">عمولة النظام:</span>
                    <span className="font-semibold text-blue-600">+${commission}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">السعر للعميل {formData.trip_type === 'round_trip' ? '(ذهاب + إياب)' : '(ذهاب فقط)'}:</span>
                    <span className="text-xl font-bold text-green-600">${total}</span>
                  </div>
                  {formData.trip_type === 'round_trip' && formData.allow_one_way_purchase && formData.one_way_price > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                      <span className="text-amber-700">سعر الذهاب فقط للعميل:</span>
                      <span className="font-semibold text-amber-600">${(formData.one_way_price + commission)}</span>
                    </div>
                  )}
                </div>

                {/* معلومة توضيحية */}
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <p className="font-semibold mb-1">💡 كيف يعمل التسعير؟</p>
                  <ul className="text-xs space-y-1 text-blue-700">
                    <li>• العميل يرى سعراً واحداً فقط (السعر الإجمالي)</li>
                    <li>• إذا بحث عن "ذهاب وعودة" → يرى ${total}</li>
                    {formData.allow_one_way_purchase && (
                      <li>• إذا بحث عن "ذهاب فقط" → يرى ${(formData.one_way_price + commission)}</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* سياسة العودة */}
              {formData.trip_type === 'round_trip' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">سياسة العودة</h3>
                  
                  <Select value={formData.return_policy} onValueChange={(v) => setFormData({ ...formData, return_policy: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">مفتوح - يختار العميل أي تاريخ</SelectItem>
                      <SelectItem value="flexible">مرن - خلال فترة محددة</SelectItem>
                      <SelectItem value="fixed">ثابت - تاريخ محدد</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.return_policy === 'flexible' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>صلاحية العودة (بالأشهر)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={formData.return_window_months}
                          onChange={(e) => setFormData({ ...formData, return_window_months: parseInt(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>تاريخ بداية إتاحة العودة</Label>
                        <Input
                          type="date"
                          value={formData.return_start_date}
                          onChange={(e) => setFormData({ ...formData, return_start_date: e.target.value })}
                          min={formData.departure_date}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {formData.return_policy === 'fixed' && (
                    <div>
                      <Label>تاريخ العودة الثابت</Label>
                      <Input
                        type="date"
                        value={formData.return_fixed_date}
                        onChange={(e) => setFormData({ ...formData, return_fixed_date: e.target.value })}
                        min={formData.departure_date}
                        required
                        className="mt-1"
                      />
                    </div>
                  )}

                  {(formData.return_policy === 'open' || formData.return_policy === 'flexible') && (
                    <div>
                      <Label>تاريخ بداية إتاحة العودة (اختياري)</Label>
                      <Input
                        type="date"
                        value={formData.return_start_date}
                        onChange={(e) => setFormData({ ...formData, return_start_date: e.target.value })}
                        min={formData.departure_date}
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">التاريخ الذي يمكن للعميل حجز العودة بعده</p>
                    </div>
                  )}
                </div>
              )}

              {/* أزرار الحفظ */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    editingSeat ? 'تحديث المقاعد' : 'إضافة المقاعد'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// مكون جدول المقاعد
function SeatsTable({ seats, airlines, onEdit, onToggle, onDelete }) {
  if (seats.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>لا توجد مقاعد</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرحلة</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>الدرجة</TableHead>
            <TableHead>المقاعد</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seats.map((seat) => (
            <TableRow key={seat.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {seat.airline_logo && (
                    <img src={seat.airline_logo} alt="" className="h-6 w-6" />
                  )}
                  <div>
                    <p className="font-semibold">{seat.flight_number}</p>
                    <p className="text-xs text-slate-500">
                      {seat.departure_city} → {seat.arrival_city}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p>{seat.departure_date}</p>
                  <p className="text-xs text-slate-500">{seat.departure_time}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {seat.seat_class === 'economy' ? 'اقتصادي' : seat.seat_class === 'business' ? 'بيزنس' : 'أولى'}
                </Badge>
              </TableCell>
              <TableCell>
                <div>
                  <span className="font-semibold text-green-600">{seat.available_count - (seat.booked_count || 0)}</span>
                  <span className="text-slate-500">/{seat.available_count}</span>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-semibold text-green-600">${seat.total_price}</p>
                  <p className="text-xs text-slate-500">أرباحك: ${seat.provider_earning}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={seat.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                  {seat.status === 'active' ? 'نشط' : 'متوقف'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onToggle(seat)}>
                    {seat.status === 'active' ? (
                      <Pause className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Play className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(seat)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(seat.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}