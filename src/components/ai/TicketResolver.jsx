import { base44 } from '@/api/base44Client';

export class TicketResolver {
  async resolveTicketForCustomer(customerId) {
    // جلب جميع الحجوزات
    const bookings = await base44.entities.Booking.filter({
      customer_id: customerId
    }, '-created_date', 20);

    if (bookings.length === 0) {
      return {
        found: false,
        reason: 'no_bookings',
        message: 'لا توجد حجوزات لهذا العميل'
      };
    }

    // منطق اختيار التذكرة المناسبة
    const logic = this.selectBestTicket(bookings);

    return {
      found: true,
      ticket: logic.selected,
      reason: logic.reason,
      total_tickets: bookings.length,
      alternatives: logic.alternatives
    };
  }

  selectBestTicket(bookings) {
    // 1. التذاكر الصادرة فقط
    const issued = bookings.filter(b => b.status === 'issued' && b.ticket_pdf_url);
    
    // 2. إذا لا يوجد تذاكر صادرة، نبحث عن المؤكدة
    if (issued.length === 0) {
      const paid = bookings.filter(b => b.status === 'paid' || b.status === 'pending_issue');
      
      if (paid.length === 0) {
        return {
          selected: null,
          reason: 'no_issued_tickets',
          alternatives: bookings
        };
      }

      return {
        selected: paid[0],
        reason: 'not_issued_yet',
        alternatives: paid.slice(1)
      };
    }

    // 3. إذا توجد تذكرة واحدة فقط
    if (issued.length === 1) {
      return {
        selected: issued[0],
        reason: 'single_ticket',
        alternatives: []
      };
    }

    // 4. إذا توجد عدة تذاكر، نختار الأحدث أو الأقرب للسفر
    const upcoming = issued.filter(b => {
      const depDate = new Date(b.departure_date);
      const now = new Date();
      return depDate >= now;
    });

    if (upcoming.length > 0) {
      // نختار أقرب رحلة
      upcoming.sort((a, b) => new Date(a.departure_date) - new Date(b.departure_date));
      return {
        selected: upcoming[0],
        reason: 'nearest_upcoming_flight',
        alternatives: upcoming.slice(1).concat(issued.filter(b => !upcoming.includes(b)))
      };
    }

    // 5. إذا كل الرحلات قديمة، نختار الأحدث إصداراً
    return {
      selected: issued[0],
      reason: 'latest_issued',
      alternatives: issued.slice(1)
    };
  }

  async identifyTicketFromContext(customerId, context) {
    const bookings = await base44.entities.Booking.filter({
      customer_id: customerId
    }, '-created_date', 20);

    // إذا ذكر مدينة أو تاريخ
    if (context.from_city || context.to_city || context.date) {
      const matches = bookings.filter(b => {
        let match = true;
        if (context.from_city && !b.departure_city.includes(context.from_city)) {
          match = false;
        }
        if (context.to_city && !b.arrival_city.includes(context.to_city)) {
          match = false;
        }
        // يمكن إضافة منطق تطابق التاريخ
        return match;
      });

      if (matches.length === 1) {
        return {
          found: true,
          ticket: matches[0],
          confidence: 0.9,
          method: 'context_match'
        };
      }
    }

    // fallback: أحدث تذكرة
    return await this.resolveTicketForCustomer(customerId);
  }
}