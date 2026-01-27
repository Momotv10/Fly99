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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Image, Upload, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAdvertisements() {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    link_url: '',
    position: 'hero',
    order: 0,
    start_date: '',
    end_date: '',
    is_active: true
  });

  useEffect(() => {
    checkAuth();
    loadAds();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadAds = async () => {
    const data = await base44.entities.Advertisement.list();
    setAds(data);
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: file_url });
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingAd) {
      await base44.entities.Advertisement.update(editingAd.id, formData);
      toast.success('تم تحديث الإعلان بنجاح');
    } else {
      await base44.entities.Advertisement.create(formData);
      toast.success('تم إضافة الإعلان بنجاح');
    }
    
    setDialogOpen(false);
    resetForm();
    loadAds();
  };

  const handleEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title || '',
      image_url: ad.image_url || '',
      link_url: ad.link_url || '',
      position: ad.position || 'hero',
      order: ad.order || 0,
      start_date: ad.start_date || '',
      end_date: ad.end_date || '',
      is_active: ad.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف الإعلان؟')) {
      await base44.entities.Advertisement.delete(id);
      toast.success('تم حذف الإعلان');
      loadAds();
    }
  };

  const resetForm = () => {
    setEditingAd(null);
    setFormData({
      title: '',
      image_url: '',
      link_url: '',
      position: 'hero',
      order: 0,
      start_date: '',
      end_date: '',
      is_active: true
    });
  };

  const positionLabels = {
    hero: 'الصفحة الرئيسية',
    sidebar: 'الشريط الجانبي',
    footer: 'أسفل الصفحة',
    popup: 'نافذة منبثقة'
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">الإعلانات</h1>
            <p className="text-slate-600">إدارة المساحات الإعلانية</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة إعلان
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingAd ? 'تعديل الإعلان' : 'إضافة إعلان جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>عنوان الإعلان</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>صورة الإعلان</Label>
                  <div className="mt-1">
                    {formData.image_url ? (
                      <div className="relative">
                        <img src={formData.image_url} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                        >
                          تغيير الصورة
                        </Button>
                      </div>
                    ) : (
                      <Label className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg hover:bg-slate-50">
                        {uploading ? (
                          <span className="text-slate-600">جاري الرفع...</span>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-600">انقر لرفع صورة الإعلان</span>
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </Label>
                    )}
                  </div>
                </div>
                <div>
                  <Label>رابط الإعلان</Label>
                  <Input
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    placeholder="https://..."
                    dir="ltr"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>موقع العرض</Label>
                    <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hero">الصفحة الرئيسية</SelectItem>
                        <SelectItem value="sidebar">الشريط الجانبي</SelectItem>
                        <SelectItem value="footer">أسفل الصفحة</SelectItem>
                        <SelectItem value="popup">نافذة منبثقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ترتيب العرض</Label>
                    <Input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>تاريخ البداية</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>تاريخ الانتهاء</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>نشط</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit">{editingAd ? 'تحديث' : 'إضافة'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad) => (
            <Card key={ad.id} className="overflow-hidden">
              <div className="relative h-48">
                {ad.image_url ? (
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Image className="h-12 w-12 text-slate-300" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge className={ad.is_active ? 'bg-green-500' : 'bg-red-500'}>
                    {ad.is_active ? 'نشط' : 'غير نشط'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{ad.title}</h3>
                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <span>{positionLabels[ad.position]}</span>
                  <span>ترتيب: {ad.order}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(ad)}>
                    <Pencil className="h-4 w-4 ml-1" />
                    تعديل
                  </Button>
                  {ad.link_url && (
                    <a href={ad.link_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" size="icon" onClick={() => handleDelete(ad.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}