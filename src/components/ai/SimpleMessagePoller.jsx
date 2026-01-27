import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';

/**
 * ✅ سحب رسائل مباشر بسيط (بدون طابور معقد)
 */
export class SimpleMessagePoller {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processedMessageIds = new Set();
  }

  async start() {
    if (this.isRunning) return;
    
    console.log('🚀 بدء سحب الرسائل من WAHA...');
    this.isRunning = true;

    // سحب فوري أول مرة
    await this.poll();

    // سحب كل 10 ثواني
    this.intervalId = setInterval(() => this.poll(), 10000);
  }

  async poll() {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({
        is_active: true,
        status: 'connected'
      });

      for (const gateway of gateways) {
        await this.pollGateway(gateway);
      }
    } catch (error) {
      console.error('❌ خطأ في السحب:', error);
    }
  }

  async pollGateway(gateway) {
    try {
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      const messages = await client.getAllMessages('default', 30);

      if (!messages?.length) return;

      console.log(`📬 ${gateway.name}: وجدنا ${messages.length} رسالة`);

      for (const msg of messages) {
        if (msg.fromMe || !msg.body) continue;

        const messageId = msg.id;
        
        // تخطي المعالج مسبقاً
        if (this.processedMessageIds.has(messageId)) continue;
        this.processedMessageIds.add(messageId);

        // استخراج الرقم
        let phone = msg.from?.replace('@c.us', '').replace('@s.whatsapp.net', '') || '';
        if (!phone) continue;

        // حفظ الرسالة مباشرة
        try {
          const savedMsg = await base44.entities.WhatsAppMessage.create({
            message_id: messageId,
            direction: 'incoming',
            from_number: phone,
            to_number: gateway.phone_number || '',
            from_name: msg.notifyName || msg.pushName || '',
            message_type: msg.hasMedia ? 'media' : 'text',
            content: msg.body || '[media]',
            gateway_id: gateway.id,
            status: 'received',
            processed_by_ai: false
          });

          console.log(`✅ رسالة محفوظة: ${phone}`);

          // وضع علامة مقروء على WAHA
          try {
            await client.markMessagesAsRead('default', `${phone}@c.us`, [messageId]);
          } catch (e) {
            console.log('⚠️ فشل وضع العلامة على WAHA');
          }

        } catch (error) {
          if (!error.message?.includes('already exists')) {
            console.error('❌ خطأ في حفظ الرسالة:', error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ خطأ في معالجة البوابة:', error);
    }
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    console.log('🛑 إيقاف السحب');
  }
}

export const simplePoller = new SimpleMessagePoller();