/**
 * خدمة API للوكلاء
 * واجهة برمجية كاملة لربط المحافظ الإلكترونية
 */

import { base44 } from '@/api/base44Client';

export const AgentAPIService = {
  
  /**
   * التحقق من مفاتيح API
   */
  async authenticate(apiKey, apiSecret, requestIP = null) {
    const agents = await base44.entities.Agent.filter({
      api_key: apiKey,
      api_secret: apiSecret,
      api_enabled: true,
      is_active: true
    });
    
    if (agents.length === 0) {
      return { success: false, error: 'UNAUTHORIZED', message: 'مفاتيح API غير صحيحة' };
    }
    
    const agent = agents[0];
    
    // التحقق من IP إذا كان محدداً
    if (requestIP && agent.api_whitelist_ips && agent.api_whitelist_ips.length > 0) {
      const { AgentIPMiddleware } = await import('@/components/api/AgentIPMiddleware');
      const ipCheck = await AgentIPMiddleware.verifyIP(agent, requestIP);
      
      if (!ipCheck.allowed) {
        return {
          success: false,
          error: 'IP_NOT_WHITELISTED',
          message: ipCheck.message,
          current_ip: ipCheck.current_ip
        };
      }
    }
    
    return { success: true, agent };
  },
  
  /**
   * اختبار الاتصال
   * GET /api/agent/test
   */
  async testConnection(agent) {
    return {
      success: true,
      message: 'الاتصال ناجح!',
      agent_id: agent.id,
      agent_name: agent.name,
      api_enabled: agent.api_enabled,
      timestamp: new Date().toISOString(),
      services: {
        airports: true,
        airlines: true,
        search: true,
        booking: true,
        balance: true
      }
    };
  },

  /**
   * جلب المطارات - لمزامنة نظام الوكيل
   * GET /api/agent/airports
   */
  async getAirports() {
    const airports = await base44.entities.Airport.filter({ is_active: true });
    return {
      success: true,
      count: airports.length,
      timestamp: new Date().toISOString(),
      airports: airports.map(a => ({
        code: a.iata_code,
        airport_code: a.iata_code,
        icao_code: a.icao_code,
        name: a.name_ar,
        airport_name_ar: a.name_ar,
        airport_name_en: a.name_en,
        city: a.city_ar,
        city_ar: a.city_ar,
        city_en: a.city_en,
        country: a.country_ar,
        country_ar: a.country_ar,
        country_en: a.country_en,
        timezone: a.timezone,
        utc_offset: a.utc_offset,
        latitude: a.latitude,
        longitude: a.longitude
      }))
    };
  },

  /**
   * جلب شركات الطيران - لمزامنة نظام الوكيل
   * GET /api/public/airlines
   */
  async getAirlines() {
    const airlines = await base44.entities.Airline.filter({ is_active: true });
    return {
      success: true,
      count: airlines.length,
      airlines: airlines.map(a => ({
        airline_code: a.iata_code,
        icao_code: a.icao_code,
        airline_name_ar: a.name_ar,
        airline_name_en: a.name_en,
        logo_url: a.logo_url,
        country: a.country,
        baggage_economy: a.baggage_economy,
        baggage_business: a.baggage_business,
        hand_baggage: a.hand_baggage
      }))
    };
  },

  /**
   * البحث عن الرحلات
   * POST /api/agent/flights/search
   */
  async searchFlights(agent, { from, to, date, passengers = 1, seat_class = 'economy' }) {
    // البحث في المقاعد المتاحة
    const seats = await base44.entities.AvailableSeat.filter({
      departure_airport_code: from,
      arrival_airport_code: to,
      status: 'active'
    });
    
    // فلترة حسب التاريخ والمقاعد المتاحة
    const availableSeats = seats.filter(seat => {
      const available = (seat.available_count || 0) - (seat.booked_count || 0);
      if (available < passengers) return false;
      if (seat_class && seat.seat_class !== seat_class) return false;
      
      // التحقق من التاريخ - نبحث عن أقرب تاريخ
      const seatDate = new Date(seat.departure_date);
      const searchDate = new Date(date);
      
      // نقبل الرحلات في نفس اليوم أو بعده
      return seatDate >= searchDate;
    });
    
    // ترتيب حسب التاريخ
    availableSeats.sort((a, b) => new Date(a.departure_date) - new Date(b.departure_date));
    
    return {
      success: true,
      flights: availableSeats.slice(0, 10).map(seat => ({
        flight_id: seat.id,
        airline_code: seat.airline_id,
        airline_name: seat.airline_name,
        airline_logo: seat.airline_logo,
        flight_number: seat.flight_number,
        departure: {
          city: seat.departure_city,
          code: seat.departure_airport_code,
          time: seat.departure_time,
          date: seat.departure_date
        },
        arrival: {
          city: seat.arrival_city,
          code: seat.arrival_airport_code,
          time: seat.arrival_time
        },
        seat_class: seat.seat_class,
        trip_type: seat.trip_type,
        price: seat.total_price,
        provider_price: seat.price_outbound + (seat.price_return || 0),
        commission: seat.system_commission,
        available_seats: (seat.available_count || 0) - (seat.booked_count || 0),
        currency: 'USD'
      }))
    };
  },

  /**
   * إنشاء طلب دفع
   * POST /api/agent/payment/create
   */
  async createPayment(agent, { flight_id, amount, currency = 'USD', customer_phone, passengers_count = 1 }) {
    // التحقق من الرصيد
    const availableBalance = (agent.balance || 0) + (agent.credit_limit || 0);
    if (availableBalance < amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `الرصيد غير كافي. المتاح: ${availableBalance}$، المطلوب: ${amount}$`
      };
    }
    
    // جلب بيانات المقعد
    const seats = await base44.entities.AvailableSeat.filter({ id: flight_id });
    if (seats.length === 0) {
      return { success: false, error: 'NOT_FOUND', message: 'الرحلة غير موجودة' };
    }
    
    const seat = seats[0];
    
    // إنشاء حجز مبدئي
    const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;
    const booking = await base44.entities.Booking.create({
      booking_number: bookingNumber,
      seat_id: seat.id,
      provider_id: seat.provider_id,
      provider_name: seat.provider_name,
      agent_id: agent.id,
      agent_name: agent.name,
      flight_id: seat.flight_id,
      flight_number: seat.flight_number,
      airline_name: seat.airline_name,
      airline_logo: seat.airline_logo,
      departure_airport_code: seat.departure_airport_code,
      departure_city: seat.departure_city,
      arrival_airport_code: seat.arrival_airport_code,
      arrival_city: seat.arrival_city,
      departure_date: seat.departure_date,
      departure_time: seat.departure_time,
      trip_type: seat.trip_type,
      seat_class: seat.seat_class,
      passengers_count: passengers_count,
      ticket_price: seat.price_outbound + (seat.price_return || 0),
      system_commission: seat.system_commission,
      total_amount: amount,
      provider_amount: seat.price_outbound + (seat.price_return || 0),
      customer_phone: customer_phone,
      customer_whatsapp: customer_phone,
      booking_source: 'api',
      status: 'pending_payment',
      payment_status: 'pending'
    });
    
    return {
      success: true,
      payment_id: booking.id,
      booking_number: bookingNumber,
      amount: amount,
      currency: currency,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 دقيقة
    };
  },

  /**
   * رفع صورة الجواز
   * POST /api/agent/passport/upload
   */
  async uploadPassport(agent, { payment_id, passenger_index, passport_image }) {
    // جلب الحجز
    const bookings = await base44.entities.Booking.filter({ id: payment_id, agent_id: agent.id });
    if (bookings.length === 0) {
      return { success: false, error: 'NOT_FOUND', message: 'الحجز غير موجود' };
    }
    
    const booking = bookings[0];
    const passengers = booking.passengers || [];
    
    // تحليل الجواز باستخدام AI
    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `استخرج بيانات جواز السفر من هذه الصورة:
        - الاسم الكامل (full_name)
        - رقم الجواز (passport_number)
        - الجنسية (nationality)
        - تاريخ الميلاد (date_of_birth)
        - تاريخ الإصدار (issue_date)
        - تاريخ الانتهاء (expiry_date)
        - الجنس (gender)
        أعد البيانات بتنسيق JSON فقط.`,
        file_urls: [passport_image],
        response_json_schema: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            passport_number: { type: "string" },
            nationality: { type: "string" },
            date_of_birth: { type: "string" },
            issue_date: { type: "string" },
            expiry_date: { type: "string" },
            gender: { type: "string" },
            is_valid: { type: "boolean" }
          }
        }
      });
      
      // تحديث بيانات المسافر
      passengers[passenger_index] = {
        ...passengers[passenger_index],
        ...analysis,
        passport_image_url: passport_image
      };
      
      await base44.entities.Booking.update(booking.id, { passengers });
      
      // التحقق من صلاحية الجواز
      const warnings = [];
      if (analysis.expiry_date) {
        const expiry = new Date(analysis.expiry_date);
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        if (expiry < sixMonthsFromNow) {
          warnings.push('الجواز ينتهي خلال 6 أشهر');
        }
      }
      
      return {
        success: true,
        extracted_data: analysis,
        warnings
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'EXTRACTION_FAILED',
        message: 'فشل استخراج بيانات الجواز'
      };
    }
  },

  /**
   * تأكيد الدفع
   * POST /api/agent/payment/confirm
   */
  async confirmPayment(agent, { payment_id, transaction_id }) {
    // جلب الحجز
    const bookings = await base44.entities.Booking.filter({ id: payment_id, agent_id: agent.id });
    if (bookings.length === 0) {
      return { success: false, error: 'NOT_FOUND', message: 'الحجز غير موجود' };
    }
    
    const booking = bookings[0];
    
    if (booking.payment_status === 'paid') {
      return { success: false, error: 'ALREADY_PAID', message: 'تم الدفع مسبقاً' };
    }
    
    // التحقق من الرصيد
    const availableBalance = (agent.balance || 0) + (agent.credit_limit || 0);
    if (availableBalance < booking.total_amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `الرصيد غير كافي. المتاح: ${availableBalance}$`
      };
    }
    
    // خصم من رصيد الوكيل
    const newBalance = (agent.balance || 0) - booking.total_amount;
    await base44.entities.Agent.update(agent.id, {
      balance: newBalance,
      total_bookings: (agent.total_bookings || 0) + 1,
      total_sales: (agent.total_sales || 0) + booking.total_amount
    });
    
    // تسجيل الحركة المالية
    await base44.entities.AgentTransaction.create({
      agent_id: agent.id,
      agent_name: agent.name,
      transaction_type: 'api_booking',
      amount: -booking.total_amount,
      balance_before: agent.balance || 0,
      balance_after: newBalance,
      reference_type: 'booking',
      reference_id: booking.id,
      description: `حجز API - ${booking.booking_number}`,
      source: 'api',
      status: 'completed'
    });
    
    // تحديث الحجز
    await base44.entities.Booking.update(booking.id, {
      status: 'pending_issue',
      payment_status: 'paid',
      payment_method: 'agent_balance',
      payment_reference: transaction_id || `API-${Date.now()}`
    });
    
    return {
      success: true,
      status: 'SUCCESS',
      booking_id: booking.id,
      booking_number: booking.booking_number,
      agent_balance_after: newBalance,
      message: `تم تأكيد الحجز وخصم $${booking.total_amount} من رصيدك`
    };
  },

  /**
   * استعلام حالة الدفع
   * GET /api/agent/payment/status/{payment_id}
   */
  async getPaymentStatus(agent, payment_id) {
    const bookings = await base44.entities.Booking.filter({ id: payment_id, agent_id: agent.id });
    if (bookings.length === 0) {
      return { success: false, error: 'NOT_FOUND', message: 'الحجز غير موجود' };
    }
    
    const booking = bookings[0];
    
    let status = 'PENDING';
    if (booking.payment_status === 'paid') status = 'SUCCESS';
    if (booking.status === 'cancelled') status = 'FAILED';
    
    return {
      success: true,
      payment_id: booking.id,
      booking_number: booking.booking_number,
      status,
      booking_status: booking.status,
      ticket_number: booking.ticket_number,
      ticket_url: booking.ticket_pdf_url
    };
  },

  /**
   * استعلام رصيد الوكيل
   * GET /api/agent/balance
   */
  async getBalance(agent) {
    return {
      success: true,
      agent_id: agent.id,
      balance: agent.balance || 0,
      credit_limit: agent.credit_limit || 0,
      available: (agent.balance || 0) + (agent.credit_limit || 0),
      currency: 'USD'
    };
  },

  /**
   * تسجيل طلب API
   */
  async logRequest(agent, endpoint, method, requestBody, responseBody, statusCode, responseTime) {
    await base44.entities.AgentApiLog.create({
      agent_id: agent.id,
      agent_name: agent.name,
      endpoint,
      method,
      request_body: JSON.stringify(requestBody),
      response_body: JSON.stringify(responseBody),
      status_code: statusCode,
      response_time_ms: responseTime,
      is_success: statusCode >= 200 && statusCode < 300
    });
    
    // تحديث عداد الطلبات
    await base44.entities.Agent.update(agent.id, {
      api_requests_count: (agent.api_requests_count || 0) + 1
    });
  }
};

export default AgentAPIService;