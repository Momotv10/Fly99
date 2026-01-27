/**
 * 🎯 نظام تتبع الرسائل - منع التكرار 100%
 * 
 * المبادئ:
 * 1. كل رسالة لها ID فريد
 * 2. تسجيل كل رسالة مستقبلة
 * 3. تجاهل المكررات خلال 60 ثانية
 * 4. تنظيف تلقائي
 */
export class MessageTracker {
  constructor() {
    // Map لتتبع الرسائل: messageId -> timestamp
    this.receivedMessages = new Map();
    
    // Map لتتبع الرسائل حسب المحتوى: phone_content -> timestamp
    this.contentTracker = new Map();
    
    // إحصائيات
    this.stats = {
      totalReceived: 0,
      duplicatesBlocked: 0,
      lastCleanup: Date.now()
    };
    
    // تنظيف تلقائي كل دقيقة
    this.startCleanupTimer();
  }

  /**
   * فحص: هل الرسالة مكررة؟
   */
  isDuplicate(messageId, phoneNumber, content) {
    const now = Date.now();
    
    // 1. فحص بالـ ID
    if (messageId && this.receivedMessages.has(messageId)) {
      const lastTime = this.receivedMessages.get(messageId);
      if (now - lastTime < 60000) { // دقيقة
        this.stats.duplicatesBlocked++;
        console.log('🔴 رسالة مكررة (ID):', messageId);
        return true;
      }
    }
    
    // 2. فحص بالمحتوى (حماية إضافية)
    const contentKey = `${phoneNumber}_${content?.substring(0, 50)}`;
    if (this.contentTracker.has(contentKey)) {
      const lastTime = this.contentTracker.get(contentKey);
      if (now - lastTime < 30000) { // 30 ثانية
        this.stats.duplicatesBlocked++;
        console.log('🔴 رسالة مكررة (محتوى):', contentKey);
        return true;
      }
    }
    
    return false;
  }

  /**
   * تسجيل رسالة جديدة
   */
  track(messageId, phoneNumber, content) {
    const now = Date.now();
    
    // تسجيل بالـ ID
    if (messageId) {
      this.receivedMessages.set(messageId, now);
    }
    
    // تسجيل بالمحتوى
    const contentKey = `${phoneNumber}_${content?.substring(0, 50)}`;
    this.contentTracker.set(contentKey, now);
    
    this.stats.totalReceived++;
    
    console.log('✅ تم تسجيل رسالة جديدة:', messageId || contentKey);
  }

  /**
   * تنظيف السجلات القديمة
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // تنظيف IDs القديمة (أكثر من دقيقتين)
    for (const [id, time] of this.receivedMessages.entries()) {
      if (now - time > 120000) {
        this.receivedMessages.delete(id);
        cleanedCount++;
      }
    }
    
    // تنظيف المحتوى القديم
    for (const [key, time] of this.contentTracker.entries()) {
      if (now - time > 120000) {
        this.contentTracker.delete(key);
        cleanedCount++;
      }
    }
    
    this.stats.lastCleanup = now;
    
    if (cleanedCount > 0) {
      console.log(`🧹 تم تنظيف ${cleanedCount} سجل قديم`);
    }
  }

  /**
   * بدء التنظيف التلقائي
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, 60000); // كل دقيقة
  }

  /**
   * الحصول على الإحصائيات
   */
  getStats() {
    return {
      ...this.stats,
      trackedMessages: this.receivedMessages.size,
      trackedContent: this.contentTracker.size,
      duplicateRate: this.stats.totalReceived > 0 
        ? ((this.stats.duplicatesBlocked / this.stats.totalReceived) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * إعادة تعيين الإحصائيات
   */
  resetStats() {
    this.stats = {
      totalReceived: 0,
      duplicatesBlocked: 0,
      lastCleanup: Date.now()
    };
  }
}

export const messageTracker = new MessageTracker();