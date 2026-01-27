import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Bot, Search, MessageSquare, Plane, Users, CheckCircle2, XCircle, 
  Clock, AlertCircle, Eye, ThumbsUp, ThumbsDown, Sparkles, Brain
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminAITasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [tasksData, providersData] = await Promise.all([
      base44.entities.AITask.list('-created_date', 100),
      base44.entities.Provider.list()
    ]);
    setTasks(tasksData);
    setProviders(providersData);
    setLoading(false);
  };

  const handleApprove = async (task) => {
    await base44.entities.AITask.update(task.id, { 
      admin_approved: true,
      admin_action_required: false,
      status: 'completed'
    });
    
    // If it's a flight discovery, create the flight
    if (task.task_type === 'flight_discovery' && task.discovered_data) {
      await base44.entities.Flight.create({
        ...task.discovered_data,
        source: 'ai',
        is_active: true
      });
      toast.success('تم إضافة الرحلة بنجاح');
    }
    
    loadData();
  };

  const handleReject = async (task) => {
    await base44.entities.AITask.update(task.id, { 
      admin_approved: false,
      admin_action_required: false,
      status: 'completed'
    });
    toast.success('تم رفض المهمة');
    loadData();
  };

  const viewDetails = (task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const filteredTasks = tasks.filter(t => {
    const matchType = filterType === 'all' || t.task_type === filterType;
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchProvider = filterProvider === 'all' || t.provider_id === filterProvider;
    return matchType && matchStatus && matchProvider;
  });

  const taskTypeConfig = {
    flight_discovery: { label: 'اكتشاف رحلة', icon: Plane, color: 'bg-blue-100 text-blue-700' },
    provider_outreach: { label: 'تواصل مع مزود', icon: MessageSquare, color: 'bg-purple-100 text-purple-700' },
    seat_request: { label: 'طلب مقاعد', icon: Users, color: 'bg-green-100 text-green-700' },
    provider_command: { label: 'أمر من مزود', icon: Bot, color: 'bg-amber-100 text-amber-700' }
  };

  const statusConfig = {
    pending: { label: 'قيد الانتظار', icon: Clock, color: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'جاري التنفيذ', icon: Sparkles, color: 'bg-blue-100 text-blue-700' },
    waiting_response: { label: 'بانتظار الرد', icon: MessageSquare, color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'مكتمل', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    failed: { label: 'فشل', icon: XCircle, color: 'bg-red-100 text-red-700' }
  };

  const pendingApproval = tasks.filter(t => t.admin_action_required);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="h-7 w-7 text-purple-600" />
            مركز الذكاء الاصطناعي
          </h1>
          <p className="text-slate-600">مراقبة وإدارة مهام الذكاء الاصطناعي</p>
        </div>

        {/* Pending Approvals */}
        {pendingApproval.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                تحتاج موافقتك ({pendingApproval.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingApproval.map((task) => {
                  const typeConfig = taskTypeConfig[task.task_type] || taskTypeConfig.flight_discovery;
                  const TypeIcon = typeConfig.icon;
                  
                  return (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{typeConfig.label}</p>
                          <p className="text-sm text-slate-600">{task.flight_details || task.result}</p>
                          {task.source_url && (
                            <p className="text-xs text-blue-600">المصدر: {task.source_url}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => viewDetails(task)}>
                          <Eye className="h-4 w-4 ml-1" />
                          التفاصيل
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleReject(task)}>
                          <ThumbsDown className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(task)}>
                          <ThumbsUp className="h-4 w-4 ml-1" />
                          موافق
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.task_type === 'flight_discovery').length}</p>
                <p className="text-sm text-slate-500">اكتشاف رحلات</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.task_type === 'provider_outreach').length}</p>
                <p className="text-sm text-slate-500">تواصل مع مزودين</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-sm text-slate-500">مهام مكتملة</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'waiting_response').length}</p>
                <p className="text-sm text-slate-500">بانتظار الرد</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <CardTitle>سجل المهام</CardTitle>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="flight_discovery">اكتشاف رحلات</SelectItem>
                  <SelectItem value="provider_outreach">تواصل مع مزود</SelectItem>
                  <SelectItem value="seat_request">طلب مقاعد</SelectItem>
                  <SelectItem value="provider_command">أمر من مزود</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="in_progress">جاري التنفيذ</SelectItem>
                  <SelectItem value="waiting_response">بانتظار الرد</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="failed">فشل</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
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
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const typeConfig = taskTypeConfig[task.task_type] || taskTypeConfig.flight_discovery;
                const status = statusConfig[task.status] || statusConfig.pending;
                const TypeIcon = typeConfig.icon;
                const StatusIcon = status.icon;

                return (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{typeConfig.label}</p>
                          {task.provider_name && (
                            <Badge variant="outline">{task.provider_name}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 max-w-xl truncate">
                          {task.flight_details || task.result || '-'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {task.created_date && format(new Date(task.created_date), 'dd MMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 ml-1" />
                        {status.label}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => viewDetails(task)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
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
          </CardContent>
        </Card>

        {/* Task Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                تفاصيل المهمة
              </DialogTitle>
            </DialogHeader>
            
            {selectedTask && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">النوع</p>
                      <Badge className={taskTypeConfig[selectedTask.task_type]?.color}>
                        {taskTypeConfig[selectedTask.task_type]?.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">الحالة</p>
                      <Badge className={statusConfig[selectedTask.status]?.color}>
                        {statusConfig[selectedTask.status]?.label}
                      </Badge>
                    </div>
                  </div>

                  {selectedTask.provider_name && (
                    <div>
                      <p className="text-sm text-slate-500">المزود</p>
                      <p className="font-semibold">{selectedTask.provider_name}</p>
                    </div>
                  )}

                  {selectedTask.flight_details && (
                    <div>
                      <p className="text-sm text-slate-500">تفاصيل الرحلة</p>
                      <p>{selectedTask.flight_details}</p>
                    </div>
                  )}

                  {selectedTask.source_url && (
                    <div>
                      <p className="text-sm text-slate-500">المصدر</p>
                      <a href={selectedTask.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {selectedTask.source_url}
                      </a>
                    </div>
                  )}

                  {selectedTask.ai_thinking && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">كيف فكر الذكاء الاصطناعي</p>
                      <div className="p-3 bg-purple-50 rounded-lg text-sm">
                        {selectedTask.ai_thinking}
                      </div>
                    </div>
                  )}

                  {selectedTask.conversation_history && selectedTask.conversation_history.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">سجل المحادثة</p>
                      <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                        {selectedTask.conversation_history.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                              msg.role === 'ai' ? 'bg-purple-100' : 'bg-blue-100'
                            }`}>
                              <p>{msg.content}</p>
                              <p className="text-xs text-slate-500 mt-1">{msg.timestamp}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTask.result && (
                    <div>
                      <p className="text-sm text-slate-500">النتيجة</p>
                      <p>{selectedTask.result}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}