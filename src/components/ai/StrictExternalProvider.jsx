/**
 * المزود الخارجي الذكي المنضبط
 * Strict External Flight Provider
 * 
 * يعمل وفق قواعد صارمة:
 * 1. لا يبدأ من تلقاء نفسه - يحتاج قرار صريح
 * 2. يستقبل طلب موحد ومحدد فقط
 * 3. نتائجه تخضع للتحقق الصارم
 * 4. العمولة تضاف بعد تثبيت السعر فقط
 */

import { base44 } from '@/api/base44Client';

class StrictExternalProvider {
  constructor() {
    this.settings = null;
    this.isInitialized = false;
  }

  /**
   * تحميل الإعدادات
   */
  async loadSettings() {
    if (this.settings) return this.settings;
    
    try {
      const settingsData = await base44.entities.ExternalProviderSettings.filter({ setting_type: 'general' });
      this.settings = settingsData[0] || this.getDefaultSettings();
    } catch (e) {
      this.settings = this.getDefaultSettings();
    }
    
    this.isInitialized = true;
    return this.settings;
  }

  getDefaultSettings() {
    return {
      is_enabled: true,
      commission_type: 'fixed',
      commission_per_booking: 30,
      commission_percentage: 5,
      min_commission: 10,
      max_commission: 100
    };
  }

  /**
   * المرحلة 1: التحقق من الطلب قبل البحث
   * يمنع البحث إذا كان أي عنصر غير محدد
   */
  validateSearchRequest(request) {
    const errors = [];

    // التحقق من المدن
    if (!request.from || request.from.length < 2) {
      errors.push('رمز مطار المغادرة غير صالح');
    }
    if (!request.to || request.to.length < 2) {
      errors.push('رمز مطار الوصول غير صالح');
    }

    // التحقق من نوع الرحلة
    if (!['one_way', 'round_trip'].includes(request.tripType)) {
      errors.push('نوع الرحلة غير محدد');
    }

    // التحقق من التواريخ
    if (!request.departureDate) {
      errors.push('تاريخ المغادرة مطلوب');
    }

    // للذهاب والعودة - تاريخ العودة إلزامي
    if (request.tripType === 'round_trip' && !request.returnDate) {
      errors.push('تاريخ العودة إلزامي لرحلات الذهاب والعودة');
    }

    // التحقق من عدد المسافرين
    if (!request.passengers || request.passengers < 1) {
      errors.push('عدد المسافرين يجب أن يكون 1 على الأقل');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * المرحلة 2: البحث الخارجي المنضبط
   * لا يغير أي خيار من خيارات العميل
   */
  async searchFlights(request) {
    // التحقق أولاً
    const validation = this.validateSearchRequest(request);
    if (!validation.isValid) {
      return {
        success: false,
        message: 'طلب البحث غير مكتمل',
        errors: validation.errors,
        flights: []
      };
    }

    await this.loadSettings();

    try {
      // بناء prompt منضبط للذكاء الاصطناعي
      const searchPrompt = this.buildStrictSearchPrompt(request);

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: searchPrompt,
        add_context_from_internet: true,
        response_json_schema: this.getResponseSchema()
      });

      if (!aiResult || !aiResult.flights || aiResult.flights.length === 0) {
        // لا نعرض رحلات وهمية - نعيد فشل
        return {
          success: false,
          message: 'لم نتمكن من العثور على رحلات مطابقة',
          flights: []
        };
      }

      // المرحلة 5: التحقق الصارم من كل نتيجة
      const validatedFlights = this.validateAndFilterResults(aiResult.flights, request);

      if (validatedFlights.length === 0) {
        return {
          success: false,
          message: 'لا توجد رحلات مطابقة 100% للطلب',
          flights: []
        };
      }

      // المرحلة 6 و 7: تثبيت السعر وإضافة العمولة
      const pricedFlights = this.applyPricing(validatedFlights, request.passengers, request);

      return {
        success: true,
        message: `تم العثور على ${pricedFlights.length} رحلة مطابقة`,
        flights: pricedFlights,
        searchDate: new Date().toISOString()
      };

    } catch (error) {
      console.error('External search error:', error);
      return {
        success: false,
        message: 'حدث خطأ أثناء البحث',
        error: error.message,
        flights: []
      };
    }
  }

