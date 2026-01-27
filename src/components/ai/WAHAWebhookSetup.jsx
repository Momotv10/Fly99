import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';

export class WAHAWebhookSetup {
  
  static async setupWebhooksForAllGateways() {
    console.log('🔧 إعداد webhooks لجميع البوابات...');
    
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter({
        is_active: true
      });

      for (const gateway of gateways) {
        await this.setupWebhookForGateway(gateway);
      }

      console.log('✅ تم إعداد جميع البوابات');
      return true;
    } catch (error) {
      console.error('❌ فشل الإعداد:', error);
      return false;
    }
  }

  static async setupWebhookForGateway(gateway) {
    try {
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);
      
      // الحصول على URL الخاص بتطبيقنا
      const appUrl = window.location.origin;
      const webhookUrl = `${appUrl}/api/waha-webhook`;
      
      console.log('📡 Webhook URL:', webhookUrl);

      // التحقق من الجلسة الحالية
      let existingSession = null;
      try {
        existingSession = await client.getSession('default');
        console.log('📋 جلسة موجودة:', existingSession.status);
      } catch (e) {
        console.log('📋 لا توجد جلسة - سيتم إنشاء واحدة جديدة');
      }

      // إعداد الـ webhook configuration
      const webhookConfig = {
        url: webhookUrl,
        events: ['message', 'message.any'],
        headers: {
          'X-Gateway-Id': gateway.id
        }
      };

      // إذا كانت الجلسة موجودة ومتصلة، نحدث الـ webhook فقط
      if (existingSession && existingSession.status === 'WORKING') {
        console.log('✅ الجلسة متصلة - سنحدث webhook فقط');
        
        try {
          // تحديث config الجلسة لإضافة webhook
          await client.request('/api/sessions/default', {
            method: 'PATCH',
            body: JSON.stringify({
              config: {
                webhooks: [webhookConfig]
              }
            })
          });
          console.log('✅ تم تحديث webhook للجلسة الموجودة');
        } catch (error) {
          console.log('⚠️ فشل تحديث webhook، سنحاول إعادة إنشاء الجلسة');
          // إذا فشل التحديث، لا نفعل شيء - الجلسة ستبقى تعمل
        }
      } else {
        // إنشاء جلسة جديدة فقط إذا لم تكن موجودة أو فاشلة
        console.log('🔄 إنشاء جلسة جديدة مع webhook...');
        
        // حذف الجلسة الفاشلة فقط
        if (existingSession && existingSession.status === 'FAILED') {
          try {
            await client.deleteSession('default');
            await new Promise(r => setTimeout(r, 3000)); // انتظار 3 ثواني
          } catch (e) {
            console.log('⚠️ تجاهل خطأ الحذف');
          }
        }

        // إنشاء جلسة جديدة
        const sessionConfig = {
          name: 'default',
          config: {
            webhooks: [webhookConfig]
          }
        };

        await client.request('/api/sessions', {
          method: 'POST',
          body: JSON.stringify(sessionConfig)
        });
        
        console.log('✅ تم إنشاء جلسة جديدة');
      }

      // حفظ webhook URL في البوابة
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        webhook_url: webhookUrl
      });

      console.log('✅ Webhook configured for gateway:', gateway.name);
      return true;
      
    } catch (error) {
      console.error('❌ فشل إعداد webhook للبوابة', gateway.name, ':', error);
      return false;
    }
  }
}