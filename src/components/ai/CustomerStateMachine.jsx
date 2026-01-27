export class CustomerStateMachine {
  constructor(session) {
    this.session = session;
    this.state = session.customer_state || 'new';
  }

  transition(intent, context) {
    const currentState = this.state;
    let newState = currentState;
    let stateAction = null;

    switch (currentState) {
      case 'new':
        if (intent === 'search_flight') {
          newState = 'active_booking';
          stateAction = 'collect_flight_requirements';
        } else if (intent === 'request_ticket' && context.has_bookings) {
          newState = 'returning';
          stateAction = 'fetch_latest_ticket';
        } else if (intent === 'general_inquiry') {
          stateAction = 'respond_general';
        }
        break;

      case 'returning':
        if (intent === 'request_ticket') {
          stateAction = 'send_ticket';
        } else if (intent === 'report_problem') {
          newState = 'problem_reported';
          stateAction = 'identify_problem';
        } else if (intent === 'search_flight') {
          newState = 'active_booking';
          stateAction = 'collect_flight_requirements';
        }
        break;

      case 'active_booking':
        if (intent === 'complete_booking') {
          stateAction = 'finalize_booking';
        } else if (intent === 'search_flight') {
          stateAction = 'search_and_present';
        }
        break;

      case 'problem_reported':
        if (intent === 'provider_no_response') {
          newState = 'escalated';
          stateAction = 'escalate_to_emergency';
        } else if (intent === 'change_booking') {
          stateAction = 'route_to_provider';
        }
        break;

      case 'escalated':
        // في حالة التصعيد، ننتظر تدخل بشري
        stateAction = 'wait_human_intervention';
        break;
    }

    this.state = newState;
    
    return {
      previous_state: currentState,
      new_state: newState,
      action: stateAction,
      transition_reason: intent
    };
  }

  getState() {
    return this.state;
  }

  canAccessTicket() {
    // عميل جديد لا يمكنه الوصول لبيانات حساسة
    return this.session.is_registered_customer && 
           (this.state === 'returning' || this.state === 'problem_reported');
  }

  canSeeProviderInfo() {
    // فقط العملاء الذين لديهم حجز يمكنهم رؤية المزود
    return this.session.is_registered_customer && 
           this.session.active_booking_id !== null;
  }

  shouldEscalate() {
    return this.session.escalation_level >= 2 || this.state === 'escalated';
  }
}