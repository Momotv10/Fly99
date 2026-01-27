import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { masterProcessor } from './MasterProcessor';
import { WAHAListener } from './WAHAListener';

export class AIServiceEngine {
  constructor() {
    this.processor = masterProcessor;
    this.processing = new Set();
    this.listener = new WAHAListener(this.processMessage.bind(this));
  }

  async initialize() {
    console.log('🤖 تفعيل محرك الذكاء الاصطناعي...');
    console.log('🎧 ربط مع WAHA...');
    
    // بدء الاستماع لرسائل WAHA
    const unsubscribe = await this.listener.startListening();
    
    console.log('✅ النظام جاهز ومتصل');
    
    return unsubscribe;
  }

  async processMessage(message) {
    if (this.processing.has(message.id)) return;
    this.processing.add(message.id);

    try {
      console.log('📩 رسالة واردة:', message.from_number);

      // 1. التعرف على العميل
      const customer = await this.identifyCustomer(message.from_number);
      console.log('👤 العميل:', customer ? customer.full_name : 'جديد');

      // 2. جلب أو إنشاء الجلسة
      const session = await this.getOrCreateSession(message.from_number, customer);
      console.log('📋 الجلسة:', session.session_id, '- الحالة:', session.customer_state);

      // 3. معالجة بالذكاء الاصطناعي
      await this.processor.processIncomingMessage(message);

      console.log('✅ تمت المعالجة بنجاح');

    } catch (error) {
      console.error('❌ خطأ:', error);
      await this.sendResponse(message.from_number, 'عذراً، حدث خطأ. جاري إعادة المحاولة...', message.gateway_id);
    } finally {
      this.processing.delete(message.id);
    }
  }

  async identifyCustomer(phoneNumber) {
    const customers = await base44.entities.Customer.filter({ whatsapp: phoneNumber });
    return customers[0] || null;
  }

  async getOrCreateSession(phoneNumber, customer) {
    // البحث عن جلسة نشطة
    const sessions = await base44.entities.AISession.filter({
      customer_phone: phoneNumber,
      is_active: true
    }, '-created_date', 1);

    if (sessions[0]) {
      // إذا مرت أكثر من ساعة، نبدأ جلسة جديدة
      const lastMsg = new Date(sessions[0].last_message_at || sessions[0].created_date);
      const now = new Date();
      const hoursPassed = (now - lastMsg) / (1000 * 60 * 60);

      if (hoursPassed < 1) {
        return sessions[0];
      }
    }

    // إنشاء جلسة جديدة
    const sessionId = `session_${Date.now()}_${phoneNumber}`;
    return await base44.entities.AISession.create({
      session_id: sessionId,
      customer_phone: phoneNumber,
      customer_id: customer?.id || null,
      is_registered_customer: !!customer,
      customer_state: customer ? 'returning' : 'new',
      last_intent: null,
      current_context: {},
      messages_count: 0,
      escalation_level: 0,
      provider_response_waited: false,
      is_active: true,
      last_message_at: new Date().toISOString()
    });
  }

  async executeActions(decision, session, customer, message) {
    // 1. إرسال الرد للعميل
    if (decision.response) {
      await this.sendResponse(message.from_number, decision.response, message.gateway_id);
    }

    // 2. إرسال للمزود إن لزم
    if (decision.send_to_provider && decision.provider_message) {
      await this.sendToProvider(decision, message);
    }

    // 3. التصعيد للطوارئ
    if (decision.escalate && decision.escalate_to === 'emergency_staff') {
      await this.escalateToEmergency(decision, session, customer, message);
    }

    // 4. إرسال التذكرة
    if (decision.ticket_to_send?.ticket_pdf_url) {
      // TODO: إرسال ملف PDF
      console.log('📄 إرسال تذكرة:', decision.ticket_to_send.ticket_pdf_url);
    }
  }

