import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Plus, RefreshCw } from 'lucide-react';
import WhatsAppConnect from './WhatsAppConnect';
import { toast } from "sonner";

export default function WhatsAppGatewayManager() {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'customers',
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    loadGateways();
  }, []);

  const loadGateways = async () => {
    const data = await base44.entities.WhatsAppGateway.list();
    setGateways(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingGateway) {
      await base44.entities.WhatsAppGateway.update(editingGateway.id, formData);
      toast.success('تم تحديث البوابة');
    } else {
      await base44.entities.WhatsAppGateway.create({
        ...formData,
        status: 'disconnected',
        messages_sent: 0,
        messages_received: 0
      });
      toast.success('تم إنشاء البوابة');
    }
    
    setDialogOpen(false);
    resetForm();
    loadGateways();
  };

  const resetForm = () => {
    setEditingGateway(null);
    setFormData({
      name: '',
      type: 'customers',
      is_default: false,
      is_active: true
    });
  };

  const typeLabels = {
    customers: 'العملاء',
    providers: 'المزودين والذكاء الاصطناعي',
    employees: 'الموظفين'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">بوابات الواتساب</h2>
          <p className="text-slate-600">إدارة اتصالات الواتساب للنظام</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="ml-2 h-4 w-4" />
              إضافة بوابة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة بوابة واتساب جديدة</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>اسم البوابة *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="بوابة العملاء"
                  required
                />
              </div>
              
              <div>
                <Label>نوع البوابة *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">العملاء</SelectItem>
                    <SelectItem value="providers">المزودين والذكاء الاصطناعي</SelectItem>
                    <SelectItem value="employees">الموظفين</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.type === 'providers' && 'سيتم استخدامها للتواصل الذكي مع المزودين'}
                  {formData.type === 'customers' && 'سيتم استخدامها لإرسال التذاكر والإشعارات للعملاء'}
                  {formData.type === 'employees' && 'للتواصل الداخلي مع الموظفين'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                />
                <Label>البوابة الافتراضية لهذا النوع</Label>
              </div>
              
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  حفظ
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gateways.map((gateway) => (
          <Card key={gateway.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{gateway.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{typeLabels[gateway.type]}</Badge>
                  {gateway.is_default && (
                    <Badge className="mt-1 mr-1 bg-blue-500">افتراضي</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {gateway.phone_number && (
                <p className="text-sm text-slate-600" dir="ltr">
                  📱 {gateway.phone_number}
                </p>
              )}
              
              <WhatsAppConnect gateway={gateway} onUpdate={loadGateways} />
              
              <div className="flex justify-between text-xs text-slate-500 pt-2 border-t">
                <span>مرسلة: {gateway.messages_sent || 0}</span>
                <span>مستلمة: {gateway.messages_received || 0}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {gateways.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">لم يتم إضافة أي بوابة واتساب</p>
          <p className="text-sm text-slate-400 mt-1">أضف بوابة جديدة للبدء</p>
        </Card>
      )}
    </div>
  );
}