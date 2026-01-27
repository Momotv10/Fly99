import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Plane, Globe, Upload, Sparkles, Loader2, ExternalLink, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAirlinesNew() {
  const navigate = useNavigate();
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAirline, setEditingAirline] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [addMethod, setAddMethod] = useState('manual');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    iata_code: '',
    logo_url: '',
    country: '',
    website_url: '',
    social_links: [],
    baggage_economy: '23 كجم',
    baggage_business: '32 كجم',
    baggage_first: '40 كجم',
    terms_conditions: '',
    notes: '',
    is_active: true,
    created_by: 'manual'
  });

  const [aiFormData, setAiFormData] = useState({
    website_url: '',
    social_urls: ''
  });

  const [newSocialLink, setNewSocialLink] = useState({ platform: '', url: '' });

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
    const data = await base44.entities.Airline.list('-created_date');
    setAirlines(data);
    setLoading(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      setUploading(false);
    }
  };

  const addSocialLink = () => {
    if (newSocialLink.platform && newSocialLink.url) {
      setFormData({
        ...formData,
        social_links: [...(formData.social_links || []), newSocialLink]
      });
      setNewSocialLink({ platform: '', url: '' });
    }
  };

  const removeSocialLink = (index) => {
    setFormData({
      ...formData,
      social_links: formData.social_links.filter((_, i) => i !== index)
    });
  };

  const handleAIExtract = async () => {
    if (!aiFormData.website_url) {
      toast.error('يرجى إدخال رابط موقع الشركة');
      return;
    }
    
    setAiLoading(true);
    
    const prompt = `استخرج بيانات شركة الطيران من الرابط التالي: ${aiFormData.website_url}
    ${aiFormData.social_urls ? `روابط التواصل الاجتماعي: ${aiFormData.social_urls}` : ''}
    
    أريد البيانات التالية:
    - اسم الشركة بالعربية
    - اسم الشركة بالإنجليزية
    - رمز IATA
    - الدولة
    - وزن الأمتعة المسموح للدرجة السياحية
    - وزن الأمتعة المسموح لدرجة رجال الأعمال
    - وزن الأمتعة المسموح للدرجة الأولى`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          name_ar: { type: "string" },
          name_en: { type: "string" },
          iata_code: { type: "string" },
          country: { type: "string" },
          baggage_economy: { type: "string" },
          baggage_business: { type: "string" },
          baggage_first: { type: "string" },
          logo_url: { type: "string" },
          social_links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string" },
                url: { type: "string" }
              }
            }
          }
        }
      }
    });

    setFormData({
      ...formData,
      ...result,
      website_url: aiFormData.website_url,
      created_by: 'ai'
    });
    
    setAddMethod('manual');
    setAiLoading(false);
    toast.success('تم استخراج البيانات بنجاح، يمكنك مراجعتها وتعديلها');
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
      name_ar: airline.name_ar || '',
      name_en: airline.name_en || '',
      iata_code: airline.iata_code || '',
      logo_url: airline.logo_url || '',
      country: airline.country || '',
      website_url: airline.website_url || '',
      social_links: airline.social_links || [],
      baggage_economy: airline.baggage_economy || '23 كجم',
      baggage_business: airline.baggage_business || '32 كجم',
      baggage_first: airline.baggage_first || '40 كجم',
      terms_conditions: airline.terms_conditions || '',
      notes: airline.notes || '',
      is_active: airline.is_active !== false,
      created_by: airline.created_by || 'manual'
    });
    setAddMethod('manual');
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف شركة الطيران؟')) {
      await base44.entities.Airline.delete(id);
      toast.success('تم حذف شركة الطيران');
      loadAirlines();
    }
  };

  const handleToggleStatus = async (airline) => {
    await base44.entities.Airline.update(airline.id, { is_active: !airline.is_active });
    loadAirlines();
  };

  const resetForm = () => {
    setEditingAirline(null);
    setFormData({
      name_ar: '',
      name_en: '',
      iata_code: '',
      logo_url: '',
      country: '',
      website_url: '',
      social_links: [],
      baggage_economy: '23 كجم',
      baggage_business: '32 كجم',
      baggage_first: '40 كجم',
      terms_conditions: '',
      notes: '',
      is_active: true,
      created_by: 'manual'
    });
    setAiFormData({ website_url: '', social_urls: '' });
    setAddMethod('manual');
  };

  const filteredAirlines = airlines.filter(a =>
    a.name_ar?.includes(searchTerm) ||
    a.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.iata_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة شركات الطيران</h1>
            <p className="text-slate-600">إضافة وإدارة شركات الطيران المدرجة في النظام</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة شركة طيران
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAirline ? 'تعديل شركة الطيران' : 'إضافة شركة طيران جديدة'}</DialogTitle>
              </DialogHeader>
              
              {!editingAirline && (
                <Tabs value={addMethod} onValueChange={setAddMethod} className="mb-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="manual" className="flex-1">
                      <Pencil className="h-4 w-4 ml-2" />
                      إضافة يدوية
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex-1">
                      <Sparkles className="h-4 w-4 ml-2" />
                      إضافة بالذكاء الاصطناعي
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {addMethod === 'ai' && !editingAirline ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">استخراج البيانات تلقائياً</h3>
                    </div>
                    <p className="text-sm text-purple-700 mb-4">
                      أدخل رابط موقع شركة الطيران وسيقوم النظام باستخراج جميع البيانات تلقائياً
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label>رابط موقع الشركة *</Label>
                        <Input
                          value={aiFormData.website_url}
                          onChange={(e) => setAiFormData({ ...aiFormData, website_url: e.target.value })}
                          placeholder="https://www.yemenia.com"
                          dir="ltr"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>روابط التواصل الاجتماعي (اختياري)</Label>
                        <Textarea
                          value={aiFormData.social_urls}
                          onChange={(e) => setAiFormData({ ...aiFormData, social_urls: e.target.value })}
                          placeholder="https://twitter.com/yemenia&#10;https://facebook.com/yemenia"
                          dir="ltr"
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      
                      <Button 
                        onClick={handleAIExtract} 
                        disabled={aiLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري استخراج البيانات...
                          </>
                        ) : (
                          <>
                            <Sparkles className="ml-2 h-4 w-4" />
                            استخراج البيانات
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم الشركة (عربي) *</Label>
                      <Input
                        value={formData.name_ar}
                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>اسم الشركة (إنجليزي)</Label>
                      <Input
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        dir="ltr"
                        className="mt-1"
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
                        placeholder="IY"
                        dir="ltr"
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>الدولة</Label>
                      <Input
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>شعار الشركة</Label>
                    <div className="mt-1">
                      {formData.logo_url ? (
                        <div className="flex items-center gap-4">
                          <img src={formData.logo_url} alt="Logo" className="h-16 w-auto object-contain border rounded p-2" />
                          <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, logo_url: '' })}>
                            تغيير
                          </Button>
                        </div>
                      ) : (
                        <Label className="cursor-pointer flex items-center justify-center p-4 border-2 border-dashed rounded-lg hover:bg-slate-50">
                          {uploading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          ) : (
                            <>
                              <Upload className="h-6 w-6 text-slate-400 ml-2" />
                              <span className="text-sm text-slate-600">رفع شعار الشركة</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </Label>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>رابط الموقع الرسمي</Label>
                    <Input
                      value={formData.website_url}
                      onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                      placeholder="https://"
                      dir="ltr"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>روابط التواصل الاجتماعي</Label>
                    <div className="mt-2 space-y-2">
                      {(formData.social_links || []).map((link, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                          <Badge variant="outline">{link.platform}</Badge>
                          <span className="text-sm text-slate-600 flex-1 truncate" dir="ltr">{link.url}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSocialLink(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          value={newSocialLink.platform}
                          onChange={(e) => setNewSocialLink({ ...newSocialLink, platform: e.target.value })}
                          placeholder="المنصة (Twitter, Facebook...)"
                          className="w-40"
                        />
                        <Input
                          value={newSocialLink.url}
                          onChange={(e) => setNewSocialLink({ ...newSocialLink, url: e.target.value })}
                          placeholder="https://..."
                          dir="ltr"
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={addSocialLink}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>وزن الأمتعة (سياحية)</Label>
                      <Input
                        value={formData.baggage_economy}
                        onChange={(e) => setFormData({ ...formData, baggage_economy: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>وزن الأمتعة (بيزنس)</Label>
                      <Input
                        value={formData.baggage_business}
                        onChange={(e) => setFormData({ ...formData, baggage_business: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>وزن الأمتعة (أولى)</Label>
                      <Input
                        value={formData.baggage_first}
                        onChange={(e) => setFormData({ ...formData, baggage_first: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>الشروط والأحكام</Label>
                    <Textarea
                      value={formData.terms_conditions}
                      onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                      rows={4}
                      className="mt-1"
                      placeholder="شروط الحجز والإلغاء..."
                    />
                  </div>

                  <div>
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                    <Label>شركة نشطة</Label>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingAirline ? 'تحديث' : 'إضافة'}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن شركة طيران..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {airlines.length} شركة
              </Badge>
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
                  <TableHead>الموقع</TableHead>
                  <TableHead>طريقة الإضافة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAirlines.map((airline) => (
                  <TableRow key={airline.id}>
                    <TableCell>
                      {airline.logo_url ? (
                        <img src={airline.logo_url} alt="" className="h-10 w-auto object-contain" />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                          <Plane className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{airline.name_ar}</p>
                        {airline.name_en && <p className="text-sm text-slate-500">{airline.name_en}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{airline.iata_code}</Badge>
                    </TableCell>
                    <TableCell>{airline.country || '-'}</TableCell>
                    <TableCell>
                      {airline.website_url ? (
                        <a href={airline.website_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={airline.created_by === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}>
                        {airline.created_by === 'ai' ? 'ذكاء اصطناعي' : 'يدوي'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={airline.is_active !== false}
                        onCheckedChange={() => handleToggleStatus(airline)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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