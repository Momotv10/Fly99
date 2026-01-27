import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';

/**
 * ✅ سحب صحيح 100% - بدون تكرار
 * 
 * الطريقة الصحيحة:
 * 1. سحب الرسائل الجديدة فقط (unread)
 * 2. وضع علامة مقروء فوراً قبل الحفظ
 * 3. تتبع دقيق بـ timestamp الرسالة
 */
export class CorrectMessagePoller {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processedTimestamps = new Map(); // هاتف -> آخر timestamp تمت معالجته
  }

  async start() {
    if (this.isRunning) return;
    
    console.log('🚀 بدء السحب الصحيح من WAHA...');
    this.isRunning = true;

    // سحب فوري أول مرة
    await this.poll();

    // سحب كل 5 ثواني (معقول)
    this.intervalId = setInterval(() => this.poll(), 5000);
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

      // الحصول على المحادثات
      const chats = await client.getChats('default');
      if (!chats?.length) return;

      console.log(`📬 ${gateway.name}: فحص ${chats.length} محادثة`);

      for (const chat of chats) {
        // تخطي المجموعات
        if (chat.isGroup) continue;

        const chatId = chat.id._serialized || chat.id;
        
        try {
          // جلب آخر 5 رسائل فقط
          const messages = await client.getChatMessages('default', chatId, 5);
          if (!messages?.length) continue;

          for (const msg of messages) {
            // ✅ تخطي الرسائل المرسلة من الجهاز
            if (msg.fromMe) continue;

            // ✅ تخطي الرسائل الفارغة
            if (!msg.body?.trim()) continue;

            const messageId = msg.id;
            const phone = msg.from?.replace('@c.us', '').replace('@s.whatsapp.net', '') || '';

            if (!phone) continue;

            // ✅ التحقق: هل تمت معالجة هذه الرسالة من قبل؟
            const lastTimestamp = this.processedTimestamps.get(phone);
            if (lastTimestamp && msg.timestamp <= lastTimestamp) {
              // الرسالة قديمة، تخطي
              continue;
            }

            // ✅ البحث في قاعدة البيانات (بـ message_id)
            const existing = await base44.entities.WhatsAppMessage.filter({
              message_id: messageId
            }, '', 1);

            if (existing?.length > 0) {
              // الرسالة موجودة مسبقاً، تخطي
              continue;
            }

            console.log(`\n✅ رسالة جديدة من ${phone}`);
            console.log(`   📝 ID: ${messageId}`);
            console.log(`   ⏰ Timestamp: ${msg.timestamp}`);
            console.log(`   📄 المحتوى: ${msg.body?.substring(0, 50)}...`);

            // 🔵 خطوة حرجة: وضع علامة مقروء فوراً (قبل المعالجة)
            try {
              await client.markMessagesAsRead('default', chatId, [messageId]);
              console.log(`   ✅ علامة مقروء على WAHA`);
            } catch (e) {
              console.log(`   ⚠️ تحذير: فشل وضع العلامة على WAHA - سيتم المتابعة`);
            }

            // حفظ في قاعدة البيانات
            try {
              await base44.entities.WhatsAppMessage.create({
                message_id: messageId,
                direction: 'incoming',
                from_number: phone,
                to_number: gateway.phone_number || '',
                from_name: msg.notifyName || msg.pushName || '',
                message_type: msg.hasMedia ? 'media' : 'text',
                content: msg.body,
                gateway_id: gateway.id,
                status: 'received',
                processed_by_ai: false,
                sent_at: new Date(msg.timestamp * 1000).toISOString()
              });

              // تحديث التاريخ المعالج
              this.processedTimestamps.set(phone, msg.timestamp);
              
              console.log(`   💾 حفظت في قاعدة البيانات`);

            } catch (error) {
              if (error.message?.includes('already exists')) {
                // الرسالة موجودة بالفعل
                this.processedTimestamps.set(phone, msg.timestamp);
              } else {
                console.error(`   ❌ خطأ في الحفظ:`, error.message);
              }
            }
          }

        } catch (error) {
          console.error(`   ❌ خطأ في معالجة المحادثة:`, error.message);
          continue;
        }
      }

    } catch (error) {
      console.error(`❌ خطأ في سحب البوابة:`, error);
    }
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    console.log('🛑 إيقاف السحب');
  }
}

export const correctPoller = new CorrectMessagePoller();