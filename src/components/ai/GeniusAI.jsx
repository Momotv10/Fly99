import { base44 } from '@/api/base44Client';

/**
 * 🧠 نظام ذكاء اصطناعي متقدم 100%
 * - يتعلم من كل محادثة
 * - يفهم السياق كاملاً
 * - يتذكر العميل والمحادثات السابقة
 * - يستخرج البيانات بذكاء خارق
 */
export class GeniusAI {
  constructor() {
    this.conversationMemory = new Map(); // ذاكرة قصيرة المدى
  }

  /**
   * المعالج الرئيسي - يفهم كل شيء
   */
  async processMessage(message, customer, history = []) {
    try {
      console.log('\n🧠 بدء التحليل الذكي...');
      
      // 1. بناء السياق الكامل مع التعلم
      const fullContext = await this.buildIntelligentContext(message, customer, history);
      
      // 2. تحليل عميق متقدم
      const analysis = await this.deepThink(message, fullContext);
      
      // 3. تنفيذ ذكي
      const result = await this.executeSmartAction(analysis, customer);
      
      // 4. التعلم من التفاعل
      await this.learn(customer?.whatsapp || 'unknown', message, result);
      
      console.log('✅ التحليل اكتمل');
      return result;
      
    } catch (error) {
      console.error('❌ خطأ في AI:', error);
      return {
        response: 'أهلاً، معذرة حصل خطأ تقني بسيط. ممكن تعيد رسالتك؟',
        success: false
      };
    }
  }

  /**
   * بناء سياق ذكي شامل
   */
  async buildIntelligentContext(currentMessage, customer, history) {
    let context = {
      current_message: currentMessage,
      customer_info: '',
      conversation_history: '',
      learned_patterns: '',
      business_data: ''
    };

    // معلومات العميل
    if (customer) {
      context.customer_info = `
اسم العميل: ${customer.full_name}
عميل مسجل: نعم
عدد الحجوزات السابقة: ${customer.total_bookings || 0}
`;
    } else {
      context.customer_info = 'عميل جديد - أول مرة يتواصل معنا';
    }

    // تاريخ المحادثة
    if (history && history.length > 0) {
      context.conversation_history = '\nالمحادثة السابقة:\n';
      history.slice(-10).forEach(msg => {
        const role = msg.role === 'customer' ? '👤 العميل' : '🤖 النظام';
        context.conversation_history += `${role}: ${msg.message}\n`;
      });
    }

    // أنماط متعلمة من ذاكرة النظام
    const phoneKey = customer?.whatsapp || 'unknown';
    if (this.conversationMemory.has(phoneKey)) {
      const memory = this.conversationMemory.get(phoneKey);
      context.learned_patterns = `\nأنماط سابقة: ${JSON.stringify(memory.patterns)}`;
    }

    // بيانات الأعمال الحالية
    try {
      const recentSeats = await base44.entities.AvailableSeat.list('-created_date', 5);
      if (recentSeats.length > 0) {
        context.business_data = '\nرحلات متاحة حالياً:\n';
        recentSeats.slice(0, 3).forEach(seat => {
          context.business_data += `- ${seat.departure_city} → ${seat.arrival_city} (${seat.available_count} مقعد)\n`;
        });
      }
    } catch (e) {
      // ignore
    }

    return context;
  }

