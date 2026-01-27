import { base44 } from '@/api/base44Client';

/**
 * 🧠 نظام الذاكرة الذكي
 * - ذاكرة قصيرة المدى (السياق الفوري)
 * - ذاكرة طويلة المدى (قاعدة البيانات)
 * - تتبع العميل وسلوكه
 */
export class SmartMemory {
  constructor() {
    this.shortTermMemory = new Map(); // ذاكرة قصيرة المدى
    this.customerProfiles = new Map(); // ملفات العملاء
  }

  /**
   * جلب السياق الكامل للعميل
   */
  async getCustomerContext(phoneNumber) {
    try {
      // 1. العميل المسجل
      const customer = await this.getCustomer(phoneNumber);
      
      // 2. تاريخ المحادثات (آخر 15 رسالة)
      const history = await this.getConversationHistory(phoneNumber);
      
      // 3. الحجوزات السابقة
      const bookings = customer ? await this.getCustomerBookings(customer.id) : [];
      
      // 4. الحالة الحالية (من الذاكرة القصيرة)
      const currentState = this.shortTermMemory.get(phoneNumber) || {};
      
      // 5. الأنماط المتعلمة
      const patterns = this.customerProfiles.get(phoneNumber) || { preferences: {}, behavior: [] };
      
      return {
        customer,
        history,
        bookings,
        currentState,
        patterns,
        isRegistered: !!customer,
        hasActiveBookings: bookings.filter(b => ['paid', 'pending_issue', 'issued'].includes(b.status)).length > 0
      };
      
    } catch (error) {
      console.error('خطأ في جلب السياق:', error);
      return {
        customer: null,
        history: [],
        bookings: [],
        currentState: {},
        patterns: {},
        isRegistered: false,
        hasActiveBookings: false
      };
    }
  }

