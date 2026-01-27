import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * ✅ Webhook Initializer
 * 
 * تسجيل الـ webhook لدى WAHA
 */
export default function WebhookInitializer() {
  useEffect(() => {
    const setupWebhook = async () => {
      try {
        console.log('\n════════════════════════════════════');
        console.log('🔧 إعداد Webhook');
        console.log('════════════════════════════════════');

        // جلب البوابات
        const gateways = await base44.entities.WhatsAppGateway.filter({
          is_active: true
        });

        for (const gateway of gateways) {
          try {
            // تسجيل الـ webhook لدى WAHA
            console.log(`\n📡 تسجيل webhook للبوابة: ${gateway.name}`);

            // الـ webhook URL - يجب أن يكون public
            const webhookUrl = `${window.location.origin}/api/webhooks/waha`;

            console.log(`   Webhook URL: ${webhookUrl}`);

            // تحديث البوابة بـ webhook_url
            await base44.entities.WhatsAppGateway.update(gateway.id, {
              webhook_url: webhookUrl
            });

            console.log('   ✅ تم التسجيل');

          } catch (error) {
            console.error(`   ❌ خطأ: ${error.message}`);
          }
        }

        console.log('\n════════════════════════════════════');
        console.log('✅ الـ Webhook جاهز');
        console.log('════════════════════════════════════\n');

      } catch (error) {
        console.error('❌ خطأ في إعداد الـ Webhook:', error);
      }
    };

    setupWebhook();
  }, []);

  return null;
}