import { base44 } from '@/api/base44Client';
import { smartMemory } from './SmartMemory';

/**
 * 🧠 الذكاء الاصطناعي الخارق - نسخة محسنة 100%
 * 
 * القدرات:
 * ✅ فهم السياق الكامل من تاريخ المحادثة
 * ✅ التعرف على اللهجات (يمني، خليجي، مصري)
 * ✅ تذكر العميل وحجوزاته
 * ✅ أمان البيانات (لا يعطي معلومات عملاء آخرين)
 * ✅ التعلم من كل تفاعل
 * ✅ ردود طويلة ومفصلة
 * ✅ ذكاء عاطفي (يميز الطوارئ)
 */
export class SuperGeniusAI {
  constructor() {
    this.memory = smartMemory;
  }

  /**
   * معالجة الرسالة بذكاء خارق
   */
  async processMessage(message, phoneNumber) {
    try {
      console.log('\n🧠 بدء التحليل الخارق...');
      
      // 1. جلب السياق الكامل
      const context = await this.memory.getCustomerContext(phoneNumber);
      
      // 2. تحليل عميق جداً
      const analysis = await this.deepAnalysis(message, context);
      
      // 3. تنفيذ ذكي
      const result = await this.executeAction(analysis, context, phoneNumber);
      
      // 4. حفظ المحادثة
      await this.memory.saveConversation(
        phoneNumber,
        context.customer,
        message,
        result.response,
        analysis.intent
      );
      
      // 5. التعلم
      this.memory.learn(phoneNumber, message, result.response, result.success);
      
      console.log('✅ التحليل اكتمل بنجاح');
      
      return result;
      
    } catch (error) {
      console.error('❌ خطأ في AI:', error);
      return {
        response: 'أهلاً بك! معذرة، حصل خطأ تقني بسيط. ممكن تعيد رسالتك؟',
        success: false
      };
    }
  }

