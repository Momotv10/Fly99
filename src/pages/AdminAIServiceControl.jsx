import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { messagePoller } from '@/components/ai/WAHAMessagePoller';
import { masterProcessor } from '@/components/ai/MasterProcessor';
import { Power, Trash2, AlertCircle, CheckCircle, Pause, Play } from 'lucide-react';

export default function AdminAIServiceControl() {
  const [isServiceRunning, setIsServiceRunning] = useState(messagePoller.isRunning);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    pending: 0
  });

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    try {
      const allMessages = await base44.entities.WhatsAppMessage.list('-created_date', 50);
      setMessages(allMessages || []);
      
      const stats = {
        total: allMessages?.length || 0,
        processed: allMessages?.filter(m => m.processed_by_ai).length || 0,
        pending: allMessages?.filter(m => !m.processed_by_ai && m.direction === 'incoming').length || 0
      };
      setStats(stats);
    } catch (error) {
      console.error('خطأ في تحميل الرسائل:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = () => {
    if (isServiceRunning) {
      messagePoller.stop();
      setIsServiceRunning(false);
      console.log('🛑 تم إيقاف الخدمة');
    } else {
      messagePoller.start();
      setIsServiceRunning(true);
      console.log('🚀 تم تشغيل الخدمة');
    }
  };

  const handleDeleteAllMessages = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع الرسائل؟ هذا الإجراء لا يمكن التراجع عنه!')) {
      return;
    }

    try {
      await delete_entities('WhatsAppMessage', {});
      setMessages([]);
      setStats({ total: 0, processed: 0, pending: 0 });
      alert('✅ تم حذف جميع الرسائل');
    } catch (error) {
      console.error('خطأ في الحذف:', error);
      alert('❌ فشل في حذف الرسائل');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await base44.entities.WhatsAppMessage.delete(messageId);
      setMessages(messages.filter(m => m.id !== messageId));
      loadMessages();
    } catch (error) {
      console.error('خطأ:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          {/* رأس الصفحة */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">🎮 لوحة التحكم - خدمة الذكاء الاصطناعي</h1>
            <p className="text-slate-600 mt-2">إدارة والتحكم بخدمة الرسائل الآلية</p>
          </div>

          {/* حالة الخدمة */}
          <Card className="mb-8 border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>حالة الخدمة</span>
                <Badge className={isServiceRunning ? 'bg-green-600' : 'bg-red-600'}>
                  {isServiceRunning ? '🟢 تشغيل' : '🔴 إيقاف'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleToggleService}
                className={`w-full text-lg py-6 ${
                  isServiceRunning 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isServiceRunning ? (
                  <>
                    <Pause className="ml-2 h-5 w-5" />
                    إيقاف الخدمة
                  </>
                ) : (
                  <>
                    <Play className="ml-2 h-5 w-5" />
                    تشغيل الخدمة
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{stats.total}</div>
                  <p className="text-slate-600">إجمالي الرسائل</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">{stats.processed}</div>
                  <p className="text-slate-600">معالجة</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">{stats.pending}</div>
                  <p className="text-slate-600">قيد الانتظار</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار الإدارة */}
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                إجراءات حساسة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleDeleteAllMessages}
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="ml-2 h-5 w-5" />
                حذف جميع الرسائل
              </Button>
              <p className="text-xs text-red-600 mt-2">⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه</p>
            </CardContent>
          </Card>

          {/* قائمة الرسائل */}
          <Card>
            <CardHeader>
              <CardTitle>آخر الرسائل</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-slate-500">لا توجد رسائل</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-600">{msg.from_number}</span>
                          <Badge className={msg.processed_by_ai ? 'bg-green-600' : 'bg-orange-600'}>
                            {msg.processed_by_ai ? '✓ معالجة' : '⏳ قيد الانتظار'}
                          </Badge>
                          <Badge variant="outline" className={msg.direction === 'incoming' ? 'bg-blue-50' : 'bg-purple-50'}>
                            {msg.direction === 'incoming' ? '📥 وارد' : '📤 صادر'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 truncate">{msg.content?.substring(0, 60)}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(msg.created_date).toLocaleString('ar')}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDeleteMessage(msg.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}