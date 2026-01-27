import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, Pencil, Trash2, Plane, Upload, Search, Brain, Loader2, 
  Pause, Play, Globe, Twitter, Facebook, Instagram, ExternalLink,
  Luggage, FileText, Check, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAirlinesComplete() {
  const navigate = useNavigate();
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAirline, setEditingAirline] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    iata_code: '',
    icao_code: '',
    logo_url: '',
    country: '',
    website_url: '',
    social_links: [],
    baggage_economy: '',
    baggage_business: '',
    baggage_first: '',
    hand_baggage: '',
    terms_conditions: '',
    cancellation_policy: '',
    change_policy: '',
    notes: '',
    is_active: true
  });

  const [aiFormData, setAiFormData] = useState({
    website_url: '',
    social_links: ''
  });

  const [newSocialLink, setNewSocialLink] = useState({ platform: '', url: '' });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadAirlines();
  }, []);

  const loadAirlines = async () => {
    const data = await base44.entities.Airline.list('-created_date');
    setAirlines(data);
    setLoading(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, logo_url: file_url });
    setUploading(false);
    toast.success('تم رفع الشعار');
  };

  const addSocialLink = () => {
    if (!newSocialLink.platform || !newSocialLink.url) return;
    setFormData({
      ...formData,
      social_links: [...(formData.social_links || []), newSocialLink]
    });
    setNewSocialLink({ platform: '', url: '' });
  };

  const removeSocialLink = (index) => {
    const updated = formData.social_links.filter((_, i) => i !== index);
    setFormData({ ...formData, social_links: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingAirline) {
      await base44.entities.Airline.update(editingAirline.id, formData);
      toast.success('تم تحديث شركة الطيران');
    } else {
      await base44.entities.Airline.create({
        ...formData,
        created_by_method: 'manual'
      });
      toast.success('تم إضافة شركة الطيران بنجاح');
    }
    
    setDialogOpen(false);
    resetForm();
    loadAirlines();
  };

  const handleAICreate = async () => {
    if (!aiFormData.website_url) {
      toast.error('يرجى إدخال رابط موقع الشركة');
      return;
    }

    setAiLoading(true);
    
    try {
      const prompt = `
      قم بجمع معلومات شركة الطيران من الرابط التالي: ${aiFormData.website_url}
      ${aiFormData.social_links ? `وأيضاً من منصات التواصل الاجتماعي: ${aiFormData.social_links}` : ''}
      
      أريد المعلومات التالية:
      - اسم الشركة بالعربية والإنجليزية
      - رمز IATA و ICAO
      - الدولة
      - معلومات الأمتعة (اقتصادي، رجال أعمال، أولى، حقيبة يد)
      - شروط وأحكام الحجز
      - سياسة الإلغاء
      - سياسة التغيير
      - روابط منصات التواصل الاجتماعي
      `;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name_ar: { type: "string" },
            name_en: { type: "string" },
            iata_code: { type: "string" },
            icao_code: { type: "string" },
            country: { type: "string" },
            baggage_economy: { type: "string" },
            baggage_business: { type: "string" },
            baggage_first: { type: "string" },
            hand_baggage: { type: "string" },
            terms_conditions: { type: "string" },
            cancellation_policy: { type: "string" },
            change_policy: { type: "string" },
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
        is_active: true
      });
      
      setActiveTab('manual');
      toast.success('تم جلب بيانات الشركة بنجاح، يرجى مراجعتها');
    } catch (error) {
      toast.error('حدث خطأ في جلب البيانات');
    }
    
    setAiLoading(false);
  };

  const handleEdit = (airline) => {
    setEditingAirline(airline);
    setFormData({
      name_ar: airline.name_ar || '',
      name_en: airline.name_en || '',
      iata_code: airline.iata_code || '',
      icao_code: airline.icao_code || '',
      logo_url: airline.logo_url || '',
      country: airline.country || '',
      website_url: airline.website_url || '',
      social_links: airline.social_links || [],
      baggage_economy: airline.baggage_economy || '',
      baggage_business: airline.baggage_business || '',
      baggage_first: airline.baggage_first || '',
      hand_baggage: airline.hand_baggage || '',
      terms_conditions: airline.terms_conditions || '',
      cancellation_policy: airline.cancellation_policy || '',
      change_policy: airline.change_policy || '',
      notes: airline.notes || '',
      is_active: airline.is_active !== false
    });
    setActiveTab('manual');
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const flights = await base44.entities.Flight.filter({ airline_id: id });
    if (flights.length > 0) {
      toast.error('لا يمكن حذف الشركة لوجود رحلات مرتبطة بها');
      return;
    }
    
    if (confirm('هل أنت متأكد من حذف شركة الطيران؟')) {
      await base44.entities.Airline.delete(id);
      toast.success('تم حذف شركة الطيران');
      loadAirlines();
    }
  };

  const handleToggleStatus = async (airline) => {
    await base44.entities.Airline.update(airline.id, {
      is_active: !airline.is_active
    });
    loadAirlines();
  };

  const resetForm = () => {
    setEditingAirline(null);
    setFormData({
      name_ar: '',
      name_en: '',
      iata_code: '',
      icao_code: '',
      logo_url: '',
      country: '',
      website_url: '',
      social_links: [],
      baggage_economy: '',
      baggage_business: '',
      baggage_first: '',
      hand_baggage: '',
      terms_conditions: '',
      cancellation_policy: '',
      change_policy: '',
      notes: '',
      is_active: true
    });
    setAiFormData({ website_url: '', social_links: '' });
  };

  const filteredAirlines = airlines.filter(a =>
    a.name_ar?.includes(searchTerm) ||
    a.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.iata_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const platformIcons = {
    twitter: Twitter,
    facebook: Facebook,
    instagram: Instagram,
    website: Globe
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="h-6 w-6 text-blue-600" />
              إدارة شركات الطيران
            </h1>
            <p className="text-slate-600">إضافة وإدارة شركات الطيران</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="ml-2 h-4 w-4" />
                إضافة شركة طيران
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAirline ? 'تعديل شركة الطيران' : 'إضافة شركة طيران جديدة'}</DialogTitle>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="manual">إضافة يدوية</TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    إضافة بالذكاء الاصطناعي
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-6 space-y-4">
                      <Alert>
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                          أدخل رابط موقع شركة الطيران وسيقوم النظام بجمع جميع المعلومات تلقائياً
                        </AlertDescription>
                      </Alert>

                      <div>
                        <Label>رابط موقع الشركة الرسمي *</Label>
                        <Input
                          value={aiFormData.website_url}
                          onChange={(e) => setAiFormData({ ...aiFormData, website_url: e.target.value })}
                          placeholder="https://www.yemenia.com"
                          dir="ltr"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>روابط منصات التواصل الاجتماعي (اختياري)</Label>
                        <Textarea
                          value={aiFormData.social_links}
                          onChange={(e) => setAiFormData({ ...aiFormData, social_links: e.target.value })}
                          placeholder="أدخل روابط الفيسبوك، تويتر، انستجرام..."
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <Button 
                        onClick={handleAICreate} 
                        disabled={aiLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري جلب البيانات...
                          </>
                        ) : (
                          <>
                            <Brain className="ml-2 h-4 w-4" />
                            جلب بيانات الشركة
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manual">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">المعلومات الأساسية</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>اسم الشركة (عربي) *</Label>
                          <Input
                            value={formData.name_ar}
                            onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
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

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>رمز IATA *</Label>
                          <Input
                            value={formData.iata_code}
                            onChange={(e) => setFormData({ ...formData, iata_code: e.target.value.toUpperCase() })}
                            placeholder="IY"
                            maxLength={2}
                            dir="ltr"
                            required
                          />
                        </div>
                        <div>
                          <Label>رمز ICAO</Label>
                          <Input
                            value={formData.icao_code}
                            onChange={(e) => setFormData({ ...formData, icao_code: e.target.value.toUpperCase() })}
                            placeholder="IYE"
                            maxLength={4}
                            dir="ltr"
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
                        <div className="mt-1">
                          {formData.logo_url ? (
                            <div className="flex items-center gap-4">
                              <img src={formData.logo_url} alt="" className="h-16 w-auto border rounded p-2" />
                              <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, logo_url: '' })}>
                                تغيير
                              </Button>
                            </div>
                          ) : (
                            <Label className="cursor-pointer flex items-center justify-center p-6 border-2 border-dashed rounded-lg hover:bg-slate-50">
                              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-slate-400 ml-2" />}
                              <span>رفع الشعار</span>
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
                          placeholder="https://www.example.com"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Social Links */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                      <h3 className="font-semibold">منصات التواصل الاجتماعي</h3>
                      
                      <div className="flex gap-2">
                        <Input
                          value={newSocialLink.platform}
                          onChange={(e) => setNewSocialLink({ ...newSocialLink, platform: e.target.value })}
                          placeholder="اسم المنصة (twitter, facebook...)"
                          className="flex-1"
                        />
                        <Input
                          value={newSocialLink.url}
                          onChange={(e) => setNewSocialLink({ ...newSocialLink, url: e.target.value })}
                          placeholder="الرابط"
                          dir="ltr"
                          className="flex-1"
                        />
                        <Button type="button" onClick={addSocialLink} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {formData.social_links?.map((link, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border">
                          <Badge variant="outline">{link.platform}</Badge>
                          <span className="text-sm flex-1 truncate" dir="ltr">{link.url}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSocialLink(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Baggage Info */}
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Luggage className="h-5 w-5" />
                        معلومات الأمتعة
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الدرجة السياحية (Economy)</Label>
                          <Input
                            value={formData.baggage_economy}
                            onChange={(e) => setFormData({ ...formData, baggage_economy: e.target.value })}
                            placeholder="مثال: 23 كجم"
                          />
                        </div>
                        <div>
                          <Label>درجة رجال الأعمال (Business)</Label>
                          <Input
                            value={formData.baggage_business}
                            onChange={(e) => setFormData({ ...formData, baggage_business: e.target.value })}
                            placeholder="مثال: 32 كجم"
                          />
                        </div>
                        <div>
                          <Label>الدرجة الأولى (First)</Label>
                          <Input
                            value={formData.baggage_first}
                            onChange={(e) => setFormData({ ...formData, baggage_first: e.target.value })}
                            placeholder="مثال: 46 كجم"
                          />
                        </div>
                        <div>
                          <Label>حقيبة اليد</Label>
                          <Input
                            value={formData.hand_baggage}
                            onChange={(e) => setFormData({ ...formData, hand_baggage: e.target.value })}
                            placeholder="مثال: 7 كجم"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Terms & Policies */}
                    <div className="space-y-4 p-4 bg-amber-50 rounded-lg">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        الشروط والسياسات
                      </h3>
                      
                      <div>
                        <Label>شروط وأحكام الحجز</Label>
                        <Textarea
                          value={formData.terms_conditions}
                          onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label>سياسة الإلغاء والاسترجاع</Label>
                        <Textarea
                          value={formData.cancellation_policy}
                          onChange={(e) => setFormData({ ...formData, cancellation_policy: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label>سياسة تغيير الحجز</Label>
                        <Textarea
                          value={formData.change_policy}
                          onChange={(e) => setFormData({ ...formData, change_policy: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <Label>ملاحظات إضافية</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        {editingAirline ? 'تحديث' : 'إضافة'} الشركة
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث عن شركة طيران..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Airlines Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشعار</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>الرموز</TableHead>
                  <TableHead>الدولة</TableHead>
                  <TableHead>الأمتعة</TableHead>
                  <TableHead>الروابط</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAirlines.map((airline) => (
                  <TableRow key={airline.id}>
                    <TableCell>
                      {airline.logo_url ? (
                        <img src={airline.logo_url} alt="" className="h-10 w-10 object-contain" />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                          <Plane className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{airline.name_ar}</p>
                        {airline.name_en && <p className="text-xs text-slate-500" dir="ltr">{airline.name_en}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="font-mono">{airline.iata_code}</Badge>
                        {airline.icao_code && <Badge variant="secondary" className="font-mono text-xs">{airline.icao_code}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{airline.country}</TableCell>
                    <TableCell>
                      {airline.baggage_economy && (
                        <Badge variant="secondary" className="text-xs">
                          <Luggage className="h-3 w-3 ml-1" />
                          {airline.baggage_economy}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {airline.website_url && (
                          <a href={airline.website_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Globe className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {airline.social_links?.slice(0, 2).map((link, i) => {
                          const Icon = platformIcons[link.platform.toLowerCase()] || ExternalLink;
                          return (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Icon className="h-4 w-4" />
                              </Button>
                            </a>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={airline.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                          {airline.is_active !== false ? 'نشطة' : 'موقفة'}
                        </Badge>
                        {airline.created_by_method === 'ai' && (
                          <Brain className="h-4 w-4 text-purple-500" title="أضيفت بالذكاء الاصطناعي" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(airline)}>
                          {airline.is_active !== false ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-green-600" />}
                        </Button>
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
            
            {filteredAirlines.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Plane className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>لا توجد شركات طيران</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}