  /**
   * تحليل عميق بفهم السياق الكامل
   */
  async deepAnalysis(message, context) {
    // بناء السياق للذكاء الاصطناعي
    let contextText = this.buildContextPrompt(message, context);
    
    const prompt = `أنت موظف خدمة عملاء محترف 100% في شركة طيران. مهمتك خدمة كل عميل بودية واحترام.

${contextText}

📨 رسالة العميل الحالية:
"${message}"

🧠 قدراتك:
✓ فهم جميع اللهجات: يمني، خليجي، مصري، شامي
✓ تذكر المحادثة - لا تكرر الأسئلة
✓ استخراج البيانات: مدن، تواريخ، أسماء، أرقام حجز
✓ كل رسالة عميل جادة إلا إذا كانت واضحة جداً أنها سخيفة

📝 فهم النيات:

1. "مرحبا" / "السلام عليكم" / "اريد منك خدمه"
   → intent: greeting (ليس spam!)
   → action: provide_help
   → response: "مرحباً! كيف أساعدك؟ ابحث عن رحلة؟ حجز قديم؟"
   → is_customer_serious: TRUE - هذا عميل حقيقي!

2. "الو" / "هناك؟"
   → intent: check_connection
   → action: confirm_connection
   → response: "أيوه، أنا هنا! كيف أساعدك؟"

3. "رقم حجزي RES-123"
   → intent: search_booking_by_number
   → action: search_booking_by_number
   → response: "لحظة، أبحث عن حجزك..."

4. "من عدن للقاهرة غد"
   → intent: search_new_flight
   → action: search_flights

🎯 القواعد الذهبية:
- كل رسالة عميل جادة ما لم تكن صريحة كـ "hahahaha" أو "يلا مزح"
- "مرحبا" = عميل حقيقي يريد خدمة ✅
- "اريد منك خدمه" = عميل حقيقي يطلب مساعدة ✅
- الرسائل القصيرة العادية ليست spam!
- spam فقط: "جرب هذا الموقع" أو نصوص بلا معنى`;

    const schema = {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: [
            "search_new_flight",
            "check_existing_booking",
            "search_booking_by_name",
            "search_booking_by_number",
            "problem_with_booking",
            "greeting",
            "question",
            "check_connection",
            "confirmation",
            "rejection",
            "gratitude_end",
            "emergency",
            "spam_or_joke",
            "other"
          ],
          description: "النية الحقيقية - فكر جيداً!"
        },
        language: {
          type: "string",
          enum: ["ar", "en"],
          description: "لغة العميل"
        },
        urgency: {
          type: "string",
          enum: ["normal", "urgent", "emergency"],
          description: "مستوى الأولوية"
        },
        extracted_data: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            from_city: { type: "string" },
            to_city: { type: "string" },
            date: { type: "string" },
            passengers: { type: "number" },
            booking_number: { type: "string" }
          }
        },
        action: {
          type: "string",
          enum: [
            "search_flights",
            "show_booking",
            "search_booking_by_name",
            "search_booking_by_number",
            "confirm_connection",
            "ask_for_info",
            "provide_help",
            "end_conversation",
            "escalate",
            "ignore_spam"
          ],
          description: "الإجراء المطلوب"
        },
        is_customer_serious: {
          type: "boolean",
          description: "هل العميل جاد أم يستهزئ/يزعج؟"
        },
        response: {
          type: "string",
          description: "رد طبيعي وودود ومفصل بلغة العميل"
        },
        reasoning: {
          type: "string",
          description: "لماذا اتخذت هذا القرار؟"
        },
        confidence: {
          type: "number",
          description: "مستوى الثقة 0-100"
        }
      },
      required: ["intent", "language", "action", "response", "confidence"]
    };

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: schema,
      add_context_from_internet: false
    });

    console.log('🎯 النية:', result.intent);
    console.log('⚡ الأولوية:', result.urgency);
    console.log('📊 البيانات:', result.extracted_data);
    console.log('🎬 الإجراء:', result.action);
    console.log('💭 المنطق:', result.reasoning);
    console.log('📈 الثقة:', result.confidence + '%');

    return result;
  }

  /**
   * بناء السياق الذكي
   */
  buildContextPrompt(message, context) {
    let prompt = '';

    // 1. معلومات العميل
    if (context.customer) {
      prompt += `\n📋 معلومات العميل:\n`;
      prompt += `- الاسم: ${context.customer.full_name}\n`;
      prompt += `- عميل مسجل: نعم\n`;
      prompt += `- عدد الحجوزات السابقة: ${context.customer.total_bookings || 0}\n`;
    } else {
      prompt += `\n📋 العميل: جديد (لم يسجل بعد)\n`;
    }

    // 2. تاريخ المحادثة
    if (context.history && context.history.length > 0) {
      prompt += `\n💬 المحادثة السابقة (مهم جداً - استخدمها للسياق):\n`;
      context.history.slice(-10).forEach(msg => {
        const role = msg.role === 'customer' ? '👤 العميل' : '🤖 النظام';
        prompt += `${role}: ${msg.message}\n`;
      });
    }

    // 3. الحجوزات النشطة
    if (context.bookings && context.bookings.length > 0) {
      prompt += `\n✈️ حجوزات العميل:\n`;
      context.bookings.slice(0, 3).forEach(b => {
        prompt += `- ${b.booking_number}: ${b.departure_city} → ${b.arrival_city} (${b.status})\n`;
      });
    }

    // 4. الحالة الحالية
    if (context.currentState && Object.keys(context.currentState).length > 0) {
      prompt += `\n🔄 الحالة الحالية:\n`;
      if (context.currentState.searchingFor) {
        prompt += `- يبحث عن: ${context.currentState.searchingFor}\n`;
      }
      if (context.currentState.lastIntent) {
        prompt += `- آخر نية: ${context.currentState.lastIntent}\n`;
      }
    }

    return prompt;
  }

  /**
   * تنفيذ الإجراء بذكاء
   */
  async executeAction(analysis, context, phoneNumber) {
    const result = {
      response: analysis.response,
      success: true,
      data: null
    };

    try {
      // ✅ فحص: هل عميل مزعج/غير جاد؟
      if (analysis.is_customer_serious === false || analysis.action === 'ignore_spam') {
        console.log('⚠️ عميل غير جاد:', analysis.reasoning);
        await this.handleSuspiciousCustomer(phoneNumber, analysis);
        // لا نرد - الرد من analysis يكون أنسب
        result.response = analysis.response || 'شكراً لتواصلك معنا.';
        return result;
      }

      // ✅ "الو" = تأكيد الاتصال
      if (analysis.action === 'confirm_connection') {
        result.response = analysis.response || (analysis.language === 'en'
          ? '👋 Yes, I\'m here! How can I help you?'
          : '👋 أيوه، أنا هنا! كيف أقدر أساعدك؟');
        return result;
      }

      // ✅ greeting = عميل جديد يطلب خدمة عامة
      if (analysis.action === 'provide_help') {
        result.response = analysis.response || (analysis.language === 'en'
          ? 'Hello! How can I help? Looking for flights, or do you have an existing booking?'
          : 'مرحباً! كيف أساعدك؟ ابحث عن رحلة جديدة؟ أم عندك حجز قديم؟');
        return result;
      }

      // 1. البحث عن حجز برقم الحجز (أولوية!)
      if (analysis.action === 'search_booking_by_number' && analysis.extracted_data?.booking_number) {
        const bookings = await this.searchBookingByNumber(
          analysis.extracted_data.booking_number,
          phoneNumber
        );
        
        if (bookings.length > 0) {
          result.response = this.formatBooking(bookings[0], analysis.language);
          result.data = bookings[0];
        } else {
          result.response = analysis.language === 'en'
            ? `Booking ${analysis.extracted_data.booking_number} not found. Please verify the number.`
            : `حجز ${analysis.extracted_data.booking_number} مو موجود. تأكد من الرقم.`;
        }
        return result;
      }

      // 2. البحث عن رحلات جديدة
      if (analysis.action === 'search_flights' && analysis.extracted_data) {
        const flights = await this.searchFlights(analysis.extracted_data);
        
        if (flights && flights.length > 0) {
          result.response = this.formatFlights(flights, analysis.language, analysis.extracted_data);
          result.data = flights;
        } else {
          // ✅ تسجيل الطلب غير المتوفر
          await this.recordUnavailableRequest(phoneNumber, context.customer, analysis.extracted_data, analysis);
          result.response = this.noFlightsMessage(analysis.extracted_data, analysis.language);
        }
        return result;
      }

      // 3. عرض حجز موجود
      else if (analysis.action === 'show_booking' && context.bookings.length > 0) {
        const booking = context.bookings[0];
        result.response = this.formatBooking(booking, analysis.language);
        result.data = booking;
        return result;
      }

      // 4. البحث عن حجز بالاسم (مع الأمان!)
      else if (analysis.action === 'search_booking_by_name' && analysis.extracted_data?.customer_name) {
        console.log('🔍 بحث بالاسم (آمن):', analysis.extracted_data.customer_name);
        
        const bookings = await this.memory.searchBookingSafely(
          analysis.extracted_data.customer_name,
          phoneNumber
        );
        
        if (bookings.length > 0) {
          console.log('✅ وجدنا حجز:', bookings[0].booking_number);
          result.response = this.formatBooking(bookings[0], analysis.language);
          result.data = bookings[0];
        } else {
          console.log('❌ لم نجد حجز بهذا الاسم');
          result.response = analysis.language === 'en'
            ? `No booking found for "${analysis.extracted_data.customer_name}" with your phone number.`
            : `ما لقيت حجز باسم "${analysis.extracted_data.customer_name}" لرقمك.`;
        }
        return result;
      }

      // تحديث الذاكرة القصيرة
      this.memory.updateShortTerm(phoneNumber, {
        lastIntent: analysis.intent,
        lastAction: analysis.action,
        searchingFor: analysis.extracted_data
      });

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

      const seats = await base44.entities.AvailableSeat.filter(filters, '-departure_date', 15);
      
      // فقط المقاعد المتاحة
      return seats.filter(s => s.available_count > 0);
      
    } catch (error) {
      console.error('خطأ في البحث:', error);
      return [];
    }
  }

  /**
   * توحيد أسماء المدن (لهجات مختلفة)
   */
  normalizeCityName(city) {
    const normalized = city.toLowerCase().trim();
    
    const cityMap = {
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
      'دبي': 'دبي',
      'riyadh': 'الرياض',
      'الرياض': 'الرياض'
    };
    
    return cityMap[normalized] || city;
  }

  /**
   * تنسيق نتائج الرحلات (مفصل)
   */
  formatFlights(flights, lang, searchData) {
    const isEn = lang === 'en';
    
    let msg = isEn 
      ? `✈️ Found ${flights.length} available flights:\n\n`
      : `✈️ لقيت ${flights.length} رحلة متاحة:\n\n`;
    
    flights.slice(0, 5).forEach((f, i) => {
      msg += `${i + 1}. ${f.airline_name || 'شركة طيران'}\n`;
      msg += `   🛫 ${f.departure_city} → ${f.arrival_city}\n`;
      msg += `   📅 ${f.departure_date || '-'} | ⏰ ${f.departure_time || '-'}\n`;
      msg += `   💺 ${f.available_count} ${isEn ? 'seats available' : 'مقعد متاح'}\n`;
      msg += `   💵 ${f.total_price || 0} ${isEn ? 'YER' : 'ريال'}\n`;
      msg += `   📍 ${isEn ? 'Provider' : 'المزود'}: ${f.provider_name || '-'}\n\n`;
    });

    msg += isEn 
      ? '📞 To book, tell me which flight number you want (1, 2, 3...)\n\nOr contact us directly for immediate booking!'
      : '📞 للحجز، قول لي رقم الرحلة اللي تبيها (1، 2، 3...)\n\nأو تواصل معنا مباشرة للحجز الفوري!';
    
    return msg;
  }

  /**
   * رسالة عدم وجود رحلات
   */
  noFlightsMessage(data, lang) {
    const isEn = lang === 'en';
    
    if (isEn) {
      return `Sorry, no available flights from ${data.from_city || '...'} to ${data.to_city || '...'} ${data.date ? 'on ' + data.date : ''}.\n\n📅 Would you like to:\n1. Try another date?\n2. Try different cities?\n3. Get notified when flights become available?`;
    }
    
    return `عذراً، ما في رحلات متاحة من ${data.from_city || '...'} إلى ${data.to_city || '...'} ${data.date ? 'بتاريخ ' + data.date : ''}.\n\n📅 تبي:\n1. تجرب تاريخ ثاني؟\n2. تجرب مدن ثانية؟\n3. نبلغك لما تتوفر رحلات؟`;
  }

  /**
   * تنسيق معلومات الحجز (مفصل)
   */
  formatBooking(booking, lang) {
    const isEn = lang === 'en';
    
    if (isEn) {
      return `✈️ Your Booking Details:\n\n📋 Booking #: ${booking.booking_number}\n👤 Passenger: ${booking.customer_name}\n🛫 Route: ${booking.departure_city} → ${booking.arrival_city}\n📅 Date: ${booking.departure_date}\n⏰ Time: ${booking.departure_time || '-'}\n👥 Passengers: ${booking.passengers_count}\n💵 Total: ${booking.total_amount} YER\n📊 Status: ${this.translateStatus(booking.status, 'en')}\n\n${this.statusMessage(booking.status, 'en')}`;
    }
    
    return `✈️ تفاصيل حجزك:\n\n📋 رقم الحجز: ${booking.booking_number}\n👤 الاسم: ${booking.customer_name}\n🛫 المسار: ${booking.departure_city} → ${booking.arrival_city}\n📅 التاريخ: ${booking.departure_date}\n⏰ الوقت: ${booking.departure_time || '-'}\n👥 عدد المسافرين: ${booking.passengers_count}\n💵 المبلغ الكلي: ${booking.total_amount} ريال\n📊 الحالة: ${this.translateStatus(booking.status, 'ar')}\n\n${this.statusMessage(booking.status, 'ar')}`;
  }

  translateStatus(status, lang) {
    if (lang === 'en') {
      const map = {
        'pending_payment': 'Pending Payment',
        'paid': 'Paid',
        'pending_issue': 'Being Processed',
        'issued': 'Ticket Issued ✅',
        'cancelled': 'Cancelled'
      };
      return map[status] || status;
    }
    
    const map = {
      'pending_payment': 'بانتظار الدفع',
      'paid': 'مدفوع',
      'pending_issue': 'قيد الإصدار',
      'issued': 'تذكرة صادرة ✅',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  }

  statusMessage(status, lang) {
    if (lang === 'en') {
      if (status === 'issued') return '✅ Your ticket is ready! We will send it to you shortly.';
      if (status === 'pending_issue') return '⏳ Your booking is being processed. You will receive your ticket soon.';
      if (status === 'paid') return '💰 Payment received. Processing your ticket...';
      return '📞 Need help? Contact us anytime!';
    }
    
    if (status === 'issued') return '✅ تذكرتك جاهزة! راح نرسلها لك الحين.';
    if (status === 'pending_issue') return '⏳ حجزك قيد الإصدار. راح توصلك التذكرة قريب.';
    if (status === 'paid') return '💰 استلمنا الدفع. نشتغل على إصدار تذكرتك...';
    return '📞 تحتاج مساعدة؟ تواصل معنا أي وقت!';
  }

  /**
   * البحث برقم الحجز (آمن)
   */
  async searchBookingByNumber(bookingNumber, phoneNumber) {
    try {
      const bookings = await base44.entities.Booking.filter({
        booking_number: bookingNumber
      }, '-created_date', 1);
      
      // ✅ فلترة أمنية: فقط حجوزات نفس الرقم
      return bookings.filter(b => 
        b.customer_phone === phoneNumber || 
        b.customer_whatsapp === phoneNumber
      );
    } catch (e) {
      return [];
    }
  }

  /**
   * تسجيل طلب غير متوفر
   */
  async recordUnavailableRequest(phoneNumber, customer, data, analysis) {
    try {
      // البحث عن طلب مشابه
      const existing = await base44.entities.UnavailableFlightRequest.filter({
        customer_phone: phoneNumber,
        from_city: data.from_city,
        to_city: data.to_city,
        status: 'pending'
      }, '-created_date', 1);

      if (existing.length > 0) {
        // زيادة العداد
        await base44.entities.UnavailableFlightRequest.update(existing[0].id, {
          request_count: (existing[0].request_count || 1) + 1,
          requested_date: data.date || existing[0].requested_date
        });
      } else {
        // طلب جديد
        await base44.entities.UnavailableFlightRequest.create({
          customer_phone: phoneNumber,
          customer_name: customer?.full_name || 'عميل',
          from_city: data.from_city,
          to_city: data.to_city,
          requested_date: data.date || null,
          passengers_count: data.passengers || 1,
          airline_preference: data.airline || null,
          urgency: analysis.urgency || 'normal',
          is_serious: analysis.is_customer_serious !== false,
          status: 'pending'
        });
      }

      console.log('📝 تم تسجيل طلب غير متوفر:', data.from_city, '→', data.to_city);
    } catch (e) {
      console.error('خطأ في تسجيل الطلب:', e);
    }
  }

  /**
   * معالجة العميل المشبوه
   */
  async handleSuspiciousCustomer(phoneNumber, analysis) {
    try {
      const blacklisted = await base44.entities.BlacklistedCustomer.filter({
        phone_number: phoneNumber,
        is_active: true
      });

      if (blacklisted.length > 0) {
        // زيادة عداد المخالفات
        await base44.entities.BlacklistedCustomer.update(blacklisted[0].id, {
          offense_count: (blacklisted[0].offense_count || 1) + 1
        });
      } else {
        // اقتراح للقائمة السوداء
        await base44.entities.BlacklistedCustomer.create({
          phone_number: phoneNumber,
          reason: 'طلبات غير جادة أو استهزاء',
          offense_type: analysis.intent === 'spam_or_joke' ? 'spam' : 'fake_requests',
          auto_detected: true,
          blocked_by: 'AI System',
          is_active: false, // غير مفعل - يحتاج موافقة المدير
          notes: `اكتشفه الذكاء الاصطناعي - ${analysis.reasoning}`
        });
      }

      console.log('⚠️ عميل مشبوه:', phoneNumber);
    } catch (e) {
      console.error('خطأ في معالجة العميل المشبوه:', e);
    }
  }
}

export const superGeniusAI = new SuperGeniusAI();