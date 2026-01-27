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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, MapPin, Search, Brain, Loader2, Pause, Play, Globe, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

// قائمة المطارات الشائعة للإضافة السريعة
const COMMON_AIRPORTS = {
  yemen: [
    { name_ar: 'مطار عدن الدولي', name_en: 'Aden International Airport', iata_code: 'ADE', city_ar: 'عدن', city_en: 'Aden', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
    { name_ar: 'مطار صنعاء الدولي', name_en: 'Sanaa International Airport', iata_code: 'SAH', city_ar: 'صنعاء', city_en: 'Sanaa', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
    { name_ar: 'مطار سيئون', name_en: 'Seiyun Airport', iata_code: 'GXF', city_ar: 'سيئون', city_en: 'Seiyun', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
    { name_ar: 'مطار المكلا', name_en: 'Riyan Airport', iata_code: 'RIY', city_ar: 'المكلا', city_en: 'Mukalla', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
    { name_ar: 'مطار تعز', name_en: 'Taiz Airport', iata_code: 'TAI', city_ar: 'تعز', city_en: 'Taiz', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
    { name_ar: 'مطار الحديدة', name_en: 'Hodeidah Airport', iata_code: 'HOD', city_ar: 'الحديدة', city_en: 'Hodeidah', country_ar: 'اليمن', country_en: 'Yemen', timezone: 'Asia/Aden', utc_offset: 3 },
  ],
  saudi: [
    { name_ar: 'مطار الملك عبدالعزيز الدولي', name_en: 'King Abdulaziz International Airport', iata_code: 'JED', city_ar: 'جدة', city_en: 'Jeddah', country_ar: 'السعودية', country_en: 'Saudi Arabia', timezone: 'Asia/Riyadh', utc_offset: 3 },
    { name_ar: 'مطار الملك خالد الدولي', name_en: 'King Khalid International Airport', iata_code: 'RUH', city_ar: 'الرياض', city_en: 'Riyadh', country_ar: 'السعودية', country_en: 'Saudi Arabia', timezone: 'Asia/Riyadh', utc_offset: 3 },
    { name_ar: 'مطار الملك فهد الدولي', name_en: 'King Fahd International Airport', iata_code: 'DMM', city_ar: 'الدمام', city_en: 'Dammam', country_ar: 'السعودية', country_en: 'Saudi Arabia', timezone: 'Asia/Riyadh', utc_offset: 3 },
    { name_ar: 'مطار الأمير محمد بن عبدالعزيز', name_en: 'Prince Mohammad bin Abdulaziz Airport', iata_code: 'MED', city_ar: 'المدينة المنورة', city_en: 'Medina', country_ar: 'السعودية', country_en: 'Saudi Arabia', timezone: 'Asia/Riyadh', utc_offset: 3 },
  ],
  egypt: [
    { name_ar: 'مطار القاهرة الدولي', name_en: 'Cairo International Airport', iata_code: 'CAI', city_ar: 'القاهرة', city_en: 'Cairo', country_ar: 'مصر', country_en: 'Egypt', timezone: 'Africa/Cairo', utc_offset: 2 },
    { name_ar: 'مطار الغردقة الدولي', name_en: 'Hurghada International Airport', iata_code: 'HRG', city_ar: 'الغردقة', city_en: 'Hurghada', country_ar: 'مصر', country_en: 'Egypt', timezone: 'Africa/Cairo', utc_offset: 2 },
    { name_ar: 'مطار شرم الشيخ الدولي', name_en: 'Sharm el-Sheikh International Airport', iata_code: 'SSH', city_ar: 'شرم الشيخ', city_en: 'Sharm el-Sheikh', country_ar: 'مصر', country_en: 'Egypt', timezone: 'Africa/Cairo', utc_offset: 2 },
    { name_ar: 'مطار الأقصر الدولي', name_en: 'Luxor International Airport', iata_code: 'LXR', city_ar: 'الأقصر', city_en: 'Luxor', country_ar: 'مصر', country_en: 'Egypt', timezone: 'Africa/Cairo', utc_offset: 2 },
    { name_ar: 'مطار الإسكندرية الدولي', name_en: 'Borg El Arab Airport', iata_code: 'HBE', city_ar: 'الإسكندرية', city_en: 'Alexandria', country_ar: 'مصر', country_en: 'Egypt', timezone: 'Africa/Cairo', utc_offset: 2 },
  ],
  uae: [
    { name_ar: 'مطار دبي الدولي', name_en: 'Dubai International Airport', iata_code: 'DXB', city_ar: 'دبي', city_en: 'Dubai', country_ar: 'الإمارات', country_en: 'UAE', timezone: 'Asia/Dubai', utc_offset: 4 },
    { name_ar: 'مطار أبوظبي الدولي', name_en: 'Abu Dhabi International Airport', iata_code: 'AUH', city_ar: 'أبوظبي', city_en: 'Abu Dhabi', country_ar: 'الإمارات', country_en: 'UAE', timezone: 'Asia/Dubai', utc_offset: 4 },
    { name_ar: 'مطار الشارقة الدولي', name_en: 'Sharjah International Airport', iata_code: 'SHJ', city_ar: 'الشارقة', city_en: 'Sharjah', country_ar: 'الإمارات', country_en: 'UAE', timezone: 'Asia/Dubai', utc_offset: 4 },
  ],
  jordan: [
    { name_ar: 'مطار الملكة علياء الدولي', name_en: 'Queen Alia International Airport', iata_code: 'AMM', city_ar: 'عمان', city_en: 'Amman', country_ar: 'الأردن', country_en: 'Jordan', timezone: 'Asia/Amman', utc_offset: 3 },
  ],
  turkey: [
    { name_ar: 'مطار إسطنبول', name_en: 'Istanbul Airport', iata_code: 'IST', city_ar: 'إسطنبول', city_en: 'Istanbul', country_ar: 'تركيا', country_en: 'Turkey', timezone: 'Europe/Istanbul', utc_offset: 3 },
    { name_ar: 'مطار صبيحة كوكجن', name_en: 'Sabiha Gokcen Airport', iata_code: 'SAW', city_ar: 'إسطنبول', city_en: 'Istanbul', country_ar: 'تركيا', country_en: 'Turkey', timezone: 'Europe/Istanbul', utc_offset: 3 },
  ],
  qatar: [
    { name_ar: 'مطار حمد الدولي', name_en: 'Hamad International Airport', iata_code: 'DOH', city_ar: 'الدوحة', city_en: 'Doha', country_ar: 'قطر', country_en: 'Qatar', timezone: 'Asia/Qatar', utc_offset: 3 },
  ],
  kuwait: [
    { name_ar: 'مطار الكويت الدولي', name_en: 'Kuwait International Airport', iata_code: 'KWI', city_ar: 'الكويت', city_en: 'Kuwait City', country_ar: 'الكويت', country_en: 'Kuwait', timezone: 'Asia/Kuwait', utc_offset: 3 },
  ],
  bahrain: [
    { name_ar: 'مطار البحرين الدولي', name_en: 'Bahrain International Airport', iata_code: 'BAH', city_ar: 'المنامة', city_en: 'Manama', country_ar: 'البحرين', country_en: 'Bahrain', timezone: 'Asia/Bahrain', utc_offset: 3 },
  ],
  oman: [
    { name_ar: 'مطار مسقط الدولي', name_en: 'Muscat International Airport', iata_code: 'MCT', city_ar: 'مسقط', city_en: 'Muscat', country_ar: 'عمان', country_en: 'Oman', timezone: 'Asia/Muscat', utc_offset: 4 },
    { name_ar: 'مطار صلالة', name_en: 'Salalah Airport', iata_code: 'SLL', city_ar: 'صلالة', city_en: 'Salalah', country_ar: 'عمان', country_en: 'Oman', timezone: 'Asia/Muscat', utc_offset: 4 },
  ],
  malaysia: [
    { name_ar: 'مطار كوالالمبور الدولي', name_en: 'Kuala Lumpur International Airport', iata_code: 'KUL', city_ar: 'كوالالمبور', city_en: 'Kuala Lumpur', country_ar: 'ماليزيا', country_en: 'Malaysia', timezone: 'Asia/Kuala_Lumpur', utc_offset: 8 },
  ],
  india: [
    { name_ar: 'مطار إنديرا غاندي الدولي', name_en: 'Indira Gandhi International Airport', iata_code: 'DEL', city_ar: 'نيودلهي', city_en: 'New Delhi', country_ar: 'الهند', country_en: 'India', timezone: 'Asia/Kolkata', utc_offset: 5.5 },
    { name_ar: 'مطار مومباي الدولي', name_en: 'Chhatrapati Shivaji Maharaj Airport', iata_code: 'BOM', city_ar: 'مومباي', city_en: 'Mumbai', country_ar: 'الهند', country_en: 'India', timezone: 'Asia/Kolkata', utc_offset: 5.5 },
  ],
};

export default function AdminAirportsComplete() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAirport, setEditingAirport] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('all');
  const [bulkAddCountry, setBulkAddCountry] = useState('');

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    iata_code: '',
    icao_code: '',
    city_ar: '',
    city_en: '',
    country_ar: '',
    country_en: '',
    timezone: 'Asia/Aden',
    utc_offset: 3,
    latitude: 0,
    longitude: 0,
    is_active: true
  });

  const [aiSearchQuery, setAiSearchQuery] = useState('');

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadAirports();
  }, []);

  const loadAirports = async () => {
    const data = await base44.entities.Airport.list('-created_date');
    setAirports(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for duplicate IATA code
    const existing = airports.find(a => 
      a.iata_code?.toLowerCase() === formData.iata_code?.toLowerCase() && 
      a.id !== editingAirport?.id
    );
    if (existing) {
      toast.error(`المطار برمز ${formData.iata_code} موجود مسبقاً`);
      return;
    }

    if (editingAirport) {
      await base44.entities.Airport.update(editingAirport.id, formData);
      toast.success('تم تحديث المطار');
    } else {
      await base44.entities.Airport.create({
        ...formData,
        created_by_method: 'manual'
      });
      toast.success('تم إضافة المطار بنجاح');
    }

    setDialogOpen(false);
    resetForm();
    loadAirports();
  };

  const handleAISearch = async () => {
    if (!aiSearchQuery.trim()) {
      toast.error('يرجى إدخال اسم المطار أو المدينة');
      return;
    }

    setAiLoading(true);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `ابحث عن معلومات المطار: "${aiSearchQuery}"
        أعطني المعلومات التالية:
        - اسم المطار بالعربية والإنجليزية
        - رمز IATA و ICAO
        - المدينة بالعربية والإنجليزية
        - الدولة بالعربية والإنجليزية
        - المنطقة الزمنية
        - فرق التوقيت UTC
        - خط العرض والطول`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name_ar: { type: "string" },
            name_en: { type: "string" },
            iata_code: { type: "string" },
            icao_code: { type: "string" },
            city_ar: { type: "string" },
            city_en: { type: "string" },
            country_ar: { type: "string" },
            country_en: { type: "string" },
            timezone: { type: "string" },
            utc_offset: { type: "number" },
            latitude: { type: "number" },
            longitude: { type: "number" }
          }
        }
      });

      setFormData({
        ...result,
        is_active: true
      });
      setActiveTab('manual');
      toast.success('تم جلب بيانات المطار، يرجى مراجعتها');
    } catch (error) {
      toast.error('حدث خطأ في البحث');
    }

    setAiLoading(false);
  };

  const handleBulkAdd = async () => {
    if (!bulkAddCountry) {
      toast.error('اختر دولة لإضافة مطاراتها');
      return;
    }

    const countryAirports = COMMON_AIRPORTS[bulkAddCountry] || [];
    const existingCodes = airports.map(a => a.iata_code?.toLowerCase());
    const newAirports = countryAirports.filter(a => !existingCodes.includes(a.iata_code.toLowerCase()));

    if (newAirports.length === 0) {
      toast.info('جميع مطارات هذه الدولة مضافة مسبقاً');
      return;
    }

    setAiLoading(true);

    for (const airport of newAirports) {
      await base44.entities.Airport.create({
        ...airport,
        is_active: true,
        created_by_method: 'auto'
      });
    }

    toast.success(`تم إضافة ${newAirports.length} مطار`);
    setBulkAddCountry('');
    loadAirports();
    setAiLoading(false);
  };

  const handleEdit = (airport) => {
    setEditingAirport(airport);
    setFormData({
      name_ar: airport.name_ar || '',
      name_en: airport.name_en || '',
      iata_code: airport.iata_code || '',
      icao_code: airport.icao_code || '',
      city_ar: airport.city_ar || '',
      city_en: airport.city_en || '',
      country_ar: airport.country_ar || '',
      country_en: airport.country_en || '',
      timezone: airport.timezone || 'Asia/Aden',
      utc_offset: airport.utc_offset || 3,
      latitude: airport.latitude || 0,
      longitude: airport.longitude || 0,
      is_active: airport.is_active !== false
    });
    setActiveTab('manual');
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const flights = await base44.entities.Flight.filter({
      $or: [
        { departure_airport_id: id },
        { arrival_airport_id: id }
      ]
    });

    if (flights.length > 0) {
      toast.error('لا يمكن حذف المطار لوجود رحلات مرتبطة به');
      return;
    }

    if (confirm('هل أنت متأكد من حذف المطار؟')) {
      await base44.entities.Airport.delete(id);
      toast.success('تم حذف المطار');
      loadAirports();
    }
  };

  const handleToggleStatus = async (airport) => {
    await base44.entities.Airport.update(airport.id, {
      is_active: !airport.is_active
    });
    loadAirports();
  };

  const resetForm = () => {
    setEditingAirport(null);
    setFormData({
      name_ar: '',
      name_en: '',
      iata_code: '',
      icao_code: '',
      city_ar: '',
      city_en: '',
      country_ar: '',
      country_en: '',
      timezone: 'Asia/Aden',
      utc_offset: 3,
      latitude: 0,
      longitude: 0,
      is_active: true
    });
    setAiSearchQuery('');
  };

  const countries = [...new Set(airports.map(a => a.country_ar).filter(Boolean))];

  const filteredAirports = airports.filter(a => {
    const matchSearch = a.name_ar?.includes(searchTerm) ||
      a.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.iata_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.city_ar?.includes(searchTerm);
    const matchCountry = filterCountry === 'all' || a.country_ar === filterCountry;
    return matchSearch && matchCountry;
  });

  const countryOptions = [
    { key: 'yemen', label: 'اليمن' },
    { key: 'saudi', label: 'السعودية' },
    { key: 'egypt', label: 'مصر' },
    { key: 'uae', label: 'الإمارات' },
    { key: 'jordan', label: 'الأردن' },
    { key: 'turkey', label: 'تركيا' },
    { key: 'qatar', label: 'قطر' },
    { key: 'kuwait', label: 'الكويت' },
    { key: 'bahrain', label: 'البحرين' },
    { key: 'oman', label: 'عمان' },
    { key: 'malaysia', label: 'ماليزيا' },
    { key: 'india', label: 'الهند' },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />

      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-blue-600" />
              إدارة المطارات
            </h1>
            <p className="text-slate-600">قائمة المطارات والوجهات</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة مطار
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAirport ? 'تعديل المطار' : 'إضافة مطار جديد'}</DialogTitle>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="manual">إضافة يدوية</TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    بحث ذكي
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    إضافة جماعية
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-6 space-y-4">
                      <Alert>
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                          ابحث عن أي مطار وسيتم جلب بياناته تلقائياً
                        </AlertDescription>
                      </Alert>

                      <div>
                        <Label>ابحث عن مطار أو مدينة</Label>
                        <Input
                          value={aiSearchQuery}
                          onChange={(e) => setAiSearchQuery(e.target.value)}
                          placeholder="مثال: مطار القاهرة الدولي"
                          className="mt-1"
                        />
                      </div>

                      <Button onClick={handleAISearch} disabled={aiLoading} className="w-full bg-purple-600 hover:bg-purple-700">
                        {aiLoading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري البحث...
                          </>
                        ) : (
                          <>
                            <Brain className="ml-2 h-4 w-4" />
                            بحث
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bulk">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6 space-y-4">
                      <Alert>
                        <Globe className="h-4 w-4" />
                        <AlertDescription>
                          أضف جميع المطارات الرئيسية لدولة معينة دفعة واحدة
                        </AlertDescription>
                      </Alert>

                      <div>
                        <Label>اختر الدولة</Label>
                        <Select value={bulkAddCountry} onValueChange={setBulkAddCountry}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="اختر دولة" />
                          </SelectTrigger>
                          <SelectContent>
                            {countryOptions.map(c => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label} ({COMMON_AIRPORTS[c.key]?.length || 0} مطار)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {bulkAddCountry && (
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-sm font-semibold mb-2">المطارات المتاحة:</p>
                          <div className="flex flex-wrap gap-2">
                            {COMMON_AIRPORTS[bulkAddCountry]?.map(a => (
                              <Badge key={a.iata_code} variant="outline">
                                {a.city_ar} ({a.iata_code})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button onClick={handleBulkAdd} disabled={aiLoading || !bulkAddCountry} className="w-full bg-green-600 hover:bg-green-700">
                        {aiLoading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري الإضافة...
                          </>
                        ) : (
                          <>
                            <Check className="ml-2 h-4 w-4" />
                            إضافة المطارات
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manual">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>اسم المطار (عربي) *</Label>
                        <Input
                          value={formData.name_ar}
                          onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>اسم المطار (إنجليزي)</Label>
                        <Input
                          value={formData.name_en}
                          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>رمز IATA *</Label>
                        <Input
                          value={formData.iata_code}
                          onChange={(e) => setFormData({ ...formData, iata_code: e.target.value.toUpperCase() })}
                          maxLength={3}
                          dir="ltr"
                          required
                        />
                      </div>
                      <div>
                        <Label>رمز ICAO</Label>
                        <Input
                          value={formData.icao_code}
                          onChange={(e) => setFormData({ ...formData, icao_code: e.target.value.toUpperCase() })}
                          maxLength={4}
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>المدينة (عربي) *</Label>
                        <Input
                          value={formData.city_ar}
                          onChange={(e) => setFormData({ ...formData, city_ar: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>المدينة (إنجليزي)</Label>
                        <Input
                          value={formData.city_en}
                          onChange={(e) => setFormData({ ...formData, city_en: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>الدولة (عربي) *</Label>
                        <Input
                          value={formData.country_ar}
                          onChange={(e) => setFormData({ ...formData, country_ar: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>الدولة (إنجليزي)</Label>
                        <Input
                          value={formData.country_en}
                          onChange={(e) => setFormData({ ...formData, country_en: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>المنطقة الزمنية</Label>
                        <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asia/Aden">Asia/Aden (+3)</SelectItem>
                            <SelectItem value="Africa/Cairo">Africa/Cairo (+2)</SelectItem>
                            <SelectItem value="Asia/Riyadh">Asia/Riyadh (+3)</SelectItem>
                            <SelectItem value="Asia/Dubai">Asia/Dubai (+4)</SelectItem>
                            <SelectItem value="Europe/Istanbul">Europe/Istanbul (+3)</SelectItem>
                            <SelectItem value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (+8)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>فرق التوقيت UTC</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formData.utc_offset}
                          onChange={(e) => setFormData({ ...formData, utc_offset: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">حفظ</Button>
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
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الدولة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الدول</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-lg px-4 py-2">{filteredAirports.length} مطار</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Airports Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المطار</TableHead>
                  <TableHead>رمز IATA</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead>الدولة</TableHead>
                  <TableHead>المنطقة الزمنية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAirports.map((airport) => (
                  <TableRow key={airport.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{airport.name_ar}</p>
                        {airport.name_en && <p className="text-xs text-slate-500" dir="ltr">{airport.name_en}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{airport.iata_code}</Badge>
                    </TableCell>
                    <TableCell>{airport.city_ar}</TableCell>
                    <TableCell>{airport.country_ar}</TableCell>
                    <TableCell className="text-xs">{airport.timezone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={airport.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                          {airport.is_active !== false ? 'نشط' : 'موقف'}
                        </Badge>
                        {airport.created_by_method === 'ai' && (
                          <Brain className="h-4 w-4 text-purple-500" title="أضيف بالذكاء الاصطناعي" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(airport)}>
                          {airport.is_active !== false ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-green-600" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(airport)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(airport.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredAirports.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد مطارات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}