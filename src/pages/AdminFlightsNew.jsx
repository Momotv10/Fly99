import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Search, Plane, Upload, Sparkles, Loader2, FileImage, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

const DAYS_OF_WEEK = [
  { value: 0, label: 'الأحد', short: 'أحد' },
  { value: 1, label: 'الاثنين', short: 'اثن' },
  { value: 2, label: 'الثلاثاء', short: 'ثلا' },
  { value: 3, label: 'الأربعاء', short: 'أرب' },
  { value: 4, label: 'الخميس', short: 'خمي' },
  { value: 5, label: 'الجمعة', short: 'جمع' },
  { value: 6, label: 'السبت', short: 'سبت' }
];

export default function AdminFlightsNew() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAirline, setFilterAirline] = useState('all');
  const [addMethod, setAddMethod] = useState('manual');
  const [aiLoading, setAiLoading] = useState(false);
  const [extractedFlights, setExtractedFlights] = useState([]);
  
  const [formData, setFormData] = useState({
    flight_number: '',
    airline_id: '',
    departure_airport_id: '',
    arrival_airport_id: '',
    departure_time: '',
    arrival_time: '',
    days_of_week: [],
    stops_count: 0,
    aircraft_type: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
    source: 'manual'
  });

  const [newAirport, setNewAirport] = useState({
    name_ar: '',
    name_en: '',
    iata_code: '',
    city_ar: '',
    city_en: '',
    country_ar: '',
    country_en: '',
    timezone: ''
  });
  const [showNewAirport, setShowNewAirport] = useState(false);
  const [airportType, setAirportType] = useState('departure');

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [flightsData, airlinesData, airportsData] = await Promise.all([
      base44.entities.Flight.list('-created_date'),
      base44.entities.Airline.filter({ is_active: true }),
      base44.entities.Airport.filter({ is_active: true })
    ]);
    setFlights(flightsData);
    setAirlines(airlinesData);
    setAirports(airportsData);
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAiLoading(true);
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `حلل صورة جدول رحلات الطيران هذه واستخرج بيانات الرحلات.
      لكل رحلة استخرج: رقم الرحلة، مطار المغادرة (الاسم والرمز)، مطار الوصول (الاسم والرمز)، وقت المغادرة، وقت الوصول، أيام التشغيل.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          flights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flight_number: { type: "string" },
                departure_airport: { type: "string" },
                departure_code: { type: "string" },
                arrival_airport: { type: "string" },
                arrival_code: { type: "string" },
                departure_time: { type: "string" },
                arrival_time: { type: "string" },
                days: { type: "array", items: { type: "number" } }
              }
            }
          }
        }
      }
    });

    setExtractedFlights(result.flights || []);
    setAiLoading(false);
    toast.success(`تم استخراج ${result.flights?.length || 0} رحلات من الصورة`);
  };

  const saveExtractedFlights = async () => {
    if (!formData.airline_id) {
      toast.error('يرجى اختيار شركة الطيران أولاً');
      return;
    }

    const airline = airlines.find(a => a.id === formData.airline_id);
    
    for (const flight of extractedFlights) {
      // Check/create departure airport
      let depAirport = airports.find(a => a.iata_code === flight.departure_code);
      if (!depAirport) {
        depAirport = await base44.entities.Airport.create({
          name_ar: flight.departure_airport,
          name_en: flight.departure_airport,
          iata_code: flight.departure_code,
          city_ar: flight.departure_airport,
          country_ar: 'غير محدد',
          is_active: true
        });
      }

      // Check/create arrival airport
      let arrAirport = airports.find(a => a.iata_code === flight.arrival_code);
      if (!arrAirport) {
        arrAirport = await base44.entities.Airport.create({
          name_ar: flight.arrival_airport,
          name_en: flight.arrival_airport,
          iata_code: flight.arrival_code,
          city_ar: flight.arrival_airport,
          country_ar: 'غير محدد',
          is_active: true
        });
      }

      await base44.entities.Flight.create({
        flight_number: flight.flight_number,
        airline_id: formData.airline_id,
        airline_name: airline.name_ar,
        airline_logo: airline.logo_url,
        departure_airport_id: depAirport.id,
        departure_airport_code: flight.departure_code,
        departure_city: flight.departure_airport,
        arrival_airport_id: arrAirport.id,
        arrival_airport_code: flight.arrival_code,
        arrival_city: flight.arrival_airport,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time,
        days_of_week: flight.days || [],
        is_active: true,
        source: 'pdf_import'
      });
    }

    toast.success('تم إضافة جميع الرحلات بنجاح');
    setExtractedFlights([]);
    setDialogOpen(false);
    loadData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const airline = airlines.find(a => a.id === formData.airline_id);
    const depAirport = airports.find(a => a.id === formData.departure_airport_id);
    const arrAirport = airports.find(a => a.id === formData.arrival_airport_id);

    const flightData = {
      ...formData,
      airline_name: airline?.name_ar,
      airline_logo: airline?.logo_url,
      departure_airport_code: depAirport?.iata_code,
      departure_city: depAirport?.city_ar,
      arrival_airport_code: arrAirport?.iata_code,
      arrival_city: arrAirport?.city_ar
    };

    if (editingFlight) {
      await base44.entities.Flight.update(editingFlight.id, flightData);
      toast.success('تم تحديث الرحلة بنجاح');
    } else {
      await base44.entities.Flight.create(flightData);
      toast.success('تم إضافة الرحلة بنجاح');
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleAddAirport = async () => {
    const airport = await base44.entities.Airport.create({ ...newAirport, is_active: true });
    setAirports([...airports, airport]);
    
    if (airportType === 'departure') {
      setFormData({ ...formData, departure_airport_id: airport.id });
    } else {
      setFormData({ ...formData, arrival_airport_id: airport.id });
    }
    
    setShowNewAirport(false);
    setNewAirport({
      name_ar: '',
      name_en: '',
      iata_code: '',
      city_ar: '',
      city_en: '',
      country_ar: '',
      country_en: '',
      timezone: ''
    });
    toast.success('تم إضافة المطار بنجاح');
  };

  const toggleDay = (day) => {
    const current = formData.days_of_week || [];
    if (current.includes(day)) {
      setFormData({ ...formData, days_of_week: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, days_of_week: [...current, day].sort() });
    }
  };

  const handleEdit = (flight) => {
    setEditingFlight(flight);
    setFormData({
      flight_number: flight.flight_number || '',
      airline_id: flight.airline_id || '',
      departure_airport_id: flight.departure_airport_id || '',
      arrival_airport_id: flight.arrival_airport_id || '',
      departure_time: flight.departure_time || '',
      arrival_time: flight.arrival_time || '',
      days_of_week: flight.days_of_week || [],
      stops_count: flight.stops_count || 0,
      aircraft_type: flight.aircraft_type || '',
      valid_from: flight.valid_from || '',
      valid_until: flight.valid_until || '',
      is_active: flight.is_active !== false,
      source: flight.source || 'manual'
    });
    setAddMethod('manual');
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف الرحلة؟')) {
      await base44.entities.Flight.delete(id);
      toast.success('تم حذف الرحلة');
      loadData();
    }
  };

  const resetForm = () => {
    setEditingFlight(null);
    setFormData({
      flight_number: '',
      airline_id: '',
      departure_airport_id: '',
      arrival_airport_id: '',
      departure_time: '',
      arrival_time: '',
      days_of_week: [],
      stops_count: 0,
      aircraft_type: '',
      valid_from: '',
      valid_until: '',
      is_active: true,
      source: 'manual'
    });
    setExtractedFlights([]);
    setAddMethod('manual');
  };

  const filteredFlights = flights.filter(f => {
    const matchSearch = f.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.departure_city?.includes(searchTerm) ||
      f.arrival_city?.includes(searchTerm);
    const matchAirline = filterAirline === 'all' || f.airline_id === filterAirline;
    return matchSearch && matchAirline;
  });

  const getDaysDisplay = (days) => {
    if (!days || days.length === 0) return '-';
    if (days.length === 7) return 'يومياً';
    return days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short).join('، ');
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة الرحلات</h1>
            <p className="text-slate-600">إضافة وإدارة جدول رحلات شركات الطيران</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة رحلة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlight ? 'تعديل الرحلة' : 'إضافة رحلة جديدة'}</DialogTitle>
              </DialogHeader>

              {!editingFlight && (
                <Tabs value={addMethod} onValueChange={setAddMethod} className="mb-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="manual" className="flex-1">
                      <Pencil className="h-4 w-4 ml-2" />
                      إضافة يدوية
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex-1">
                      <FileImage className="h-4 w-4 ml-2" />
                      استيراد من صورة
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {addMethod === 'image' && !editingFlight ? (
                <div className="space-y-4">
                  <div>
                    <Label>شركة الطيران *</Label>
                    <Select value={formData.airline_id} onValueChange={(v) => setFormData({ ...formData, airline_id: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="اختر شركة الطيران" />
                      </SelectTrigger>
                      <SelectContent>
                        {airlines.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name_ar} ({a.iata_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-6 border-2 border-dashed rounded-xl bg-gradient-to-r from-purple-50 to-blue-50">
                    <div className="text-center">
                      <FileImage className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                      <h3 className="font-semibold mb-2">استيراد جدول الرحلات من صورة</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        قم برفع صورة جدول الرحلات وسيقوم النظام باستخراج البيانات تلقائياً
                      </p>
                      <Label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        {aiLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            جاري التحليل...
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5" />
                            رفع صورة
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleImageUpload} disabled={aiLoading} />
                      </Label>
                    </div>
                  </div>

                  {extractedFlights.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">الرحلات المستخرجة ({extractedFlights.length})</h3>
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>رقم الرحلة</TableHead>
                              <TableHead>من</TableHead>
                              <TableHead>إلى</TableHead>
                              <TableHead>الوقت</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {extractedFlights.map((f, i) => (
                              <TableRow key={i}>
                                <TableCell>{f.flight_number}</TableCell>
                                <TableCell>{f.departure_code}</TableCell>
                                <TableCell>{f.arrival_code}</TableCell>
                                <TableCell>{f.departure_time}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <Button onClick={saveExtractedFlights} className="w-full bg-green-600 hover:bg-green-700">
                        حفظ جميع الرحلات
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>شركة الطيران *</Label>
                      <Select value={formData.airline_id} onValueChange={(v) => setFormData({ ...formData, airline_id: v })} required>
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
                    <div>
                      <Label>رقم الرحلة *</Label>
                      <Input
                        value={formData.flight_number}
                        onChange={(e) => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })}
                        placeholder="IY601"
                        dir="ltr"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <Label>مطار المغادرة *</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setAirportType('departure'); setShowNewAirport(true); }}>
                          <Plus className="h-3 w-3 ml-1" />
                          إضافة مطار
                        </Button>
                      </div>
                      <Select value={formData.departure_airport_id} onValueChange={(v) => setFormData({ ...formData, departure_airport_id: v })} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر المطار" />
                        </SelectTrigger>
                        <SelectContent>
                          {airports.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.city_ar} ({a.iata_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label>مطار الوصول *</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setAirportType('arrival'); setShowNewAirport(true); }}>
                          <Plus className="h-3 w-3 ml-1" />
                          إضافة مطار
                        </Button>
                      </div>
                      <Select value={formData.arrival_airport_id} onValueChange={(v) => setFormData({ ...formData, arrival_airport_id: v })} required>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر المطار" />
                        </SelectTrigger>
                        <SelectContent>
                          {airports.filter(a => a.id !== formData.departure_airport_id).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.city_ar} ({a.iata_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {showNewAirport && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-4 space-y-3">
                        <h4 className="font-semibold">إضافة مطار جديد</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <Input
                            value={newAirport.iata_code}
                            onChange={(e) => setNewAirport({ ...newAirport, iata_code: e.target.value.toUpperCase() })}
                            placeholder="رمز IATA (مثل: ADE)"
                            dir="ltr"
                            maxLength={3}
                          />
                          <Input
                            value={newAirport.name_ar}
                            onChange={(e) => setNewAirport({ ...newAirport, name_ar: e.target.value })}
                            placeholder="اسم المطار بالعربية"
                          />
                          <Input
                            value={newAirport.city_ar}
                            onChange={(e) => setNewAirport({ ...newAirport, city_ar: e.target.value })}
                            placeholder="المدينة"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            value={newAirport.country_ar}
                            onChange={(e) => setNewAirport({ ...newAirport, country_ar: e.target.value })}
                            placeholder="الدولة"
                          />
                          <Input
                            value={newAirport.timezone}
                            onChange={(e) => setNewAirport({ ...newAirport, timezone: e.target.value })}
                            placeholder="المنطقة الزمنية (مثل: Asia/Aden)"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={handleAddAirport} size="sm">حفظ المطار</Button>
                          <Button type="button" variant="outline" onClick={() => setShowNewAirport(false)} size="sm">إلغاء</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>وقت المغادرة *</Label>
                      <Input
                        type="time"
                        value={formData.departure_time}
                        onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>وقت الوصول</Label>
                      <Input
                        type="time"
                        value={formData.arrival_time}
                        onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">أيام التشغيل</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={(formData.days_of_week || []).includes(day.value)}
                            onCheckedChange={() => toggleDay(day.value)}
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>عدد التوقفات</Label>
                      <Select value={String(formData.stops_count)} onValueChange={(v) => setFormData({ ...formData, stops_count: Number(v) })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">مباشر</SelectItem>
                          <SelectItem value="1">توقف واحد</SelectItem>
                          <SelectItem value="2">توقفين</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>صالحة من</Label>
                      <Input
                        type="date"
                        value={formData.valid_from}
                        onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>صالحة حتى</Label>
                      <Input
                        type="date"
                        value={formData.valid_until}
                        onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                    <Label>رحلة نشطة</Label>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingFlight ? 'تحديث' : 'إضافة'}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
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
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="شركة الطيران" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الشركات</SelectItem>
                  {airlines.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {filteredFlights.length} رحلة
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرحلة</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>الأيام</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlights.map((flight) => (
                  <TableRow key={flight.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-lg">{flight.flight_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {flight.airline_logo && (
                          <img src={flight.airline_logo} alt="" className="h-6 w-auto" />
                        )}
                        <span className="text-sm">{flight.airline_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{flight.departure_city}</span>
                        <ArrowLeft className="h-4 w-4 text-slate-400" />
                        <span>{flight.arrival_city}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {flight.departure_airport_code} → {flight.arrival_airport_code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono">{flight.departure_time}</div>
                      {flight.arrival_time && (
                        <div className="text-xs text-slate-500">{flight.arrival_time}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getDaysDisplay(flight.days_of_week)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        flight.source === 'ai' ? 'bg-purple-100 text-purple-700' :
                        flight.source === 'pdf_import' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {flight.source === 'ai' ? 'ذكاء اصطناعي' :
                         flight.source === 'pdf_import' ? 'استيراد' : 'يدوي'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={flight.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {flight.is_active ? 'نشطة' : 'متوقفة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(flight)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(flight.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}