  async sendResponse(toNumber, text, gatewayId) {
    try {
      let gateway;
      if (gatewayId) {
        const gateways = await base44.entities.WhatsAppGateway.filter({ id: gatewayId });
        gateway = gateways[0];
      } else {
        const gateways = await base44.entities.WhatsAppGateway.filter({
          type: 'customers',
          status: 'connected',
          is_active: true
        });
        gateway = gateways[0];
      }

      if (!gateway) {
        console.error('❌ لا توجد بوابة');
        return;
      }

      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      await client.sendText('default', toNumber, text);

      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: gateway.phone_number,
        to_number: toNumber,
        message_type: 'text',
        content: text,
        gateway_id: gateway.id,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      console.log('✅ رد مُرسل');
    } catch (error) {
      console.error('❌ خطأ في الإرسال:', error);
    }
  }

  async sendToProvider(decision, message) {
    const providers = await base44.entities.Provider.filter({ id: decision.provider_id });
    const provider = providers[0];

    if (!provider || !provider.whatsapp) return;

    const providerGateways = await base44.entities.WhatsAppGateway.filter({
      type: 'providers',
      status: 'connected',
      is_active: true
    });

    if (providerGateways[0]) {
      const client = new WAHAClient(
        providerGateways[0].waha_server_url,
        providerGateways[0].waha_api_key
      );
      
      await client.sendText('default', provider.whatsapp, decision.provider_message);

      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: providerGateways[0].phone_number,
        to_number: provider.whatsapp,
        message_type: 'text',
        content: decision.provider_message,
        gateway_id: providerGateways[0].id,
        status: 'sent',
        sent_at: new Date().toISOString(),
        related_entity_type: 'provider',
        related_entity_id: provider.id
      });

      console.log('📨 إشعار مُرسل للمزود');
    }
  }

  async escalateToEmergency(decision, session, customer, message) {
    const emergencySettings = await base44.entities.SystemSettings.filter({
      setting_key: 'emergency_staff_whatsapp'
    });

    if (!emergencySettings[0]?.setting_value) return;

    const customerGateways = await base44.entities.WhatsAppGateway.filter({
      type: 'customers',
      status: 'connected',
      is_active: true
    });

    if (customerGateways[0]) {
      const client = new WAHAClient(
        customerGateways[0].waha_server_url,
        customerGateways[0].waha_api_key
      );

      await client.sendText(
        'default',
        emergencySettings[0].setting_value,
        decision.emergency_notification
      );

      console.log('🚨 تصعيد للطوارئ');
    }

    // تحديث الجلسة
    await base44.entities.AISession.update(session.id, {
      customer_state: 'escalated',
      escalation_level: 3
    });
  }

  async updateConversation(session, customerMsg, aiResponse, decision) {
    const conversations = await base44.entities.AIConversation.filter({
      customer_phone: session.customer_phone,
      status: 'active'
    });

    let conversation = conversations[0];

    if (!conversation) {
      conversation = await base44.entities.AIConversation.create({
        customer_phone: session.customer_phone,
        customer_id: session.customer_id,
        customer_name: session.customer_id ? 'عميل مسجل' : 'عميل جديد',
        conversation_log: [],
        status: 'active',
        priority: decision.escalate ? 'urgent' : 'normal'
      });
    }

    const updatedLog = [
      ...(conversation.conversation_log || []),
      {
        role: 'customer',
        message: customerMsg,
        timestamp: new Date().toISOString()
      },
      {
        role: 'ai',
        message: aiResponse,
        timestamp: new Date().toISOString(),
        understood_intent: decision.intent,
        action_taken: decision.action
      }
    ];

    await base44.entities.AIConversation.update(conversation.id, {
      conversation_log: updatedLog,
      intent: decision.intent,
      priority: decision.escalate ? 'urgent' : conversation.priority,
      ai_summary: `${decision.action} - ${decision.logic_used}`,
      status: decision.escalate ? 'escalated' : 'active',
      escalated_to: decision.escalate_to || conversation.escalated_to,
      related_booking_id: decision.booking_id || conversation.related_booking_id,
      related_provider_id: decision.provider_id || conversation.related_provider_id
    });
  }
}

export const aiEngine = new AIServiceEngine();