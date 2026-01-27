import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ProviderSidebar from '@/components/provider/ProviderSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, Send, Users, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function ProviderTransfer() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  
  const [transferData, setTransferData] = useState({
    agent_id: '',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    const user = JSON.parse(systemUser);
    if (user.role !== 'provider' || !user.related_entity_id) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (providerId) => {
    const [providerData, agentsData] = await Promise.all([
      base44.entities.Provider.filter({ id: providerId }),
      base44.entities.ProviderAgent.filter({ provider_id: providerId, is_active: true })
    ]);
    
    if (providerData.length > 0) {
      setProvider(providerData[0]);
    }
    
    setAgents(agentsData);
    setLoading(false);
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferData.amount);
    
    if (!transferData.agent_id) {
      toast.error('يرجى اختيار الوكيل');
      return;
    }
    
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    if (amount > (provider?.balance || 0)) {
      toast.error('الرصيد غير كافي');
      return;
    }
    
    setTransferring(true);
    
    try {
      const selectedAgent = agents.find(a => a.id === transferData.agent_id);
      
      // خصم من رصيد المزود
      await base44.entities.Provider.update(provider.id, {
        balance: (provider.balance || 0) - amount
      });
      
      // إضافة لرصيد الوكيل
      await base44.entities.ProviderAgent.update(transferData.agent_id, {
        balance: (selectedAgent.balance || 0) + amount
      });
      
      // تسجيل معاملة للمزود
      await base44.entities.ProviderTransaction.create({
        provider_id: provider.id,
        provider_name: provider.company_name_ar,
        transaction_type: 'transfer_to_agent',
        amount: -amount,
        balance_before: provider.balance,
        balance_after: (provider.balance || 0) - amount,
        reference_type: 'transfer',
        related_agent_id: transferData.agent_id,
        related_agent_name: selectedAgent.name,
        description: `تحويل رصيد للوكيل ${selectedAgent.name}`,
        notes: transferData.notes,
        status: 'completed'
      });
      
      toast.success(`تم تحويل $${amount} للوكيل ${selectedAgent.name} بنجاح`);
      
      // تحديث البيانات
      setTransferData({ agent_id: '', amount: '', notes: '' });
      loadData(provider.id);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التحويل');
    }
    
    setTransferring(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedAgent = agents.find(a => a.id === transferData.agent_id);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <ProviderSidebar provider={provider} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* العنوان */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Send className="h-6 w-6" />
            تحويل رصيد للوكلاء
          </h1>
          <p className="text-slate-600">إضافة رصيد لحسابات الوكلاء التابعين لك</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* نموذج التحويل */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>تحويل رصيد</CardTitle>
                <CardDescription>اختر الوكيل والمبلغ المراد تحويله</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* رصيدك الحالي */}
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-sm text-blue-600">رصيدك الحالي</p>
                  <p className="text-3xl font-bold text-blue-700">${(provider?.balance || 0).toLocaleString()}</p>
                </div>

                {agents.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">لا يوجد وكلاء</p>
                    <Button 
                      className="mt-4"
                      onClick={() => navigate(createPageUrl('ProviderAgents'))}
                    >
                      إضافة وكيل
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>اختر الوكيل *</Label>
                      <Select 
                        value={transferData.agent_id} 
                        onValueChange={(v) => setTransferData({ ...transferData, agent_id: v })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر الوكيل" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center justify-between gap-4">
                                <span>{agent.name}</span>
                                <span className="text-slate-500 text-sm">
                                  رصيده: ${(agent.balance || 0).toLocaleString()}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>المبلغ *</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          type="number"
                          value={transferData.amount}
                          onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                          placeholder="0.00"
                          className="pr-10 text-2xl h-14"
                          min="0"
                          max={provider?.balance || 0}
                        />
                      </div>
                      {parseFloat(transferData.amount) > (provider?.balance || 0) && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          المبلغ أكبر من الرصيد المتاح
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>ملاحظات (اختياري)</Label>
                      <Textarea
                        value={transferData.notes}
                        onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                        placeholder="سبب التحويل..."
                        rows={3}
                      />
                    </div>

                    <Button 
                      onClick={handleTransfer}
                      disabled={
                        transferring || 
                        !transferData.agent_id || 
                        !transferData.amount ||
                        parseFloat(transferData.amount) <= 0 ||
                        parseFloat(transferData.amount) > (provider?.balance || 0)
                      }
                      className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                    >
                      {transferring ? (
                        <>
                          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                          جاري التحويل...
                        </>
                      ) : (
                        <>
                          <Send className="ml-2 h-5 w-5" />
                          تأكيد التحويل
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ملخص التحويل */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>ملخص التحويل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAgent && parseFloat(transferData.amount) > 0 ? (
                  <>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">المستلم:</span>
                        <span className="font-semibold">{selectedAgent.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">المبلغ:</span>
                        <span className="font-bold text-green-600">${parseFloat(transferData.amount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-slate-600">رصيده بعد التحويل:</span>
                        <span className="font-semibold">
                          ${((selectedAgent.balance || 0) + parseFloat(transferData.amount)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">رصيدك بعد التحويل:</span>
                        <span className="font-semibold">
                          ${((provider?.balance || 0) - parseFloat(transferData.amount)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>اختر الوكيل والمبلغ لعرض الملخص</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* قائمة الوكلاء */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  أرصدة الوكلاء
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">{agent.name}</span>
                      <span className={`font-bold ${(agent.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(agent.balance || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}