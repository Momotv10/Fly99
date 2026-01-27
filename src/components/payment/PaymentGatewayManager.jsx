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
import { Plus, Pencil, Trash2, CreditCard, Wallet, Building, Upload, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from "sonner";

const PROVIDER_CONFIG = {
  jaib: { name: 'جيب', type: 'wallet', logo: '💳', color: '#FF6B00' },
  jawali: { name: 'جوالي', type: 'wallet', logo: '📱', color: '#00A859' },
  onecash: { name: 'ون كاش', type: 'wallet', logo: '💰', color: '#E31837' },
  mobicash: { name: 'موبي كاش', type: 'wallet', logo: '💵', color: '#0066B3' },
  bank_transfer: { name: 'تحويل بنكي', type: 'bank', logo: '🏦', color: '#1E3A8A' },
  stripe: { name: 'Stripe', type: 'card', logo: '💳', color: '#635BFF' },
  paypal: { name: 'PayPal', type: 'card', logo: '🅿️', color: '#003087' },
  manual: { name: 'دفع يدوي', type: 'manual', logo: '✋', color: '#6B7280' }
};

const VERIFICATION_METHODS = {
  automatic: 'تلقائي (API)',
  manual: 'يدوي (مراجعة)',
  ai_ocr: 'ذكاء اصطناعي (قراءة الإيصال)'
};

export default function PaymentGatewayManager() {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'wallet',
    provider: 'jaib',
    account_number: '',
    account_name: '',
    logo_url: '',
    instructions_ar: '',
    instructions_en: '',
    api_key: '',
    api_secret: '',
    webhook_url: '',
    verification_method: 'manual',
    display_order: 0,
    is_active: true
  });

  useEffect(() => {
    loadGateways();
  }, []);

  const loadGateways = async () => {
    const data = await base44.entities.PaymentGateway.list('display_order');
    setGateways(data);
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

  const handleProviderChange = (provider) => {
    const config = PROVIDER_CONFIG[provider];
    setFormData({
      ...formData,
      provider,
      type: config.type,
      name: config.name,
      verification_method: config.type === 'card' ? 'automatic' : 'manual'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingGateway) {
      await base44.entities.PaymentGateway.update(editingGateway.id, formData);
      toast.success('تم تحديث بوابة الدفع');
    } else {
      // إنشاء حساب مالي للبوابة
      const account = await base44.entities.Account.create({
        name: `بوابة الدفع - ${formData.name}`,
        name_en: `Payment Gateway - ${formData.name}`,
        type: 'asset',
        category: 'payment_gateway',
        balance: 0,
        is_active: true
      });
      
      await base44.entities.PaymentGateway.create({
        ...formData,
        account_id: account.id
      });
      toast.success('تم إنشاء بوابة الدفع');
    }
    
    setDialogOpen(false);
    resetForm();
    loadGateways();
  };

  const handleEdit = (gateway) => {
    setEditingGateway(gateway);
    setFormData({
      name: gateway.name || '',
      type: gateway.type || 'wallet',
      provider: gateway.provider || 'jaib',
      account_number: gateway.account_number || '',
      account_name: gateway.account_name || '',
      logo_url: gateway.logo_url || '',
      instructions_ar: gateway.instructions_ar || '',
      instructions_en: gateway.instructions_en || '',
      api_key: gateway.api_key || '',
      api_secret: gateway.api_secret || '',
      webhook_url: gateway.webhook_url || '',
      verification_method: gateway.verification_method || 'manual',
      display_order: gateway.display_order || 0,
      is_active: gateway.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف بوابة الدفع؟')) {
      await base44.entities.PaymentGateway.delete(id);
      toast.success('تم حذف بوابة الدفع');
      loadGateways();
    }
  };

  const handleToggleStatus = async (gateway) => {
    await base44.entities.PaymentGateway.update(gateway.id, {
      is_active: !gateway.is_active
    });
    loadGateways();
  };

  const resetForm = () => {
    setEditingGateway(null);
    setFormData({
      name: '',
      type: 'wallet',
      provider: 'jaib',
      account_number: '',
      account_name: '',
      logo_url: '',
      instructions_ar: '',
      instructions_en: '',
      api_key: '',
      api_secret: '',
      webhook_url: '',
      verification_method: 'manual',
      display_order: 0,
      is_active: true
    });
    setShowSecrets(false);
  };

  const typeIcons = {
    wallet: Wallet,
    bank: Building,
    card: CreditCard,
    manual: CreditCard
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">بوابات الدفع</h2>
          <p className="text-slate-600">إدارة طرق الدفع المتاحة للعملاء</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="ml-2 h-4 w-4" />
              إضافة بوابة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingGateway ? 'تعديل بوابة الدفع' : 'إضافة بوابة دفع جديدة'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>مزود الخدمة *</Label>
                <Select value={formData.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{config.logo}</span>
                          <span>{config.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم البوابة *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              {(formData.type === 'wallet' || formData.type === 'bank') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>رقم الحساب *</Label>
                      <Input
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <Label>اسم صاحب الحساب *</Label>
                      <Input
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>تعليمات الدفع (عربي) *</Label>
                    <Textarea
                      value={formData.instructions_ar}
                      onChange={(e) => setFormData({ ...formData, instructions_ar: e.target.value })}
                      rows={3}
                      placeholder="1. افتح تطبيق المحفظة&#10;2. اختر تحويل&#10;3. أدخل الرقم..."
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>تعليمات الدفع (إنجليزي)</Label>
                    <Textarea
                      value={formData.instructions_en}
                      onChange={(e) => setFormData({ ...formData, instructions_en: e.target.value })}
                      rows={3}
                      dir="ltr"
                    />
                  </div>
                </>
              )}
              
              {formData.type === 'card' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>API Key</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showSecrets ? "text" : "password"}
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          dir="ltr"
                        />
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowSecrets(!showSecrets)}
                        >
                          {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={formData.api_secret}
                        onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Webhook URL</Label>
                    <Input
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                      dir="ltr"
                      placeholder="https://..."
                    />
                  </div>
                </>
              )}
              
              <div>
                <Label>شعار البوابة</Label>
                <div className="mt-1">
                  {formData.logo_url ? (
                    <div className="flex items-center gap-4">
                      <img src={formData.logo_url} alt="Logo" className="h-12 w-auto object-contain border rounded p-2" />
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
                          <span className="text-sm text-slate-600">رفع شعار</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </Label>
                  )}
                </div>
              </div>
              
              <div>
                <Label>طريقة التحقق من الدفع *</Label>
                <Select value={formData.verification_method} onValueChange={(v) => setFormData({ ...formData, verification_method: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VERIFICATION_METHODS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.verification_method === 'ai_ocr' && 'سيقوم النظام بقراءة صورة إيصال الدفع والتحقق منها تلقائياً'}
                  {formData.verification_method === 'manual' && 'سيتم مراجعة الدفع يدوياً من قبل الإدارة'}
                  {formData.verification_method === 'automatic' && 'سيتم التحقق تلقائياً عبر API البوابة'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>بوابة نشطة</Label>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gateways.map((gateway) => {
          const config = PROVIDER_CONFIG[gateway.provider] || PROVIDER_CONFIG.manual;
          const TypeIcon = typeIcons[gateway.type] || CreditCard;
          
          return (
            <Card key={gateway.id} className={!gateway.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {gateway.logo_url ? (
                      <img src={gateway.logo_url} alt="" className="h-10 w-auto" />
                    ) : (
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-xl"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.logo}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{gateway.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        <TypeIcon className="h-3 w-3 ml-1" />
                        {gateway.type === 'wallet' ? 'محفظة' : gateway.type === 'bank' ? 'بنك' : 'بطاقة'}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={gateway.is_active}
                    onCheckedChange={() => handleToggleStatus(gateway)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {gateway.account_number && (
                  <p className="text-sm" dir="ltr">
                    <span className="text-slate-500">الحساب:</span> {gateway.account_number}
                  </p>
                )}
                {gateway.account_name && (
                  <p className="text-sm">
                    <span className="text-slate-500">باسم:</span> {gateway.account_name}
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-slate-500">التحقق:</span> {VERIFICATION_METHODS[gateway.verification_method]}
                </p>
                
                <div className="flex justify-between text-xs text-slate-500 pt-2 border-t">
                  <span>العمليات: {gateway.total_transactions || 0}</span>
                  <span>الإجمالي: ${gateway.total_amount || 0}</span>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(gateway)}>
                    <Pencil className="h-4 w-4 ml-1" />
                    تعديل
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {gateways.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">لم يتم إضافة أي بوابة دفع</p>
        </Card>
      )}
    </div>
  );
}