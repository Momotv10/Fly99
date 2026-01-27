import { base44 } from '@/api/base44Client';

export class WAHAListener {
  constructor(onMessageReceived) {
    this.onMessageReceived = onMessageReceived;
    this.isListening = false;
  }

  async startListening() {
    if (this.isListening) return;
    
    console.log('🎧 بدء الاستماع لرسائل WAHA...');
    this.isListening = true;

    // الاشتراك في الرسائل الواردة
    const unsubscribe = base44.entities.WhatsAppMessage.subscribe(async (event) => {
      if (event.type === 'create' && 
          event.data.direction === 'incoming' && 
          !event.data.processed_by_ai) {
        
        console.log('📨 رسالة واردة جديدة من:', event.data.from_number);
        
        if (this.onMessageReceived) {
          await this.onMessageReceived(event.data);
        }
      }
    });

    return unsubscribe;
  }

  stop() {
    this.isListening = false;
    console.log('🛑 إيقاف الاستماع');
  }
}