import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Target, Zap, AlertCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminAIDecisions() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecisions();
    const interval = setInterval(loadDecisions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDecisions = async () => {
    const data = await base44.entities.AIDecision.list('-created_date', 50);
    setDecisions(data);
    setLoading(false);
  };

  const getIntentBadge = (intent) => {
    const styles = {
      'request_ticket': 'bg-blue-100 text-blue-800',
      'search_flight': 'bg-green-100 text-green-800',
      'report_problem': 'bg-red-100 text-red-800',
      'change_booking': 'bg-orange-100 text-orange-800',
      'emergency': 'bg-red-100 text-red-800 animate-pulse',
      'provider_no_response': 'bg-yellow-100 text-yellow-800',
      'complete_booking': 'bg-purple-100 text-purple-800'
    };

    const labels = {
      'request_ticket': 'طلب تذكرة',
      'search_flight': 'بحث عن رحلة',
      'report_problem': 'مشكلة',
      'change_booking': 'تعديل حجز',
      'emergency': '🚨 طارئ',
      'provider_no_response': 'المزود لم يرد',
      'complete_booking': 'إكمال حجز'
    };

    return (
      <Badge className={styles[intent] || 'bg-gray-100'}>
        {labels[intent] || intent}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧠 سجل قرارات الذكاء الاصطناعي
          </h1>
          <p className="text-gray-600">تتبع منطق القرار والإجراءات المتخذة</p>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              </CardContent>
            </Card>
          ) : decisions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                لا توجد قرارات بعد
              </CardContent>
            </Card>
          ) : (
            decisions.map(decision => (
              <Card key={decision.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Brain className="h-6 w-6 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold">{decision.customer_phone || 'غير معروف'}</span>
                            {decision.customer_type && <Badge variant="outline">{decision.customer_type}</Badge>}
                            {decision.detected_intent && getIntentBadge(decision.detected_intent)}
                          </div>
                          <p className="text-sm text-gray-600">
                            📩 "{decision.message_content || ''}"
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          {decision.created_date && !isNaN(new Date(decision.created_date).getTime()) ? new Date(decision.created_date).toLocaleString('ar') : ''}
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-sm text-blue-900">منطق القرار</span>
                        </div>
                        <p className="text-sm text-blue-800">
                          {decision.decision_logic}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-600 mb-1">القرار المتخذ</div>
                          <div className="font-semibold text-sm">{decision.decision_made || '-'}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-600 mb-1">الإجراء</div>
                          <div className="font-semibold text-sm">{decision.action_taken || '-'}</div>
                        </div>
                      </div>

                      {decision.escalated_to && decision.escalated_to !== 'none' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-sm text-red-900">
                              تم التصعيد إلى: {decision.escalated_to}
                            </span>
                          </div>
                          {decision.escalation_reason && (
                            <p className="text-xs text-red-700 mt-1">
                              السبب: {decision.escalation_reason}
                            </p>
                          )}
                        </div>
                      )}

                      {decision.response_sent && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs text-green-700 mb-1">الرد المُرسل:</div>
                          <p className="text-sm text-green-900 whitespace-pre-wrap">
                            {decision.response_sent}
                          </p>
                        </div>
                      )}

                      {decision.extracted_entities && Object.keys(decision.extracted_entities).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-gray-600 mb-2">كيانات مستخرجة:</div>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(decision.extracted_entities).map(([key, value]) => (
                              value && (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {value}
                                </Badge>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}