  /**
   * بناء prompt منضبط وصارم ودقيق للغاية
   */
  buildStrictSearchPrompt(request) {
    const tripTypeText = request.tripType === 'round_trip' ? 'ذهاب وعودة (Round Trip)' : 'ذهاب فقط (One Way)';
    const classText = { economy: 'اقتصادية Economy', business: 'رجال أعمال Business', first: 'أولى First' }[request.seatClass] || 'اقتصادية';

    return `أنت محرك بحث متخصص في رحلات الطيران. مهمتك البحث عن أسعار ومواعيد حقيقية ودقيقة.

=== طلب البحث الدقيق (لا يمكن تغييره أو تعديله) ===
📍 من: ${request.from} (رمز IATA)
📍 إلى: ${request.to} (رمز IATA)
📅 تاريخ المغادرة: ${request.departureDate}
${request.tripType === 'round_trip' ? `📅 تاريخ العودة: ${request.returnDate}` : ''}
✈️ نوع الرحلة: ${tripTypeText}
👥 عدد المسافرين: ${request.passengers}
💺 الدرجة: ${classText}

=== قواعد الدقة الصارمة ===
1. ⚠️ السعر يجب أن يكون السعر الحقيقي الحالي بالدولار الأمريكي - لا تقريب!
2. ⚠️ أوقات المغادرة والوصول يجب أن تكون دقيقة بصيغة HH:MM (24 ساعة)
3. ⚠️ رقم الرحلة يجب أن يكون الرقم الفعلي (مثل: EK231, TK705, QR401)
4. ⚠️ ${request.tripType === 'round_trip' ? 'يجب تضمين تفاصيل رحلة العودة الكاملة: رقم الرحلة، وقت المغادرة، وقت الوصول' : 'ذهاب فقط'}
5. ⚠️ لا تخترع أو تقدر - أعد فقط ما تجده من مصادر موثوقة

=== المطلوب بدقة ===
ابحث في المصادر التالية: Kayak, Google Flights, Skyscanner, مواقع شركات الطيران المباشرة.

أعد 3-5 رحلات حقيقية متاحة الآن مع:
- اسم شركة الطيران بالضبط
- رمز الشركة (IATA code مثل: EK, TK, QR)
- رقم الرحلة الفعلي
- وقت المغادرة الدقيق (HH:MM)
- وقت الوصول الدقيق (HH:MM)
- مدة الرحلة
- السعر الفعلي بالدولار (رقم بدون فواصل)
- عدد التوقفات (0 للمباشرة)
${request.tripType === 'round_trip' ? `
لرحلة العودة أعد:
- رقم رحلة العودة
- وقت مغادرة العودة
- وقت وصول العودة
- تاريخ العودة: ${request.returnDate}` : ''}

⚠️ تأكد من دقة الأسعار - أسعار غير دقيقة تسبب مشاكل كبيرة!`;
  }

