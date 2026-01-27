import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';
import { messageTracker } from './MessageTracker';
import { messageQueue } from './MessageQueue';

export class WAHAMessagePoller {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processedMessages = new Set();
    this.lastPollTime = {};
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ سحب الرسائل يعمل بالفعل');
      return;
    }
    
    console.log('🚀 بدء سحب الرسائل من WAHA...');
    this.isRunning = true;

    // سحب فوري أول مرة
    await this.pollMessages();

    // سحب الرسائل كل 15 ثانية (لتجنب rate limit)
    this.intervalId = setInterval(() => {
      this.pollMessages();
    }, 15000);

    console.log('✅ نظام السحب يعمل - سيتحقق من الرسائل كل 15 ثانية');
  }

  async pollMessages() {
    try {
      // جلب جميع البوابات المتصلة
      const gateways = await base44.entities.WhatsAppGateway.filter({
        is_active: true
      });

      for (const gateway of gateways) {
        // تحقق من حالة الجلسة أولاً
        if (gateway.status !== 'connected') {
          console.log(`⏭️ تخطي ${gateway.name} - الحالة: ${gateway.status}`);
          continue;
        }
        
        await this.pollGatewayMessages(gateway);
      }
    } catch (error) {
      console.error('❌ خطأ في سحب الرسائل:', error);
    }
  }

  async pollGatewayMessages(gateway) {
    try {
      // تجنب السحب المتكرر
      const now = Date.now();
      const lastPoll = this.lastPollTime[gateway.id] || 0;
      if (now - lastPoll < 12000) {
        return;
      }
      this.lastPollTime[gateway.id] = now;
      
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      
      console.log(`🔍 سحب رسائل من: ${gateway.name}`);
      
      // الطريقة الصحيحة: الحصول على المحادثات أولاً ثم الرسائل
      const allMessages = await client.getAllMessages('default', 20);
      
      if (!allMessages || allMessages.length === 0) {
        return;
      }

      console.log(`📬 وجدنا ${allMessages.length} رسالة في ${gateway.name}`);

      // معالجة الرسائل
      let newMessagesCount = 0;

      console.log(`\n📊 [POLLER] بدء معالجة ${allMessages.length} رسالة من WAHA`);
      
      for (const msg of allMessages) {
        try {
          console.log(`\n🔍 [MSG] فحص رسالة جديدة:`);
          console.log(`   ID: ${msg.id}`);
          console.log(`   From: ${msg.from}`);
          console.log(`   Body: ${msg.body?.substring(0, 30)}...`);
          console.log(`   FromMe: ${msg.fromMe}`);
          
          // تجاهل الرسائل المرسلة منا
          if (msg.fromMe) {
            console.log(`   ⏭️ تخطي - رسالة منا`);
            continue;
          }

          // تجاهل الرسائل الفارغة
          if (!msg.body && !msg.hasMedia) {
            console.log(`   ⏭️ تخطي - رسالة فارغة`);
            continue;
          }

          const messageId = msg.id;
          console.log(`   ✅ رسالة صالحة - ID: ${messageId}`);
          
          // ✅ استخراج الرقم الصحيح - دعم الأرقام الدولية
          const rawFrom = msg.from || '';
          const displayName = msg.notifyName || msg.pushName || msg.chat_name || '';
          console.log('📱 الرقم الخام من WAHA:', rawFrom);
          console.log('📝 الاسم المعروض:', displayName);

          // ✅ تنظيف وتوحيد صيغة الرقم
          let fullPhoneId;
          let phoneNumber;

          if (rawFrom.includes('@lid')) {
            // رقم WhatsApp Business - استخرج الرقم الحقيقي من displayName
            const cleanNumber = displayName.replace(/[^\d]/g, ''); // أرقام فقط
            if (cleanNumber && cleanNumber.length > 8) {
              phoneNumber = cleanNumber;
              fullPhoneId = `${cleanNumber}@c.us`;
              console.log('🔄 استخراج من displayName:', displayName, '→', fullPhoneId);
            } else {
              // fallback: استخدم الرقم من @lid
              phoneNumber = rawFrom.split('@')[0];
              fullPhoneId = `${phoneNumber}@c.us`;
              console.log('⚠️ fallback @lid:', rawFrom, '→', fullPhoneId);
            }
          } else if (rawFrom.includes('@c.us') || rawFrom.includes('@s.whatsapp.net')) {
            // صيغة عادية
            fullPhoneId = rawFrom;
            phoneNumber = rawFrom.replace('@c.us', '').replace('@s.whatsapp.net', '');
          } else {
            // رقم بدون بادئة
            phoneNumber = rawFrom;
            fullPhoneId = `${rawFrom}@c.us`;
          }

          console.log('✅ الرقم النهائي:', fullPhoneId);

          if (!phoneNumber || !fullPhoneId) {
            console.log('❌ رقم غير صالح، تخطي');
            continue;
          }

          console.log(`\n🔎 [CHECK] فحص التكرار...`);

          // 🛑 فحص 1: MessageTracker (الذاكرة)
          if (messageTracker.isDuplicate(messageId, phoneNumber, msg.body)) {
            console.log(`   ❌ [TRACKER] موجود في الذاكرة - تخطي`);
            continue;
          }
          console.log(`   ✅ [TRACKER] غير موجود في الذاكرة`);

          // 🛑 فحص 2: قاعدة البيانات
          console.log(`   🔍 [DB] البحث في قاعدة البيانات...`);
          console.log(`      - message_id: ${messageId}`);
          console.log(`      - from_number: ${fullPhoneId}`);

          const existingMsg = await base44.entities.WhatsAppMessage.filter({
            message_id: messageId
          }, '', 1);

          if (existingMsg && existingMsg.length > 0) {
            console.log(`   ❌ [DB] الرسالة موجودة مسبقاً (ID: ${existingMsg[0].id})`);
            console.log(`      - تم حفظها في: ${existingMsg[0].created_date}`);
            console.log(`      - معالجة AI: ${existingMsg[0].processed_by_ai}`);
            messageTracker.track(messageId, phoneNumber, msg.body);
            continue;
          }
          console.log(`   ✅ [DB] رسالة جديدة - سيتم حفظها`);

          // ✅ تسجيل في الذاكرة
          messageTracker.track(messageId, phoneNumber, msg.body);

          // 💾 حفظ في قاعدة البيانات
          console.log(`\n💾 [SAVE] حفظ رسالة جديدة...`);
          console.log(`   - message_id: ${messageId}`);
          console.log(`   - from: ${phoneNumber}`);
          console.log(`   - fullPhoneId: ${fullPhoneId}`);
          console.log(`   - content: ${msg.body?.substring(0, 50)}...`);

          const savedMsg = await base44.entities.WhatsAppMessage.create({
            message_id: messageId,
            direction: 'incoming',
            from_number: fullPhoneId,
            to_number: gateway.phone_number || '',
            from_name: msg.notifyName || msg.pushName || msg.chat_name || '',
            message_type: msg.hasMedia ? 'media' : 'text',
            content: msg.body || '[media]',
            gateway_id: gateway.id,
            status: 'received',
            processed_by_ai: false,
            sent_at: new Date(msg.timestamp * 1000 || Date.now()).toISOString()
          });

          console.log(`   ✅ تم الحفظ - DB ID: ${savedMsg.id}`);

          // 🔵 CRITICAL: وضع علامة مقروء على WAHA (مرة واحدة فقط)
          console.log(`\n🔵 [WAHA-ACK] وضع علامة مقروء على WAHA...`);
          try {
            const wahaClient = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
            await wahaClient.markMessagesAsRead('default', fullPhoneId, [messageId]);
            console.log(`   ✅ تم وضع العلامة على WAHA - الرسالة محذوفة من الخادم`);
          } catch (ackError) {
            console.error(`   ❌ فشل وضع العلامة على WAHA:`, ackError.message);
            // نكمل المعالجة حتى لو فشل ACK
          }

          // ✅ إضافة للطابور
          console.log(`\n📥 [QUEUE] إضافة للطابور...`);
          messageQueue.enqueue(savedMsg);
          console.log(`   ✅ تمت الإضافة للطابور`);

          newMessagesCount++;
          console.log(`\n✅ [SUCCESS] رسالة جديدة معالجة بنجاح (#${newMessagesCount})`);
          console.log(`════════════════════════════════════\n`);

        } catch (error) {
          console.error(`\n❌ [ERROR] خطأ في معالجة رسالة:`);
          console.error(`   - Message ID: ${msg.id}`);
          console.error(`   - Error: ${error.message}`);
          console.error(`   - Stack: ${error.stack}`);
          console.error(`════════════════════════════════════\n`);
          continue;
        }
      }
      
      console.log(`\n📊 [SUMMARY] نتائج الدورة:`);
      console.log(`   - إجمالي الرسائل من WAHA: ${allMessages.length}`);
      console.log(`   - رسائل جديدة محفوظة: ${newMessagesCount}`);
      console.log(`════════════════════════════════════\n`);
      
      if (newMessagesCount > 0) {
        console.log(`🎉 تم حفظ ${newMessagesCount} رسالة جديدة - سيتم الرد تلقائياً!`);
      }

      // تنظيف الذاكرة
      if (this.processedMessages.size > 1000) {
        const toDelete = Array.from(this.processedMessages).slice(0, 500);
        toDelete.forEach(id => this.processedMessages.delete(id));
      }

    } catch (error) {
      console.error('❌ خطأ في سحب رسائل البوابة', gateway.name, ':', error.message);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 إيقاف سحب الرسائل');
  }
}

export const messagePoller = new WAHAMessagePoller();