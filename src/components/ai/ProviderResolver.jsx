import { base44 } from '@/api/base44Client';

export class ProviderResolver {
  async resolveProviderForBooking(bookingId) {
    const bookings = await base44.entities.Booking.filter({ id: bookingId });
    const booking = bookings[0];

    if (!booking || !booking.provider_id) {
      return {
        found: false,
        reason: 'no_provider_assigned'
      };
    }

    const providers = await base44.entities.Provider.filter({ id: booking.provider_id });
    const provider = providers[0];

    if (!provider) {
      return {
        found: false,
        reason: 'provider_not_found'
      };
    }

    return {
      found: true,
      provider: provider,
      booking: booking,
      contact_method: 'whatsapp',
      contact_value: provider.whatsapp
    };
  }

  async resolveProviderForCustomer(customerId) {
    // جلب آخر حجز للعميل
    const bookings = await base44.entities.Booking.filter({
      customer_id: customerId
    }, '-created_date', 1);

    if (bookings.length === 0) {
      return {
        found: false,
        reason: 'no_bookings'
      };
    }

    return await this.resolveProviderForBooking(bookings[0].id);
  }

  shouldEscalateToProvider(problemType, bookingStatus) {
    // المشاكل التي تتطلب تدخل المزود
    const providerProblems = [
      'change_booking',
      'cancel_booking',
      'reschedule',
      'flight_issue',
      'ticket_error'
    ];

    // الحالات التي يمكن فيها التواصل مع المزود
    const validStatuses = ['paid', 'pending_issue', 'issued'];

    return providerProblems.includes(problemType) && validStatuses.includes(bookingStatus);
  }

  buildProviderNotification(customer, booking, problem) {
    return `🔔 طلب عميل - ${problem.type}

العميل: ${customer.full_name || 'غير معروف'}
رقم الواتساب: ${customer.whatsapp}

الحجز:
• رقم: ${booking.booking_number}
• الرحلة: ${booking.departure_city} ← ${booking.arrival_city}
• التاريخ: ${booking.departure_date}
• الحالة: ${booking.status}

المشكلة:
"${problem.description}"

${problem.urgency === 'urgent' ? '⚠️ يرجى الرد بشكل عاجل' : 'يرجى التواصل مع العميل في أقرب وقت'}

---
نظام الحجوزات الذكي`;
  }
}