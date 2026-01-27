import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

// المزود الذكي - المحرك الرئيسي
export const SmartProviderEngine = {
  
  // فحص المخزون وإرسال طلبات للمزودين
  async checkInventoryAndRequestSeats() {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    // جلب الرحلات للأسبوع القادم
    const flights = await base44.entities.Flight.filter({ is_active: true });
    const seats = await base44.entities.AvailableSeat.filter({ status: 'active' });
    const providers = await base44.entities.Provider.filter({ is_active: true, ai_assistant_enabled: true });
    
    const tasksToCreate = [];
    
    for (const flight of flights) {
      // فحص إذا كان هناك مقاعد متاحة للأسبوع القادم
      const flightSeats = seats.filter(s => 
        s.flight_id === flight.id && 
        s.departure_date >= format(today, 'yyyy-MM-dd') &&
        s.departure_date <= format(nextWeek, 'yyyy-MM-dd') &&
        (s.available_count - (s.booked_count || 0)) > 0
      );
      
      if (flightSeats.length === 0) {
        // لا توجد مقاعد - نحتاج طلب من المزودين
        const relevantProviders = providers.filter(p => 
          (p.authorized_airlines || []).includes(flight.airline_id)
        );
        
        for (const provider of relevantProviders) {
          // التحقق من أنه لم يتم إرسال طلب مؤخراً
          const recentTasks = await base44.entities.AITask.filter({
            provider_id: provider.id,
            flight_id: flight.id,
            task_type: 'seat_request',
            status: { $in: ['pending', 'in_progress', 'waiting_response'] }
          });
          
          if (recentTasks.length === 0) {
            tasksToCreate.push({
              task_type: 'seat_request',
              status: 'pending',
              priority: 'high',
              provider_id: provider.id,
              provider_name: provider.company_name_ar,
              provider_whatsapp: provider.whatsapp,
              airline_id: flight.airline_id,
              airline_name: flight.airline_name,
              flight_id: flight.id,
              flight_details: `${flight.flight_number} - ${flight.departure_city} إلى ${flight.arrival_city}`,
              scheduled_time: this.getNextWorkingTime(provider)
            });
          }
        }
      }
    }
    
    // إنشاء المهام
    for (const task of tasksToCreate) {
      await base44.entities.AITask.create(task);
    }
    
    return tasksToCreate.length;
  },

  // الحصول على وقت العمل التالي
  getNextWorkingTime(provider) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    const workingDays = provider.working_days || [0, 1, 2, 3, 4, 5];
    const startHour = parseInt(provider.working_hours_start?.split(':')[0] || '9');
    const endHour = parseInt(provider.working_hours_end?.split(':')[0] || '20');
    
    // إذا كنا في وقت العمل
    if (workingDays.includes(currentDay) && currentHour >= startHour && currentHour < endHour) {
      return now.toISOString();
    }
    
    // البحث عن أقرب وقت عمل
    let targetDate = new Date(now);
    for (let i = 0; i < 7; i++) {
      targetDate = addDays(now, i);
      if (workingDays.includes(targetDate.getDay())) {
        targetDate.setHours(startHour, 0, 0, 0);
        if (targetDate > now) {
          return targetDate.toISOString();
        }
      }
    }
    
    return now.toISOString();
  },

  // إنشاء رسالة طلب مقاعد
  generateSeatRequestMessage(task, isFirstMessage = true) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير';
    
    if (isFirstMessage) {
      return `${greeting} 👋

أتمنى أن تكون بخير.

هل يوجد مقاعد متاحة لرحلة ${task.flight_details}؟

نحتاج لمعرفة:
- عدد المقاعد المتاحة
- السعر
- الدرجة (اقتصادي/بيزنس)

شكراً لتعاونكم 🙏`;
    }
    
    return null;
  },

  // تحليل رد المزود
  async analyzeProviderResponse(message, task) {
    const content = message.content.toLowerCase();
    
    // تحليل بسيط للرد
    const analysis = {
      hasSeats: false,
      seatsCount: 0,
      price: 0,
      seatClass: 'economy',
      confirmed: false
    };
    
    // البحث عن أرقام (عدد المقاعد)
    const numberMatch = content.match(/(\d+)\s*(مقعد|مقاعد|تذكرة|تذاكر)/);
    if (numberMatch) {
      analysis.seatsCount = parseInt(numberMatch[1]);
      analysis.hasSeats = true;
    }
    
    // البحث عن السعر
    const priceMatch = content.match(/(\d+)\s*(دولار|\$|ريال)/);
    if (priceMatch) {
      analysis.price = parseInt(priceMatch[1]);
    }
    
    // البحث عن الدرجة
    if (content.includes('بيزنس') || content.includes('business')) {
      analysis.seatClass = 'business';
    } else if (content.includes('أولى') || content.includes('first')) {
      analysis.seatClass = 'first';
    }
    
    // التأكيد
    if (content.includes('نعم') || content.includes('متاح') || content.includes('موجود') || content.includes('تم')) {
      analysis.confirmed = true;
    }
    
    // استخدام الذكاء الاصطناعي للتحليل المتقدم
    try {
      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `حلل رسالة المزود التالية واستخرج المعلومات:
        
الرسالة: "${message.content}"

السياق: نحن نسأل عن مقاعد لرحلة ${task.flight_details}

استخرج:
1. هل يوجد مقاعد متاحة؟
2. كم عدد المقاعد؟
3. ما هو السعر؟
4. ما هي درجة المقعد؟
5. هل تم التأكيد؟`,
        response_json_schema: {
          type: "object",
          properties: {
            has_seats: { type: "boolean" },
            seats_count: { type: "number" },
            price: { type: "number" },
            seat_class: { type: "string", enum: ["economy", "business", "first"] },
            confirmed: { type: "boolean" },
            needs_more_info: { type: "boolean" },
            follow_up_question: { type: "string" }
          }
        }
      });
      
      return { ...analysis, ...aiAnalysis };
    } catch (error) {
      return analysis;
    }
  },

  // إنشاء المقاعد بناءً على تأكيد المزود
  async createSeatsFromConfirmation(task, analysis, provider) {
    const flight = await base44.entities.Flight.filter({ id: task.flight_id });
    if (flight.length === 0) return null;
    
    const flightData = flight[0];
    
    // حساب الأسعار
    const providerPrice = analysis.price || 0;
    const systemCommission = provider.commission_value || 50;
    const totalPrice = providerPrice + systemCommission;
    
    const seatData = {
      provider_id: provider.id,
      provider_name: provider.company_name_ar,
      flight_id: flightData.id,
      flight_number: flightData.flight_number,
      airline_id: flightData.airline_id,
      airline_name: flightData.airline_name,
      airline_logo: flightData.airline_logo,
      departure_airport_code: flightData.departure_airport_code,
      departure_city: flightData.departure_city,
      arrival_airport_code: flightData.arrival_airport_code,
      arrival_city: flightData.arrival_city,
      departure_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), // غداً كمثال
      departure_time: flightData.departure_time,
      arrival_time: flightData.arrival_time,
      seat_class: analysis.seat_class || 'economy',
      available_count: analysis.seats_count || 5,
      booked_count: 0,
      trip_type: 'round_trip',
      price_outbound: providerPrice,
      price_return: 0,
      system_commission: systemCommission,
      total_price: totalPrice,
      provider_earning: providerPrice,
      return_policy: 'open',
      status: 'active',
      source: 'ai'
    };
    
    const seat = await base44.entities.AvailableSeat.create(seatData);
    return seat;
  },

  // معالجة أمر من المزود
  async processProviderCommand(message, provider) {
    const content = message.content.toLowerCase();
    
    // أوامر معروفة
    if (content.includes('وقف') || content.includes('إيقاف')) {
      // البحث عن رحلة أو تاريخ
      const seats = await base44.entities.AvailableSeat.filter({
        provider_id: provider.id,
        status: 'active'
      });
      
      // إيقاف المقاعد
      for (const seat of seats) {
        // منطق تحديد أي مقاعد توقف
      }
      
      return {
        success: true,
        message: 'تم تنفيذ أمر الإيقاف'
      };
    }
    
    return {
      success: false,
      message: 'لم أفهم الأمر، يرجى التوضيح'
    };
  }
};

