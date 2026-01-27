/**
 * 🎯 طابور المعالجة الذكي
 * 
 * القواعد:
 * 1. رسالة واحدة لكل عميل في الطابور
 * 2. معالجة تسلسلية (FIFO)
 * 3. Lock لكل عميل أثناء المعالجة
 * 4. تجميع الرسائل المتتالية
 */
export class MessageQueue {
  constructor() {
    // الطابور الرئيسي
    this.queue = [];
    
    // العملاء قيد المعالجة (Lock)
    this.processingCustomers = new Set();
    
    // آخر رسالة لكل عميل (للتجميع)
    this.lastMessageByCustomer = new Map();
    
    // الإحصائيات
    this.stats = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalAggregated: 0,
      currentQueueSize: 0
    };
  }

  /**
   * إضافة رسالة للطابور
   */
  enqueue(message) {
    const { from_number, content, id } = message;
    const now = Date.now();
    
    // فحص التجميع: هل هناك رسالة حديثة من نفس العميل؟
    const lastMsg = this.lastMessageByCustomer.get(from_number);
    if (lastMsg && (now - lastMsg.timestamp) < 3000) {
      // تجميع الرسائل (خلال 3 ثواني)
      const combined = {
        ...lastMsg.message,
        content: lastMsg.message.content + ' ' + content,
        aggregated: true
      };
      
      // استبدال الرسالة القديمة
      const index = this.queue.findIndex(m => m.id === lastMsg.message.id);
      if (index !== -1) {
        this.queue[index] = combined;
        this.stats.totalAggregated++;
        console.log('🔗 تم تجميع رسالة:', from_number);
        return;
      }
    }
    
    // إزالة الرسائل القديمة من نفس العميل
    this.queue = this.queue.filter(m => m.from_number !== from_number);
    
    // إضافة للطابور
    this.queue.push(message);
    this.lastMessageByCustomer.set(from_number, {
      message,
      timestamp: now
    });
    
    this.stats.totalEnqueued++;
    this.stats.currentQueueSize = this.queue.length;
    
    console.log(`📥 رسالة في الطابور: ${from_number} (حجم الطابور: ${this.queue.length})`);
  }

  /**
   * سحب رسالة للمعالجة
   */
  dequeue() {
    // ابحث عن أول رسالة لعميل غير قيد المعالجة
    const index = this.queue.findIndex(
      msg => !this.processingCustomers.has(msg.from_number)
    );
    
    if (index === -1) {
      return null; // كل العملاء قيد المعالجة
    }
    
    const message = this.queue.splice(index, 1)[0];
    this.processingCustomers.add(message.from_number);
    
    this.stats.currentQueueSize = this.queue.length;
    
    console.log(`📤 بدء معالجة: ${message.from_number}`);
    
    return message;
  }

  /**
   * تحرير Lock بعد انتهاء المعالجة
   */
  release(phoneNumber) {
    this.processingCustomers.delete(phoneNumber);
    this.stats.totalProcessed++;
    
    console.log(`✅ انتهت المعالجة: ${phoneNumber}`);
  }

  /**
   * هل العميل قيد المعالجة؟
   */
  isProcessing(phoneNumber) {
    return this.processingCustomers.has(phoneNumber);
  }

  /**
   * حجم الطابور
   */
  size() {
    return this.queue.length;
  }

  /**
   * هل الطابور فارغ؟
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * الإحصائيات
   */
  getStats() {
    return {
      ...this.stats,
      processingCount: this.processingCustomers.size,
      averageQueueSize: this.stats.totalEnqueued > 0
        ? (this.stats.totalEnqueued / Math.max(1, this.stats.totalProcessed)).toFixed(1)
        : 0
    };
  }

  /**
   * مسح الطابور
   */
  clear() {
    this.queue = [];
    this.processingCustomers.clear();
    this.lastMessageByCustomer.clear();
    this.stats.currentQueueSize = 0;
  }
}

export const messageQueue = new MessageQueue();