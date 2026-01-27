/**
 * 🎯 Webhook Handler - Backend Function
 * نقطة استقبال WAHA الوحيدة
 * 
 * القاعدة الذهبية:
 * ✅ HTTP 200 في أقل من 500ms
 * ✅ تحقق من التكرار
 * ✅ أضف للطابور (بدون انتظار)
 */

import { wahaSystem } from '@/components/ai/WAHAIntegratedSystem';
import crypto from 'crypto';

export default async function webhookHandler(request, response) {
  const startTime = Date.now();

  try {
    // ✅ 1. التحقق من التوقيع الأمني (اختياري لكن موصى به)
    const signature = request.headers['x-waha-signature'];
    if (signature && !verifySignature(request.body, signature)) {
      console.warn('❌ توقيع غير صحيح');
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const payload = JSON.parse(request.body || '{}');
    console.log('\n════════════════════════════════════');
    console.log(`🔔 [WEBHOOK] استقبال من WAHA - ${payload.event}`);
    console.log('════════════════════════════════════');

    // ✅ معالجة الـ Webhook من خلال النظام المتكامل
    const result = await wahaSystem.handleWebhook(payload);

    // ✅ ارجع 200 OK فوراً
    response.status(200).json(result);

  } catch (error) {
    console.error('❌ خطأ في Webhook:', error);
    
    // حتى في الخطأ، ارجع 200 (لكي لا يعيد WAHA الإرسال)
    response.status(200).json({
      status: 'ok',
      error: error.message,
    });
  }
}

/**
 * التحقق من التوقيع الأمني
 */
function verifySignature(body, signature) {
  const secret = process.env.WEBHOOK_SECRET || 'your-secret-key';
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return hash === signature;
}

export const config = {
  runtime: 'nodejs',
  memory: 256,
  timeoutSeconds: 5,
};