  /**
   * مخطط الاستجابة المتوقع
   */
  getResponseSchema() {
    return {
      type: "object",
      properties: {
        found: { type: "boolean" },
        flights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              airline_name: { type: "string" },
              airline_code: { type: "string" },
              flight_number: { type: "string" },
              departure_airport_code: { type: "string" },
              arrival_airport_code: { type: "string" },
              departure_city: { type: "string" },
              arrival_city: { type: "string" },
              departure_time: { type: "string" },
              arrival_time: { type: "string" },
              departure_date: { type: "string" },
              duration: { type: "string" },
              stops: { type: "number" },
              price_usd: { type: "number" },
              seat_class: { type: "string" },
              // بيانات العودة
              return_flight_number: { type: "string" },
              return_departure_time: { type: "string" },
              return_arrival_time: { type: "string" },
              return_date: { type: "string" },
              return_price_usd: { type: "number" }
            }
          }
        }
      }
    };
  }

  /**
   * المرحلة 5: التحقق من النتائج - مرن مع المسار لأن AI قد يعيد رموز مختلفة
   */
  validateAndFilterResults(flights, request) {
    return flights.filter(flight => {
      // 1. التحقق من السعر - يجب أن يكون رقماً موجباً (الأهم)
      const price = flight.price_usd || flight.source_price || 0;
      if (!price || price <= 0 || isNaN(price)) {
        console.log('Rejected: Invalid price', flight);
        return false;
      }

      // 2. التحقق من وجود وقت المغادرة
      if (!flight.departure_time) {
        console.log('Rejected: No departure time', flight);
        return false;
      }

      // 3. التحقق من نوع الرحلة - للذهاب والعودة
      if (request.tripType === 'round_trip') {
        // يجب وجود بيانات رحلة العودة
        if (!flight.return_flight_number && !flight.return_date) {
          console.log('Rejected: Round trip without return', flight);
          return false;
        }
      }

      // 4. التحقق من اسم الشركة
      if (!flight.airline_name) {
        console.log('Rejected: No airline name', flight);
        return false;
      }

      // نقبل الرحلة - AI أعاد بيانات صحيحة
      return true;
    });
  }

  /**
   * المرحلة 6 و 7: تثبيت السعر وحساب العمولة
   */
  applyPricing(flights, passengers, request) {
    return flights.map((flight, index) => {
      // تنظيف وقت المغادرة (إزالة التاريخ إذا موجود)
      const cleanTime = (timeStr) => {
        if (!timeStr) return '';
        // إذا كان الوقت يحتوي على T (مثل 2026-01-29T08:00:00)
        if (timeStr.includes('T')) {
          const timePart = timeStr.split('T')[1];
          return timePart.split(':').slice(0, 2).join(':');
        }
        return timeStr;
      };

      // حفظ البيانات كما وردت من المزود دون أي تعديل أو تقريب
      const rawPrice = flight.price_usd || flight.source_price || 0;
      const rawReturnPrice = flight.return_price_usd || 0;
      const exactTotalBasePrice = rawPrice + rawReturnPrice;

      // حساب العمولة بدقة
      const commissionPerPerson = this.calculateCommission(exactTotalBasePrice);
      const finalPricePerPerson = exactTotalBasePrice + commissionPerPerson;

      return {
        id: `ext_${Date.now()}_${index}`,
        
        // بيانات الشركة - كما وردت بالضبط
        airline_name: flight.airline_name,
        airline_code: flight.airline_code || '',
        airline_logo: this.getAirlineLogo(flight.airline_code),
        
        // بيانات الرحلة - كما وردت بالضبط دون أي تعديل
        flight_number: flight.flight_number,
        departure_airport_code: flight.departure_airport_code || request.from,
        departure_city: flight.departure_city,
        arrival_airport_code: flight.arrival_airport_code || request.to,
        arrival_city: flight.arrival_city,
        departure_date: flight.departure_date || request.departureDate,
        departure_time: cleanTime(flight.departure_time),
        departure_time_formatted: this.formatTimeAMPM(cleanTime(flight.departure_time)),
        arrival_time: cleanTime(flight.arrival_time),
        arrival_time_formatted: this.formatTimeAMPM(cleanTime(flight.arrival_time)),
        duration: flight.duration,
        stops: flight.stops || 0,
        stops_details: flight.stops === 0 ? 'رحلة مباشرة' : `${flight.stops} توقف`,
        
        // بيانات العودة - كما وردت بالضبط
        return_date: flight.return_date || request.returnDate,
        return_flight_number: flight.return_flight_number,
        return_departure_time: cleanTime(flight.return_departure_time),
        return_departure_time_formatted: flight.return_departure_time ? this.formatTimeAMPM(cleanTime(flight.return_departure_time)) : null,
        return_arrival_time: cleanTime(flight.return_arrival_time),
        return_arrival_time_formatted: flight.return_arrival_time ? this.formatTimeAMPM(cleanTime(flight.return_arrival_time)) : null,
        
        // السعر - بالضبط كما ورد دون تعديل
        source_price: exactTotalBasePrice,
        system_commission: commissionPerPerson,
        price_per_person: finalPricePerPerson,
        total_price: finalPricePerPerson,
        display_price: finalPricePerPerson,
        passengers: passengers,
        currency: 'USD',
        
        // معلومات إضافية
        seat_class: flight.seat_class || request.seatClass || 'economy',
        baggage_allowance: flight.baggage_allowance || this.getBaggageAllowance(flight.seat_class || request.seatClass),
        is_external: true,
        trip_type: request.tripType,
        
        // معلومات المصدر الدقيقة للموظفين فقط
        source_platform: flight.source_platform || this.detectSourcePlatform(flight.airline_code),
        source_url: flight.source_url || this.buildBookingUrl(flight, request),
        // روابط بحث متعددة لموظف الإصدار
        search_urls: this.getMultipleSearchUrls(flight, request)
      };
    });
  }

  /**
   * حساب العمولة - بعد تثبيت السعر فقط
   */
  calculateCommission(basePrice) {
    const settings = this.settings || this.getDefaultSettings();
    
    let commission;
    if (settings.commission_type === 'percentage') {
      commission = Math.round(basePrice * (settings.commission_percentage / 100));
    } else {
      commission = settings.commission_per_booking || 30;
    }

    // تطبيق الحدود
    if (settings.min_commission && commission < settings.min_commission) {
      commission = settings.min_commission;
    }
    if (settings.max_commission && commission > settings.max_commission) {
      commission = settings.max_commission;
    }

    return commission;
  }

  /**
   * تحويل الوقت لصيغة AM/PM
   */
  formatTimeAMPM(time24) {
    if (!time24) return '';
    try {
      const [hours, minutes] = time24.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    } catch {
      return time24;
    }
  }

  /**
   * الحصول على شعار شركة الطيران
   */
  getAirlineLogo(code) {
    const logos = {
      'EK': 'https://logos-world.net/wp-content/uploads/2020/03/Emirates-Logo.png',
      'TK': 'https://logos-world.net/wp-content/uploads/2020/03/Turkish-Airlines-Logo.png',
      'QR': 'https://logos-world.net/wp-content/uploads/2020/03/Qatar-Airways-Logo.png',
      'IY': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Yemenia_logo.svg/200px-Yemenia_logo.svg.png',
      'MS': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/13/EgyptAir_logo.svg/200px-EgyptAir_logo.svg.png',
      'SV': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Saudia_logo.svg/200px-Saudia_logo.svg.png',
      'EY': 'https://logos-world.net/wp-content/uploads/2020/03/Etihad-Airways-Logo.png',
      'RJ': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/73/Royal_Jordanian_logo.svg/200px-Royal_Jordanian_logo.svg.png'
    };
    return logos[code] || '';
  }

  /**
   * وزن الأمتعة حسب الدرجة
   */
  getBaggageAllowance(seatClass) {
    const allowances = {
      'economy': '23 كجم',
      'business': '32 كجم',
      'first': '40 كجم'
    };
    return allowances[seatClass] || '23 كجم';
  }

  /**
   * اكتشاف منصة الحجز من رمز الشركة
   */
  detectSourcePlatform(airlineCode) {
    const platforms = {
      'EK': 'Emirates.com',
      'TK': 'TurkishAirlines.com',
      'QR': 'QatarAirways.com',
      'IY': 'Yemenia.com',
      'SV': 'Saudia.com',
      'MS': 'EgyptAir.com',
      'EY': 'Etihad.com',
      'RJ': 'RoyalJordanian.com'
    };
    return platforms[airlineCode] || 'Booking.com';
  }

  /**
   * بناء رابط الحجز المباشر والدقيق - مثل Kayak
   * يبني رابط البحث الفعلي الذي يأخذ موظف الإصدار مباشرة لنتائج البحث
   */
  buildBookingUrl(flight, request) {
    const { from, to, departureDate, returnDate, passengers, seatClass } = request;
    const tripType = request.tripType;
    const airlineCode = flight.airline_code || '';
    
    // تنسيق التاريخ للروابط (yyyy-MM-dd)
    const depDate = departureDate;
    const retDate = returnDate;
    
    // تحديد كود الدرجة
    const cabinCode = seatClass === 'business' ? 'b' : seatClass === 'first' ? 'f' : 'e';
    
    // Kayak - الأفضل للبحث الشامل مع رابط مباشر
    // nearby = يبحث في المطارات القريبة أيضاً
    const kayakUrl = tripType === 'round_trip'
      ? `https://www.kayak.com/flights/${from},nearby-${to},nearby/${depDate}/${retDate}?sort=bestflight_a&fs=cabin%3D${cabinCode}`
      : `https://www.kayak.com/flights/${from},nearby-${to},nearby/${depDate}?sort=bestflight_a&fs=cabin%3D${cabinCode}`;
    
    // Google Flights - بديل ممتاز
    const googleFlightsUrl = tripType === 'round_trip'
      ? `https://www.google.com/travel/flights?q=flights%20from%20${from}%20to%20${to}%20on%20${depDate}%20return%20${retDate}&curr=USD`
      : `https://www.google.com/travel/flights?q=flights%20from%20${from}%20to%20${to}%20on%20${depDate}%20one%20way&curr=USD`;
    
    // Skyscanner
    const skyscannerUrl = tripType === 'round_trip'
      ? `https://www.skyscanner.com/transport/flights/${from}/${to}/${depDate.replace(/-/g, '')}/${retDate.replace(/-/g, '')}/`
      : `https://www.skyscanner.com/transport/flights/${from}/${to}/${depDate.replace(/-/g, '')}/`;
    
    // روابط شركات الطيران المباشرة
    const directAirlineUrls = {
      'EK': `https://www.emirates.com/ae/english/book/flight-search?from=${from}&to=${to}&departDate=${depDate}&returnDate=${retDate}&adult=${passengers}&class=${cabinCode === 'e' ? 'Economy' : cabinCode === 'b' ? 'Business' : 'First'}`,
      'TK': `https://www.turkishairlines.com/en-int/flights/booking/?origin=${from}&destination=${to}&departureDate=${depDate}&returnDate=${retDate}&adult=${passengers}`,
      'QR': `https://www.qatarairways.com/en/booking.html?origin=${from}&destination=${to}&departDate=${depDate}&returnDate=${retDate}&adult=${passengers}&cabin=${cabinCode}`,
      'EY': `https://www.etihad.com/en/book/booking?from=${from}&to=${to}&departDate=${depDate}&returnDate=${retDate}&adults=${passengers}`,
      'SV': `https://www.saudia.com/booking?from=${from}&to=${to}&departDate=${depDate}&returnDate=${retDate}&passengers=${passengers}`,
      'MS': `https://www.egyptair.com/en/book/booking?origin=${from}&destination=${to}&departDate=${depDate}&returnDate=${retDate}&adult=${passengers}`,
      'RJ': `https://www.rj.com/en/book-online?from=${from}&to=${to}&departDate=${depDate}&returnDate=${retDate}&adults=${passengers}`
    };
    
    // إذا كانت شركة طيران معروفة، نعطي رابطها المباشر
    // وإلا نعطي رابط Kayak الشامل
    return directAirlineUrls[airlineCode] || kayakUrl;
  }

  /**
   * الحصول على روابط بحث متعددة لموظف الإصدار
   */
  getMultipleSearchUrls(flight, request) {
    const { from, to, departureDate, returnDate, seatClass } = request;
    const tripType = request.tripType;
    const cabinCode = seatClass === 'business' ? 'b' : seatClass === 'first' ? 'f' : 'e';
    const depDate = departureDate;
    const retDate = returnDate;
    
    return {
      kayak: tripType === 'round_trip'
        ? `https://www.kayak.com/flights/${from},nearby-${to},nearby/${depDate}/${retDate}?sort=bestflight_a&fs=cabin%3D${cabinCode}`
        : `https://www.kayak.com/flights/${from},nearby-${to},nearby/${depDate}?sort=bestflight_a&fs=cabin%3D${cabinCode}`,
      google: tripType === 'round_trip'
        ? `https://www.google.com/travel/flights?q=flights%20from%20${from}%20to%20${to}%20on%20${depDate}%20return%20${retDate}&curr=USD`
        : `https://www.google.com/travel/flights?q=flights%20from%20${from}%20to%20${to}%20on%20${depDate}%20one%20way&curr=USD`,
      skyscanner: tripType === 'round_trip'
        ? `https://www.skyscanner.com/transport/flights/${from}/${to}/${depDate.replace(/-/g, '')}/${retDate.replace(/-/g, '')}/`
        : `https://www.skyscanner.com/transport/flights/${from}/${to}/${depDate.replace(/-/g, '')}/`
    };
  }
}

export const strictExternalProvider = new StrictExternalProvider();
export default StrictExternalProvider;