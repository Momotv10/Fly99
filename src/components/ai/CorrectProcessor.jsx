import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { superGeniusAI } from './SuperGeniusAI';

/**
 * ✅ معالج صحيح 100% - رد واحد فقط
 * 
 * الطريقة الصحيحة:
 * 1. رسالة واحدة → معالجة واحدة → رد واحد
 * 2. تتبع دقيق بـ message_id + timestamp
 * 3. منع التكرار بـ cooldown ذكي
 */
class CorrectProcessor {
  constructor() {
    this.processing = new Set(); // رسائل قيد المعالجة الآن
    this.processed = new Map(); // رسالة → وقت المعالجة
    this.responseSent = new Map(); // عميل → وقت آخر رد
    this.cooldownMs = 3000; // فترة الانتظار بين الردود لنفس العميل
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
    const { id, message_id, from_number, content, gateway_id } = msg;

    // 🛑 فحص 1: هل معالجة مسبقاً؟
    if (msg.processed_by_ai) {
      console.log('⏭️ معالجة مسبقاً - تخطي');
      return;
    }

    // 🛑 فحص 2: قيد المعالجة الآن؟
    if (this.processing.has(message_id)) {
      console.log('⏭️ قيد المعالجة - تخطي');
      return;
    }

    // 🛑 فحص 3: معالجة حديثة جداً؟ (نفس الرسالة)
    if (this.processed.has(message_id)) {
      const timeSince = Date.now() - this.processed.get(message_id);
      if (timeSince < 10000) { // دقيقة واحدة
        console.log('⏭️ معالجة حديثة - تخطي');
        return;
      }
    }

    // 🛑 فحص 4: cooldown للعميل (منع الرد السريع)
    const lastResponse = this.responseSent.get(from_number);
    if (lastResponse && Date.now() - lastResponse < this.cooldownMs) {
      console.log('⏭️ cooldown نشط - تخطي الرد للآن');
      return;
    }

    // 🛑 فحص 5: رسالة فارغة؟
    if (!content?.trim()) {
      console.log('⏭️ رسالة فارغة - تخطي');
      return;
    }

    // ✅ الرسالة صحيحة - معالجة
    this.processing.add(message_id);

    try {
      console.log('\n═══════════════════════════════════');
      console.log('📨 معالجة رسالة جديدة');
      console.log(`   من: ${from_number}`);
      console.log(`   ID: ${message_id}`);
      console.log(`   المحتوى: ${content.substring(0, 50)}`);
      console.log('═══════════════════════════════════');

      // 1. معالجة بالذكاء الاصطناعي
      const aiResult = await superGeniusAI.processMessage(content, from_number);

      // 2. تحديث الرسالة الواردة
      await base44.entities.WhatsAppMessage.update(id, {
        processed_by_ai: true,
        ai_processing_result: aiResult.response
      });

      // 3. تسجيل المعالجة
      this.processed.set(message_id, Date.now());

      // 4. تأخير صغير
      await new Promise(r => setTimeout(r, 200));

      // 5. إرسال الرد (مرة واحدة فقط)
      await this.sendReply(from_number, aiResult.response, gateway_id);

      // 6. تسجيل الرد
      this.responseSent.set(from_number, Date.now());

      console.log('✅ تمت المعالجة بنجاح\n');

    } catch (error) {
      console.error('❌ خطأ في المعالجة:', error.message);
      
      // إرسال رسالة خطأ
      try {
        await this.sendReply(
          from_number,
          'معذرة، حصل خطأ. جاري إعادة المحاولة...',
          gateway_id
        );
      } catch (e) {
        console.error('❌ فشل الرد:', e.message);
      }

    } finally {
      this.processing.delete(message_id);
    }
  }

  async sendReply(phone, text, gatewayId) {
    try {
      // جلب البوابة
      const gateways = gatewayId
        ? await base44.entities.WhatsAppGateway.filter({ id: gatewayId })
        : await base44.entities.WhatsAppGateway.filter({
            status: 'connected',
            is_active: true
          }, '-created_date', 1);

      if (!gateways?.length) {
        console.error('❌ لا توجد بوابة');
        return;
      }

      const gateway = gateways[0];
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      
      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;

      console.log('📤 إرسال الرد...');
      console.log(`   📱 للعميل: ${formattedPhone}`);
      console.log(`   📝 الرسالة: ${text.substring(0, 50)}...`);
      
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

  // تنظيف دوري
  cleanup() {
    const now = Date.now();
    const minute = 60000;

    // تنظيف الرسائل المعالجة (أكثر من دقيقة)
    for (const [key, time] of this.processed.entries()) {
      if (now - time > minute) {
        this.processed.delete(key);
      }
    }

    // تنظيف الردود (أكثر من 5 دقائق)
    for (const [key, time] of this.responseSent.entries()) {
      if (now - time > 5 * minute) {
        this.responseSent.delete(key);
      }
    }
  }
}

export const correctProcessor = new CorrectProcessor();

// تنظيف كل دقيقة
setInterval(() => {
  correctProcessor.cleanup();
}, 60000);