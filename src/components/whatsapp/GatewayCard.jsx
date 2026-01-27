import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Send, Edit, Trash, Activity, Globe, Key, Power, PowerOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import WhatsAppConnect from './WhatsAppConnect';
import TestMessageForm from './TestMessageForm';

export default function GatewayCard({ gateway, onUpdate, onEdit, onDelete }) {
  const [showTest, setShowTest] = useState(false);

  const handleToggleActive = async () => {
    try {
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        is_active: !gateway.is_active
      });
      toast.success(gateway.is_active ? 'تم إيقاف البوابة' : 'تم تفعيل البوابة');
      onUpdate();
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  const typeLabels = {
    customers: { name: 'العملاء', color: 'bg-blue-100 text-blue-800' },
    providers: { name: 'المزودين', color: 'bg-purple-100 text-purple-800' },
    employees: { name: 'الموظفين', color: 'bg-green-100 text-green-800' }
  };

  const handleDelete = () => {
    if (confirm(`هل تريد حذف البوابة "${gateway.name}"؟`)) {
      onDelete(gateway.id);
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{gateway.name}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={typeLabels[gateway.type]?.color}>
                  {typeLabels[gateway.type]?.name}
                </Badge>
                {gateway.is_default && (
                  <Badge className="bg-blue-500">افتراضي</Badge>
                )}
                {!gateway.is_active && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    متوقفة
                  </Badge>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowTest(true)}>
                  <Send className="h-4 w-4 ml-2" />
                  اختبار الإرسال
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(gateway)}>
                  <Edit className="h-4 w-4 ml-2" />
                  تعديل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleActive}>
                  {gateway.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4 ml-2" />
                      إيقاف البوابة
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 ml-2" />
                      تفعيل البوابة
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash className="h-4 w-4 ml-2" />
                  حذف البوابة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <WhatsAppConnect gateway={gateway} onUpdate={onUpdate} />

          <div className="pt-3 border-t space-y-3">
            <div>
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                <Globe className="h-3 w-3" />
                خادم WAHA
              </Label>
              <p className="text-xs font-mono text-slate-700 truncate" dir="ltr" title={gateway.waha_server_url}>
                {gateway.waha_server_url}
              </p>
            </div>
            
            <div>
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                <Key className="h-3 w-3" />
                API Key
              </Label>
              <p className="text-xs font-mono text-slate-700">
                {gateway.waha_api_key ? '••••••••' + gateway.waha_api_key.slice(-4) : 'غير محدد'}
              </p>
            </div>

            {gateway.phone_number && (
              <div>
                <Label className="text-xs text-slate-500">الرقم المتصل</Label>
                <p className="text-sm font-mono font-semibold" dir="ltr">{gateway.phone_number}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs pt-3 border-t">
            <div className="text-center">
              <p className="font-semibold text-green-600 text-lg">{gateway.messages_sent || 0}</p>
              <p className="text-slate-500">مرسلة</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-blue-600 text-lg">{gateway.messages_received || 0}</p>
              <p className="text-slate-500">مستلمة</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-purple-600 text-lg">
                {((gateway.messages_sent || 0) + (gateway.messages_received || 0))}
              </p>
              <p className="text-slate-500">الإجمالي</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              اختبار إرسال رسالة
            </DialogTitle>
          </DialogHeader>
          <TestMessageForm gateway={gateway} onClose={() => setShowTest(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}