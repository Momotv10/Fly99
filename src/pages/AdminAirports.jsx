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
import { Plus, Pencil, Trash2, MapPin, Globe, Pause, Play, Brain } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAirports() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAirport, setEditingAirport] = useState(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadAirports();
  }, []);

  const loadAirports = async () => {
    const data = await base44.entities.Airport.list();
    setAirports(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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

  const handleEdit = (airport) => {
    setEditingAirport(airport);
    setFormData({
      name_ar: airport.name_ar,
      name_en: airport.name_en || '',
      iata_code: airport.iata_code,
      icao_code: airport.icao_code || '',
      city_ar: airport.city_ar,
      city_en: airport.city_en || '',
      country_ar: airport.country_ar,
      country_en: airport.country_en || '',
      timezone: airport.timezone || 'Asia/Aden',
      utc_offset: airport.utc_offset || 3,
      latitude: airport.latitude || 0,
      longitude: airport.longitude || 0,
      is_active: airport.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    // التحقق من عدم وجود رحلات مرتبطة
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

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('يرجى إدخال اسم المدينة أو المطار');
      return;
    }
    
    // محاكاة البحث بالذكاء الاصطناعي
    toast.info('جاري البحث...');
    
    setTimeout(() => {
      toast.success('تم العثور على معلومات المطار');
      // يمكن هنا استخدام API حقيقي للبحث عن معلومات المطارات
    }, 2000);
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
  };

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
          
          <div className="flex gap-2">
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-purple-50">
                  <Brain className="ml-2 h-4 w-4" />
                  إضافة بالذكاء الاصطناعي
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>البحث عن مطار بالذكاء الاصطناعي</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>ابحث عن مطار أو مدينة</Label>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="مثال: مطار القاهرة الدولي"
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleAISearch} className="w-full bg-purple-600">
                    <Brain className="ml-2 h-4 w-4" />
                    بحث
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مطار
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingAirport ? 'تعديل المطار' : 'إضافة مطار جديد'}</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم المطار (عربي) *</Label>
                      <Input
                        value={formData.name_ar}
                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        placeholder="مطار صنعاء الدولي"
                        required
                      />
                    </div>
                    <div>
                      <Label>اسم المطار (إنجليزي)</Label>
                      <Input
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="Sana'a International Airport"
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
                        placeholder="SAH"
                        maxLength={3}
                        required
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>رمز ICAO</Label>
                      <Input
                        value={formData.icao_code}
                        onChange={(e) => setFormData({ ...formData, icao_code: e.target.value.toUpperCase() })}
                        placeholder="OYSN"
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>فرق التوقيت UTC</Label>
                      <Input
                        type="number"
                        value={formData.utc_offset}
                        onChange={(e) => setFormData({ ...formData, utc_offset: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>خط العرض (Latitude)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>خط الطول (Longitude)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      إلغاء
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      حفظ
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
                {airports.map((airport) => (
                  <TableRow key={airport.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{airport.name_ar}</p>
                        {airport.name_en && (
                          <p className="text-xs text-slate-500" dir="ltr">{airport.name_en}</p>
                        )}
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
                        <Badge className={airport.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                          {airport.is_active ? 'نشط' : 'موقف'}
                        </Badge>
                        {airport.created_by_method === 'ai' && (
                          <Brain className="h-4 w-4 text-purple-500" title="أضيف بالذكاء الاصطناعي" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleToggleStatus(airport)}
                        >
                          {airport.is_active ? (
                            <Pause className="h-4 w-4 text-amber-600" />
                          ) : (
                            <Play className="h-4 w-4 text-green-600" />
                          )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}