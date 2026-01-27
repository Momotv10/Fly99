import { useEffect } from 'react';
import { simplePoller } from './SimpleMessagePoller';
import { simpleProcessor } from './SimpleProcessor';

export default function NewAIStarter() {
  useEffect(() => {
    const start = async () => {
      try {
        console.log('\n═══════════════════════════════════');
        console.log('🚀 تشغيل النظام الجديد');
        console.log('═══════════════════════════════════\n');

        // 1. بدء السحب من WAHA
        simplePoller.start();

        // 2. بدء المعالجة
        simpleProcessor.start();

        console.log('\n✅ النظام جاهز 100%');
        console.log('🎯 سيتم معالجة الرسائل تلقائياً');
        console.log('═══════════════════════════════════\n');

      } catch (error) {
        console.error('❌ خطأ في التشغيل:', error);
        setTimeout(start, 5000);
      }
    };

    start();

    return () => {
      simplePoller.stop();
    };
  }, []);

  return null;
}