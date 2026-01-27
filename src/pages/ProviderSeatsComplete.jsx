import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Plus, Pencil, Trash2, Search, Plane, ArrowLeft, Users, DollarSign, 
  Calendar, Pause, Play, AlertTriangle, Info, Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function ProviderSeatsComplete() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [seats, setSeats] = useState([]);
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    airline_id: '',
    flight_id: '',
    departure_date: '',
    seat_class: 'economy',
    available_count: 1,
    trip_type: 'round_trip',
    price_outbound: 0,
    price_return: 0,
    return_policy: 'open',
    return_window_months: 3,
    return_fixed_date: '',
    return_start_date: '',
    allow_one_way_purchase: false,
    one_way_price: 0,
    visa_service_enabled: false,
    visa_price: 0,
    visa_service_name: 'فيزا',
    notes: '',
    status: 'active'
  });

  const [filteredFlights, setFilteredFlights] = useState([]);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=provider');
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'provider') {
      navigate(createPageUrl('SystemLogin') + '?type=provider');
      return;
    }
    
    loadData(user.related_entity_id);
  }, []);

  useEffect(() => {
    if (formData.airline_id) {
      setFilteredFlights(flights.filter(f => f.airline_id === formData.airline_id && f.is_active !== false));
    } else {
      setFilteredFlights([]);
    }
  }, [formData.airline_id, flights]);

  const loadData = async (providerId) => {
    const [providerData, seatsData, flightsData, airlinesData] = await Promise.all([
      base44.entities.Provider.filter({ id: providerId }),
      base44.entities.AvailableSeat.filter({ provider_id: providerId }),
      base44.entities.Flight.filter({ is_active: true }),
      base44.entities.Airline.filter({ is_active: true })
    ]);
    
    if (providerData.length > 0) {
      setProvider(providerData[0]);
      // Filter airlines by authorized airlines
      const authorizedAirlines = providerData[0].authorized_airlines || [];
      setAirlines(airlinesData.filter(a => authorizedAirlines.includes(a.id)));
    }
    
    setSeats(seatsData);
    setFlights(flightsData);
    setLoading(false);
  };

  const calculatePrices = () => {
    const commission = provider?.commission_value || 0;
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

    return { totalPrice, providerEarning, oneWayTotal, commission };
  };

  const handleFlightSelect = (flightId) => {
    const flight = flights.find(f => f.id === flightId);
    if (flight) {
      setFormData({
        ...formData,
        flight_id: flightId
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const airline = airlines.find(a => a.id === formData.airline_id);
    const flight = flights.find(f => f.id === formData.flight_id);
    const { totalPrice, providerEarning, commission } = calculatePrices();

    const seatNumber = `S${Date.now().toString().slice(-8)}`;

    const seatData = {
      ...formData,
      seat_number: editingSeat?.seat_number || seatNumber,
      provider_id: provider.id,
      provider_name: provider.company_name_ar,
      airline_id: formData.airline_id,
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
      system_commission: commission,
      total_price: totalPrice,
      provider_earning: providerEarning,
      source: 'provider'
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
    loadData(provider.id);
  };

  const handleEdit = (seat) => {
    setEditingSeat(seat);
    setFormData({
      airline_id: seat.airline_id || '',
      flight_id: seat.flight_id || '',
      departure_date: seat.departure_date || '',
      seat_class: seat.seat_class || 'economy',
      available_count: seat.available_count || 1,
      trip_type: seat.trip_type || 'round_trip',
      price_outbound: seat.price_outbound || 0,
      price_return: seat.price_return || 0,
      return_policy: seat.return_policy || 'open',
      return_window_months: seat.return_window_months || 3,
      return_fixed_date: seat.return_fixed_date || '',
      return_start_date: seat.return_start_date || '',
      allow_one_way_purchase: seat.allow_one_way_purchase || false,
      one_way_price: seat.one_way_price || 0,
      visa_service_enabled: seat.visa_service_enabled || false,
      visa_price: seat.visa_price || 0,
      visa_service_name: seat.visa_service_name || 'فيزا',
      notes: seat.notes || '',
      status: seat.status || 'active'
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (seat) => {
    const newStatus = seat.status === 'active' ? 'paused' : 'active';
    await base44.entities.AvailableSeat.update(seat.id, { status: newStatus });
    loadData(provider.id);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف المقاعد؟')) {
      await base44.entities.AvailableSeat.delete(id);
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
      seat_class: 'economy',
      available_count: 1,
      trip_type: 'round_trip',
      price_outbound: 0,
      price_return: 0,
      return_policy: 'open',
      return_window_months: 3,
      return_fixed_date: '',
      return_start_date: '',
      allow_one_way_purchase: false,
      one_way_price: 0,
      visa_service_enabled: false,
      visa_price: 0,
      visa_service_name: 'فيزا',
      notes: '',
      status: 'active'
    });
  };

  const filteredSeats = seats.filter(s => {
    const matchSearch = s.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.departure_city?.includes(searchTerm) ||
      s.arrival_city?.includes(searchTerm);
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const { totalPrice, providerEarning, oneWayTotal, commission } = calculatePrices();

  const classLabels = {
    economy: 'سياحية',
    business: 'رجال أعمال',
    first: 'درجة أولى'
  };

  const statusConfig = {
    active: { label: 'نشط', color: 'bg-green-100 text-green-700' },
    paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700' },
    sold_out: { label: 'نفذ', color: 'bg-red-100 text-red-700' }
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
      <ProviderSidebar provider={provider} />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              المقاعد المتاحة
            </h1>
            <p className="text-slate-600">إدارة المقاعد المتاحة للحجز</p>
          </div>
          
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
                {/* Airline & Flight Selection */}
                <div className="grid grid-cols-2 gap-4">
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
                    {airlines.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">لم يتم تفويضك بأي شركة طيران بعد</p>
                    )}
                  </div>
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
                </div>

                {/* Date & Class */}
                <div className="grid grid-cols-3 gap-4">
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
                  <div>
                    <Label>درجة المقعد *</Label>
                    <Select value={formData.seat_class} onValueChange={(v) => setFormData({ ...formData, seat_class: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">سياحية</SelectItem>
                        <SelectItem value="business">رجال أعمال</SelectItem>
                        <SelectItem value="first">درجة أولى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>عدد المقاعد *</Label>
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
                      <TabsTrigger value="one_way">ذهاب فقط</TabsTrigger>
                      <TabsTrigger value="round_trip">ذهاب وعودة</TabsTrigger>
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
                          value={commission}
                          className="mt-1 bg-slate-100"
                          disabled
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex justify-between text-sm">
                        <span>السعر الإجمالي للعميل:</span>
                        <span className="font-bold text-green-600">${totalPrice}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span>أرباحك:</span>
                        <span className="font-bold text-blue-600">${providerEarning}</span>
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
                              <SelectItem value="open">مفتوح</SelectItem>
                              <SelectItem value="flexible">مرن (خلال فترة)</SelectItem>
                              <SelectItem value="fixed">محدد</SelectItem>
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
                        خدمة الفيزا / التصريح
                      </h4>
                      <Switch
                        checked={formData.visa_service_enabled}
                        onCheckedChange={(v) => setFormData({ ...formData, visa_service_enabled: v })}
                      />
                    </div>

                    {formData.visa_service_enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>اسم الخدمة</Label>
                          <Input
                            value={formData.visa_service_name}
                            onChange={(e) => setFormData({ ...formData, visa_service_name: e.target.value })}
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
                    )}
                  </CardContent>
                </Card>

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
              <Badge variant="secondary" className="text-lg px-4 py-2">{filteredSeats.length} مقعد</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Seats Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرحلة</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الدرجة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المقاعد</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>أرباحك</TableHead>
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
                      </TableCell>
                      <TableCell>
                        {seat.departure_date && format(new Date(seat.departure_date), 'dd MMM', { locale: ar })}
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
                        <span className={remaining <= 3 ? 'text-red-600 font-bold' : ''}>
                          {remaining} / {seat.available_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">${seat.total_price}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-blue-600">${seat.provider_earning}</span>
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
                <p className="text-sm">أضف مقاعد جديدة للبدء</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}