import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Plane, Upload, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAirlines() {
  const navigate = useNavigate();
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAirline, setEditingAirline] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    code: '',
    logo_url: '',
    country: '',
    currency: 'SAR',
    booking_policy: 'both',
    is_active: true
  });

  useEffect(() => {
    checkAuth();
    loadAirlines();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadAirlines = async () => {
    const data = await base44.entities.Airline.list();
    setAirlines(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingAirline) {
      await base44.entities.Airline.update(editingAirline.id, formData);
      toast.success('تم تحديث شركة الطيران بنجاح');
    } else {
      await base44.entities.Airline.create(formData);
      toast.success('تم إضافة شركة الطيران بنجاح');
    }
    
    setDialogOpen(false);
    resetForm();
    loadAirlines();
  };

  const handleEdit = (airline) => {
    setEditingAirline(airline);
    setFormData({
      name: airline.name || '',
      name_en: airline.name_en || '',
      code: airline.code || '',
      logo_url: airline.logo_url || '',
      country: airline.country || '',
      currency: airline.currency || 'SAR',
      booking_policy: airline.booking_policy || 'both',
      is_active: airline.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف شركة الطيران؟')) {
      await base44.entities.Airline.delete(id);
      toast.success('تم حذف شركة الطيران');
      loadAirlines();
    }
  };

  const resetForm = () => {
    setEditingAirline(null);
    setFormData({
      name: '',
      name_en: '',
      code: '',
      logo_url: '',
      country: '',
      currency: 'SAR',
      booking_policy: 'both',
      is_active: true
    });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
    }
  };

  const filteredAirlines = airlines.filter(a => 
    a.name?.includes(searchTerm) || 
    a.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const policyLabels = {
    one_way: 'ذهاب فقط',
    round_trip: 'ذهاب وعودة',
    both: 'الاثنان'
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">شركات الطيران</h1>
            <p className="text-slate-600">إدارة شركات الطيران المسجلة في النظام</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة شركة طيران
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingAirline ? 'تعديل شركة الطيران' : 'إضافة شركة طيران جديدة'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الشركة (عربي)</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>اسم الشركة (إنجليزي)</Label>
                    <Input
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>رمز الشركة (IATA)</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="SV"
                      maxLength={3}
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <Label>الدولة</Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>شعار الشركة</Label>
                  <div className="flex items-center gap-4 mt-1">
                    {formData.logo_url && (
                      <img src={formData.logo_url} alt="Logo" className="h-12 w-12 object-contain border rounded" />
                    )}
                    <Label className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50">
                      <Upload className="h-4 w-4" />
                      رفع الشعار
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>العملة</Label>
                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                        <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                        <SelectItem value="EUR">يورو (EUR)</SelectItem>
                        <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>سياسة الحجز</Label>
                    <Select value={formData.booking_policy} onValueChange={(v) => setFormData({ ...formData, booking_policy: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_way">ذهاب فقط</SelectItem>
                        <SelectItem value="round_trip">ذهاب وعودة</SelectItem>
                        <SelectItem value="both">الاثنان</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>نشطة</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit">{editingAirline ? 'تحديث' : 'إضافة'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن شركة طيران..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشعار</TableHead>
                  <TableHead>اسم الشركة</TableHead>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الدولة</TableHead>
                  <TableHead>سياسة الحجز</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAirlines.map((airline) => (
                  <TableRow key={airline.id}>
                    <TableCell>
                      {airline.logo_url ? (
                        <img src={airline.logo_url} alt={airline.name} className="h-10 w-10 object-contain" />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                          <Plane className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{airline.name}</p>
                        <p className="text-sm text-slate-500">{airline.name_en}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{airline.code}</Badge>
                    </TableCell>
                    <TableCell>{airline.country}</TableCell>
                    <TableCell>{policyLabels[airline.booking_policy]}</TableCell>
                    <TableCell>
                      <Badge className={airline.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {airline.is_active !== false ? 'نشطة' : 'غير نشطة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(airline)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(airline.id)}>
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