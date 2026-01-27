/**
 * محرك البحث الذكي عن الرحلات
 * Smart Flight Search Engine
 * 
 * يتبع تسلسل صارم للبحث:
 * 1. البحث في قاعدة البيانات الداخلية أولاً
 * 2. البحث عن أقرب موعد متاح إذا لم يوجد تطابق
 * 3. استخدام المزود الخارجي كحل أخير فقط
 */

import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';

class SmartFlightSearch {
  constructor() {
    this.lastSearchRequest = null;
  }

  /**
   * المرحلة 1: توحيد وتحقق من طلب البحث
   * Request Normalization & Validation
   */
  normalizeSearchRequest(params) {
    const normalized = {
      // بيانات المسار - إلزامية
      from: (params.from || '').toUpperCase().trim(),
      to: (params.to || '').toUpperCase().trim(),
      
      // نوع الرحلة - إلزامي
      tripType: params.type || params.tripType || 'round_trip',
      
      // التواريخ
      departureDate: params.date || params.departureDate || '',
      returnDate: params.returnDate || '',
      
      // تفاصيل أخرى
      passengers: parseInt(params.passengers) || 1,
      seatClass: params.class || params.seatClass || 'economy',
      
      // وقت الإقلاع المفضل (صباح / مساء / أي وقت)
      preferredTime: params.preferredTime || 'any',
      
      // علم التحقق
      isValid: false,
      validationErrors: []
    };

    // التحقق من صحة البيانات
    const errors = [];

    if (!normalized.from) {
      errors.push('مدينة المغادرة مطلوبة');
    }
    if (!normalized.to) {
      errors.push('مدينة الوصول مطلوبة');
    }
    if (!normalized.departureDate) {
      errors.push('تاريخ المغادرة مطلوب');
    }
    if (normalized.tripType === 'round_trip' && !normalized.returnDate) {
      errors.push('تاريخ العودة مطلوب لرحلات الذهاب والعودة');
    }
    if (normalized.passengers < 1) {
      errors.push('عدد المسافرين يجب أن يكون 1 على الأقل');
    }

    normalized.validationErrors = errors;
    normalized.isValid = errors.length === 0;

    return normalized;
  }

  /**
   * المرحلة 2: البحث الرئيسي مع التسلسل الصحيح
   * Main Search with Correct Priority
   */
  async search(params) {
    // توحيد الطلب أولاً
    const request = this.normalizeSearchRequest(params);
    this.lastSearchRequest = request;
    
    console.log('=== Smart Flight Search ===');
    console.log('Request:', JSON.stringify(request, null, 2));

    if (!request.isValid) {
      console.log('Validation failed:', request.validationErrors);
      return {
        success: false,
        source: 'validation',
        message: 'بيانات البحث غير مكتملة',
        errors: request.validationErrors,
        results: [],
        suggestedFlights: [],
        needsExternalSearch: false
      };
    }

    // البحث الداخلي أولاً
    console.log('Searching internal database...');
    const internalResult = await this.searchInternalDatabase(request);
    console.log('Internal result - Exact:', internalResult.exactMatches.length, 'Nearest:', internalResult.nearestFlights.length);

    // إذا وجدنا نتائج داخلية، نعيدها مباشرة
    if (internalResult.exactMatches.length > 0) {
      console.log('Found exact matches, returning internal results');
      return {
        success: true,
        source: 'internal_exact',
        message: `تم العثور على ${internalResult.exactMatches.length} رحلة متاحة`,
        results: internalResult.exactMatches,
        suggestedFlights: [],
        needsExternalSearch: false
      };
    }

    // إذا وجدنا رحلات قريبة (أقرب موعد)
    if (internalResult.nearestFlights.length > 0) {
      console.log('Found nearest flights:', internalResult.nearestFlights.map(f => f.departure_date));
      return {
        success: true,
        source: 'internal_nearest',
        message: 'لم نجد رحلات في التاريخ المحدد، لكن وجدنا رحلات في تواريخ قريبة',
        results: [],
        suggestedFlights: internalResult.nearestFlights,
        needsExternalSearch: true, // نسمح بالبحث الخارجي كخيار إضافي
        originalRequest: request
      };
    }

    // لم نجد أي شيء في قاعدة البيانات - نحتاج البحث الخارجي
    console.log('No internal results found, external search needed');
    return {
      success: true,
      source: 'no_internal_results',
      message: 'لا توجد رحلات متاحة في النظام لهذا المسار',
      results: [],
      suggestedFlights: [],
      needsExternalSearch: true,
      originalRequest: request
    };
  }

