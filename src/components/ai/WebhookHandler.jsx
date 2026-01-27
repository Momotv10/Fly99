/**
 * 🎯 معالج Webhook الرئيسي من Waha
 * 
 * القاعدة الذهبية:
 * 1. استقبل → ارجع 200 OK فوراً ✅
 * 2. تحقق من التكرار ✅
 * 3. معالجة في الخلفية (async) 🔄
 */

import { base44 } from '@/api/base44Client';
import { superGeniusAI } from './SuperGeniusAI';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { deduplicationService } from './DeduplicationService';

export class WebhookHandler {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.backgroundWorker();
  }

  /**
   * 🔴 نقطة الدخول - استقبل الـ webhook
   * يجب أن ترجع 200 OK فوراً!
   */
  async handleWebhook(payload) {
    console.log('\n🔔 [WEBHOOK] استقبال من WAHA');

    try {
      const { event, data } = payload;

      // ✅ التحقق من أن البيانات موجودة
      if (!data) {
        console.warn('⚠️ بيانات فارغة');
        return { status: 'ok', queued: false };
      }

      // استخراج معرف الرسالة
      const messageId = data.id || data.message_id || `msg_${Date.now()}`;

      // ✅ التحقق الفوري من التكرار
      const dedup = await deduplicationService.checkAndRegister(messageId);
      
      if (dedup.isDuplicate) {
        console.log(`⏭️ تجاهل مكرر: ${dedup.reason}`);
        return { status: 'ok', queued: false, isDuplicate: true };
      }

      // ✅ إضافة للطابور (بدون انتظار!)
      this.queue.push({
        event,
        data,
        messageId,
        timestamp: Date.now()
      });

      console.log(`📥 تم إضافة للطابور (حجم: ${this.queue.length})`);

      // ✅ ارجع 200 OK فوراً!
      return { status: 'ok', queued: true };

    } catch (error) {
      console.error('❌ خطأ في استقبال webhook:', error.message);
      // حتى في الخطأ، ارجع 200 لكي لا يعيد Waha الإرسال
      return { status: 'ok', error: error.message };
    }
  }

  /**
   * 🔄 عامل الخلفية - معالجة الطابور
   */
  backgroundWorker() {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;

      try {
        const item = this.queue.shift();
        if (!item) {
          this.processing = false;
          return;
        }

        console.log(`\n🔄 معالجة من الطابور (${item.queue.length} متبقي)`);

        // معالجة
        if (item.event === 'message.created') {
          await this.processMessage(item.data, item.messageId);
        }

      } catch (error) {
        console.error('❌ خطأ في المعالجة:', error.message);
      } finally {
        this.processing = false;
      }
    }, 500); // كل 500ms
  }

  /**
   * 🧠 معالجة الرسالة
   */
  async processMessage(data, messageId) {
    try {
      const {
        from,
        body,
        fromMe,
        sessionId,
        remoteJid
      } = data;

      // تخطي رسائلنا
      if (fromMe) {
        console.log('⏭️ رسالة منا');
        return;
      }

      // تخطي رسائل فارغة
      if (!body?.trim()) {
        console.log('⏭️ رسالة فارغة');
        return;
      }

      // استخراج الرقم
      const phone = (from || remoteJid || '').replace(/[^0-9]/g, '');
      if (!phone) {
        console.log('❌ لا يوجد رقم');
        return;
      }

      console.log(`\n════════════════════════════════════`);
      console.log(`📨 معالجة رسالة`);
      console.log(`   ID: ${messageId}`);
      console.log(`   من: ${phone}`);
      console.log(`   النص: ${body.substring(0, 50)}`);
      console.log(`════════════════════════════════════`);

      // جلب البوابة
      const gateway = await this.getGateway(sessionId);
      if (!gateway) {
        console.error('❌ لم نجد البوابة');
        return;
      }

      // 💾 حفظ الرسالة
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
        sent_at: new Date(data.timestamp ? data.timestamp * 1000 : Date.now()).toISOString()
      });

      console.log(`✅ حفظت: ${savedMsg.id}`);

      // 🧠 معالجة AI
      console.log('🧠 معالجة بـ AI...');
      const aiResult = await superGeniusAI.processMessage(body, phone);

      // 📝 تحديث الحالة
      await base44.entities.WhatsAppMessage.update(savedMsg.id, {
        processed_by_ai: true,
        ai_processing_result: aiResult.response
      });

      console.log('✅ تحديثت الحالة');

      // تأخير صغير
      await new Promise(r => setTimeout(r, 500));

      // 📤 إرسال الرد
      console.log('📤 إرسال الرد...');
      await this.sendReply(
        phone,
        aiResult.response,
        gateway
      );

      console.log('════════════════════════════════════\n');

    } catch (error) {
      console.error('❌ خطأ في المعالجة:', error.message);
      console.error(error.stack);
    }
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
   * 📤 إرسال الرد
   */
  async sendReply(phone, text, gateway) {
    try {
      const client = new WAHAClient(
        gateway.waha_server_url,
        gateway.waha_api_key
      );

      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;

      console.log(`   📞 إرسال إلى: ${formattedPhone}`);

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
    }
  }

  /**
   * إحصائيات
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      dedup: deduplicationService.getStats()
    };
  }
}

export const webhookHandler = new WebhookHandler();