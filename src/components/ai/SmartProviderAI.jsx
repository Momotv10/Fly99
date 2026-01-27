import { base44 } from '@/api/base44Client';
import { WAHAService } from '@/components/whatsapp/WAHAService';
import { LocalAIEngine } from './LocalAIEngine';
import { format, addDays, addHours } from 'date-fns';
import { ar } from 'date-fns/locale';

// المزود الذكي - النظام الكامل
export class SmartProviderAI {
  
  constructor() {
    this.isRunning = false;
    this.conversationHistory = new Map(); // لكل مزود
    this.lastRequestTime = new Map(); // آخر وقت طلب لكل مزود
    this.activeGateway = null;
  }

  // بدء تشغيل النظام
  async start() {
    if (this.isRunning) {
      console.log('النظام يعمل بالفعل');
      return;
    }
    
    this.isRunning = true;
    console.log('✅ بدء تشغيل المزود الذكي');
    
    // جلب بوابة الواتساب الخاصة بالمزودين
    const gateways = await base44.entities.WhatsAppGateway.filter({
      type: 'providers',
      status: 'connected',
      is_active: true
    });
    
    if (gateways.length === 0) {
      console.log('⚠️ لا توجد بوابة واتساب متصلة');
      this.isRunning = false;
      return;
    }
    
    this.activeGateway = gateways[0];
    console.log(`✅ تم الاتصال بالبوابة: ${this.activeGateway.name}`);
    
    // بدء الفحص الدوري
    await this.performInventoryCheck();
    
    // جدولة الفحص كل ساعة
    this.checkInterval = setInterval(() => {
      this.performInventoryCheck();
    }, 60 * 60 * 1000); // كل ساعة
  }

