import { base44 } from '@/api/base44Client';
import { superGeniusAI } from './SuperGeniusAI';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';

/**
 * ✅ معالج Webhook - استقبال مباشر من WAHA
 * 
 * مميزات:
 * - رسالة واحدة = معالجة واحدة
 * - بدون polling
 * - فوري 100%
 * - لا تكرار
 */
export class WebhookMessageReceiver {
  constructor() {
    this.processing = new Set();
    this.lastResponse = new Map();
    this.cooldownMs = 3000;
  }

  /**
   * معالجة webhook من WAHA
   * هذه الدالة يتم استدعاؤها من backend function
   */
  async handleWebhook(payload) {
    console.log('\n════════════════════════════════════');
    console.log('📨 [WEBHOOK] استقبال رسالة من WAHA');
    console.log('════════════════════════════════════');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
      // استخراج البيانات
      const { event, data } = payload;

      // ✅ معالجة الأنواع المختلفة
      if (event === 'message.created') {
        await this.handleMessageCreated(data);
      } else if (event === 'message.received') {
        await this.handleMessageReceived(data);
      } else if (event === 'status') {
        await this.handleStatusUpdate(data);
      }

      console.log('✅ تمت معالجة الـ webhook\n');

    } catch (error) {
      console.error('❌ خطأ في معالجة الـ webhook:', error);
      throw error;
    }
  }

  /**
   * معالجة رسالة جديدة
   */
  async handleMessageCreated(data) {
    const {
      id: messageId,
      from,
      body,
      timestamp,
      fromMe,
      sessionId,
      chatId,
      remoteJid
    } = data;

    // 🛑 تخطي الرسائل المرسلة منا
    if (fromMe) {
      console.log('⏭️ رسالة منا - تخطي');
      return;
    }

    // 🛑 تخطي الرسائل الفارغة
    if (!body?.trim()) {
      console.log('⏭️ رسالة فارغة - تخطي');
      return;
    }

    // استخراج رقم العميل
    const phone = (from || remoteJid || '').replace(/[^0-9]/g, '');
    if (!phone) {
      console.log('❌ رقم فارغ - تخطي');
      return;
    }

    console.log(`\n════════════════════════════════════`);
    console.log(`📨 رسالة جديدة: ${messageId}`);
    console.log(`   من: ${phone}`);
    console.log(`════════════════════════════════════`);

    try {
      // 🔴 CRITICAL: التحقق الأول من قاعدة البيانات
      console.log('🔍 فحص قاعدة البيانات...');
      const existing = await base44.entities.WhatsAppMessage.filter({
        message_id: messageId
      }, '-created_date', 1);

      if (existing?.length > 0) {
        console.log('⏭️ الرسالة موجودة مسبقاً - تخطي');
        console.log(`   معالجة: ${existing[0].processed_by_ai}`);
        return;
      }

      console.log('✅ رسالة جديدة 100%');

      // جلب البوابة
      const gateway = await this.getGateway(sessionId);
      if (!gateway) {
        console.error('❌ لم نجد البوابة');
        return;
      }

      // 💾 حفظ فوري
      console.log('💾 حفظ الرسالة...');
      const savedMsg = await base44.entities.WhatsAppMessage.create({
        message_id: messageId,
        direction: 'incoming',
        from_number: phone,
        to_number: gateway.phone_number || '',
        from_name: data.pushName || data.notifyName || '',
        message_type: 'text',
        content: body,
        gateway_id: gateway.id,
        status: 'received',
        processed_by_ai: false,
        sent_at: new Date(timestamp * 1000 || Date.now()).toISOString()
      });

      console.log(`✅ حفظت برقم: ${savedMsg.id}`);

      // 🧠 معالجة
      console.log('🧠 معالجة بـ AI...');
      const aiResult = await superGeniusAI.processMessage(body, phone);

      // 📝 تحديث
      await base44.entities.WhatsAppMessage.update(savedMsg.id, {
        processed_by_ai: true,
        ai_processing_result: aiResult.response
      });

      console.log('✅ تحديثت');

      // تأخير
      await new Promise(r => setTimeout(r, 500));

      // 📤 إرسال رد واحد فقط
      console.log('📤 إرسال رد واحد...');
      await this.sendReply(
        phone,
        aiResult.response,
        gateway,
        chatId || remoteJid
      );

      console.log('════════════════════════════════════\n');

    } catch (error) {
      console.error('❌ خطأ:', error.message);
    }
  }

  /**
   * معالجة تحديث الحالة
   */
  async handleMessageReceived(data) {
    console.log('📬 تحديث استقبال:', data);
    // يمكن استخدام هذا لتحديث حالة الرسائل المرسلة
  }

  /**
   * معالجة تحديثات الحالة
   */
  async handleStatusUpdate(data) {
    console.log('⚡ تحديث الحالة:', data);
  }

  /**
   * جلب البوابة
   */
  async getGateway(sessionId) {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({
        session_id: sessionId,
        is_active: true
      }, '-created_date', 1);

      return gateways?.[0] || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * إرسال الرد
   */
  async sendReply(phone, text, gateway, chatId) {
    try {
      const client = new WAHAClient(
        gateway.waha_server_url,
        gateway.waha_api_key
      );

      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;

      console.log(`   🚀 إرسال إلى: ${formattedPhone}`);

      await client.sendText('default', formattedPhone, text);

      console.log('   ✅ تم الإرسال');

      // حفظ الرد
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: gateway.phone_number || 'system',
        to_number: formattedPhone,
        message_type: 'text',
        content: text,
        gateway_id: gateway.id,
        status: 'sent',
        processed_by_ai: true,
        sent_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ خطأ في الإرسال:', error.message);
      throw error;
    }
  }
}

export const webhookReceiver = new WebhookMessageReceiver();