  /**
   * المرحلة 3: البحث في قاعدة البيانات الداخلية
   * Internal Database Search
   */
  async searchInternalDatabase(request) {
    const result = {
      exactMatches: [],
      nearestFlights: [],
      alternativeClasses: []
    };

    try {
      console.log('Searching internal DB for:', request.from, '->', request.to, 'date:', request.departureDate);
      
      // البحث عن جميع المقاعد المتاحة للمسار المطلوب
      const allSeatsForRoute = await base44.entities.AvailableSeat.filter({
        departure_airport_code: request.from,
        arrival_airport_code: request.to,
        status: 'active'
      }, 'departure_date', 100);
      
      console.log('Found seats for route:', allSeatsForRoute.length);

      // فلترة المقاعد المتاحة فعلياً (الكمية)
      const availableSeats = allSeatsForRoute.filter(seat => 
        (seat.available_count - (seat.booked_count || 0)) >= request.passengers
      );
      
      console.log('Available seats with capacity:', availableSeats.length);

      if (availableSeats.length === 0) {
        // لا توجد مقاعد متاحة للمسار - نبحث عن أقرب تواريخ حتى في الفلتر الأول
        console.log('No available seats found');
        return result;
      }

      // 1. البحث عن تطابق تام (نفس التاريخ ونفس الدرجة)
      const exactDateMatches = availableSeats.filter(seat => 
        seat.departure_date === request.departureDate &&
        seat.seat_class === request.seatClass
      );
      
      console.log('Exact date matches:', exactDateMatches.length);

      // نظام التسعير الجديد - كما تفعل شركات الطيران الحقيقية
      if (request.tripType === 'round_trip') {
        // العميل يبحث عن ذهاب وعودة
        for (const seat of exactDateMatches) {
          // فقط تذاكر ذهاب وعودة
          if (seat.trip_type === 'round_trip') {
            // البحث عن رحلة العودة في جدول الرحلات تلقائياً - مهم جداً!
            // حتى لو لم يدخل المزود تاريخ عودة محدد
            const returnFlightInfo = await this.findBestReturnFlight(seat, request.returnDate);
            
            console.log('✅ Return flight info found:', returnFlightInfo);
            
            // السعر الإجمالي للتذكرة (ذهاب + عودة كسعر واحد)
            const roundTripPrice = seat.round_trip_price || seat.total_price || 0;
            const totalWithCommission = roundTripPrice + (seat.system_commission || 0);
            
            result.exactMatches.push({
              ...seat,
              trip_type: 'round_trip',
              // السعر الإجمالي للتذكرة (كما يراه العميل)
              total_price: totalWithCommission,
              display_price: totalWithCommission,
              round_trip_price: roundTripPrice,
              // بيانات رحلة العودة التلقائية - مهمة جداً
              return_date: returnFlightInfo?.return_date || returnFlightInfo?.actual_date || request.returnDate,
              return_flight_id: returnFlightInfo?.flight_id || seat.return_flight_id,
              return_flight_number: returnFlightInfo?.flight_number || seat.return_flight_number,
              return_departure_time: returnFlightInfo?.departure_time || seat.return_departure_time,
              return_arrival_time: returnFlightInfo?.arrival_time,
              actual_return_date: returnFlightInfo?.actual_date || request.returnDate,
              // نضيف كائن كامل لبيانات رحلة العودة
              return_flight: returnFlightInfo ? {
                flight_id: returnFlightInfo.flight_id,
                flight_number: returnFlightInfo.flight_number,
                departure_time: returnFlightInfo.departure_time,
                arrival_time: returnFlightInfo.arrival_time,
                departure_date: returnFlightInfo.return_date || returnFlightInfo.actual_date || request.returnDate
              } : null
            });
          }
        }
      } else {
        // العميل يبحث عن ذهاب فقط
        for (const seat of exactDateMatches) {
          if (seat.trip_type === 'one_way') {
            // تذكرة ذهاب فقط أصلية - سعر الذهاب فقط
            const oneWayBasePrice = seat.one_way_base_price || seat.total_price || 0;
            const totalWithCommission = oneWayBasePrice + (seat.system_commission || 0);
            
            result.exactMatches.push({
              ...seat,
              trip_type: 'one_way',
              total_price: totalWithCommission,
              display_price: totalWithCommission,
              one_way_base_price: oneWayBasePrice
            });
          } else if (seat.trip_type === 'round_trip' && seat.allow_one_way_purchase) {
            // تذكرة ذهاب وعودة تسمح ببيع الذهاب فقط بسعر مختلف
            const oneWayPrice = seat.one_way_price || 0;
            const totalWithCommission = oneWayPrice + (seat.system_commission || 0);
            
            result.exactMatches.push({
              ...seat,
              trip_type: 'one_way',
              total_price: totalWithCommission,
              display_price: totalWithCommission,
              one_way_price: oneWayPrice,
              is_partial_from_round_trip: true,
              original_round_trip_price: seat.round_trip_price
            });
          }
        }
      }

      // 2. إذا لم نجد تطابق تام، نبحث عن درجات بديلة في نفس التاريخ
      if (result.exactMatches.length === 0) {
        const sameDateDifferentClass = availableSeats.filter(seat =>
          seat.departure_date === request.departureDate &&
          seat.seat_class !== request.seatClass
        );

        result.alternativeClasses = sameDateDifferentClass.map(seat => ({
          ...seat,
          is_alternative_class: true,
          requested_class: request.seatClass
        }));
      }

      // 3. البحث عن أقرب موعد متاح
      if (result.exactMatches.length === 0) {
        console.log('No exact matches, searching for nearest dates...');
        
        // نأخذ جميع المقاعد (سواء في المستقبل أو قريبة من التاريخ المطلوب)
        // ونرتبها حسب القرب من التاريخ المطلوب
        const sortedSeats = [...availableSeats].sort((a, b) => {
          try {
            const daysA = Math.abs(differenceInDays(parseISO(a.departure_date), parseISO(request.departureDate)));
            const daysB = Math.abs(differenceInDays(parseISO(b.departure_date), parseISO(request.departureDate)));
            return daysA - daysB;
          } catch (e) {
            return 0;
          }
        });

        console.log('Sorted seats by date proximity:', sortedSeats.length);

        // أخذ أقرب 5 رحلات
        result.nearestFlights = sortedSeats.slice(0, 5).map(seat => {
          let daysDiff = 0;
          try {
            daysDiff = differenceInDays(parseISO(seat.departure_date), parseISO(request.departureDate));
          } catch (e) {}
          
          return {
            ...seat,
            is_suggested: true,
            days_difference: daysDiff
          };
        });
        
        console.log('Nearest flights found:', result.nearestFlights.length);
      }

      // إضافة الدرجات البديلة للنتائج إذا لم توجد تطابقات
      if (result.exactMatches.length === 0 && result.alternativeClasses.length > 0) {
        result.exactMatches = result.alternativeClasses;
      }

    } catch (error) {
      console.error('Internal search error:', error);
    }

    return result;
  }

