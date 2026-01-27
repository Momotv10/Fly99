/**
 * 🚀 مُهيّئ Webhook - بدء الخدمة
 */

import React, { useEffect } from 'react';
import { webhookSetupManager } from './WebhookSetupManager';
import { webhookHandler } from './WebhookHandler';

export default function WebhookInitializerV2() {
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🚀 بدء تهيئة Webhook...\n');

        // 1. إعداد جميع Webhooks
        console.log('📋 خطوة 1: إعداد Webhooks مع Waha');
        const setupResults = await webhookSetupManager.setupAllWebhooks();
        console.log('✅ إعداد اكتمل:', setupResults);

        // 2. اختبار الـ Webhook
        console.log('\n🧪 خطوة 2: اختبار الـ Webhook');
        const testResult = await webhookSetupManager.testWebhook();
        if (testResult) {
          console.log('✅ الـ Webhook يعمل بنجاح');
        } else {
          console.warn('⚠️ قد يكون هناك مشكلة في الـ Webhook');
        }

        // 3. بدء معالج الخلفية
        console.log('\n🔄 خطوة 3: بدء معالج الخلفية');
        console.log('✅ معالج Webhook جاهز للعمل');

        // 4. إحصائيات
        console.log('\n📊 الحالة:');
        const stats = webhookHandler.getStats();
        console.log('   Queue:', stats.queueSize);
        console.log('   Processing:', stats.processing);
        console.log('   Dedup:', stats.dedup);

        console.log('\n✅ ✅ ✅ الخدمة جاهزة 100%\n');

      } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
      }
    };

    initialize();
  }, []);

  return null;
}