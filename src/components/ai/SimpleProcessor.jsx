import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { superGeniusAI } from './SuperGeniusAI';

/**
 * ✅ معالج بسيط مباشر (بدون طابور معقد)
 */
class SimpleProcessor {
  constructor() {
    this.processing = new Set();
    this.processed = new Set();
  }

  async start() {
    console.log('🧠 بدء معالجة الرسائل...');
    
    // مراقبة الرسائل الجديدة
    base44.entities.WhatsAppMessage.subscribe(async (event) => {
      if (event.type === 'create' && event.data.direction === 'incoming') {
        await this.processMessage(event.data);
      }
    });
  }

  async processMessage(msg) {
    const { id, from_number, content, message_id } = msg;

    // تخطي إذا كانت معالجة
    if (msg.processed_by_ai) {
      console.log('⏭️ معالجة مسبقاً - تخطي');
      return;
    }

    if (this.processing.has(id)) {
      console.log('⏭️ قيد المعالجة - تخطي');
      return;
    }

    if (this.processed.has(id)) {
      console.log('⏭️ معالجة سابقاً - تخطي');
      return;
    }

    if (!content?.trim()) {
      console.log('⏭️ رسالة فارغة - تخطي');
      return;
    }

    this.processing.add(id);

    try {
      console.log('\n🎯 معالجة رسالة من:', from_number);
      console.log('   محتوى:', content.substring(0, 50));

      // 1. معالجة بالذكاء الاصطناعي
      const aiResult = await superGeniusAI.processMessage(content, from_number);

      // 2. تحديث الرسالة الواردة
      await base44.entities.WhatsAppMessage.update(id, {
        processed_by_ai: true,
        ai_processing_result: aiResult.response
      });

      // 3. تأخير صغير
      await new Promise(r => setTimeout(r, 300));

      // 4. إرسال الرد
      await this.sendReply(from_number, aiResult.response);

      console.log('✅ تمت المعالجة بنجاح\n');
      this.processed.add(id);

    } catch (error) {
      console.error('❌ خطأ في المعالجة:', error.message);
      
      try {
        await this.sendReply(from_number, 'معذرة، حصل خطأ تقني. جرب مرة ثانية.');
      } catch (e) {
        console.error('❌ فشل الرد:', e.message);
      }

    } finally {
      this.processing.delete(id);
    }
  }

  async sendReply(phone, text) {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({
        status: 'connected',
        is_active: true
      }, '-created_date', 1);

      if (!gateways?.length) {
        console.error('❌ لا توجد بوابة متصلة');
        return;
      }

      const gateway = gateways[0];
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      
      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;

      console.log('📤 إرسال رد للعميل:', formattedPhone);
      
      await client.sendText('default', formattedPhone, text);

      console.log('✅ تم الإرسال');

      // حفظ الرد
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: gateway.phone_number || 'system',
        to_number: formattedPhone,
        message_type: 'text',
        content: text,
        gateway_id: gateway.id,
        status: 'sent',
        processed_by_ai: true
      });

    } catch (error) {
      console.error('❌ خطأ في الإرسال:', error.message);
      throw error;
    }
  }
}

export const simpleProcessor = new SimpleProcessor();