  /**
   * البحث الذكي عن أفضل رحلة عودة تلقائية
   * يبحث في FlightPair أولاً ثم في جدول الرحلات
   * يختار أقرب تاريخ متاح بناءً على أيام التشغيل
   */
  async findBestReturnFlight(outboundSeat, requestedReturnDate) {
    try {
      console.log('=== Finding Return Flight ===');
      console.log('Outbound seat:', outboundSeat.departure_airport_code, '->', outboundSeat.arrival_airport_code);
      console.log('Requested return date:', requestedReturnDate);
      
      // 1. البحث أولاً في جدول أزواج الرحلات
      const flightPairs = await base44.entities.FlightPair.filter({
        outbound_flight_id: outboundSeat.flight_id,
        is_active: true
      });
      
      if (flightPairs.length > 0) {
        const pair = flightPairs[0];
        console.log('Found flight pair:', pair.return_flight_number);
        
        const actualReturnDate = this.calculateActualReturnDate(
          { days_of_week: pair.days_of_week, departure_time: pair.return_departure_time },
          requestedReturnDate,
          outboundSeat.return_start_date
        );
        
        return {
          flight_id: pair.return_flight_id,
          flight_number: pair.return_flight_number,
          departure_time: pair.return_departure_time,
          return_date: actualReturnDate
        };
      }
      
      // 2. إذا كانت الرحلة محددة مسبقاً في المقعد
      if (outboundSeat.return_flight_id) {
        const returnFlights = await base44.entities.Flight.filter({
          id: outboundSeat.return_flight_id
        });
        if (returnFlights.length > 0) {
          const returnFlight = returnFlights[0];
          const actualReturnDate = this.calculateActualReturnDate(
            returnFlight, 
            requestedReturnDate,
            outboundSeat.return_start_date
          );
          
          console.log('Found linked return flight:', returnFlight.flight_number);
          return {
            flight_id: returnFlight.id,
            flight_number: returnFlight.flight_number,
            departure_time: returnFlight.departure_time,
            return_date: actualReturnDate
          };
        }
      }

      // 3. البحث في جدول الرحلات عن رحلة عودة مناسبة (المسار المعاكس)
      const returnFlights = await base44.entities.Flight.filter({
        departure_airport_code: outboundSeat.arrival_airport_code,
        arrival_airport_code: outboundSeat.departure_airport_code,
        airline_id: outboundSeat.airline_id,
        is_active: true
      });

      console.log('Return flights found in schedule:', returnFlights.length);

      if (returnFlights.length > 0) {
        // اختيار أنسب رحلة عودة بناءً على تاريخ العودة المطلوب وأيام التشغيل
        let bestReturnFlight = null;
        let bestReturnDate = null;
        let minDaysDiff = 999;
        
        for (const flight of returnFlights) {
          const actualDate = this.calculateActualReturnDate(
            flight, 
            requestedReturnDate,
            outboundSeat.return_start_date
          );
          
          // حساب الفرق بالأيام من التاريخ المطلوب
          const requestedDate = parseISO(requestedReturnDate);
          const calculatedDate = parseISO(actualDate);
          const daysDiff = Math.abs(differenceInDays(calculatedDate, requestedDate));
          
          // اختيار الرحلة الأقرب للتاريخ المطلوب
          if (daysDiff < minDaysDiff) {
            bestReturnFlight = flight;
            bestReturnDate = actualDate;
            minDaysDiff = daysDiff;
          }
          
          // إذا وجدنا تطابق تام، نتوقف
          if (daysDiff === 0) break;
        }

        if (bestReturnFlight) {
          console.log('Selected return flight:', bestReturnFlight.flight_number, 'date:', bestReturnDate, 'days diff:', minDaysDiff);
          
          return {
            flight_id: bestReturnFlight.id,
            flight_number: bestReturnFlight.flight_number,
            departure_time: bestReturnFlight.departure_time,
            arrival_time: bestReturnFlight.arrival_time,
            return_date: bestReturnDate,
            actual_date: bestReturnDate
          };
        }
      }

      // 4. إذا لم نجد رحلة عودة، نعيد التاريخ المطلوب فقط
      console.log('No return flight found, using requested date');
      return {
        return_date: requestedReturnDate,
        flight_number: outboundSeat.return_flight_number
      };
    } catch (error) {
      console.error('Error finding return flight:', error);
      return { return_date: requestedReturnDate };
    }
  }

