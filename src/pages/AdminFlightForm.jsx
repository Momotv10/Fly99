import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plane, Save, ArrowRight, DollarSign, Users, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { autoFlightPairing } from '@/components/provider/AutoFlightPairing';

export default function AdminFlightForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);
  const [providers, setProviders] = useState([]);
  
  const [formData, setFormData] = useState({
    flight_number: '',
    airline_id: '',
    airline_name: '',
    airline_logo: '',
    departure_airport_id: '',
    departure_airport_code: '',
    departure_city: '',
    arrival_airport_id: '',
    arrival_airport_code: '',
    arrival_city: '',
    departure_date: '',
    departure_time: '',
    arrival_date: '',
    arrival_time: '',
    flight_class: 'economy',
    total_seats: 10,
    available_seats: 10,
    cost_price: 0,
    selling_price: 0,
    agent_commission: 0,
    system_commission: 0,
    tax_amount: 0,
    visa_available: false,
    visa_price: 0,
    visa_nationalities: [],
    provider_id: '',
    provider_name: '',
    employee_whatsapp: '',
    status: 'active',
    currency: 'SAR'
  });

  useEffect(() => {
    checkAuth();
    loadData();
    
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setEditingId(id);
      loadFlight(id);
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [airlinesData, airportsData, providersData] = await Promise.all([
      base44.entities.Airline.filter({ is_active: true }),
      base44.entities.Airport.filter({ is_active: true }),
      base44.entities.Provider.filter({ is_active: true })
    ]);
    setAirlines(airlinesData);
    setAirports(airportsData);
    setProviders(providersData);
  };

  const loadFlight = async (id) => {
    const flights = await base44.entities.Flight.filter({ id });
    if (flights.length > 0) {
      setFormData(flights[0]);
    }
    setLoading(false);
  };

  const handleAirlineChange = (airlineId) => {
    const airline = airlines.find(a => a.id === airlineId);
    if (airline) {
      setFormData({
        ...formData,
        airline_id: airline.id,
        airline_name: airline.name,
        airline_logo: airline.logo_url
      });
    }
  };

  const handleAirportChange = (airportId, type) => {
    const airport = airports.find(a => a.id === airportId);
    if (airport) {
      if (type === 'departure') {
        setFormData({
          ...formData,
          departure_airport_id: airport.id,
          departure_airport_code: airport.code,
          departure_city: airport.city
        });
      } else {
        setFormData({
          ...formData,
          arrival_airport_id: airport.id,
          arrival_airport_code: airport.code,
          arrival_city: airport.city
        });
      }
    }
  };

  const handleProviderChange = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setFormData({
        ...formData,
        provider_id: provider.id,
        provider_name: provider.name
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (!formData.employee_whatsapp) {
      toast.error('يرجى إدخال رقم واتساب الموظف المسؤول');
      setSaving(false);
      return;
    }

    const dataToSave = {
      ...formData,
      total_seats: Number(formData.total_seats),
      available_seats: Number(formData.available_seats),
      cost_price: Number(formData.cost_price),
      selling_price: Number(formData.selling_price),
      agent_commission: Number(formData.agent_commission),
      system_commission: Number(formData.system_commission),
      tax_amount: Number(formData.tax_amount),
      visa_price: formData.visa_available ? Number(formData.visa_price) : 0
    };

    if (editingId) {
      await base44.entities.Flight.update(editingId, dataToSave);
      toast.success('تم تحديث الرحلة بنجاح');
      
      // إعادة فحص الأزواج بعد التحديث
      await autoFlightPairing.findAndCreatePairs(editingId);
    } else {
      const newFlight = await base44.entities.Flight.create(dataToSave);
      toast.success('تم إضافة الرحلة بنجاح');
      
      // البحث التلقائي عن رحلات قابلة للربط
      await autoFlightPairing.findAndCreatePairs(newFlight.id);
    }

    navigate(createPageUrl('AdminFlights'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AdminFlights'))}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {editingId ? 'تعديل الرحلة' : 'إضافة رحلة جديدة'}
            </h1>
            <p className="text-slate-600">أدخل بيانات الرحلة</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-blue-600" />
                معلومات الرحلة الأساسية
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>رقم الرحلة</Label>
                <Input
                  value={formData.flight_number}
                  onChange={(e) => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })}
                  placeholder="SV123"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <Label>شركة الطيران</Label>
                <Select value={formData.airline_id} onValueChange={handleAirlineChange} required>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر شركة الطيران" />
                  </SelectTrigger>
                  <SelectContent>
                    {airlines.map((airline) => (
                      <SelectItem key={airline.id} value={airline.id}>{airline.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>درجة الرحلة</Label>
                <Select value={formData.flight_class} onValueChange={(v) => setFormData({ ...formData, flight_class: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">اقتصادي</SelectItem>
                    <SelectItem value="business">رجال أعمال</SelectItem>
                    <SelectItem value="first">درجة أولى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Route */}
          <Card>
            <CardHeader>
              <CardTitle>مسار الرحلة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 bg-green-50 rounded-xl">
                  <h3 className="font-semibold text-green-800">المغادرة</h3>
                  <div>
                    <Label>مطار المغادرة</Label>
                    <Select value={formData.departure_airport_id} onValueChange={(v) => handleAirportChange(v, 'departure')} required>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المطار" />
                      </SelectTrigger>
                      <SelectContent>
                        {airports.map((airport) => (
                          <SelectItem key={airport.id} value={airport.id}>
                            {airport.city} ({airport.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>تاريخ المغادرة</Label>
                      <Input
                        type="date"
                        value={formData.departure_date}
                        onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>وقت المغادرة</Label>
                      <Input
                        type="time"
                        value={formData.departure_time}
                        onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
                  <h3 className="font-semibold text-blue-800">الوصول</h3>
                  <div>
                    <Label>مطار الوصول</Label>
                    <Select value={formData.arrival_airport_id} onValueChange={(v) => handleAirportChange(v, 'arrival')} required>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المطار" />
                      </SelectTrigger>
                      <SelectContent>
                        {airports.filter(a => a.id !== formData.departure_airport_id).map((airport) => (
                          <SelectItem key={airport.id} value={airport.id}>
                            {airport.city} ({airport.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>تاريخ الوصول</Label>
                      <Input
                        type="date"
                        value={formData.arrival_date}
                        onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seats & Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                المقاعد والتسعير
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>إجمالي المقاعد</Label>
                <Input
                  type="number"
                  value={formData.total_seats}
                  onChange={(e) => setFormData({ ...formData, total_seats: e.target.value, available_seats: e.target.value })}
                  min="1"
                />
              </div>
              <div>
                <Label>المقاعد المتاحة</Label>
                <Input
                  type="number"
                  value={formData.available_seats}
                  onChange={(e) => setFormData({ ...formData, available_seats: e.target.value })}
                  min="0"
                  max={formData.total_seats}
                />
              </div>
              <div>
                <Label>سعر التكلفة</Label>
                <Input
                  type="number"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  min="0"
                />
              </div>
              <div>
                <Label>سعر البيع</Label>
                <Input
                  type="number"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  min="0"
                  required
                />
              </div>
              <div>
                <Label>عمولة النظام</Label>
                <Input
                  type="number"
                  value={formData.system_commission}
                  onChange={(e) => setFormData({ ...formData, system_commission: e.target.value })}
                  min="0"
                />
              </div>
              <div>
                <Label>عمولة الوكيل</Label>
                <Input
                  type="number"
                  value={formData.agent_commission}
                  onChange={(e) => setFormData({ ...formData, agent_commission: e.target.value })}
                  min="0"
                />
              </div>
              <div>
                <Label>الضريبة</Label>
                <Input
                  type="number"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                  min="0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Provider & Employee */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                المزود والموظف المسؤول
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>المزود</Label>
                <Select value={formData.provider_id} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المزود (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رقم واتساب الموظف المسؤول *</Label>
                <Input
                  value={formData.employee_whatsapp}
                  onChange={(e) => setFormData({ ...formData, employee_whatsapp: e.target.value })}
                  placeholder="+966xxxxxxxxx"
                  dir="ltr"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">رقم الموظف الذي سيستلم إشعارات الحجوزات</p>
              </div>
            </CardContent>
          </Card>

          {/* Visa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                خدمة التأشيرة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Switch
                  checked={formData.visa_available}
                  onCheckedChange={(v) => setFormData({ ...formData, visa_available: v })}
                />
                <Label>توفر خدمة التأشيرة</Label>
              </div>
              {formData.visa_available && (
                <div>
                  <Label>سعر التأشيرة</Label>
                  <Input
                    type="number"
                    value={formData.visa_price}
                    onChange={(e) => setFormData({ ...formData, visa_price: e.target.value })}
                    min="0"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('AdminFlights'))}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="ml-2 h-4 w-4" />
              {saving ? 'جاري الحفظ...' : (editingId ? 'تحديث الرحلة' : 'إضافة الرحلة')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}