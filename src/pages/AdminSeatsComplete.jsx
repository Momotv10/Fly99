import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Plus, Pencil, Trash2, Search, Plane, ArrowLeft, Users, DollarSign, 
  Calendar, Pause, Play, AlertTriangle, Info, Loader2, FileSpreadsheet
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminSeatsComplete() {
  const navigate = useNavigate();
  const [seats, setSeats] = useState([]);
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAirline, setFilterAirline] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const [formData, setFormData] = useState({
    provider_id: '',
    airline_id: '',
    flight_id: '',
    departure_date: '',
    seat_class: 'economy',
    available_count: 1,
    trip_type: 'round_trip',
    price_outbound: 0,
    price_return: 0,
    system_commission: 0,
    return_policy: 'open',
    return_window_months: 3,
    return_fixed_date: '',
    return_start_date: '',
    allow_one_way_purchase: false,
    one_way_price: 0,
    visa_service_enabled: false,
    visa_price: 0,
    visa_service_name: 'فيزا',
    visa_required_nationalities: [],
    notes: '',
    status: 'active'
  });

  const [filteredFlights, setFilteredFlights] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (formData.airline_id) {
      setFilteredFlights(flights.filter(f => f.airline_id === formData.airline_id && f.is_active !== false));
    } else {
      setFilteredFlights([]);
    }
  }, [formData.airline_id, flights]);

  useEffect(() => {
    if (formData.provider_id) {
      const provider = providers.find(p => p.id === formData.provider_id);
      setSelectedProvider(provider);
      if (provider) {
        setFormData(prev => ({
          ...prev,
          system_commission: provider.commission_value || 0
        }));
      }
    }
  }, [formData.provider_id, providers]);

  const loadData = async () => {
    const [seatsData, flightsData, airlinesData, providersData] = await Promise.all([
      base44.entities.AvailableSeat.list('-created_date'),
      base44.entities.Flight.filter({ is_active: true }),
      base44.entities.Airline.filter({ is_active: true }),
      base44.entities.Provider.filter({ is_active: true })
    ]);
    setSeats(seatsData);
    setFlights(flightsData);
    setAirlines(airlinesData);
    setProviders(providersData);
    setLoading(false);
  };

  const calculatePrices = () => {
    const commission = formData.system_commission || 0;
    const outbound = formData.price_outbound || 0;
    const returnPrice = formData.price_return || 0;
    
    let totalPrice, providerEarning;
    
    if (formData.trip_type === 'one_way') {
      totalPrice = outbound + commission;
      providerEarning = outbound;
    } else {
      totalPrice = outbound + returnPrice + commission;
      providerEarning = outbound + returnPrice;
    }

    const oneWayTotal = formData.allow_one_way_purchase 
      ? (formData.one_way_price || outbound) + commission 
      : 0;

    return { totalPrice, providerEarning, oneWayTotal };
  };

  const handleFlightSelect = (flightId) => {
    const flight = flights.find(f => f.id === flightId);
    if (flight) {
      setFormData({
        ...formData,
        flight_id: flightId,
        flight_number: flight.flight_number,
        departure_airport_id: flight.departure_airport_id,
        departure_airport_code: flight.departure_airport_code,
        departure_airport_name: flight.departure_airport_name,
        departure_city: flight.departure_city,
        departure_country: flight.departure_country,
        arrival_airport_id: flight.arrival_airport_id,
        arrival_airport_code: flight.arrival_airport_code,
        arrival_airport_name: flight.arrival_airport_name,
        arrival_city: flight.arrival_city,
        arrival_country: flight.arrival_country,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const provider = providers.find(p => p.id === formData.provider_id);
    const airline = airlines.find(a => a.id === formData.airline_id);
    const flight = flights.find(f => f.id === formData.flight_id);
    const { totalPrice, providerEarning } = calculatePrices();

    // Generate seat number
    const seatNumber = `S${Date.now().toString().slice(-8)}`;

    const seatData = {
      ...formData,
      seat_number: editingSeat?.seat_number || seatNumber,
      provider_name: provider?.company_name_ar,
      airline_name: airline?.name_ar,
      airline_logo: airline?.logo_url,
      flight_number: flight?.flight_number,
      departure_airport_id: flight?.departure_airport_id,
      departure_airport_code: flight?.departure_airport_code,
      departure_airport_name: flight?.departure_airport_name,
      departure_city: flight?.departure_city,
      departure_country: flight?.departure_country,
      arrival_airport_id: flight?.arrival_airport_id,
      arrival_airport_code: flight?.arrival_airport_code,
      arrival_airport_name: flight?.arrival_airport_name,
      arrival_city: flight?.arrival_city,
      arrival_country: flight?.arrival_country,
      departure_time: flight?.departure_time,
      arrival_time: flight?.arrival_time,
      total_price: totalPrice,
      provider_earning: providerEarning,
      source: 'admin'
    };

    if (editingSeat) {
      await base44.entities.AvailableSeat.update(editingSeat.id, seatData);
      toast.success('تم تحديث المقاعد');
    } else {
      await base44.entities.AvailableSeat.create(seatData);
      toast.success('تم إضافة المقاعد بنجاح');
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (seat) => {
    setEditingSeat(seat);
    setFormData({
      provider_id: seat.provider_id || '',
      airline_id: seat.airline_id || '',
      flight_id: seat.flight_id || '',
      departure_date: seat.departure_date || '',
      seat_class: seat.seat_class || 'economy',
      available_count: seat.available_count || 1,
      trip_type: seat.trip_type || 'round_trip',
      price_outbound: seat.price_outbound || 0,
      price_return: seat.price_return || 0,
      system_commission: seat.system_commission || 0,
      return_policy: seat.return_policy || 'open',
      return_window_months: seat.return_window_months || 3,
      return_fixed_date: seat.return_fixed_date || '',
      return_start_date: seat.return_start_date || '',
      allow_one_way_purchase: seat.allow_one_way_purchase || false,
      one_way_price: seat.one_way_price || 0,
      visa_service_enabled: seat.visa_service_enabled || false,
      visa_price: seat.visa_price || 0,
      visa_service_name: seat.visa_service_name || 'فيزا',
      visa_required_nationalities: seat.visa_required_nationalities || [],
      notes: seat.notes || '',
      status: seat.status || 'active'
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (seat) => {
    const newStatus = seat.status === 'active' ? 'paused' : 'active';
    await base44.entities.AvailableSeat.update(seat.id, { status: newStatus });
    loadData();
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف المقاعد؟')) {
      await base44.entities.AvailableSeat.delete(id);
      toast.success('تم حذف المقاعد');
      loadData();
    }
  };

  const resetForm = () => {
    setEditingSeat(null);
    setSelectedProvider(null);
    setFormData({
      provider_id: '',
      airline_id: '',
      flight_id: '',
      departure_date: '',
      seat_class: 'economy',
      available_count: 1,
      trip_type: 'round_trip',
      price_outbound: 0,
      price_return: 0,
      system_commission: 0,
      return_policy: 'open',
      return_window_months: 3,
      return_fixed_date: '',
      return_start_date: '',
      allow_one_way_purchase: false,
      one_way_price: 0,
      visa_service_enabled: false,
      visa_price: 0,
      visa_service_name: 'فيزا',
      visa_required_nationalities: [],
      notes: '',
      status: 'active'
    });
  };

  const filteredSeats = seats.filter(s => {
    const matchSearch = s.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.departure_city?.includes(searchTerm) ||
      s.arrival_city?.includes(searchTerm) ||
      s.provider_name?.includes(searchTerm) ||
      s.seat_number?.includes(searchTerm);
    const matchAirline = filterAirline === 'all' || s.airline_id === filterAirline;
    const matchProvider = filterProvider === 'all' || s.provider_id === filterProvider;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchDate = !filterDate || s.departure_date === filterDate;
    return matchSearch && matchAirline && matchProvider && matchStatus && matchDate;
  });

  const { totalPrice, providerEarning, oneWayTotal } = calculatePrices();

  const classLabels = {
    economy: 'سياحية',
    business: 'رجال أعمال',
    first: 'درجة أولى'
  };

  const statusConfig = {
    active: { label: 'نشط', color: 'bg-green-100 text-green-700' },
    paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700' },
    sold_out: { label: 'نفذ', color: 'bg-red-100 text-red-700' },
    expired: { label: 'منتهي', color: 'bg-slate-100 text-slate-700' }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              إدارة المقاعد المتاحة
            </h1>
            <p className="text-slate-600">إضافة وإدارة المقاعد المتاحة للحجز</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <FileSpreadsheet className="ml-2 h-4 w-4" />
              إضافة جماعية
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مقاعد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingSeat ? 'تعديل المقاعد' : 'إضافة مقاعد جديدة'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Provider & Airline Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>المزود *</Label>
                      <Select value={formData.provider_id} onValueChange={(v) => setFormData({ ...formData, provider_id: v })} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر المزود" />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.company_name_ar}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>شركة الطيران *</Label>
                      <Select value={formData.airline_id} onValueChange={(v) => setFormData({ ...formData, airline_id: v, flight_id: '' })} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر الشركة" />
                        </SelectTrigger>
                        <SelectContent>
                          {airlines.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name_ar} ({a.iata_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Flight Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الرحلة *</Label>
                      <Select value={formData.flight_id} onValueChange={handleFlightSelect} required disabled={!formData.airline_id}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر الرحلة" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredFlights.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.flight_number} - {f.departure_city} ← {f.arrival_city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>تاريخ المغادرة *</Label>
                      <Input
                        type="date"
                        value={formData.departure_date}
                        onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>

                  {/* Class & Count */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>درجة المقعد *</Label>
                      <Select value={formData.seat_class} onValueChange={(v) => setFormData({ ...formData, seat_class: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="economy">سياحية (Economy)</SelectItem>
                          <SelectItem value="business">رجال أعمال (Business)</SelectItem>
                          <SelectItem value="first">درجة أولى (First)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>عدد المقاعد المتاحة *</Label>
                      <Input
                        type="number"
                        value={formData.available_count}
                        onChange={(e) => setFormData({ ...formData, available_count: Number(e.target.value) })}
                        min="1"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Trip Type */}
                  <div>
                    <Label className="mb-3 block">نوع الرحلة *</Label>
                    <Tabs value={formData.trip_type} onValueChange={(v) => setFormData({ ...formData, trip_type: v })}>
                      <TabsList>
                        <TabsTrigger value="one_way">ذهاب فقط (One Way)</TabsTrigger>
                        <TabsTrigger value="round_trip">ذهاب وعودة (Round Trip)</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Pricing */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4 space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        التسعير
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>سعر الذهاب *</Label>
                          <Input
                            type="number"
                            value={formData.price_outbound}
                            onChange={(e) => setFormData({ ...formData, price_outbound: Number(e.target.value) })}
                            min="0"
                            className="mt-1"
                            required
                          />
                        </div>
                        {formData.trip_type === 'round_trip' && (
                          <div>
                            <Label>سعر العودة *</Label>
                            <Input
                              type="number"
                              value={formData.price_return}
                              onChange={(e) => setFormData({ ...formData, price_return: Number(e.target.value) })}
                              min="0"
                              className="mt-1"
                            />
                          </div>
                        )}
                        <div>
                          <Label>عمولة النظام</Label>
                          <Input
                            type="number"
                            value={formData.system_commission}
                            className="mt-1 bg-slate-100"
                            disabled
                          />
                          {selectedProvider && (
                            <p className="text-xs text-slate-500 mt-1">
                              حسب إعدادات المزود: ${selectedProvider.commission_value}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-lg border">
                        <div className="flex justify-between text-sm">
                          <span>السعر الإجمالي للعميل:</span>
                          <span className="font-bold text-green-600">${totalPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span>أرباح المزود:</span>
                          <span className="font-bold text-blue-600">${providerEarning}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span>عمولة النظام:</span>
                          <span className="font-bold text-purple-600">${formData.system_commission}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Return Policy */}
                  {formData.trip_type === 'round_trip' && (
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          سياسة العودة
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>نوع العودة</Label>
                            <Select value={formData.return_policy} onValueChange={(v) => setFormData({ ...formData, return_policy: v })}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">مفتوح (يحدد العميل)</SelectItem>
                                <SelectItem value="flexible">مرن (خلال فترة)</SelectItem>
                                <SelectItem value="fixed">محدد (تاريخ ثابت)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {formData.return_policy === 'flexible' && (
                            <div>
                              <Label>المدة بالأشهر</Label>
                              <Input
                                type="number"
                                value={formData.return_window_months}
                                onChange={(e) => setFormData({ ...formData, return_window_months: Number(e.target.value) })}
                                min="1"
                                max="12"
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {formData.return_policy === 'fixed' && (
                            <div>
                              <Label>تاريخ العودة</Label>
                              <Input
                                type="date"
                                value={formData.return_fixed_date}
                                onChange={(e) => setFormData({ ...formData, return_fixed_date: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>تاريخ بداية إتاحة العودة (اختياري)</Label>
                          <Input
                            type="date"
                            value={formData.return_start_date}
                            onChange={(e) => setFormData({ ...formData, return_start_date: e.target.value })}
                            className="mt-1"
                          />
                        </div>

                        {/* One Way Option */}
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={formData.allow_one_way_purchase}
                                onCheckedChange={(v) => setFormData({ ...formData, allow_one_way_purchase: v })}
                              />
                              <Label>السماح بشراء ذهاب فقط</Label>
                            </div>
                            {formData.allow_one_way_purchase && (
                              <div className="flex items-center gap-2">
                                <Label className="text-sm">السعر:</Label>
                                <Input
                                  type="number"
                                  value={formData.one_way_price}
                                  onChange={(e) => setFormData({ ...formData, one_way_price: Number(e.target.value) })}
                                  className="w-24"
                                  min="0"
                                />
                              </div>
                            )}
                          </div>
                          {formData.allow_one_way_purchase && (
                            <p className="text-xs text-slate-500 mt-2">
                              السعر للعميل (ذهاب فقط): ${oneWayTotal}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Visa Service */}
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          خدمة الفيزا / التصريح الأمني
                        </h4>
                        <Switch
                          checked={formData.visa_service_enabled}
                          onCheckedChange={(v) => setFormData({ ...formData, visa_service_enabled: v })}
                        />
                      </div>

                      {formData.visa_service_enabled && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>اسم الخدمة</Label>
                              <Input
                                value={formData.visa_service_name}
                                onChange={(e) => setFormData({ ...formData, visa_service_name: e.target.value })}
                                placeholder="فيزا / تصريح أمني"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>سعر الخدمة</Label>
                              <Input
                                type="number"
                                value={formData.visa_price}
                                onChange={(e) => setFormData({ ...formData, visa_price: Number(e.target.value) })}
                                min="0"
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              يمكنك تحديد الجنسيات والفئات العمرية التي تحتاج للفيزا عند الحجز
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  <div>
                    <Label>ملاحظات</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="ملاحظات إضافية..."
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingSeat ? 'تحديث' : 'إضافة'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterAirline} onValueChange={setFilterAirline}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الشركة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الشركات</SelectItem>
                  {airlines.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="المزود" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المزودين</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.company_name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="paused">متوقف</SelectItem>
                  <SelectItem value="sold_out">نفذ</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-40"
                placeholder="التاريخ"
              />
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {filteredSeats.length} سجل
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Seats Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم المقعد</TableHead>
                  <TableHead>المزود</TableHead>
                  <TableHead>الرحلة</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الدرجة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المقاعد</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSeats.map((seat) => {
                  const remaining = (seat.available_count || 0) - (seat.booked_count || 0);
                  return (
                    <TableRow key={seat.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{seat.seat_number}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{seat.provider_name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {seat.airline_logo && <img src={seat.airline_logo} alt="" className="h-5 w-5 object-contain" />}
                          <Badge variant="outline" className="font-mono">{seat.flight_number}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{seat.departure_airport_code}</span>
                          <ArrowLeft className="h-3 w-3 text-slate-400" />
                          <span>{seat.arrival_airport_code}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {seat.departure_city} ← {seat.arrival_city}
                        </div>
                      </TableCell>
                      <TableCell>
                        {seat.departure_date && format(new Date(seat.departure_date), 'dd MMM yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{classLabels[seat.seat_class]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={seat.trip_type === 'round_trip' ? 'default' : 'outline'} className="text-xs">
                          {seat.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span className={remaining <= 3 ? 'text-red-600 font-bold' : ''}>
                            {remaining}
                          </span>
                          <span className="text-slate-400">/ {seat.available_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">${seat.total_price}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[seat.status]?.color}>
                          {statusConfig[seat.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(seat)}>
                            {seat.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(seat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(seat.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredSeats.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد مقاعد</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}