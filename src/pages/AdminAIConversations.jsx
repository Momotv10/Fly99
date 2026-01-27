import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, Search, User, Clock, AlertCircle, 
  CheckCircle2, Brain, Filter, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import AIServiceMonitor from '@/components/ai/AIServiceMonitor';

export default function AdminAIConversations() {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    
    // تحديث كل 10 ثواني
    const interval = setInterval(loadConversations, 10000);
    
    // الاشتراك في التحديثات الفورية
    let unsubscribe;
    try {
      unsubscribe = base44.entities.AIConversation.subscribe((event) => {
        if (event.type === 'create' || event.type === 'update') {
          loadConversations();
        }
      });
    } catch (error) {
      console.log('Subscription not available');
    }

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterConversations();
  }, [conversations, searchTerm, filterStatus]);

  const loadConversations = async () => {
    try {
      const data = await base44.entities.AIConversation.list('-created_date', 100);
      setConversations(data || []);
    } catch (error) {
      console.error('خطأ في تحميل المحادثات:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const filterConversations = () => {
    let filtered = [...conversations];

    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.customer_phone?.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(conv => conv.status === filterStatus);
    }

    setFilteredConversations(filtered);
  };

  const markAsCompleted = async (conversationId) => {
    try {
      await base44.entities.AIConversation.update(conversationId, {
        status: 'completed'
      });
      toast.success('تم تحديث الحالة');
      loadConversations();
    } catch (error) {
      toast.error('فشل التحديث');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800',
      waiting_response: 'bg-yellow-100 text-yellow-800'
    };

    const labels = {
      active: 'نشط',
      completed: 'منجز',
      escalated: 'مصعّد',
      waiting_response: 'في الانتظار'
    };

    return (
      <Badge className={styles[status] || 'bg-gray-100'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      normal: 'bg-blue-100 text-blue-800',
      urgent: 'bg-orange-100 text-orange-800',
      emergency: 'bg-red-100 text-red-800 animate-pulse'
    };

    const labels = {
      normal: 'عادي',
      urgent: 'عاجل',
      emergency: '🚨 طارئ'
    };

    return (
      <Badge className={styles[priority] || 'bg-gray-100'}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🤖 خدمة العملاء الذكية
          </h1>
          <p className="text-gray-600">إدارة ومراقبة المحادثات مع الذكاء الاصطناعي</p>
        </div>

        {/* مكون الذكاء الاصطناعي النشط */}
        <div className="mb-6">
          <AIServiceMonitor />
        </div>

        {/* أدوات البحث والفلترة */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="بحث بالاسم أو رقم الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              <div className="flex gap-2">
                {['all', 'active', 'escalated', 'completed'].map(status => (
                  <Button
                    key={status}
                    size="sm"
                    variant={filterStatus === status ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status === 'all' ? 'الكل' : 
                     status === 'active' ? 'نشط' :
                     status === 'escalated' ? 'مصعّد' : 'منجز'}
                  </Button>
                ))}
              </div>

              <Button size="sm" variant="outline" onClick={loadConversations}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* قائمة المحادثات */}
        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">جاري التحميل...</p>
              </CardContent>
            </Card>
          ) : filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد محادثات</p>
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map(conversation => (
              <Card 
                key={conversation.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedConversation(conversation)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {conversation.customer_name?.charAt(0) || 'ع'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">{conversation.customer_name || 'عميل جديد'}</h3>
                          {getStatusBadge(conversation.status)}
                          {getPriorityBadge(conversation.priority)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {conversation.customer_phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(conversation.created_date).toLocaleString('ar')}
                          </span>
                        </div>

                        {conversation.ai_summary && (
                          <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                            {conversation.ai_summary}
                          </p>
                        )}

                        {conversation.intent && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {conversation.intent}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {conversation.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsCompleted(conversation.id);
                          }}
                          className="text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle2 className="h-4 w-4 ml-1" />
                          إنهاء
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                      >
                        عرض التفاصيل
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* نافذة تفاصيل المحادثة */}
        <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                محادثة مع {selectedConversation?.customer_name}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {/* معلومات المحادثة */}
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">الحالة:</span>
                        <div className="mt-1">{getStatusBadge(selectedConversation?.status)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">الأولوية:</span>
                        <div className="mt-1">{getPriorityBadge(selectedConversation?.priority)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">المشاعر:</span>
                        <div className="mt-1">
                          <Badge>
                            {selectedConversation?.sentiment === 'positive' ? '😊 إيجابي' :
                             selectedConversation?.sentiment === 'negative' ? '😠 سلبي' :
                             selectedConversation?.sentiment === 'frustrated' ? '😤 محبط' : '😐 محايد'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">رقم الهاتف:</span>
                        <div className="mt-1 font-mono">{selectedConversation?.customer_phone}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* سجل المحادثة - أسلوب واتساب */}
                <div className="bg-[#e5ddd5] rounded-lg p-4 space-y-2" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'80\' height=\'80\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h80v80H0z\' fill=\'none\'/%3E%3Cpath d=\'M14 16h15v15H14zm17 0h15v15H31zm17 0h15v15H48zM14 33h15v15H14zm17 0h15v15H31zm17 0h15v15H48z\' fill=\'%23000\' fill-opacity=\'.03\'/%3E%3C/svg%3E")'}}>
                  {(selectedConversation?.conversation_log || []).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      لا توجد رسائل بعد
                    </div>
                  ) : (
                    (selectedConversation?.conversation_log || []).map((log, index) => (
                      <div
                        key={index}
                        className={`flex ${log.role === 'customer' ? 'justify-start' : 'justify-end'} mb-1`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                            log.role === 'customer'
                              ? 'bg-white'
                              : log.role === 'ai'
                              ? 'bg-[#d9fdd3]'
                              : 'bg-yellow-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-xs" style={{color: log.role === 'customer' ? '#075e54' : '#128c7e'}}>
                              {log.role === 'customer' ? '👤 العميل' :
                               log.role === 'ai' ? '🤖 AI' : '⚙️ نظام'}
                            </span>
                          </div>
                          
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{color: '#303030'}}>
                            {log.message}
                          </p>

                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString('ar', {hour: '2-digit', minute: '2-digit'})}
                            </span>
                            {log.role === 'ai' && (
                              <svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-500">
                                <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path>
                              </svg>
                            )}
                          </div>

                          {log.understood_intent && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-[10px] text-gray-600">
                                💡 {log.understood_intent}
                              </p>
                            </div>
                          )}

                          {log.action_taken && log.action_taken !== 'none' && (
                            <div className="mt-1">
                              <p className="text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded">
                                ⚡ {log.action_taken}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}