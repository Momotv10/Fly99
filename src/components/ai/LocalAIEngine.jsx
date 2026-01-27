// محرك الذكاء الاصطناعي المحلي - بدون خدمات خارجية
// يستخدم خوارزميات متقدمة للمعالجة والتحليل

export const LocalAIEngine = {
  
  // تحليل النصوص واستخراج المعلومات
  async analyzeText(text, context = {}) {
    const analysis = {
      entities: this.extractEntities(text),
      intent: this.detectIntent(text, context),
      sentiment: this.analyzeSentiment(text),
      keywords: this.extractKeywords(text),
      numbers: this.extractNumbers(text),
      dates: this.extractDates(text),
      language: this.detectLanguage(text)
    };
    
    return analysis;
  },

  // استخراج الكيانات من النص
  extractEntities(text) {
    const entities = {
      airports: [],
      airlines: [],
      cities: [],
      prices: [],
      dates: [],
      flightNumbers: []
    };

    // استخراج أرقام الرحلات (مثل: IY601, YE302)
    const flightPattern = /[A-Z]{2}\d{3,4}/gi;
    entities.flightNumbers = [...new Set(text.match(flightPattern) || [])];

    // استخراج أكواد المطارات (مثل: CAI, SAH, ADE)
    const airportPattern = /\b[A-Z]{3}\b/g;
    entities.airports = [...new Set(text.match(airportPattern) || [])];

    // استخراج الأسعار
    const pricePattern = /(\d+)\s*(دولار|dollar|\$|ريال)/gi;
    const priceMatches = text.matchAll(pricePattern);
    for (const match of priceMatches) {
      entities.prices.push(parseInt(match[1]));
    }

    return entities;
  },

  // كشف النية من النص
  detectIntent(text, context) {
    const lowerText = text.toLowerCase();
    
    // نوايا الحجز
    if (lowerText.includes('حجز') || lowerText.includes('أريد') || lowerText.includes('booking')) {
      return { type: 'booking_request', confidence: 0.9 };
    }
    
    // نوايا الاستفسار
    if (lowerText.includes('كم') || lowerText.includes('هل') || lowerText.includes('متى')) {
      return { type: 'inquiry', confidence: 0.85 };
    }
    
    // نوايا التأكيد
    if (lowerText.includes('نعم') || lowerText.includes('موافق') || lowerText.includes('تم') || lowerText.includes('أكيد')) {
      return { type: 'confirmation', confidence: 0.95 };
    }
    
    // نوايا الرفض
    if (lowerText.includes('لا') || lowerText.includes('رفض') || lowerText.includes('إلغاء')) {
      return { type: 'rejection', confidence: 0.9 };
    }
    
    // نوايا طلب المعلومات
    if (lowerText.includes('معلومات') || lowerText.includes('تفاصيل') || lowerText.includes('بيانات')) {
      return { type: 'info_request', confidence: 0.8 };
    }
    
    return { type: 'unknown', confidence: 0.5 };
  },

  // تحليل المشاعر
  analyzeSentiment(text) {
    const positiveWords = ['شكرا', 'ممتاز', 'رائع', 'جيد', 'موافق', 'نعم', 'تمام'];
    const negativeWords = ['سيء', 'مشكلة', 'خطأ', 'لا', 'رفض', 'إلغاء'];
    
    let score = 0;
    const lowerText = text.toLowerCase();
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1;
    });
    
    if (score > 0) return { sentiment: 'positive', score };
    if (score < 0) return { sentiment: 'negative', score };
    return { sentiment: 'neutral', score: 0 };
  },

  // استخراج الكلمات المفتاحية
  extractKeywords(text) {
    const stopWords = ['من', 'إلى', 'في', 'على', 'هل', 'أن', 'و', 'ل', 'ب'];
    const words = text.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
    
    // حساب التكرارات
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // ترتيب حسب التكرار
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  },

  // استخراج الأرقام
  extractNumbers(text) {
    const numbers = text.match(/\d+/g);
    return numbers ? numbers.map(n => parseInt(n)) : [];
  },

  // استخراج التواريخ
  extractDates(text) {
    const dates = [];
    
    // تنسيق DD-MM-YYYY أو DD/MM/YYYY
    const datePattern1 = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g;
    const matches1 = text.matchAll(datePattern1);
    for (const match of matches1) {
      dates.push(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
    }
    
    // كلمات مثل "غداً", "بعد غد", "اليوم"
    const today = new Date();
    if (text.includes('غدا') || text.includes('غداً')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dates.push(tomorrow.toISOString().split('T')[0]);
    }
    
    if (text.includes('بعد غد')) {
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      dates.push(dayAfter.toISOString().split('T')[0]);
    }
    
    return dates;
  },

  // كشف اللغة
  detectLanguage(text) {
    const arabicPattern = /[\u0600-\u06FF]/;
    const englishPattern = /[a-zA-Z]/;
    
    const hasArabic = arabicPattern.test(text);
    const hasEnglish = englishPattern.test(text);
    
    if (hasArabic && !hasEnglish) return 'ar';
    if (hasEnglish && !hasArabic) return 'en';
    return 'mixed';
  },

  // معالجة محادثة كاملة
  async processConversation(messages, context = {}) {
    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      analysis: this.analyzeText(msg.content, context),
      timestamp: msg.timestamp || new Date().toISOString()
    }));
    
    // فهم السياق من المحادثة
    const conversationContext = this.buildContext(history);
    
    // تحديد الخطوة التالية
    const nextAction = this.determineNextAction(history, conversationContext);
    
    return {
      history,
      context: conversationContext,
      nextAction
    };
  },

  // بناء السياق من المحادثة
  buildContext(history) {
    const context = {
      topic: null,
      entities: {},
      confirmed: {},
      pending: []
    };
    
    // استخراج المعلومات من كل الرسائل
    history.forEach(msg => {
      if (msg.analysis.entities) {
        Object.keys(msg.analysis.entities).forEach(key => {
          if (!context.entities[key]) context.entities[key] = [];
          context.entities[key].push(...msg.analysis.entities[key]);
        });
      }
    });
    
    // إزالة التكرارات
    Object.keys(context.entities).forEach(key => {
      context.entities[key] = [...new Set(context.entities[key])];
    });
    
    return context;
  },

  // تحديد الإجراء التالي
  determineNextAction(history, context) {
    const lastMessage = history[history.length - 1];
    const intent = lastMessage?.analysis?.intent;
    
    if (!intent) return { action: 'ask_clarification' };
    
    switch (intent.type) {
      case 'booking_request':
        return this.handleBookingRequest(context);
      case 'confirmation':
        return { action: 'proceed', confidence: intent.confidence };
      case 'rejection':
        return { action: 'cancel', confidence: intent.confidence };
      case 'inquiry':
        return { action: 'provide_info', confidence: intent.confidence };
      default:
        return { action: 'ask_clarification', confidence: 0.5 };
    }
  },

  // معالجة طلب حجز
  handleBookingRequest(context) {
    const required = ['flightNumbers', 'dates', 'prices'];
    const missing = [];
    
    required.forEach(field => {
      if (!context.entities[field] || context.entities[field].length === 0) {
        missing.push(field);
      }
    });
    
    if (missing.length > 0) {
      return {
        action: 'ask_for_info',
        missing,
        confidence: 0.8
      };
    }
    
    return {
      action: 'create_booking',
      data: context.entities,
      confidence: 0.9
    };
  },

  // توليد رد ذكي
  generateResponse(action, context = {}) {
    const responses = {
      greeting: {
        ar: ['مرحباً! كيف يمكنني مساعدتك؟', 'أهلاً بك! ماذا تحتاج؟'],
        en: ['Hello! How can I help you?', 'Welcome! What do you need?']
      },
      ask_flight: {
        ar: ['ما هو رقم الرحلة؟', 'إلى أي وجهة تريد السفر؟'],
        en: ['What is the flight number?', 'Where do you want to travel?']
      },
      ask_date: {
        ar: ['ما هو تاريخ السفر؟', 'متى تريد السفر؟'],
        en: ['What is the travel date?', 'When do you want to travel?']
      },
      ask_price: {
        ar: ['ما هو السعر المتاح؟', 'كم سعر المقعد؟'],
        en: ['What is the available price?', 'How much is the seat?']
      },
      confirmation: {
        ar: ['تم التأكيد بنجاح', 'شكراً لك، تم الحفظ'],
        en: ['Confirmed successfully', 'Thank you, saved']
      },
      error: {
        ar: ['عذراً، لم أفهم. هل يمكنك التوضيح؟'],
        en: ['Sorry, I did not understand. Can you clarify?']
      }
    };
    
    const lang = context.language || 'ar';
    const templates = responses[action] || responses.error;
    const template = templates[lang] || templates.ar;
    
    return template[Math.floor(Math.random() * template.length)];
  },

  // استخراج بيانات من صورة (OCR محلي بسيط)
  async extractFromImage(imageData) {
    // هنا نستخدم خوارزميات بسيطة للتعرف على الأنماط
    // في الإنتاج، يمكن استخدام Tesseract.js أو مكتبات OCR محلية أخرى
    
    return {
      text: '',
      confidence: 0,
      message: 'OCR processing requires additional setup'
    };
  },

  // التعلم من البيانات
  async learn(feedback) {
    // نظام بسيط للتعلم من التغذية الراجعة
    // يمكن توسيعه لاحقاً بنماذج أكثر تعقيداً
    
    const learningData = {
      timestamp: new Date().toISOString(),
      feedback,
      context: feedback.context,
      result: feedback.result
    };
    
    // حفظ في قاعدة البيانات للتحليل المستقبلي
    return learningData;
  }
};

export default LocalAIEngine;