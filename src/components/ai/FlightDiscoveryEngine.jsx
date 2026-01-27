import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

// مستكشف الرحلات الذكي
export const FlightDiscoveryEngine = {

  // فحص منصات التواصل الاجتماعي لشركات الطيران
  async discoverNewFlights() {
    const airlines = await base44.entities.Airline.filter({ is_active: true });
    const discoveries = [];
    
    for (const airline of airlines) {
      // فحص كل رابط تواصل اجتماعي
      if (airline.social_links && airline.social_links.length > 0) {
        for (const link of airline.social_links) {
          const result = await this.scanSocialMedia(airline, link);
          if (result) discoveries.push(result);
        }
      }
      
      // فحص الموقع الرسمي
      if (airline.website_url) {
        const result = await this.scanWebsite(airline);
        if (result) discoveries.push(result);
      }
    }
    
    return discoveries;
  },

  // فحص منصة تواصل اجتماعي
  async scanSocialMedia(airline, socialLink) {
    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `ابحث عن أي إعلانات جديدة لرحلات طيران من شركة ${airline.name_ar} (${airline.iata_code}).
        
رابط المنصة: ${socialLink.url}

ابحث عن:
1. رحلات جديدة أو إضافية
2. تغييرات في مواعيد الرحلات
3. إلغاء رحلات
4. رحلات خاصة أو موسمية

استخرج المعلومات بدقة.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            found_updates: { type: "boolean" },
            updates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["new_flight", "schedule_change", "cancellation", "special_flight"] },
                  flight_number: { type: "string" },
                  departure_city: { type: "string" },
                  arrival_city: { type: "string" },
                  departure_date: { type: "string" },
                  departure_time: { type: "string" },
                  details: { type: "string" },
                  source_url: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (analysis.found_updates && analysis.updates.length > 0) {
        // إنشاء مهام للموافقة
        for (const update of analysis.updates) {
          await base44.entities.AITask.create({
            task_type: 'flight_discovery',
            status: 'needs_approval',
            priority: 'high',
            related_entity_type: 'airline',
            related_entity_id: airline.id,
            airline_id: airline.id,
            airline_name: airline.name_ar,
            flight_details: `${update.type}: ${update.flight_number || 'غير محدد'} - ${update.departure_city} إلى ${update.arrival_city}`,
            source_url: socialLink.url,
            source_type: socialLink.platform.toLowerCase(),
            discovered_data: update,
            admin_action_required: true,
            ai_thinking: `تم اكتشاف تحديث من ${socialLink.platform}: ${update.details}`
          });
        }
        
        return {
          airline: airline.name_ar,
          source: socialLink.platform,
          updates: analysis.updates
        };
      }
      
      return null;
    } catch (error) {
      console.error('خطأ في فحص المنصة:', error);
      return null;
    }
  },

  // فحص موقع شركة الطيران
  async scanWebsite(airline) {
    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `تفحص موقع شركة الطيران ${airline.name_ar} وابحث عن جدول الرحلات أو أي تحديثات:
        
الموقع: ${airline.website_url}

استخرج:
1. أي رحلات جديدة
2. جدول الرحلات الحالي
3. أي إعلانات أو تحديثات`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            found_schedule: { type: "boolean" },
            flights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  flight_number: { type: "string" },
                  route: { type: "string" },
                  days: { type: "string" },
                  departure_time: { type: "string" }
                }
              }
            },
            announcements: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      return analysis.found_schedule ? {
        airline: airline.name_ar,
        source: 'website',
        data: analysis
      } : null;
    } catch (error) {
      return null;
    }
  },

  // مقارنة الرحلات المكتشفة مع الموجودة
  async compareAndUpdate(discoveredFlight, airline) {
    const existingFlights = await base44.entities.Flight.filter({
      airline_id: airline.id,
      flight_number: discoveredFlight.flight_number
    });

    if (existingFlights.length === 0) {
      // رحلة جديدة
      return {
        action: 'create',
        data: discoveredFlight
      };
    }

    const existing = existingFlights[0];
    
    // مقارنة المواعيد
    if (existing.departure_time !== discoveredFlight.departure_time) {
      return {
        action: 'update_schedule',
        existing: existing,
        new_data: discoveredFlight
      };
    }

    return {
      action: 'no_change'
    };
  }
};

// مكون عرض الاكتشافات
export default function FlightDiscoveryPanel() {
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadPendingDiscoveries();
  }, []);

  const loadPendingDiscoveries = async () => {
    const tasks = await base44.entities.AITask.filter({
      task_type: 'flight_discovery',
      admin_action_required: true
    }, '-created_date');
    setDiscoveries(tasks);
    setLoading(false);
  };

  const startScan = async () => {
    setScanning(true);
    await FlightDiscoveryEngine.discoverNewFlights();
    await loadPendingDiscoveries();
    setScanning(false);
  };

  const handleApprove = async (task) => {
    // إنشاء الرحلة من البيانات المكتشفة
    if (task.discovered_data) {
      // منطق إنشاء الرحلة
    }
    
    await base44.entities.AITask.update(task.id, {
      admin_approved: true,
      admin_action_required: false,
      status: 'completed',
      approved_at: new Date().toISOString()
    });
    
    loadPendingDiscoveries();
  };

  const handleReject = async (task) => {
    await base44.entities.AITask.update(task.id, {
      admin_approved: false,
      admin_action_required: false,
      status: 'completed'
    });
    
    loadPendingDiscoveries();
  };

  if (loading) return <div className="p-4">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">اكتشافات الرحلات</h3>
        <button
          onClick={startScan}
          disabled={scanning}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
        >
          {scanning ? 'جاري الفحص...' : 'فحص الآن'}
        </button>
      </div>
      
      {discoveries.length === 0 ? (
        <p className="text-slate-500 text-center py-8">لا توجد اكتشافات جديدة</p>
      ) : (
        discoveries.map(task => (
          <div key={task.id} className="p-4 bg-white rounded-lg border border-amber-200">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">{task.airline_name}</h4>
                <p className="text-sm">{task.flight_details}</p>
                <p className="text-xs text-slate-500 mt-1">
                  المصدر: {task.source_type} - {task.source_url}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReject(task)}
                  className="px-3 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  رفض
                </button>
                <button
                  onClick={() => handleApprove(task)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  موافق
                </button>
              </div>
            </div>
            
            {task.ai_thinking && (
              <div className="mt-3 p-2 bg-purple-50 rounded text-sm">
                <span className="font-semibold">تحليل:</span> {task.ai_thinking}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}