  /**
   * تحليل عميق بذكاء خارق
   */
  async deepThink(message, context) {
    const prompt = `أنت موظف خدمة عملاء محترف جداً في شركة حجز طيران. مهمتك خدمة العميل بذكاء وسرعة.

📋 المعلومات المتاحة:
${context.customer_info}
${context.conversation_history}
${context.business_data}

📨 رسالة العميل الحالية:
"${message}"

🎯 قدراتك الذكية:
✓ فهم جميع اللهجات: يمني، خليجي، مصري، شامي، عامية، فصحى
✓ فهم الاختصارات: "كم شخص؟" والرد "3" = 3 أشخاص
✓ استخراج المدن: "من عدن للقاهرة" أو "عدن القاهرة" أو "ADE to CAI"
✓ فهم التواريخ: "الخميس" أو "يوم الخميس القادم" أو "Thursday"
✓ ربط الأسئلة بالأجوبة: إذا سألت "كم؟" وقال "5" = الإجابة 5
✓ تذكر السياق: لا تكرر الأسئلة المجابة

📝 أمثلة ذكية:
- "اريد تذكرة" → intent: search_flight, action: ask_details
- "عدن القاهرة الخميس" → من عدن، إلى القاهرة، يوم الخميس
- "5" (بعد سؤال عدد المسافرين) → passenger_count: 5
- "مرحبا" → intent: greeting, رد ودود
- "وين حجزي؟" → intent: check_booking

🎯 مطلوب منك:
1. حدد نية العميل بدقة
2. استخرج البيانات (من، إلى، متى، كم شخص) بذكاء خارق
3. رد بشكل طبيعي جداً وودود - كموظف بشري محترف
4. استخدم لغة العميل (إذا كتب عربي رد عربي، إنجليزي رد إنجليزي)
5. اختصر - لا ترسل رسائل طويلة

⚠️ مهم جداً:
- إذا كانت البيانات كاملة (من، إلى، تاريخ، عدد) → action: "search"
- إذا ناقصة → action: "ask_more" واسأل عن الناقص فقط
- لا تكرر السؤال نفسه مرتين
- رد واحد قصير وواضح`;

    const schema = {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["search_flight", "check_booking", "complaint", "greeting", "question", "number_response", "confirmation", "other"],
          description: "نية العميل"
        },
        language: {
          type: "string",
          enum: ["ar", "en"],
          description: "لغة الرسالة"
        },
        extracted_data: {
          type: "object",
          properties: {
            from_city: { type: "string", description: "مدينة المغادرة" },
            to_city: { type: "string", description: "مدينة الوصول" },
            date: { type: "string", description: "تاريخ السفر" },
            passengers: { type: "number", description: "عدد المسافرين" }
          }
        },
        has_complete_data: {
          type: "boolean",
          description: "هل لدينا كل المعلومات (من، إلى، تاريخ، عدد)؟"
        },
        missing_info: {
          type: "array",
          items: { type: "string" },
          description: "ما الذي ينقص؟"
        },
        response: {
          type: "string",
          description: "رد مختصر وودود بلغة العميل"
        },
        action: {
          type: "string",
          enum: ["search", "ask_more", "show_booking", "general_response"],
          description: "الإجراء المطلوب"
        },
        confidence: {
          type: "number",
          description: "مستوى الثقة في الفهم (0-100)"
        }
      },
      required: ["intent", "language", "response", "action", "confidence"]
    };

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: schema,
      add_context_from_internet: false
    });

    console.log('🎯 النية:', result.intent);
    console.log('📊 البيانات:', result.extracted_data);
    console.log('🎬 الإجراء:', result.action);
    console.log('💬 الرد:', result.response);
    console.log('📈 الثقة:', result.confidence + '%');

    return result;
  }

  /**
   * تنفيذ ذكي بناءً على التحليل
   */
  async executeSmartAction(analysis, customer) {
    const result = {
      response: analysis.response,
      success: true,
      action: analysis.action,
      data: null
    };

    try {
      // إذا كانت البيانات كاملة → بحث فوري
      if (analysis.action === 'search' && analysis.has_complete_data) {
        const flights = await this.searchFlights(analysis.extracted_data);
        
        if (flights && flights.length > 0) {
          result.response = this.formatFlightResults(flights, analysis.language);
          result.data = flights;
        } else {
          result.response = analysis.language === 'en'
            ? `No flights found from ${analysis.extracted_data.from_city} to ${analysis.extracted_data.to_city}. Try another date?`
            : `ما لقيت رحلات من ${analysis.extracted_data.from_city} إلى ${analysis.extracted_data.to_city}. تبي تاريخ ثاني؟`;
        }
      }
      
      // البحث عن حجوزات
      else if (analysis.action === 'show_booking' && customer) {
        const bookings = await base44.entities.Booking.filter({
          customer_id: customer.id
        }, '-created_date', 1);
        
        if (bookings.length > 0) {
          result.response = this.formatBooking(bookings[0], analysis.language);
          result.data = bookings[0];
        }
      }

    } catch (error) {
      console.error('خطأ في التنفيذ:', error);
    }

    return result;
  }

  /**
   * البحث الذكي عن الرحلات
   */
  async searchFlights(data) {
    try {
      const filters = { status: 'active' };
      
      if (data.from_city) {
        filters.departure_city = this.normalizeCityName(data.from_city);
      }
      
      if (data.to_city) {
        filters.arrival_city = this.normalizeCityName(data.to_city);
      }

      const seats = await base44.entities.AvailableSeat.filter(filters, '-departure_date', 10);
      return seats.filter(s => s.available_count > 0);
      
    } catch (error) {
      console.error('خطأ في البحث:', error);
      return [];
    }
  }

  /**
   * توحيد أسماء المدن
   */
  normalizeCityName(city) {
    const map = {
      'aden': 'عدن',
      'عدن': 'عدن',
      'cairo': 'القاهرة',
      'القاهرة': 'القاهرة',
      'مصر': 'القاهرة',
      'sanaa': 'صنعاء',
      'صنعاء': 'صنعاء',
      'jeddah': 'جدة',
      'جدة': 'جدة',
      'dubai': 'دبي',
      'دبي': 'دبي'
    };
    
    return map[city.toLowerCase()] || city;
  }

  /**
   * تنسيق نتائج الرحلات
   */
  formatFlightResults(flights, lang) {
    const isEn = lang === 'en';
    
    if (flights.length === 0) {
      return isEn ? 'No flights available' : 'ما في رحلات متاحة';
    }

    let msg = isEn 
      ? `Found ${flights.length} flights:\n\n`
      : `لقيت ${flights.length} رحلة:\n\n`;
    
    flights.slice(0, 3).forEach((f, i) => {
      msg += `${i + 1}. ✈️ ${f.departure_city} → ${f.arrival_city}\n`;
      msg += `   📅 ${f.departure_date || '-'}\n`;
      msg += `   💺 ${f.available_count} ${isEn ? 'seats' : 'مقعد'}\n`;
      msg += `   💵 ${f.total_price || 0} ${isEn ? 'YER' : 'ريال'}\n\n`;
    });

    msg += isEn 
      ? 'Want to book? Tell me which number'
      : 'تبي تحجز؟ قول لي الرقم';
    
    return msg;
  }

  /**
   * تنسيق معلومات الحجز
   */
  formatBooking(booking, lang) {
    const isEn = lang === 'en';
    
    if (isEn) {
      return `Your booking:\n📋 ${booking.booking_number}\n✈️ ${booking.departure_city} → ${booking.arrival_city}\n📅 ${booking.departure_date}\n📊 ${booking.status}`;
    }
    
    return `حجزك:\n📋 ${booking.booking_number}\n✈️ ${booking.departure_city} → ${booking.arrival_city}\n📅 ${booking.departure_date}\n📊 ${this.statusAr(booking.status)}`;
  }

  statusAr(status) {
    const map = {
      'pending_payment': 'بانتظار الدفع',
      'paid': 'مدفوع',
      'issued': 'صادرة',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  }

  /**
   * التعلم من كل تفاعل
   */
  async learn(phoneNumber, message, result) {
    try {
      if (!this.conversationMemory.has(phoneNumber)) {
        this.conversationMemory.set(phoneNumber, {
          patterns: [],
          preferences: {},
          lastInteraction: Date.now()
        });
      }

      const memory = this.conversationMemory.get(phoneNumber);
      
      // حفظ الأنماط
      memory.patterns.push({
        message: message,
        intent: result.intent,
        timestamp: Date.now()
      });

      // الاحتفاظ بآخر 20 نمط فقط
      if (memory.patterns.length > 20) {
        memory.patterns = memory.patterns.slice(-20);
      }

      memory.lastInteraction = Date.now();
      
      this.conversationMemory.set(phoneNumber, memory);

      // تنظيف الذاكرة القديمة
      if (this.conversationMemory.size > 1000) {
        const entries = Array.from(this.conversationMemory.entries());
        const sorted = entries.sort((a, b) => b[1].lastInteraction - a[1].lastInteraction);
        this.conversationMemory = new Map(sorted.slice(0, 500));
      }

    } catch (e) {
      // ignore
    }
  }
}