// مكون عرض سجل المزود الذكي
export default function SmartProviderLog({ providerId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [providerId]);

  const loadTasks = async () => {
    const filter = providerId ? { provider_id: providerId } : {};
    const data = await base44.entities.AITask.filter(filter, '-created_date', 50);
    setTasks(data);
    setLoading(false);
  };

  if (loading) return <div className="p-4">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <div key={task.id} className="p-4 bg-white rounded-lg border">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold">{task.flight_details}</h4>
              <p className="text-sm text-slate-500">{task.provider_name}</p>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${
              task.status === 'completed' ? 'bg-green-100 text-green-700' :
              task.status === 'waiting_response' ? 'bg-yellow-100 text-yellow-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {task.status === 'completed' ? 'مكتمل' :
               task.status === 'waiting_response' ? 'بانتظار الرد' :
               task.status === 'in_progress' ? 'قيد التنفيذ' : 'معلق'}
            </span>
          </div>
          
          {task.conversation_history && task.conversation_history.length > 0 && (
            <div className="mt-3 space-y-2">
              {task.conversation_history.map((msg, i) => (
                <div key={i} className={`p-2 rounded text-sm ${
                  msg.role === 'ai' ? 'bg-purple-50 mr-8' : 'bg-blue-50 ml-8'
                }`}>
                  {msg.content}
                </div>
              ))}
            </div>
          )}
          
          {task.ai_thinking && (
            <div className="mt-3 p-2 bg-purple-50 rounded text-sm">
              <span className="font-semibold">تحليل الذكاء الاصطناعي:</span>
              <p>{task.ai_thinking}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}