import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Copy, FileText } from 'lucide-react';
import { toast } from "sonner";

// المتغيرات المتاحة للقوالب
const AVAILABLE_VARIABLES = [
  { key: '{customer_name}', label: 'اسم العميل' },
  { key: '{booking_number}', label: 'رقم الحجز' },
  { key: '{flight_number}', label: 'رقم الرحلة' },
  { key: '{departure_city}', label: 'مدينة المغادرة' },
  { key: '{arrival_city}', label: 'مدينة الوصول' },
  { key: '{departure_date}', label: 'تاريخ المغادرة' },
  { key: '{departure_time}', label: 'وقت المغادرة' },
  { key: '{total_amount}', label: 'المبلغ الإجمالي' },
  { key: '{ticket_number}', label: 'رقم التذكرة' },
  { key: '{provider_name}', label: 'اسم المزود' },
  { key: '{airline_name}', label: 'شركة الطيران' }
];

const CATEGORY_LABELS = {
  booking_confirmation: 'تأكيد الحجز',
  ticket_ready: 'التذكرة جاهزة',
  payment_reminder: 'تذكير بالدفع',
  travel_reminder: 'تذكير بالسفر',
  provider_request: 'طلب للمزود',
  provider_confirmation: 'تأكيد المزود',
  cancellation: 'إلغاء',
  general: 'عام'
};

const TARGET_LABELS = {
  customer: 'العملاء',
  provider: 'المزودين',
  agent: 'الوكلاء',
  employee: 'الموظفين'
};

export default function MessageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'general',
    target_audience: 'customer',
    content_ar: '',
    content_en: '',
    variables: [],
    include_attachment: false,
    attachment_type: '',
    is_active: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const data = await base44.entities.MessageTemplate.list();
    setTemplates(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // استخراج المتغيرات من المحتوى
    const usedVariables = AVAILABLE_VARIABLES
      .filter(v => formData.content_ar.includes(v.key) || formData.content_en?.includes(v.key))
      .map(v => v.key);
    
    const dataToSave = {
      ...formData,
      variables: usedVariables
    };
    
    if (editingTemplate) {
      await base44.entities.MessageTemplate.update(editingTemplate.id, dataToSave);
      toast.success('تم تحديث القالب');
    } else {
      await base44.entities.MessageTemplate.create(dataToSave);
      toast.success('تم إنشاء القالب');
    }
    
    setDialogOpen(false);
    resetForm();
    loadTemplates();
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      code: template.code || '',
      category: template.category || 'general',
      target_audience: template.target_audience || 'customer',
      content_ar: template.content_ar || '',
      content_en: template.content_en || '',
      variables: template.variables || [],
      include_attachment: template.include_attachment || false,
      attachment_type: template.attachment_type || '',
      is_active: template.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف القالب؟')) {
      await base44.entities.MessageTemplate.delete(id);
      toast.success('تم حذف القالب');
      loadTemplates();
    }
  };

  const insertVariable = (variable) => {
    setFormData({
      ...formData,
      content_ar: formData.content_ar + variable
    });
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      code: '',
      category: 'general',
      target_audience: 'customer',
      content_ar: '',
      content_en: '',
      variables: [],
      include_attachment: false,
      attachment_type: '',
      is_active: true
    });
  };

  const filteredTemplates = filterCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === filterCategory);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">قوالب الرسائل</h2>
          <p className="text-slate-600">إدارة قوالب رسائل الواتساب</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="ml-2 h-4 w-4" />
              إضافة قالب
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم القالب *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>رمز القالب *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    placeholder="booking_confirmation"
                    dir="ltr"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>التصنيف *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الجمهور المستهدف *</Label>
                  <Select value={formData.target_audience} onValueChange={(v) => setFormData({ ...formData, target_audience: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TARGET_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>المتغيرات المتاحة</Label>
                <div className="flex flex-wrap gap-1 mt-1 p-2 bg-slate-50 rounded">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.key)}
                      className="text-xs"
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>محتوى الرسالة (عربي) *</Label>
                <Textarea
                  value={formData.content_ar}
                  onChange={(e) => setFormData({ ...formData, content_ar: e.target.value })}
                  rows={6}
                  placeholder="مرحباً {customer_name}، تم تأكيد حجزك..."
                  required
                />
              </div>
              
              <div>
                <Label>محتوى الرسالة (إنجليزي)</Label>
                <Textarea
                  value={formData.content_en}
                  onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                  rows={6}
                  placeholder="Hello {customer_name}, your booking is confirmed..."
                  dir="ltr"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.include_attachment}
                    onCheckedChange={(v) => setFormData({ ...formData, include_attachment: v })}
                  />
                  <Label>تضمين مرفق</Label>
                </div>
                
                {formData.include_attachment && (
                  <Select value={formData.attachment_type} onValueChange={(v) => setFormData({ ...formData, attachment_type: v })}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="نوع المرفق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticket">التذكرة</SelectItem>
                      <SelectItem value="invoice">الفاتورة</SelectItem>
                      <SelectItem value="custom">مخصص</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>قالب نشط</Label>
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

      <div className="flex gap-4 items-center">
        <Label>تصفية:</Label>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع التصنيفات</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>القالب</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الجمهور</TableHead>
                <TableHead>المتغيرات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{template.code}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{CATEGORY_LABELS[template.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TARGET_LABELS[template.target_audience]}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-500">
                      {(template.variables || []).length} متغير
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                      {template.is_active ? 'نشط' : 'متوقف'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
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
  );
}