  // إيقاف النظام
  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log('⏸️ تم إيقاف المزود الذكي');
  }

  // فحص المخزون
  async performInventoryCheck() {
    console.log('🔍 فحص مخزون المقاعد...');
    
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    // جلب جميع الرحلات النشطة
    const flights = await base44.entities.Flight.filter({ is_active: true });
    
    // جلب المقاعد المتاحة للأسبوع القادم
    const seats = await base44.entities.AvailableSeat.filter({
      departure_date: {
        $gte: format(today, 'yyyy-MM-dd'),
        $lte: format(nextWeek, 'yyyy-MM-dd')
      },
      status: 'active'
    });
    
    // تحليل النقص في المقاعد
    const needsSeats = [];
    
    for (const flight of flights) {
      // حساب الأيام للأسبوع القادم
      for (let i = 0; i < 7; i++) {
        const checkDate = format(addDays(today, i), 'yyyy-MM-dd');
        
        // التحقق من وجود مقاعد لهذا التاريخ
        const availableSeats = seats.filter(s => 
          s.flight_id === flight.id && 
          s.departure_date === checkDate &&
          (s.available_count - (s.booked_count || 0)) > 0
        );
        
        if (availableSeats.length === 0) {
          needsSeats.push({
            flight,
            date: checkDate,
            dayOfWeek: addDays(today, i).getDay()
          });
        }
      }
    }
    
    console.log(`📊 وجد ${needsSeats.length} رحلة تحتاج مقاعد`);
    
    // طلب المقاعد من المزودين
    for (const need of needsSeats) {
      await this.requestSeatsFromProviders(need);
    }
  }

  // طلب مقاعد من المزودين
  async requestSeatsFromProviders(need) {
    const { flight, date } = need;
    
    // جلب المزودين المصرح لهم بهذه الشركة
    const providers = await base44.entities.Provider.filter({
      is_active: true,
      ai_assistant_enabled: true,
      authorized_airlines: { $contains: flight.airline_id }
    });
    
    if (providers.length === 0) {
      console.log(`⚠️ لا يوجد مزودين لشركة ${flight.airline_name}`);
      return;
    }
    
    // توزيع الطلبات على المزودين بذكاء
    for (const provider of providers) {
      // التحقق من آخر طلب
      const lastRequest = this.lastRequestTime.get(provider.id);
      const now = new Date();
      
      // عدم إرسال طلبات متكررة (على الأقل 4 ساعات بين الطلبات)
      if (lastRequest && (now - lastRequest) < 4 * 60 * 60 * 1000) {
        continue;
      }
      
      // التحقق من وقت العمل
      if (!this.isWorkingHours(provider)) {
        console.log(`⏰ ${provider.company_name_ar} خارج أوقات العمل`);
        continue;
      }
      
      // التحقق من عدم وجود مهمة معلقة
      const pendingTasks = await base44.entities.AITask.filter({
        provider_id: provider.id,
        flight_id: flight.id,
        status: { $in: ['pending', 'in_progress', 'waiting_response'] }
      });
      
      if (pendingTasks.length > 0) {
        console.log(`⏳ ${provider.company_name_ar} لديه مهمة معلقة`);
        continue;
      }
      
      // إنشاء مهمة جديدة
      const task = await base44.entities.AITask.create({
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
        conversation_history: [],
        scheduled_time: new Date().toISOString()
      });
      
      // إرسال الطلب
      await this.sendSeatRequest(provider, flight, date, task);
      
      // تحديث آخر وقت طلب
      this.lastRequestTime.set(provider.id, now);
      
      // الانتظار قبل الطلب التالي (5 دقائق)
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
  }

  // إرسال طلب مقاعد
  async sendSeatRequest(provider, flight, date, task) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء الخير';
    
    const message = `${greeting} ${provider.contact_person || ''} 👋

أتمنى أن تكون بخير.

هل يوجد مقاعد متاحة لرحلة ${flight.airline_name} ${flight.flight_number}؟

📍 من: ${flight.departure_city}
📍 إلى: ${flight.arrival_city}
📅 التاريخ: ${date}

نحتاج:
• عدد المقاعد المتاحة (5 مقاعد أو أكثر)
• السعر للمقعد الواحد
• الدرجة (اقتصادي/بيزنس)

شكراً لتعاونكم 🙏`;

    try {
      // إرسال عبر واتساب
      await WAHAService.sendTextMessage(
        this.activeGateway.session_id,
        provider.whatsapp,
        message
      );
      
      // حفظ الرسالة
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: this.activeGateway.phone_number,
        to_number: provider.whatsapp,
        message_type: 'text',
        content: message,
        related_entity_type: 'ai_task',
        related_entity_id: task.id,
        status: 'sent',
        gateway_id: this.activeGateway.id,
        sent_at: new Date().toISOString()
      });
      
      // تحديث المهمة
      await base44.entities.AITask.update(task.id, {
        status: 'waiting_response',
        conversation_history: [{
          role: 'ai',
          content: message,
          timestamp: new Date().toISOString()
        }]
      });
      
      console.log(`✅ تم إرسال طلب لـ ${provider.company_name_ar}`);
    } catch (error) {
      console.error('خطأ في إرسال الطلب:', error);
      
      await base44.entities.AITask.update(task.id, {
        status: 'failed',
        error_message: error.message
      });
    }
  }

  // معالجة رد المزود
  async processProviderResponse(message) {
    // البحث عن المهمة المرتبطة
    const tasks = await base44.entities.AITask.filter({
      provider_whatsapp: message.from_number,
      status: 'waiting_response'
    }, '-created_date', 1);
    
    if (tasks.length === 0) {
      console.log('⚠️ لم يتم العثور على مهمة معلقة لهذا المزود');
      return;
    }
    
    const task = tasks[0];
    
    // تحديث سجل المحادثة
    const conversationHistory = task.conversation_history || [];
    conversationHistory.push({
      role: 'provider',
      content: message.content,
      timestamp: message.created_date
    });
    
    // تحليل الرد باستخدام الذكاء الاصطناعي المحلي
    const analysis = await LocalAIEngine.analyzeText(message.content, {
      task_type: 'seat_availability',
      provider: task.provider_name
    });
    
    // استخراج المعلومات
    const seatsCount = this.extractNumber(message.content, ['مقعد', 'مقاعد', 'تذكرة']);
    const price = this.extractNumber(message.content, ['دولار', 'dollar', '$']);
    const hasConfirmation = this.detectConfirmation(message.content);
    
    let aiResponse = null;
    let newStatus = 'waiting_response';
    
    // التحليل والرد
    if (hasConfirmation && seatsCount && price) {
      // المزود أكد وأعطى كل البيانات
      aiResponse = await this.createSeatsAndConfirm(task, seatsCount, price, message.content);
      newStatus = 'completed';
    } else if (hasConfirmation && !seatsCount) {
      // المزود أكد لكن لم يعطِ العدد
      aiResponse = 'ممتاز! كم عدد المقاعد المتاحة؟';
    } else if (seatsCount && !price) {
      // أعطى العدد لكن لم يعطِ السعر
      aiResponse = `رائع! ${seatsCount} مقاعد متاحة. كم السعر للمقعد الواحد؟`;
    } else if (analysis.intent.type === 'rejection') {
      // المزود رفض أو لا توجد مقاعد
      aiResponse = 'شكراً لتجاوبك. سنبحث عن بديل آخر.';
      newStatus = 'completed';
    } else {
      // رد عام - نكمل المحادثة
      aiResponse = 'شكراً لردك. هل يمكنك تزويدنا بعدد المقاعد المتاحة والسعر؟';
    }
    
    // إرسال الرد
    if (aiResponse) {
      await this.sendResponse(task, aiResponse, conversationHistory);
    }
    
    // تحديث المهمة
    await base44.entities.AITask.update(task.id, {
      status: newStatus,
      conversation_history: conversationHistory,
      ai_thinking: `تحليل: ${analysis.intent.type}, مشاعر: ${analysis.sentiment.sentiment}, الأرقام: ${analysis.numbers.join(', ')}`
    });
  }

  // إنشاء المقاعد وتأكيد للمزود
  async createSeatsAndConfirm(task, seatsCount, price, originalMessage) {
    const provider = await base44.entities.Provider.filter({ id: task.provider_id });
    if (provider.length === 0) return null;
    
    const providerData = provider[0];
    const flight = await base44.entities.Flight.filter({ id: task.flight_id });
    if (flight.length === 0) return null;
    
    const flightData = flight[0];
    
    // تحديد درجة المقعد من الرسالة
    let seatClass = 'economy';
    const lowerMsg = originalMessage.toLowerCase();
    if (lowerMsg.includes('بيزنس') || lowerMsg.includes('business')) {
      seatClass = 'business';
    } else if (lowerMsg.includes('أولى') || lowerMsg.includes('first')) {
      seatClass = 'first';
    }
    
    // حساب الأسعار
    const systemCommission = providerData.commission_value || 50;
    const totalPrice = price + systemCommission;
    
    // إنشاء المقاعد
    const seatData = {
      provider_id: providerData.id,
      provider_name: providerData.company_name_ar,
      flight_id: flightData.id,
      flight_number: flightData.flight_number,
      airline_id: flightData.airline_id,
      airline_name: flightData.airline_name,
      airline_logo: flightData.airline_logo,
      departure_airport_code: flightData.departure_airport_code,
      departure_city: flightData.departure_city,
      arrival_airport_code: flightData.arrival_airport_code,
      arrival_city: flightData.arrival_city,
      departure_date: task.flight_details.match(/\d{4}-\d{2}-\d{2}/)?.[0] || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      departure_time: flightData.departure_time,
      arrival_time: flightData.arrival_time,
      seat_class: seatClass,
      available_count: seatsCount,
      booked_count: 0,
      trip_type: 'round_trip',
      price_outbound: price,
      price_return: 0,
      system_commission: systemCommission,
      total_price: totalPrice,
      provider_earning: price,
      return_policy: 'open',
      status: 'active',
      source: 'ai'
    };
    
    const newSeat = await base44.entities.AvailableSeat.create(seatData);
    
    // رسالة التأكيد
    const confirmationMessage = `تم إضافة المقاعد بنجاح! ✅

📋 التفاصيل:
• الرحلة: ${flightData.flight_number}
• عدد المقاعد: ${seatsCount}
• السعر للعميل: $${totalPrice}
• أرباحك: $${price}
• الدرجة: ${seatClass === 'economy' ? 'اقتصادي' : seatClass === 'business' ? 'بيزنس' : 'أولى'}

سيتم عرض المقاعد للعملاء الآن 🎉

شكراً لك! 🙏`;

    // حفظ النتيجة
    await base44.entities.AITask.update(task.id, {
      result: `تم إنشاء ${seatsCount} مقاعد بسعر $${totalPrice} للعميل`,
      ai_decision: 'تم إنشاء المقاعد بنجاح'
    });
    
    return confirmationMessage;
  }

  // إرسال رد
  async sendResponse(task, message, conversationHistory) {
    if (!this.activeGateway) return;
    
    try {
      await WAHAService.sendTextMessage(
        this.activeGateway.session_id,
        task.provider_whatsapp,
        message
      );
      
      // حفظ الرسالة
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: this.activeGateway.phone_number,
        to_number: task.provider_whatsapp,
        message_type: 'text',
        content: message,
        related_entity_type: 'ai_task',
        related_entity_id: task.id,
        status: 'sent',
        gateway_id: this.activeGateway.id,
        sent_at: new Date().toISOString()
      });
      
      conversationHistory.push({
        role: 'ai',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      // تحديث عدد الرسائل المرسلة
      await base44.entities.WhatsAppGateway.update(this.activeGateway.id, {
        messages_sent: (this.activeGateway.messages_sent || 0) + 1
      });
    } catch (error) {
      console.error('خطأ في إرسال الرد:', error);
    }
  }

  // معالجة أوامر المزود
  async processProviderCommand(message, provider) {
    const content = message.content.toLowerCase();
    
    // أمر إيقاف المقاعد
    if (content.includes('وقف') || content.includes('إيقاف') || content.includes('stop')) {
      return await this.handleStopCommand(content, provider);
    }
    
    // أمر تفعيل المقاعد
    if (content.includes('تفعيل') || content.includes('تشغيل') || content.includes('activate')) {
      return await this.handleActivateCommand(content, provider);
    }
    
    // أمر تحديث السعر
    if (content.includes('سعر') || content.includes('price')) {
      return await this.handlePriceUpdateCommand(content, provider);
    }
    
    return null;
  }

  // أمر إيقاف المقاعد
  async handleStopCommand(content, provider) {
    // استخراج معلومات الرحلة من الرسالة
    const dates = LocalAIEngine.extractDates(content);
    const flightNumbers = content.match(/[A-Z]{2}\d{3,4}/gi);
    
    let filter = {
      provider_id: provider.id,
      status: 'active'
    };
    
    if (dates.length > 0) {
      filter.departure_date = dates[0];
    }
    
    if (flightNumbers && flightNumbers.length > 0) {
      filter.flight_number = flightNumbers[0].toUpperCase();
    }
    
    const seats = await base44.entities.AvailableSeat.filter(filter);
    
    if (seats.length === 0) {
      return 'لم أجد مقاعد تطابق طلبك. يرجى التحديد أكثر.';
    }
    
    // إيقاف المقاعد
    for (const seat of seats) {
      await base44.entities.AvailableSeat.update(seat.id, {
        status: 'paused'
      });
    }
    
    return `تم إيقاف ${seats.length} مقعد بنجاح ✅\n\nلن تظهر للعملاء حتى يتم تفعيلها مرة أخرى.`;
  }

  // أمر تفعيل المقاعد
  async handleActivateCommand(content, provider) {
    const seats = await base44.entities.AvailableSeat.filter({
      provider_id: provider.id,
      status: 'paused'
    });
    
    for (const seat of seats) {
      await base44.entities.AvailableSeat.update(seat.id, {
        status: 'active'
      });
    }
    
    return `تم تفعيل ${seats.length} مقعد ✅`;
  }

  // استخراج رقم من النص
  extractNumber(text, keywords) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return null;
  }

  // كشف التأكيد
  detectConfirmation(text) {
    const confirmWords = ['نعم', 'موافق', 'تمام', 'أكيد', 'متوفر', 'متاح', 'موجود', 'yes', 'ok'];
    const lowerText = text.toLowerCase();
    
    return confirmWords.some(word => lowerText.includes(word));
  }

  // التحقق من أوقات العمل
  isWorkingHours(provider) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    const workingDays = provider.working_days || [0, 1, 2, 3, 4, 5]; // السبت-الخميس
    const startHour = parseInt(provider.working_hours_start?.split(':')[0] || '9');
    const endHour = parseInt(provider.working_hours_end?.split(':')[0] || '20');
    
    return workingDays.includes(currentDay) && 
           currentHour >= startHour && 
           currentHour < endHour;
  }
}

// إنشاء نسخة واحدة من النظام
export const smartProviderAI = new SmartProviderAI();

export default SmartProviderAI;