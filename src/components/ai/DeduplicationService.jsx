/**
 * 🔒 خدمة إزالة التكرار - منع الرسائل المكررة من Waha
 * 
 * الطريقة:
 * 1. معرف الرسالة (message_id) من Waha
 * 2. ذاكرة سريعة (Set) لأول 5 دقائق
 * 3. قاعدة البيانات للتخزين الدائم
 */
export class DeduplicationService {
  constructor() {
    // ذاكرة سريعة للرسائل الحديثة (آخر 5 دقائق)
    this.recentMessages = new Map();
    
    // فترة الاحتفاظ بـ message_id
    this.RETENTION_MS = 5 * 60 * 1000; // 5 دقائق
    
    // تنظيف دوري
    this.startCleanup();
  }

  /**
   * التحقق والتسجيل - في خطوة واحدة
   */
  async checkAndRegister(messageId) {
    const now = Date.now();
    
    // 1️⃣ فحص الذاكرة السريعة أولاً (أسرع)
    if (this.recentMessages.has(messageId)) {
      const entry = this.recentMessages.get(messageId);
      console.log(`🚫 رسالة مكررة (الذاكرة): ${messageId} - تمت قبل ${now - entry.time}ms`);
      return { isDuplicate: true, reason: 'in_memory' };
    }

    // 2️⃣ فحص قاعدة البيانات (للتأكيد)
    try {
      const existing = await this.checkDatabase(messageId);
      if (existing) {
        console.log(`🚫 رسالة مكررة (DB): ${messageId}`);
        // أضفها للذاكرة أيضاً
        this.recentMessages.set(messageId, { time: now });
        return { isDuplicate: true, reason: 'in_database' };
      }
    } catch (e) {
      console.warn('⚠️ خطأ في فحص DB:', e.message);
      // لا نتوقف - نتابع
    }

    // 3️⃣ تسجيل الرسالة كمعالجة
    console.log(`✅ رسالة جديدة: ${messageId}`);
    this.recentMessages.set(messageId, { 
      time: now,
      status: 'processing'
    });

    return { isDuplicate: false, reason: 'new_message' };
  }

  /**
   * فحص قاعدة البيانات
   */
  async checkDatabase(messageId) {
    try {
      const { base44 } = await import('@/api/base44Client');
      const existing = await base44.entities.WhatsAppMessage.filter({
        message_id: messageId
      }, '-created_date', 1);
      
      return existing && existing.length > 0;
    } catch (e) {
      console.error('خطأ في فحص DB:', e);
      return false;
    }
  }

  /**
   * تنظيف الذاكرة من الرسائل القديمة
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [msgId, entry] of this.recentMessages.entries()) {
        if (now - entry.time > this.RETENTION_MS) {
          this.recentMessages.delete(msgId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 تنظيف: حذفت ${cleaned} رسالة قديمة`);
      }
    }, 60000); // كل دقيقة
  }

  /**
   * إحصائيات الخدمة
   */
  getStats() {
    return {
      inMemory: this.recentMessages.size,
      retention: `${this.RETENTION_MS / 1000}s`
    };
  }
}

export const deduplicationService = new DeduplicationService();