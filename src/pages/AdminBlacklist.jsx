import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ShieldOff, ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminBlacklist() {
  const [blacklisted, setBlacklisted] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    phone_number: '',
    reason: '',
    offense_type: 'spam'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // المحظورين فعلياً
      const active = await base44.entities.BlacklistedCustomer.filter({
        is_active: true
      }, '-created_date', 50);
      setBlacklisted(active);

      // المقترحين من AI
      const suggestions = await base44.entities.BlacklistedCustomer.filter({
        is_active: false,
        auto_detected: true
      }, '-created_date', 20);
      setSuggested(suggestions);

    } catch (error) {
      console.error('خطأ:', error);
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const activateBlacklist = async (id) => {
    try {
      await base44.entities.BlacklistedCustomer.update(id, {
        is_active: true
      });
      
      toast.success('تم تفعيل الحظر');
      loadData();
    } catch (error) {
      toast.error('فشل التفعيل');
    }
  };

  const removeBlacklist = async (id) => {
    if (!confirm('هل تريد إلغاء الحظر؟')) return;

    try {
      await base44.entities.BlacklistedCustomer.update(id, {
        is_active: false,
        unblocked_at: new Date().toISOString(),
        unblocked_by: 'admin'
      });
      
      toast.success('تم إلغاء الحظر');
      loadData();
    } catch (error) {
      toast.error('فشل إلغاء الحظر');
    }
  };

  const addToBlacklist = async () => {
    if (!newEntry.phone_number || !newEntry.reason) {
      toast.error('الرجاء إدخال رقم الهاتف والسبب');
      return;
    }

    try {
      await base44.entities.BlacklistedCustomer.create({
        phone_number: newEntry.phone_number,
        reason: newEntry.reason,
        offense_type: newEntry.offense_type,
        auto_detected: false,
        blocked_by: 'admin',
        is_active: true
      });

      toast.success('تمت الإضافة للقائمة السوداء');
      setShowAddForm(false);
      setNewEntry({ phone_number: '', reason: '', offense_type: 'spam' });
      loadData();
    } catch (error) {
      toast.error('فشلت الإضافة');
    }
  };

  const rejectSuggestion = async (id) => {
    try {
      await base44.entities.BlacklistedCustomer.delete(id);
      toast.success('تم رفض الاقتراح');
      loadData();
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="flex-1 lg:mr-64">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">القائمة السوداء</h1>
              <p className="text-slate-600 mt-2">إدارة العملاء المحظورين</p>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="ml-2 h-5 w-5" />
              إضافة يدوياً
            </Button>
          </div>

          {/* نموذج الإضافة */}
          {showAddForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>إضافة عميل للقائمة السوداء</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="رقم الهاتف"
                  value={newEntry.phone_number}
                  onChange={(e) => setNewEntry({...newEntry, phone_number: e.target.value})}
                />
                <Textarea
                  placeholder="سبب الحظر"
                  value={newEntry.reason}
                  onChange={(e) => setNewEntry({...newEntry, reason: e.target.value})}
                />
                <div className="flex gap-3">
                  <Button onClick={addToBlacklist}>حفظ</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>إلغاء</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* اقتراحات الذكاء الاصطناعي */}
          {suggested.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  اقتراحات من الذكاء الاصطناعي ({suggested.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suggested.map(item => (
                    <div key={item.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-slate-900">{item.phone_number}</p>
                          <p className="text-sm text-slate-600 mt-1">{item.reason}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            نوع المخالفة: <strong>{item.offense_type}</strong>
                            {' | '}
                            {item.notes}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => activateBlacklist(item.id)}
                          >
                            حظر
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectSuggestion(item.id)}
                          >
                            رفض
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* المحظورين */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-red-500" />
                العملاء المحظورين ({blacklisted.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blacklisted.length === 0 ? (
                <p className="text-center py-8 text-slate-500">لا يوجد عملاء محظورين</p>
              ) : (
                <div className="space-y-3">
                  {blacklisted.map(item => (
                    <div key={item.id} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-slate-900">{item.phone_number}</p>
                          <p className="text-sm text-slate-600 mt-1">{item.reason}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            المخالفات: <strong>{item.offense_count || 1}</strong>
                            {' | '}
                            حظره: {item.blocked_by}
                            {' | '}
                            {new Date(item.created_date).toLocaleDateString('ar')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeBlacklist(item.id)}
                        >
                          <ShieldCheck className="ml-2 h-4 w-4" />
                          إلغاء الحظر
                        </Button>
                      </div>
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