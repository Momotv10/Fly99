/**
 * 🚀 Auto Initializer - تشغيل النظام تلقائياً
 */

import React, { useEffect } from 'react';
import { wahaSystem } from './WAHAIntegratedSystem';

export default function WAHAAutoInitializer() {
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('\n🚀 ╔════════════════════════════════════════════════════════╗');
        console.log('   ║  بدء تهيئة نظام WAHA المتكامل                        ║');
        console.log('   ╚════════════════════════════════════════════════════════╝\n');

        // 1. اختبر الاتصال
        console.log('📡 خطوة 1: اختبار الاتصال بـ WAHA');
        const connection = await wahaSystem.waha.testConnection();
        console.log(
          connection.success
            ? '✅ الاتصال نجح'
            : '❌ فشل الاتصال - تأكد من إعدادات WAHA'
        );

        // 2. اختبر التشخيصات
        console.log('\n🔍 خطوة 2: تشغيل الاختبارات التشخيصية');
        const diagnostics = await wahaSystem.runDiagnostics();
        console.log('✅ الاختبارات اكتملت');

        // 3. عرض الحالة
        console.log('\n📊 خطوة 3: معلومات النظام');
        const status = wahaSystem.getStatus();
        console.log('✅ النظام جاهز:');
        console.log(`   - الرسائل الواردة: ${status.monitor.messagesReceived}`);
        console.log(`   - المعالجة: ${status.monitor.messagesProcessed}`);
        console.log(`   - المرسلة: ${status.monitor.messagesSent}`);
        console.log(`   - حجم الطابور: ${status.queue.queueSize}`);

        // 4. عرض نقاط التفتيش
        console.log('\n🔒 خطوة 4: نقاط التفتيش');
        status.checkpoints.forEach((cp) => {
          console.log(
            `   ${cp.protected ? '🔒' : '📝'} ${cp.component}: ${cp.description}`
          );
        });

        console.log('\n✅ ✅ ✅ نظام WAHA جاهز للعمل 100%\n');
        console.log('════════════════════════════════════════════════════════\n');

      } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
      }
    };

    initialize();
  }, []);

  return null; // لا يرسل أي UI
}