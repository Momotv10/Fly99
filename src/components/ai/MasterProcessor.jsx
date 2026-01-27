import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { superGeniusAI } from './SuperGeniusAI';
import { messageQueue } from './MessageQueue';

/**
 * 🎯 المعالج الرئيسي المحسّن
 * - رد واحد فقط لكل رسالة (قاعدة ذهبية)
 * - فهم السياق الكامل
 * - سرعة < 5 ثواني
 * - أمان تام
 */
class MasterProcessor {
  constructor() {
    this.ai = superGeniusAI;
    this.activeProcessing = new Map();
    this.recentlyProcessed = new Map();
    this.responseQueue = new Map(); // طابور الردود
    
    // بدء معالج الطابور
    this.startQueueProcessor();
  }

  /**
   * معالج الطابور - يعمل باستمرار
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (messageQueue.isEmpty()) return;
      
      const message = messageQueue.dequeue();
      if (!message) return;
      
      try {
        await this.processIncomingMessage(message);
      } finally {
        messageQueue.release(message.from_number);
      }
    }, 1000); // كل ثانية
  }

  /**
   * معالجة رسالة واردة - نقطة الدخول الوحيدة
   */
  async processIncomingMessage(msg) {
    const msgId = msg.id;
    const phone = msg.from_number;
    const text = msg.content?.trim();

    // 🛑 فحص 1: رسالة فارغة؟
    if (!text || text === '') {
      console.log('⏭️ رسالة فارغة - تخطي');
      return;
    }

    // 🛑 فحص 2: معالجة مسبقة؟
    if (msg.processed_by_ai === true) {
      console.log('⏭️ تمت معالجتها مسبقاً - تخطي');
      return;
    }
    
    // 🛑 فحص 3: قيد المعالجة الآن؟
    if (this.activeProcessing.has(msgId)) {
      console.log('🔒 قيد المعالجة الآن - تخطي');
      return;
    }
    
    // 🛑 فحص 4: عولجت مؤخراً؟
    const recentKey = `recent_${msgId}`;
    if (this.recentlyProcessed.has(recentKey)) {
      console.log('⏭️ عولجت خلال دقيقتين - تخطي');
      return;
    }

    // ✅ فحص القائمة السوداء
    const isBlacklisted = await this.checkBlacklist(phone);
    if (isBlacklisted) {
      console.log('🚫 عميل محظور:', phone);
      await base44.entities.WhatsAppMessage.update(msgId, {
        processed_by_ai: true
      });
      return;
    }

    // ✅ Lock: منع معالجة موازية لنفس العميل
    if (messageQueue.isProcessing(phone)) {
      console.log('⏭️ العميل قيد المعالجة - سيتم معالجة الرسالة لاحقاً');
      return;
    }

    // منع المعالجة الموازية لنفس الرسالة
    if (this.activeProcessing.has(msgId)) {
      console.log('⏭️ قيد المعالجة');
      return;
    }

    console.log('\n🎯 ═══════════════════════════════════');
    console.log('📨 [PROCESS] بدء معالجة رسالة');
    console.log(`   - DB ID: ${msgId}`);
    console.log(`   - من: ${phone}`);
    console.log(`   - النص: ${text}`);
    console.log(`   - معالجة سابقة: ${msg.processed_by_ai}`);
    console.log('═══════════════════════════════════\n');

    // ✅ تسجيل المعالجة في كلا النظامين
    this.activeProcessing.set(msgId, Date.now());
    this.recentlyProcessed.set(recentKey, Date.now());

    const startTime = Date.now();
    
    try {
      // تحديث فوري في قاعدة البيانات
      await base44.entities.WhatsAppMessage.update(msgId, {
        processed_by_ai: true
      });

      // ✅ معالجة ذكية خارقة
      console.log('🧠 المعالجة بالذكاء الخارق...');
      const aiResult = await this.ai.processMessage(text, phone);
      
      // ⏱️ تأخير 500ms قبل الإرسال (منع السباق)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ✅ إرسال رد واحد فقط
      console.log('📤 إرسال الرد...');
      await this.sendResponse(phone, aiResult.response, msg.gateway_id);
      
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n✅ ═══════════════════════════════════');
      console.log(`تمت المعالجة بنجاح في ${processingTime} ثانية`);
      console.log('═══════════════════════════════════\n');

    } catch (error) {
      console.error('\n❌ خطأ:', error.message);
      
      // رد خطأ للعميل
      try {
        await this.sendResponse(
          phone,
          'معذرة، حصل خطأ تقني. المرجو إعادة الرسالة.',
          msg.gateway_id
        );
      } catch (e) {
        console.error('فشل إرسال رسالة الخطأ:', e);
      }
      
    } finally {
      // تنظيف بعد 30 ثانية
      setTimeout(() => {
        this.activeProcessing.delete(msgId);
      }, 30000);
    }
  }



