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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Plus, Pencil, Trash2, Plane, Search, Brain, Loader2, 
  Pause, Play, Upload, AlertTriangle, Check, ArrowLeft,
  Clock, MapPin, Calendar
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminFlightsComplete() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAirline, setFilterAirline] = useState('all');
  const [filterDay, setFilterDay] = useState('all');

  const [formData, setFormData] = useState({
    flight_number: '',
    airline_id: '',
    departure_airport_id: '',
    arrival_airport_id: '',
    departure_time: '',
    arrival_time: '',
    duration_minutes: 0,
    days_of_week: [],
    stops_count: 0,
    stops_details: [],
    aircraft_type: '',
    return_flight_id: '',
    valid_from: '',
    valid_until: '',
    is_active: true
  });

  const [aiFormData, setAiFormData] = useState({
    airline_id: '',
    day_of_week: 0,
    file: null
  });

  const [aiAnalyzedFlights, setAiAnalyzedFlights] = useState([]);
  const [aiWarnings, setAiWarnings] = useState([]);

  const daysOfWeek = [
    { value: 0, label: 'الأحد' },
    { value: 1, label: 'الإثنين' },
    { value: 2, label: 'الثلاثاء' },
    { value: 3, label: 'الأربعاء' },
    { value: 4, label: 'الخميس' },
    { value: 5, label: 'الجمعة' },
    { value: 6, label: 'السبت' }
  ];

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadData();
  }, []);

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

  const getAirportByCode = (code) => {
    return airports.find(a => a.iata_code?.toLowerCase() === code?.toLowerCase());
  };

  const handleAIAnalyze = async () => {
    if (!aiFormData.airline_id || !aiFormData.file) {
      toast.error('يرجى اختيار شركة الطيران ورفع ملف جدول الرحلات');
      return;
    }

    setAiLoading(true);
    setAiAnalyzedFlights([]);
    setAiWarnings([]);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: aiFormData.file });
      const airline = airlines.find(a => a.id === aiFormData.airline_id);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `
        قم بتحليل جدول رحلات شركة ${airline.name_ar} من الصورة/الملف المرفق.
        استخرج جميع الرحلات مع بياناتها:
        - رقم الرحلة
        - مطار المغادرة (رمز IATA واسم المدينة)
        - مطار الوصول (رمز IATA واسم المدينة)
        - وقت المغادرة
        - وقت الوصول
        - أيام التشغيل
        
        ملاحظة مهمة: حدد أيضاً الرحلات التي تشكل ذهاب وعودة (مثلاً رحلة من عدن إلى القاهرة ورحلة من القاهرة إلى عدن في نفس اليوم)
        
        المطارات المسجلة في النظام: ${airports.map(a => `${a.iata_code} (${a.city_ar})`).join(', ')}
        `,
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
                  departure_code: { type: "string" },
                  departure_city: { type: "string" },
                  arrival_code: { type: "string" },
                  arrival_city: { type: "string" },
                  departure_time: { type: "string" },
                  arrival_time: { type: "string" },
                  days_of_week: { type: "array", items: { type: "number" } },
                  return_flight_number: { type: "string" },
                  is_return_available: { type: "boolean" }
                }
              }
            },
            warnings: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      // Check for missing airports
      const warnings = [...(result.warnings || [])];
      const analyzedFlights = result.flights.map(f => {
        const depAirport = getAirportByCode(f.departure_code);
        const arrAirport = getAirportByCode(f.arrival_code);
        
        if (!depAirport) {
          warnings.push(`مطار المغادرة ${f.departure_code} (${f.departure_city}) غير موجود في النظام`);
        }
        if (!arrAirport) {
          warnings.push(`مطار الوصول ${f.arrival_code} (${f.arrival_city}) غير موجود في النظام`);
        }

        return {
          ...f,
          departure_airport_id: depAirport?.id,
          arrival_airport_id: arrAirport?.id,
          airline_id: aiFormData.airline_id,
          airline_name: airline.name_ar,
          airline_logo: airline.logo_url,
          selected: true
        };
      });

      setAiAnalyzedFlights(analyzedFlights);
      setAiWarnings([...new Set(warnings)]);
      toast.success(`تم تحليل ${analyzedFlights.length} رحلة`);
    } catch (error) {
      toast.error('حدث خطأ في تحليل الملف');
      console.error(error);
    }

    setAiLoading(false);
  };

  const handleSaveAIFlights = async () => {
    const selectedFlights = aiAnalyzedFlights.filter(f => f.selected && f.departure_airport_id && f.arrival_airport_id);
    
    if (selectedFlights.length === 0) {
      toast.error('لا توجد رحلات صالحة للحفظ');
      return;
    }

    setAiLoading(true);

    for (const flight of selectedFlights) {
      const depAirport = airports.find(a => a.id === flight.departure_airport_id);
      const arrAirport = airports.find(a => a.id === flight.arrival_airport_id);

      await base44.entities.Flight.create({
        flight_number: flight.flight_number,
        airline_id: flight.airline_id,
        airline_name: flight.airline_name,
        airline_logo: flight.airline_logo,
        departure_airport_id: flight.departure_airport_id,
        departure_airport_code: depAirport?.iata_code,
        departure_airport_name: depAirport?.name_ar,
        departure_city: depAirport?.city_ar,
        departure_country: depAirport?.country_ar,
        arrival_airport_id: flight.arrival_airport_id,
        arrival_airport_code: arrAirport?.iata_code,
        arrival_airport_name: arrAirport?.name_ar,
        arrival_city: arrAirport?.city_ar,
        arrival_country: arrAirport?.country_ar,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time,
        days_of_week: flight.days_of_week || [aiFormData.day_of_week],
        source: 'pdf_import',
        is_active: true
      });
    }

    toast.success(`تم حفظ ${selectedFlights.length} رحلة بنجاح`);
    setDialogOpen(false);
    setAiAnalyzedFlights([]);
    setAiWarnings([]);
    loadData();
    setAiLoading(false);
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
      departure_airport_name: depAirport?.name_ar,
      departure_city: depAirport?.city_ar,
      departure_country: depAirport?.country_ar,
      arrival_airport_code: arrAirport?.iata_code,
      arrival_airport_name: arrAirport?.name_ar,
      arrival_city: arrAirport?.city_ar,
      arrival_country: arrAirport?.country_ar,
      source: 'manual'
    };

    if (editingFlight) {
      await base44.entities.Flight.update(editingFlight.id, flightData);
      toast.success('تم تحديث الرحلة');
    } else {
      await base44.entities.Flight.create(flightData);
      toast.success('تم إضافة الرحلة بنجاح');
    }

    setDialogOpen(false);
    resetForm();
    loadData();
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
      duration_minutes: flight.duration_minutes || 0,
      days_of_week: flight.days_of_week || [],
      stops_count: flight.stops_count || 0,
      stops_details: flight.stops_details || [],
      aircraft_type: flight.aircraft_type || '',
      return_flight_id: flight.return_flight_id || '',
      valid_from: flight.valid_from || '',
      valid_until: flight.valid_until || '',
      is_active: flight.is_active !== false
    });
    setActiveTab('manual');
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const seats = await base44.entities.AvailableSeat.filter({ flight_id: id });
    if (seats.length > 0) {
      toast.error('لا يمكن حذف الرحلة لوجود مقاعد مرتبطة بها');
      return;
    }

    if (confirm('هل أنت متأكد من حذف الرحلة؟')) {
      await base44.entities.Flight.delete(id);
      toast.success('تم حذف الرحلة');
      loadData();
    }
  };

  const handleToggleStatus = async (flight) => {
    await base44.entities.Flight.update(flight.id, { is_active: !flight.is_active });
    loadData();
  };

  const toggleDay = (day) => {
    const current = formData.days_of_week || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setFormData({ ...formData, days_of_week: updated });
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
      duration_minutes: 0,
      days_of_week: [],
      stops_count: 0,
      stops_details: [],
      aircraft_type: '',
      return_flight_id: '',
      valid_from: '',
      valid_until: '',
      is_active: true
    });
    setAiFormData({ airline_id: '', day_of_week: 0, file: null });
    setAiAnalyzedFlights([]);
    setAiWarnings([]);
  };

  const filteredFlights = flights.filter(f => {
    const matchSearch = f.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.departure_city?.includes(searchTerm) ||
      f.arrival_city?.includes(searchTerm);
    const matchAirline = filterAirline === 'all' || f.airline_id === filterAirline;
    const matchDay = filterDay === 'all' || f.days_of_week?.includes(parseInt(filterDay));
    return matchSearch && matchAirline && matchDay;
  });

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="h-6 w-6 text-blue-600" />
              إدارة الرحلات
            </h1>
            <p className="text-slate-600">إضافة وإدارة جدول الرحلات</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة رحلة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlight ? 'تعديل الرحلة' : 'إضافة رحلة جديدة'}</DialogTitle>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="manual">إضافة يدوية</TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    استيراد من ملف
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-6 space-y-4">
                      <Alert>
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                          ارفع صورة أو ملف PDF لجدول رحلات الشركة وسيقوم النظام بتحليله واستخراج الرحلات تلقائياً
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>شركة الطيران *</Label>
                          <Select value={aiFormData.airline_id} onValueChange={(v) => setAiFormData({ ...aiFormData, airline_id: v })}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="اختر الشركة" />
                            </SelectTrigger>
                            <SelectContent>
                              {airlines.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name_ar} ({a.iata_code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>يوم التشغيل (اختياري)</Label>
                          <Select value={String(aiFormData.day_of_week)} onValueChange={(v) => setAiFormData({ ...aiFormData, day_of_week: parseInt(v) })}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {daysOfWeek.map(d => (
                                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>ملف جدول الرحلات (صورة أو PDF) *</Label>
                        <Label className="cursor-pointer flex items-center justify-center p-8 border-2 border-dashed rounded-lg hover:bg-white mt-1">
                          <Upload className="h-8 w-8 text-slate-400 ml-2" />
                          <span>{aiFormData.file ? aiFormData.file.name : 'اختر ملف'}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => setAiFormData({ ...aiFormData, file: e.target.files?.[0] })}
                          />
                        </Label>
                      </div>

                      <Button onClick={handleAIAnalyze} disabled={aiLoading} className="w-full bg-purple-600 hover:bg-purple-700">
                        {aiLoading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري التحليل...
                          </>
                        ) : (
                          <>
                            <Brain className="ml-2 h-4 w-4" />
                            تحليل الملف
                          </>
                        )}
                      </Button>

                      {/* Warnings */}
                      {aiWarnings.length > 0 && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription>
                            <p className="font-semibold mb-2">تنبيهات:</p>
                            <ul className="list-disc pr-4 space-y-1">
                              {aiWarnings.map((w, i) => (
                                <li key={i} className="text-sm">{w}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Analyzed Flights */}
                      {aiAnalyzedFlights.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-semibold">الرحلات المستخرجة ({aiAnalyzedFlights.length})</h4>
                          <ScrollArea className="h-64">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-10">
                                    <Checkbox
                                      checked={aiAnalyzedFlights.every(f => f.selected)}
                                      onCheckedChange={(v) => setAiAnalyzedFlights(aiAnalyzedFlights.map(f => ({ ...f, selected: v })))}
                                    />
                                  </TableHead>
                                  <TableHead>رقم الرحلة</TableHead>
                                  <TableHead>المسار</TableHead>
                                  <TableHead>الوقت</TableHead>
                                  <TableHead>الحالة</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {aiAnalyzedFlights.map((flight, index) => (
                                  <TableRow key={index}>
                                    <TableCell>
                                      <Checkbox
                                        checked={flight.selected}
                                        onCheckedChange={(v) => {
                                          const updated = [...aiAnalyzedFlights];
                                          updated[index].selected = v;
                                          setAiAnalyzedFlights(updated);
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="font-mono">{flight.flight_number}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1 text-sm">
                                        <span>{flight.departure_code}</span>
                                        <ArrowLeft className="h-3 w-3" />
                                        <span>{flight.arrival_code}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {flight.departure_time} - {flight.arrival_time}
                                    </TableCell>
                                    <TableCell>
                                      {flight.departure_airport_id && flight.arrival_airport_id ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>

                          <Button onClick={handleSaveAIFlights} disabled={aiLoading} className="w-full">
                            {aiLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
                            حفظ الرحلات المحددة
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manual">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>شركة الطيران *</Label>
                        <Select value={formData.airline_id} onValueChange={(v) => setFormData({ ...formData, airline_id: v })} required>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="اختر الشركة" />
                          </SelectTrigger>
                          <SelectContent>
                            {airlines.map(a => (
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
                          required
                        />
                      </div>
                    </div>

                    {/* Route */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4 space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          المسار
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>مطار المغادرة *</Label>
                            <Select value={formData.departure_airport_id} onValueChange={(v) => setFormData({ ...formData, departure_airport_id: v })} required>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="اختر المطار" />
                              </SelectTrigger>
                              <SelectContent>
                                {airports.map(a => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name_ar} ({a.iata_code}) - {a.city_ar}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>مطار الوصول *</Label>
                            <Select value={formData.arrival_airport_id} onValueChange={(v) => setFormData({ ...formData, arrival_airport_id: v })} required>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="اختر المطار" />
                              </SelectTrigger>
                              <SelectContent>
                                {airports.map(a => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name_ar} ({a.iata_code}) - {a.city_ar}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Schedule */}
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          التوقيت
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>وقت المغادرة *</Label>
                            <Input
                              type="time"
                              value={formData.departure_time}
                              onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label>وقت الوصول</Label>
                            <Input
                              type="time"
                              value={formData.arrival_time}
                              onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>مدة الرحلة (دقيقة)</Label>
                            <Input
                              type="number"
                              value={formData.duration_minutes}
                              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>أيام التشغيل</Label>
                          <div className="grid grid-cols-7 gap-2 mt-2">
                            {daysOfWeek.map(day => (
                              <div key={day.value} className="flex items-center gap-1">
                                <Checkbox
                                  checked={formData.days_of_week?.includes(day.value)}
                                  onCheckedChange={() => toggleDay(day.value)}
                                />
                                <Label className="text-xs">{day.label}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Validity */}
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          فترة الصلاحية
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>تاريخ البداية</Label>
                            <Input
                              type="date"
                              value={formData.valid_from}
                              onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>تاريخ النهاية</Label>
                            <Input
                              type="date"
                              value={formData.valid_until}
                              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        {editingFlight ? 'تحديث' : 'إضافة'} الرحلة
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
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
              <Select value={filterAirline} onValueChange={setFilterAirline}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="شركة الطيران" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الشركات</SelectItem>
                  {airlines.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="اليوم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأيام</SelectItem>
                  {daysOfWeek.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-lg px-4 py-2">{filteredFlights.length} رحلة</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Flights Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الرحلة</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>أيام التشغيل</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlights.map((flight) => (
                  <TableRow key={flight.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{flight.flight_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {flight.airline_logo && <img src={flight.airline_logo} alt="" className="h-6 w-6 object-contain" />}
                        <span className="text-sm">{flight.airline_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{flight.departure_airport_code}</span>
                        <ArrowLeft className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold">{flight.arrival_airport_code}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {flight.departure_city} ← {flight.arrival_city}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span>{flight.departure_time}</span>
                        {flight.arrival_time && <span className="text-slate-400"> - {flight.arrival_time}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {flight.days_of_week?.map(d => (
                          <Badge key={d} variant="secondary" className="text-xs">
                            {daysOfWeek.find(day => day.value === d)?.label?.slice(0, 1)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {flight.source === 'ai' || flight.source === 'pdf_import' ? (
                        <Brain className="h-4 w-4 text-purple-500" title="مستورد بالذكاء الاصطناعي" />
                      ) : (
                        <Badge variant="outline" className="text-xs">يدوي</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={flight.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                        {flight.is_active !== false ? 'نشطة' : 'موقفة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(flight)}>
                          {flight.is_active !== false ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-green-600" />}
                        </Button>
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

            {filteredFlights.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Plane className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد رحلات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}