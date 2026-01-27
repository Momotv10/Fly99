export class IntentDetector {
  detectIntent(message, customerState, sessionContext) {
    const msg = message.toLowerCase();
    
    // كلمات مفتاحية لكل نية
    const patterns = {
      request_ticket: {
        keywords: ['تذكرة', 'تذكرتي', 'ارسل', 'صورة', 'pdf', 'ملف', 'حجزي'],
        confidence: 0
      },
      emergency: {
        keywords: ['طارئ', 'عاجل', 'فوري', 'ضروري', 'مشكلة كبيرة', 'الطيارة طارت', 'فاتت علي'],
        confidence: 0
      },
      provider_no_response: {
        keywords: ['ما رد', 'ما جاوب', 'ما يرد', 'مسكر', 'مقفل', 'ما حد رد'],
        confidence: 0
      },
      report_problem: {
        keywords: ['مشكلة', 'خطأ', 'غلط', 'ما صح', 'عطلان', 'ملغي'],
        confidence: 0
      },
      change_booking: {
        keywords: ['تغيير', 'تعديل', 'تأجيل', 'تقديم', 'اغير', 'ابدل'],
        confidence: 0
      },
      search_flight: {
        keywords: ['رحلة', 'بحث', 'شوف', 'ابي', 'عندكم', 'متوفر'],
        confidence: 0
      },
      complete_booking: {
        keywords: ['احجز', 'حجز', 'اكمل', 'تأكيد', 'موافق'],
        confidence: 0
      },
      general_inquiry: {
        keywords: ['كيف', 'متى', 'ايش', 'وين', 'شلون'],
        confidence: 0
      }
    };

    // حساب الثقة لكل نية
    for (const [intent, pattern] of Object.entries(patterns)) {
      let matches = 0;
      for (const keyword of pattern.keywords) {
        if (msg.includes(keyword)) {
          matches++;
        }
      }
      pattern.confidence = matches / pattern.keywords.length;
    }

    // اختيار النية بأعلى ثقة
    let maxIntent = 'general_inquiry';
    let maxConfidence = 0;

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.confidence > maxConfidence) {
        maxConfidence = pattern.confidence;
        maxIntent = intent;
      }
    }

    // منطق إضافي بناءً على الحالة
    if (customerState === 'problem_reported' && maxIntent === 'general_inquiry') {
      // إذا كان أبلغ عن مشكلة ثم كتب رسالة عامة، غالباً يشتكي من عدم الرد
      if (msg.includes('ما') || msg.includes('لا')) {
        maxIntent = 'provider_no_response';
        maxConfidence = 0.8;
      }
    }

    return {
      intent: maxIntent,
      confidence: maxConfidence,
      all_scores: patterns
    };
  }

  extractEntities(message) {
    const entities = {
      date: null,
      from_city: null,
      to_city: null,
      passengers_count: null,
      urgency: 'normal'
    };

    // استخراج التاريخ
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})/,  // 15/3
      /يوم\s+(الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/,
      /غد[اً]?/,
      /بعد\s+غد/
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.date = match[0];
        break;
      }
    }

    // استخراج المدن
    const cities = ['صنعاء', 'عدن', 'القاهرة', 'الرياض', 'جدة', 'دبي', 'عمان', 'المدينة', 'مكة'];
    const msgLower = message.toLowerCase();
    
    for (const city of cities) {
      if (msgLower.includes(city.toLowerCase())) {
        if (!entities.from_city) {
          entities.from_city = city;
        } else if (!entities.to_city) {
          entities.to_city = city;
        }
      }
    }

    // استخراج عدد الركاب
    const numberMatch = message.match(/(\d+)\s*(راكب|شخص|مقعد)/);
    if (numberMatch) {
      entities.passengers_count = parseInt(numberMatch[1]);
    }

    // تحديد مستوى الاستعجال
    if (message.includes('طارئ') || message.includes('عاجل') || message.includes('فوري')) {
      entities.urgency = 'urgent';
    }

    return entities;
  }
}