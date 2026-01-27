import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { masterProcessor } from './MasterProcessor';
import { messagePoller } from './WAHAMessagePoller';

export default function AIAutoStarter() {
  useEffect(() => {
    let unsubscribe = null;

    const startEngine = async () => {
      try {
        console.log('\n🎯 ═════════════════════════════════════');
        console.log('🚀 تشغيل نظام الذكاء الاصطناعي المتقدم');
        console.log('═════════════════════════════════════\n');
        
        // 1. سحب الرسائل من WAHA
        await messagePoller.start();
        
        // 2. الاستماع للرسائل (للمراقبة فقط - المعالجة عبر الطابور)
        unsubscribe = base44.entities.WhatsAppMessage.subscribe(async (event) => {
          if (event.type === 'create' && 
              event.data.direction === 'incoming' && 
              !event.data.processed_by_ai) {
            
            console.log('🔔 [SUBSCRIPTION] رسالة جديدة مكتشفة:', event.data.from_number);
            console.log('   ↳ الطابور سيعالجها تلقائياً - لا حاجة لمعالجة مباشرة');
            // لا نستدعي المعالج مباشرة - الطابور سيتولى ذلك
          }
        });
        
        console.log('✅ المعالج النشط');
        console.log('✅ السحب يعمل');
        console.log('\n═════════════════════════════════════');
        console.log('🎉 النظام جاهز 100%');
        console.log('═════════════════════════════════════\n');
        
      } catch (error) {
        console.error('❌ خطأ في التشغيل:', error);
        setTimeout(startEngine, 5000);
      }
    };

    startEngine();

    return () => {
      messagePoller.stop();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return null;
}