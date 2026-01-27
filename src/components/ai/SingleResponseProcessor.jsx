import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { UltraSmartAI } from './UltraSmartAI';

class SingleResponseProcessor {
  constructor() {
    this.ai = new UltraSmartAI();
    this.processing = new Map();
    this.lastProcessed = new Map(); // تتبع آخر معالجة لكل رقم
  }

  async processIncomingMessage(messageData) {
    const messageId = messageData.id;
    const phoneNumber = messageData.from_number;
    const content = messageData.content;

    console.log('\n═══════════════════════════════════════');
    console.log('📨 رسالة واردة');
    console.log('من:', phoneNumber);
    console.log('النص:', content);
    console.log('ID:', messageId);

    // ✅ فحص 1: هل قيد المعالجة حالياً؟
    if (this.processing.has(messageId)) {
      console.log('⏭️ SKIP: قيد المعالجة');
      console.log('═══════════════════════════════════════\n');
      return;
    }

    // ✅ فحص 2: هل تمت معالجتها في قاعدة البيانات؟
    if (messageData.processed_by_ai === true) {
      console.log('⏭️ SKIP: تمت المعالجة مسبقاً');
      console.log('═══════════════════════════════════════\n');
      return;
    }

    // ✅ فحص 3: هل نفس الرسالة من نفس الرقم خلال دقيقتين؟
    const lastKey = `${phoneNumber}_${content.trim()}`;
    const lastTime = this.lastProcessed.get(lastKey);
    if (lastTime && (Date.now() - lastTime) < 120000) {
      console.log('⏭️ SKIP: رسالة مكررة');
      console.log('═══════════════════════════════════════\n');
      return;
    }

    // ✅ تحديث فوري في قاعدة البيانات
    try {
      await base44.entities.WhatsAppMessage.update(messageId, {
        processed_by_ai: true,
        ai_processing_result: 'processing_started'
      });
    } catch (e) {
      console.log('⏭️ SKIP: فشل التحديث (معالجة موازية)');
      console.log('═══════════════════════════════════════\n');
      return;
    }

    // ✅ تسجيل المعالجة
    this.processing.set(messageId, Date.now());
    this.lastProcessed.set(lastKey, Date.now());

    console.log('✅ START: بدء المعالجة');
    console.log('═══════════════════════════════════════\n');

    try {
      // 1. التعرف على العميل
      const customer = await this.getCustomer(phoneNumber);
      
      // 2. جلب تاريخ المحادثة
      const history = await this.getConversationHistory(phoneNumber);
      
      // 3. معالجة ذكية
      const result = await this.ai.processMessage(content, customer, history);
      
      // 4. إرسال الرد (مرة واحدة فقط!)
      await this.sendSingleResponse(phoneNumber, result.response, messageData.gateway_id);
      
      // 5. حفظ المحادثة
      await this.saveConversation(phoneNumber, customer, content, result.response);
      
      // 6. تحديث نهائي
      await base44.entities.WhatsAppMessage.update(messageId, {
        processed_by_ai: true,
        ai_processing_result: 'completed'
      });

      console.log('\n═══════════════════════════════════════');
      console.log('✅ SUCCESS: تمت المعالجة والرد بنجاح');
      console.log('═══════════════════════════════════════\n');

    } catch (error) {
      console.error('\n❌ ERROR:', error.message);
      await this.sendSingleResponse(
        phoneNumber,
        'عذراً، حدث خطأ تقني. أرجو المحاولة مرة أخرى.',
        messageData.gateway_id
      );
    } finally {
      // حذف من المعالجة بعد دقيقة
      setTimeout(() => {
        this.processing.delete(messageId);
      }, 60000);
    }
  }

  async getCustomer(phoneNumber) {
    try {
      const customers = await base44.entities.Customer.filter({ 
        whatsapp: phoneNumber 
      }, '-created_date', 1);
      return customers[0] || null;
    } catch (e) {
      return null;
    }
  }

  async getConversationHistory(phoneNumber) {
    try {
      const convs = await base44.entities.AIConversation.filter({
        customer_phone: phoneNumber,
        status: 'active'
      }, '-created_date', 1);

      if (convs[0] && convs[0].conversation_log) {
        return convs[0].conversation_log.slice(-8); // آخر 8 رسائل
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async sendSingleResponse(toNumber, text, gatewayId) {
    try {
      console.log('📤 إرسال رد واحد فقط...');
      
      const gateways = gatewayId 
        ? await base44.entities.WhatsAppGateway.filter({ id: gatewayId })
        : await base44.entities.WhatsAppGateway.filter({
            type: 'customers',
            status: 'connected',
            is_active: true
          }, '-created_date', 1);

      const gateway = gateways[0];
      if (!gateway) {
        console.error('❌ لا توجد بوابة');
        return;
      }

      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      
      // فحص نهائي - هل أرسلنا نفس الرد مؤخراً؟
      const recentSent = await base44.entities.WhatsAppMessage.filter({
        direction: 'outgoing',
        to_number: toNumber,
        content: text,
        gateway_id: gateway.id
      }, '-created_date', 1);

      if (recentSent.length > 0) {
        const timeDiff = Date.now() - new Date(recentSent[0].created_date).getTime();
        if (timeDiff < 30000) {
          console.log('⏭️ رد مكرر - تم إلغاؤه');
          return;
        }
      }

      // إرسال واحد فقط
      await client.sendText('default', toNumber, text);
      
      console.log('✅ تم الإرسال');

      // حفظ في قاعدة البيانات
      await base44.entities.WhatsAppMessage.create({
        direction: 'outgoing',
        from_number: gateway.phone_number || 'system',
        to_number: toNumber,
        message_type: 'text',
        content: text,
        gateway_id: gateway.id,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ خطأ في الإرسال:', error.message);
      throw error;
    }
  }

  async saveConversation(phoneNumber, customer, customerMsg, aiResponse) {
    try {
      const convs = await base44.entities.AIConversation.filter({
        customer_phone: phoneNumber,
        status: 'active'
      }, '-created_date', 1);

      let conv = convs[0];

      if (!conv) {
        conv = await base44.entities.AIConversation.create({
          customer_phone: phoneNumber,
          customer_id: customer?.id || null,
          customer_name: customer?.full_name || 'عميل',
          conversation_log: [],
          status: 'active'
        });
      }

      const updatedLog = [
        ...(conv.conversation_log || []),
        {
          role: 'customer',
          message: customerMsg,
          timestamp: new Date().toISOString()
        },
        {
          role: 'ai',
          message: aiResponse,
          timestamp: new Date().toISOString()
        }
      ];

      await base44.entities.AIConversation.update(conv.id, {
        conversation_log: updatedLog
      });

    } catch (e) {
      console.error('خطأ في حفظ المحادثة:', e);
    }
  }
}

export const singleProcessor = new SingleResponseProcessor();