  /**
   * جلب بيانات العميل
   */
  async getCustomer(phoneNumber) {
    try {
      const customers = await base44.entities.Customer.filter({
        whatsapp: phoneNumber
      }, '-created_date', 1);
      
      return customers[0] || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * جلب تاريخ المحادثة
   */
  async getConversationHistory(phoneNumber) {
    try {
      const convs = await base44.entities.AIConversation.filter({
        customer_phone: phoneNumber
      }, '-updated_date', 1);

      if (convs[0]?.conversation_log) {
        // آخر 15 رسالة فقط
        return convs[0].conversation_log.slice(-15);
      }
      
      return [];
    } catch (e) {
      return [];
    }
  }

  /**
   * جلب حجوزات العميل (فقط إذا كان مسجل بنفس الرقم - أمان!)
   */
  async getCustomerBookings(customerId) {
    try {
      const bookings = await base44.entities.Booking.filter({
        customer_id: customerId
      }, '-created_date', 5);
      
      return bookings;
    } catch (e) {
      return [];
    }
  }

  /**
   * البحث الآمن عن الحجوزات (بالاسم)
   * ✅ يتحقق أن الحجز تابع لنفس الرقم
   * ✅ يبحث في جميع الحجوزات (مؤكدة، ملغاة، مؤجلة)
   */
  async searchBookingSafely(customerName, phoneNumber) {
    try {
      // البحث الذكي: ابحث بالاسم أولاً في الحجوزات المؤكدة
      let bookings = await base44.entities.Booking.filter({
        customer_name: customerName,
        status: 'issued'
      }, '-created_date', 5);
      
      // إذا لم نجد، ابحث في قيد الإصدار
      if (bookings.length === 0) {
        bookings = await base44.entities.Booking.filter({
          customer_name: customerName,
          status: 'pending_issue'
        }, '-created_date', 5);
      }
      
      // إذا لم نجد، ابحث في المدفوعة
      if (bookings.length === 0) {
        bookings = await base44.entities.Booking.filter({
          customer_name: customerName,
          status: 'paid'
        }, '-created_date', 5);
      }
      
      // إذا لم نجد، ابحث في الملغاة والمؤجلة
      if (bookings.length === 0) {
        bookings = await base44.entities.Booking.filter({
          customer_name: customerName
        }, '-created_date', 10);
      }
      
      // ✅ فلترة أمنية: فقط الحجوزات التابعة لنفس رقم الهاتف
      const safeBookings = bookings.filter(b => 
        b.customer_phone === phoneNumber || 
        b.customer_whatsapp === phoneNumber
      );
      
      return safeBookings;
      
    } catch (e) {
      return [];
    }
  }

  /**
   * تحديث الذاكرة القصيرة
   */
  updateShortTerm(phoneNumber, data) {
    const current = this.shortTermMemory.get(phoneNumber) || {};
    
    this.shortTermMemory.set(phoneNumber, {
      ...current,
      ...data,
      lastUpdate: Date.now()
    });
    
    // تنظيف الذاكرة القديمة (أكثر من ساعة)
    this.cleanupShortTerm();
  }

  /**
   * حفظ المحادثة الكاملة
   */
  async saveConversation(phoneNumber, customer, userMessage, aiResponse, intent) {
    try {
      const convs = await base44.entities.AIConversation.filter({
        customer_phone: phoneNumber
      }, '-created_date', 1);

      let conv = convs[0];

      if (!conv) {
        conv = await base44.entities.AIConversation.create({
          customer_phone: phoneNumber,
          customer_id: customer?.id || null,
          customer_name: customer?.full_name || 'عميل جديد',
          conversation_log: [],
          status: 'active',
          intent: intent
        });
      }

      const log = [
        ...(conv.conversation_log || []),
        {
          role: 'customer',
          message: userMessage,
          timestamp: new Date().toISOString()
        },
        {
          role: 'ai',
          message: aiResponse,
          timestamp: new Date().toISOString(),
          understood_intent: intent
        }
      ];

      // الاحتفاظ بآخر 50 رسالة فقط
      const trimmed = log.slice(-50);

      await base44.entities.AIConversation.update(conv.id, {
        conversation_log: trimmed,
        intent: intent,
        last_activity: new Date().toISOString()
      });

    } catch (e) {
      console.error('خطأ في حفظ المحادثة:', e);
    }
  }

  /**
   * التعلم من التفاعل
   */
  learn(phoneNumber, message, response, success) {
    const profile = this.customerProfiles.get(phoneNumber) || {
      preferences: {},
      behavior: [],
      successRate: 0,
      totalInteractions: 0
    };

    // حفظ السلوك
    profile.behavior.push({
      message,
      response,
      success,
      timestamp: Date.now()
    });

    // الاحتفاظ بآخر 30 تفاعل فقط
    if (profile.behavior.length > 30) {
      profile.behavior = profile.behavior.slice(-30);
    }

    // حساب معدل النجاح
    profile.totalInteractions++;
    if (success) {
      profile.successRate = ((profile.successRate * (profile.totalInteractions - 1)) + 1) / profile.totalInteractions;
    } else {
      profile.successRate = (profile.successRate * (profile.totalInteractions - 1)) / profile.totalInteractions;
    }

    this.customerProfiles.set(phoneNumber, profile);
  }

  /**
   * تنظيف الذاكرة القديمة
   */
  cleanupShortTerm() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [phone, data] of this.shortTermMemory.entries()) {
      if (now - data.lastUpdate > oneHour) {
        this.shortTermMemory.delete(phone);
      }
    }

    // تنظيف الملفات الشخصية
    if (this.customerProfiles.size > 500) {
      const entries = Array.from(this.customerProfiles.entries());
      this.customerProfiles = new Map(entries.slice(-250));
    }
  }
}

export const smartMemory = new SmartMemory();

// تنظيف دوري كل 10 دقائق
setInterval(() => {
  smartMemory.cleanupShortTerm();
}, 10 * 60 * 1000);