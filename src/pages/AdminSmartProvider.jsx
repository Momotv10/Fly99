import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Bot, Brain, MessageSquare, Plane, Users, Clock, 
  CheckCircle2, XCircle, AlertCircle, Play, Pause, 
  RefreshCw, Send, Loader2, Eye, Settings
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { SmartProviderEngine } from '@/components/ai/SmartProviderEngine';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminSmartProvider() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({
    totalTasks: 0,
    pending: 0,
    waitingResponse: 0,
    completed: 0,
    seatsCreated: 0
  });

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    const [tasksData, providersData] = await Promise.all([
      base44.entities.AITask.filter({ 
        task_type: { $in: ['seat_request', 'provider_outreach', 'provider_command'] }
      }, '-created_date', 100),
      base44.entities.Provider.filter({ is_active: true, ai_assistant_enabled: true })
    ]);
    
    setTasks(tasksData);
    setProviders(providersData);
    
    // إحصائيات
    setStats({
      totalTasks: tasksData.length,
      pending: tasksData.filter(t => t.status === 'pending').length,
      waitingResponse: tasksData.filter(t => t.status === 'waiting_response').length,
      completed: tasksData.filter(t => t.status === 'completed').length,
      seatsCreated: tasksData.filter(t => t.status === 'completed' && t.result?.includes('seat')).length
    });
    
    setLoading(false);
  };

  const startInventoryCheck = async () => {
    setRunning(true);
    try {
      const count = await SmartProviderEngine.checkInventoryAndRequestSeats();
      toast.success(`تم إنشاء ${count} مهمة جديدة`);
      loadData();
    } catch (error) {
      toast.error('حدث خطأ: ' + error.message);
    }
    setRunning(false);
  };

  const filteredTasks = selectedProvider === 'all'
    ? tasks
    : tasks.filter(t => t.provider_id === selectedProvider);

  const statusConfig = {
    pending: { label: 'معلق', icon: Clock, color: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'قيد التنفيذ', icon: RefreshCw, color: 'bg-blue-100 text-blue-700' },
    waiting_response: { label: 'بانتظار الرد', icon: MessageSquare, color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'مكتمل', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    failed: { label: 'فشل', icon: XCircle, color: 'bg-red-100 text-red-700' }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bot className="h-7 w-7 text-purple-600" />
              المزود الذكي
            </h1>
            <p className="text-slate-600">نظام التواصل الذكي مع المزودين وإدارة المخزون</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={startInventoryCheck}
              disabled={running}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {running ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الفحص...
                </>
              ) : (
                <>
                  <Play className="ml-2 h-4 w-4" />
                  فحص المخزون الآن
                </>
              )}
            </Button>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
                <p className="text-sm text-slate-500">إجمالي المهام</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-xl">
                <Clock className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-slate-500">معلقة</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <MessageSquare className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.waitingResponse}</p>
                <p className="text-sm text-slate-500">بانتظار الرد</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-slate-500">مكتملة</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.seatsCreated}</p>
                <p className="text-sm text-slate-500">مقاعد أُضيفت</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* قائمة المهام */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>سجل المهام</CardTitle>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="المزود" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المزودين</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.company_name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredTasks.map((task) => {
                    const status = statusConfig[task.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow ${
                          selectedTask?.id === task.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${status.color}`}>
                              <StatusIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{task.provider_name}</p>
                              <p className="text-sm text-slate-600">{task.flight_details}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {task.created_date && format(new Date(task.created_date), 'dd MMM yyyy HH:mm', { locale: ar })}
                              </p>
                            </div>
                          </div>
                          <Badge className={status.color}>
                            {status.label}
                          </Badge>
                        </div>
                        
                        {task.conversation_history && task.conversation_history.length > 0 && (
                          <div className="mt-3 text-xs text-slate-500">
                            {task.conversation_history.length} رسالة في المحادثة
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {filteredTasks.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا توجد مهام</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* تفاصيل المهمة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                تفاصيل المهمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTask ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500">المزود</Label>
                    <p className="font-semibold">{selectedTask.provider_name}</p>
                    <p className="text-sm text-slate-500" dir="ltr">{selectedTask.provider_whatsapp}</p>
                  </div>
                  
                  <div>
                    <Label className="text-slate-500">الرحلة</Label>
                    <p>{selectedTask.flight_details}</p>
                  </div>
                  
                  <div>
                    <Label className="text-slate-500">الحالة</Label>
                    <Badge className={statusConfig[selectedTask.status]?.color}>
                      {statusConfig[selectedTask.status]?.label}
                    </Badge>
                  </div>
                  
                  {selectedTask.ai_thinking && (
                    <div>
                      <Label className="text-slate-500">تحليل الذكاء الاصطناعي</Label>
                      <div className="p-3 bg-purple-50 rounded-lg text-sm mt-1">
                        {selectedTask.ai_thinking}
                      </div>
                    </div>
                  )}
                  
                  {selectedTask.conversation_history && selectedTask.conversation_history.length > 0 && (
                    <div>
                      <Label className="text-slate-500">المحادثة</Label>
                      <ScrollArea className="h-48 mt-1">
                        <div className="space-y-2">
                          {selectedTask.conversation_history.map((msg, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded text-sm ${
                                msg.role === 'ai' ? 'bg-purple-100 mr-4' : 'bg-blue-100 ml-4'
                              }`}
                            >
                              <p className="text-xs text-slate-500 mb-1">
                                {msg.role === 'ai' ? '🤖 النظام' : '👤 المزود'}
                              </p>
                              <p>{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  
                  {selectedTask.result && (
                    <div>
                      <Label className="text-slate-500">النتيجة</Label>
                      <p className="text-sm">{selectedTask.result}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>اختر مهمة لعرض التفاصيل</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* المزودين النشطين */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              المزودين المتصلين بالذكاء الاصطناعي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider) => (
                <div key={provider.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {provider.logo_url ? (
                        <img src={provider.logo_url} alt="" className="h-10 w-10 rounded" />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                          <Users className="h-5 w-5 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{provider.company_name_ar}</p>
                        <p className="text-xs text-slate-500" dir="ltr">{provider.whatsapp}</p>
                      </div>
                    </div>
                    <Badge className={provider.ai_assistant_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                      {provider.ai_assistant_enabled ? 'مفعّل' : 'معطّل'}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>ساعات العمل: {provider.working_hours_start} - {provider.working_hours_end}</p>
                    <p className="mt-1">
                      الشركات: {(provider.authorized_airlines || []).length} شركة
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}