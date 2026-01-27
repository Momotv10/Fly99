import { base44 } from '@/api/base44Client';

export class UltraSmartAI {
  constructor() {
    this.processing = new Map(); // نتتبع الرسائل قيد المعالجة
  }

  async processMessage(message, customer, conversationHistory = []) {
    try {
      // بناء السياق الكامل
      const context = this.buildContext(conversationHistory);
      
      // تحليل ذكي متقدم مع الإنترنت
      const analysis = await this.deepAnalysis(message, customer, context);
      
      // تنفيذ الإجراء المناسب
      const result = await this.executeIntelligentAction(analysis, customer);
      
      return result;
    } catch (error) {
      console.error('❌ AI Error:', error);
      return {
        response: 'عذراً، حدث خطأ. دعني أحاول مرة أخرى.',
        success: false
      };
    }
  }

  buildContext(history) {
    if (!history || history.length === 0) return '';
    
    let context = '\n\nالمحادثة السابقة:\n';
    history.slice(-6).forEach(msg => {
      if (msg.role === 'customer') {
        context += `👤 العميل: ${msg.message}\n`;
      } else if (msg.role === 'ai') {
        context += `🤖 النظام: ${msg.message}\n`;
      }
    });
    
    return context;
  }

  async deepAnalysis(message, customer, context) {
    const prompt = `أنت موظف خدمة عملاء محترف جداً في شركة طيران. تتحدث بشكل طبيعي وودود.

المعلومات:
- رسالة العميل: "${message}"
- اسم العميل: ${customer?.full_name || 'عميل جديد'}
${context}

قدراتك:
✓ فهم جميع اللغات (عربي، إنجليزي، أي لغة)
✓ فهم اللهجات (يمني، خليجي، مصري، إلخ)
✓ تذكر المحادثة كاملة وربط الأسئلة بالأجوبة
✓ استخراج البيانات بذكاء (مدن، تواريخ، أعداد)

أمثلة ذكية:
- إذا سألت "كم عدد المسافرين؟" والعميل قال "5" → يعني 5 مسافرين
- "عدن القاهرة الخميس" → من عدن إلى القاهرة يوم الخميس
- "تبي تذكرة؟" → هل تريد تذكرة؟
- مجرد رقم بعد سؤال → هو الإجابة على السؤال

المطلوب:
1. افهم ماذا يريد العميل بالضبط
2. استخرج المعلومات (من، إلى، متى، كم شخص)
3. رد بشكل طبيعي ومفيد كموظف حقيقي
4. استخدم السياق - لا تنسى ما قاله العميل

IMPORTANT: 
- إذا كانت المعلومات كاملة → ابحث فوراً
- إذا ناقصة → اسأل بوضوح عما ينقص فقط
- لا تكرر الأسئلة
- استخدم لغة العميل (إذا كتب بالإنجليزية، رد بالإنجليزية)`;

    const schema = {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["search_flight", "check_booking", "problem", "greeting", "info_request", "other"],
          description: "النية الحقيقية"
        },
        language: {
          type: "string",
          enum: ["ar", "en", "other"],
          description: "لغة العميل"
        },
        data: {
          type: "object",
          properties: {
            from_city: { type: "string" },
            to_city: { type: "string" },
            departure_date: { type: "string" },
            passenger_count: { type: "number" }
          }
        },
        has_all_info: {
          type: "boolean",
          description: "هل لدينا جميع المعلومات للبحث؟"
        },
        missing: {
          type: "array",
          items: { type: "string" },
          description: "ما الناقص؟"
        },
        response: {
          type: "string",
          description: "رد طبيعي ومفيد بلغة العميل"
        },
        action: {
          type: "string",
          enum: ["search", "ask_more", "check_booking", "general_help"],
          description: "الإجراء المطلوب"
        }
      },
      required: ["intent", "response", "action"]
    };

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: schema,
      add_context_from_internet: false
    });

    console.log('🧠 التحليل:', result.intent, '|', result.action);
    console.log('📊 البيانات:', result.data);
    console.log('💬 الرد:', result.response);

    return result;
  }

  async executeIntelligentAction(analysis, customer) {
    const result = {
      response: analysis.response,
      success: true,
      data: null
    };

    if (analysis.action === 'search' && analysis.has_all_info) {
      // بحث فعلي عن الرحلات
      const flights = await this.searchFlights(analysis.data);
      
      if (flights && flights.length > 0) {
        result.response = this.buildFlightResults(flights, analysis.data, analysis.language);
        result.data = flights;
      } else {
        result.response = analysis.language === 'en' 
          ? `Sorry, no flights available from ${analysis.data.from_city} to ${analysis.data.to_city}. Would you like to search for another date?`
          : `عذراً، لا توجد رحلات متاحة من ${analysis.data.from_city} إلى ${analysis.data.to_city}. تريد تبحث عن تاريخ ثاني؟`;
      }
    } else if (analysis.action === 'check_booking') {
      // البحث عن حجوزات العميل
      if (customer) {
        const bookings = await this.getCustomerBookings(customer.id);
        if (bookings.length > 0) {
          result.response = this.buildBookingInfo(bookings[0], analysis.language);
          result.data = bookings;
        }
      }
    }

    return result;
  }

  async searchFlights(data) {
    try {
      let filters = { status: 'active' };
      
      if (data.from_city) {
        // بحث ذكي - نبحث في الأسماء أيضاً
        const fromVariants = this.getCityVariants(data.from_city);
        filters.departure_city = data.from_city;
      }
      
      if (data.to_city) {
        filters.arrival_city = data.to_city;
      }

      const seats = await base44.entities.AvailableSeat.filter(filters, '-created_date', 10);
      return seats;
    } catch (error) {
      console.error('خطأ في البحث:', error);
      return [];
    }
  }

  getCityVariants(city) {
    const variants = {
      'عدن': ['عدن', 'Aden'],
      'القاهرة': ['القاهرة', 'Cairo', 'مصر'],
      'صنعاء': ['صنعاء', 'Sanaa'],
      'جدة': ['جدة', 'Jeddah'],
      'دبي': ['دبي', 'Dubai']
    };
    
    return variants[city] || [city];
  }

  buildFlightResults(flights, searchData, language) {
    const isEnglish = language === 'en';
    
    if (flights.length === 0) {
      return isEnglish 
        ? 'No flights found. Try another date?'
        : 'ما لقيت رحلات. تبي تجرب تاريخ ثاني؟';
    }

    let response = isEnglish 
      ? `Found ${flights.length} available flights:\n\n`
      : `لقيت ${flights.length} رحلة متاحة:\n\n`;
    
    flights.slice(0, 5).forEach((flight, i) => {
      if (isEnglish) {
        response += `${i + 1}. ✈️ ${flight.departure_city} → ${flight.arrival_city}\n`;
        response += `   📅 ${flight.departure_date || 'TBD'}\n`;
        response += `   💺 ${flight.available_count || 0} seats\n`;
        response += `   💵 ${flight.total_price || 0} YER\n\n`;
      } else {
        response += `${i + 1}. ✈️ ${flight.departure_city} → ${flight.arrival_city}\n`;
        response += `   📅 ${flight.departure_date || 'غير محدد'}\n`;
        response += `   💺 ${flight.available_count || 0} مقعد\n`;
        response += `   💵 ${flight.total_price || 0} ريال\n\n`;
      }
    });

    response += isEnglish 
      ? 'Would you like to book one? Tell me the number.'
      : 'تبي تحجز وحدة؟ قول لي الرقم.';
    
    return response;
  }

  async getCustomerBookings(customerId) {
    try {
      return await base44.entities.Booking.filter({
        customer_id: customerId
      }, '-created_date', 3);
    } catch (error) {
      return [];
    }
  }

  buildBookingInfo(booking, language) {
    const isEnglish = language === 'en';
    
    if (isEnglish) {
      return `Your booking:\n\n📋 Reference: ${booking.booking_number}\n✈️ ${booking.departure_city} → ${booking.arrival_city}\n📅 ${booking.departure_date}\n👥 ${booking.passengers_count} passengers\n📊 Status: ${booking.status}\n\n${booking.status === 'issued' ? 'Your ticket is ready! ✅' : 'Your booking is being processed ⏳'}`;
    }
    
    return `حجزك:\n\n📋 رقم الحجز: ${booking.booking_number}\n✈️ ${booking.departure_city} → ${booking.arrival_city}\n📅 ${booking.departure_date}\n👥 ${booking.passengers_count} مسافر\n📊 الحالة: ${this.translateStatus(booking.status)}\n\n${booking.status === 'issued' ? 'تذكرتك جاهزة! ✅' : 'حجزك قيد الإصدار ⏳'}`;
  }

  translateStatus(status) {
    const map = {
      'pending_payment': 'بانتظار الدفع',
      'paid': 'مدفوع',
      'pending_issue': 'قيد الإصدار',
      'issued': 'صادرة',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  }
}