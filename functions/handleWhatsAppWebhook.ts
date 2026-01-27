/**
 * 🎯 WAHA Webhook Handler
 * HTTP 200 فوري + معالجة خلفية
 */

import { wahaSystem } from '@/components/ai/WAHACompleteSystem';

export default async function handleWhatsAppWebhook(request, response) {
  const startTime = Date.now();

  try {
    let payload;
    try {
      payload = typeof request.body === 'string' 
        ? JSON.parse(request.body) 
        : request.body;
    } catch {
      payload = {};
    }

    console.log('\n════════════════════════════════════════');
    console.log(`🔔 [WEBHOOK] ${payload.event || 'unknown'}`);
    console.log('════════════════════════════════════════');

    const result = await wahaSystem.handleWebhook(payload);

    const responseTime = Date.now() - startTime;
    console.log(`⚡ HTTP 200 في ${responseTime}ms\n`);

    return response.status(200).json({ ...result, responseTime });

  } catch (error) {
    console.error('❌ [WEBHOOK] خطأ:', error.message);
    return response.status(200).json({ status: 'ok', error: error.message });
  }
}

export const config = {
  runtime: 'nodejs',
  memory: 256,
  timeoutSeconds: 10,
};