import { useEffect } from 'react';
import { correctPoller } from './CorrectMessagePoller';
import { correctProcessor } from './CorrectProcessor';

export default function FinalAIStarter() {
  useEffect(() => {
    const start = async () => {
      try {
        console.log('\n═══════════════════════════════════');
        console.log('✅ تشغيل النظام الصحيح 100%');
        console.log('═══════════════════════════════════');
        console.log('');
        console.log('🔄 النظام:');
        console.log('  1️⃣ سحب الرسائل الجديدة من WAHA');
        console.log('  2️⃣ وضع علامة مقروء فوراً');
        console.log('  3️⃣ تتبع دقيق بـ timestamp');
        console.log('  4️⃣ رد واحد فقط لكل رسالة');
        console.log('  5️⃣ منع التكرار 100%');
        console.log('');
        console.log('═══════════════════════════════════\n');

        // بدء السحب
        correctPoller.start();

        // بدء المعالجة
        correctProcessor.start();

        console.log('✅ النظام جاهز - سيتم معالجة الرسائل تلقائياً\n');

      } catch (error) {
        console.error('❌ خطأ في التشغيل:', error);
        setTimeout(start, 5000);
      }
    };

    start();

    return () => {
      correctPoller.stop();
    };
  }, []);

  return null;
}