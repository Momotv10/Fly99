/**
 * 📋 مدير إعداد Webhook - تسجيل webhook مع Waha
 */

import { base44 } from '@/api/base44Client';
import { WAHAClient } from '@/components/whatsapp/WAHAClientClass';

export class WebhookSetupManager {
  /**
   * الحصول على Webhook URL
   */
  getWebhookUrl() {
    // استخدم URL التطبيق الحالي
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/whatsapp/webhook`;
  }

  /**
   * إعداد Webhook لبوابة واحدة
   */
  async setupWebhookForGateway(gateway) {
    try {
      console.log(`🔗 إعداد Webhook للبوابة: ${gateway.name}`);

      const client = new WAHAClient(
        gateway.waha_server_url,
        gateway.waha_api_key
      );

      const webhookUrl = this.getWebhookUrl();

      // تسجيل Webhook مع Waha
      const result = await client.request('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          events: ['message.created', 'message.received', 'status']
        })
      });

      console.log('✅ تم تسجيل Webhook:', result);

      // تحديث البوابة بـ webhook URL
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        webhook_url: webhookUrl,
        status: 'connected'
      });

      return { success: true, url: webhookUrl };

    } catch (error) {
      console.error('❌ خطأ في إعداد Webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إعداد جميع البوابات
   */
  async setupAllWebhooks() {
    try {
      console.log('🔗 إعداد Webhooks لجميع البوابات...');

      const gateways = await base44.entities.WhatsAppGateway.filter({
        is_active: true
      });

      const results = [];

      for (const gateway of gateways || []) {
        const result = await this.setupWebhookForGateway(gateway);
        results.push({
          gateway: gateway.name,
          ...result
        });
      }

      console.log('✅ اكتمل إعداد Webhooks');
      return results;

    } catch (error) {
      console.error('❌ خطأ:', error);
      return [];
    }
  }

  /**
   * اختبار Webhook
   */
  async testWebhook() {
    try {
      const webhookUrl = this.getWebhookUrl();

      console.log('🧪 اختبار Webhook...');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test',
          data: { test: true, timestamp: Date.now() }
        })
      });

      if (response.ok) {
        console.log('✅ الـ Webhook يعمل');
        return true;
      } else {
        console.error('❌ الـ Webhook لا يعمل');
        return false;
      }

    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error);
      return false;
    }
  }
}

export const webhookSetupManager = new WebhookSetupManager();