  /**
   * إرسال رد واحد فقط - بدون تكرار
   */
  async sendResponse(phone, text, gatewayId) {
    try {
      // 🔒 قفل مطلق: رد واحد فقط لكل عميل كل 5 ثواني
      const customerLock = `lock_${phone}`;
      const lastResponse = this.responseQueue.get(customerLock);
      
      if (lastResponse && (Date.now() - lastResponse) < 5000) {
        console.log('🔒 القفل نشط - تم إلغاء الرد (تبريد 5 ثواني)');
        return;
      }

      // ✅ فحص ثانوي: هل أرسلنا نفس الرد بالضبط؟
      const contentKey = `${phone}_${text.substring(0, 50)}`;
      const lastSameContent = this.responseQueue.get(contentKey);
      
      if (lastSameContent && (Date.now() - lastSameContent) < 30000) {
        console.log('⏭️ تم إلغاء رد مكرر (نفس المحتوى)');
        return;
      }

      // ✅ تسجيل القفل
      this.responseQueue.set(customerLock, Date.now());
      this.responseQueue.set(contentKey, Date.now());

      // جلب البوابة
      const gateways = gatewayId
        ? await base44.entities.WhatsAppGateway.filter({ id: gatewayId })
        : await base44.entities.WhatsAppGateway.filter({
            type: 'customers',
            status: 'connected',
            is_active: true
          }, '-created_date', 1);

      if (!gateways || gateways.length === 0) {
        console.error('❌ لا توجد بوابة');
        return;
      }

      const gateway = gateways[0];
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);

      // ✅ سجل مفصل للتتبع
      const timestamp = new Date().toISOString();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 [${timestamp}] إرسال رد`);
      console.log(`   🚪 البوابة: ${gateway.name}`);
      console.log(`   📱 العميل: ${phone}`);
      console.log(`   📝 الطول: ${text.length} حرف`);
      console.log(`   🔒 قفل التبريد: 5 ثواني`);
      
      // التأكد من أن الرقم يحتوي على @c.us
      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;
      console.log('📞 الرقم المنسق:', formattedPhone);
      
      await client.sendText('default', formattedPhone, text);
      
      console.log('✅ ━━ تم الإرسال بنجاح ━━');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // حفظ في قاعدة البيانات
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: gateway.phone_number || 'system',
        to_number: formattedPhone, // ✅ حفظ الرقم المنسق
        message_type: 'text',
        content: text,
        gateway_id: gateway.id,
        status: 'sent',
        processed_by_ai: true,
        sent_at: new Date().toISOString()
      });

      // تنظيف تلقائي (سيتم في cleanup الدوري)

    } catch (error) {
      console.error('❌ فشل الإرسال:', error.message);
      throw error;
    }
  }



  /**
   * فحص القائمة السوداء
   */
  async checkBlacklist(phone) {
    try {
      const blacklisted = await base44.entities.BlacklistedCustomer.filter({
        phone_number: phone,
        is_active: true
      }, '-created_date', 1);

      return blacklisted.length > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * تنظيف دوري
   */
  cleanup() {
    const now = Date.now();
    
    // تنظيف المعالجات النشطة
    for (const [key, time] of this.activeProcessing.entries()) {
      if (now - time > 60000) {
        this.activeProcessing.delete(key);
      }
    }

    // تنظيف المعالجات الأخيرة
    for (const [key, time] of this.recentlyProcessed.entries()) {
      if (now - time > 120000) {
        this.recentlyProcessed.delete(key);
      }
    }

    // تنظيف طابور الردود
    for (const [key, time] of this.responseQueue.entries()) {
      if (now - time > 60000) {
        this.responseQueue.delete(key);
      }
    }
  }
}

export const masterProcessor = new MasterProcessor();

// تنظيف دوري
setInterval(() => {
  masterProcessor.cleanup();
}, 60000); // كل دقيقة