  /**
   * حساب تاريخ العودة الفعلي بناءً على جدول الرحلة
   */
  calculateActualReturnDate(returnFlight, requestedDate, minStartDate) {
    try {
      const requested = parseISO(requestedDate);
      const minStart = minStartDate ? parseISO(minStartDate) : null;
      
      // التأكد من أن تاريخ العودة بعد تاريخ بداية الإتاحة
      let startDate = requested;
      if (minStart && requested < minStart) {
        startDate = minStart;
      }

      // إذا كانت الرحلة لها أيام تشغيل محددة
      if (returnFlight.days_of_week && returnFlight.days_of_week.length > 0) {
        // البحث عن أقرب يوم تشغيل
        for (let i = 0; i < 14; i++) {
          const checkDate = addDays(startDate, i);
          const dayOfWeek = checkDate.getDay();
          if (returnFlight.days_of_week.includes(dayOfWeek)) {
            return format(checkDate, 'yyyy-MM-dd');
          }
        }
      }

      return format(startDate, 'yyyy-MM-dd');
    } catch (error) {
      return requestedDate;
    }
  }

  /**
   * التحقق من توفر رحلة عودة للذهاب والعودة
   */
  async checkReturnAvailability(request, outboundSeat) {
    if (request.tripType !== 'round_trip' || !request.returnDate) {
      return null;
    }

    const returnSeats = await base44.entities.AvailableSeat.filter({
      departure_airport_code: request.to,
      arrival_airport_code: request.from,
      departure_date: request.returnDate,
      seat_class: outboundSeat.seat_class,
      status: 'active'
    });

    const availableReturn = returnSeats.filter(seat =>
      (seat.available_count - (seat.booked_count || 0)) >= request.passengers
    );

    return availableReturn.length > 0 ? availableReturn[0] : null;
  }
}

export const smartFlightSearch = new SmartFlightSearch();
export default SmartFlightSearch;