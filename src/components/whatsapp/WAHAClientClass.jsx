// WAHA API Client - يدعم بوابات متعددة مستقلة
export class WAHAClient {
  constructor(serverUrl, apiKey) {
    this.baseURL = serverUrl?.replace(/\/$/, ''); // إزالة / من النهاية
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    // إزالة /api من baseURL إذا كان endpoint يبدأ بـ /api
    let finalUrl = this.baseURL;
    if (finalUrl.endsWith('/api') && endpoint.startsWith('/api')) {
      finalUrl = finalUrl.slice(0, -4);
    }
    const url = `${finalUrl}${endpoint}`;
    
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
          ...options.headers
        }
      });

      // قراءة النص أولاً
      const text = await res.text();

      if (!res.ok) {
        // محاولة تحليل الخطأ كـ JSON
        let errorMsg = text;
        try {
          const errorJson = JSON.parse(text);
          errorMsg = errorJson.message || errorJson.error || text;
        } catch {
          errorMsg = text || `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }

      // إذا كانت الاستجابة فارغة
      if (!text || text.trim() === '') {
        return {};
      }

      // محاولة تحليل JSON
      try {
        return JSON.parse(text);
      } catch {
        // إذا فشل التحليل، نرجع النص كما هو
        return { data: text };
      }
    } catch (error) {
      if (error.message) throw error;
      throw new Error('فشل الاتصال بخادم WAHA');
    }
  }

  // اختبار الاتصال - نجرب endpoints مختلفة
  async testConnection() {
    const endpoints = ['/api/sessions', '/sessions', '/api'];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.request(endpoint);
        return { 
          success: true, 
          message: 'الاتصال ناجح ✓',
          endpoint: endpoint,
          data: result
        };
      } catch (error) {
        // نستمر في التجربة
        continue;
      }
    }
    
    // إذا فشلت كل المحاولات
    return { 
      success: false, 
      error: 'فشل الاتصال بخادم WAHA',
      details: 'تأكد من صحة الرابط (يجب أن يكون مثل: http://localhost:3000) ومفتاح API'
    };
  }

  // إنشاء جلسة جديدة - WAHA Core يدعم فقط 'default'
  async createSession(name = 'default') {
    try {
      return await this.request('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: 'default' })
      });
    } catch (error) {
      // محاولة بدون /api
      return await this.request('/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: 'default' })
      });
    }
  }

  // الحصول على حالة الجلسة - استخدام 'default' دائماً
  async getSession(name = 'default') {
    try {
      return await this.request('/api/sessions/default');
    } catch (error) {
      try {
        return await this.request('/sessions/default');
      } catch {
        console.log('Session not found');
        return null;
      }
    }
  }

  // الحصول على QR Code - استخدام 'default' دائماً
  async getQR(name = 'default') {
    try {
      const result = await this.request('/api/default/auth/qr');
      return result;
    } catch (error) {
      // محاولة endpoint بديل
      try {
        return await this.request('/default/auth/qr');
      } catch {
        throw error;
      }
    }
  }

  // إيقاف وحذف الجلسة - استخدام 'default' دائماً
  async deleteSession(name = 'default') {
    const endpoints = ['/api/sessions/default', '/sessions/default'];
    
    // محاولة الإيقاف
    for (const endpoint of endpoints) {
      try {
        await this.request(`${endpoint}/stop`, { method: 'POST' });
        await new Promise(r => setTimeout(r, 1000));
        break;
      } catch (e) {
        continue;
      }
    }
    
    // محاولة الحذف
    for (const endpoint of endpoints) {
      try {
        await this.request(endpoint, { method: 'DELETE' });
        await new Promise(r => setTimeout(r, 500));
        break;
      } catch (e) {
        continue;
      }
    }
  }

  // إرسال رسالة نصية - حسب التوثيق الرسمي
  async sendText(session, phone, text) {
    // تنظيف رقم الهاتف
    let chatId = phone.replace(/[^\d]/g, ''); // إزالة كل شيء ما عدا الأرقام
    
    // إضافة @c.us إذا لم يكن موجوداً
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }
    
    console.log(`📤 إرسال رسالة إلى: ${chatId}`);
    
    return this.request('/api/sendText', {
      method: 'POST',
      body: JSON.stringify({ 
        chatId: chatId,
        text: text,
        session: session || 'default'
      })
    });
  }

  // إرسال صورة - حسب التوثيق الرسمي
  async sendImage(session, phone, imageUrl, caption) {
    const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    
    return this.request('/api/sendImage', {
      method: 'POST',
      body: JSON.stringify({ 
        chatId: chatId,
        file: { url: imageUrl },
        caption: caption,
        session: 'default'
      })
    });
  }

  // إرسال ملف - حسب التوثيق الرسمي
  async sendFile(session, phone, fileUrl, filename) {
    const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    
    return this.request('/api/sendFile', {
      method: 'POST',
      body: JSON.stringify({ 
        chatId: chatId,
        file: { url: fileUrl, filename: filename },
        session: 'default'
      })
    });
  }

  // الحصول على جميع المحادثات
  async getChats(session = 'default') {
    return this.request(`/api/${session}/chats`);
  }

  // الحصول على رسائل محادثة معينة
  async getChatMessages(session, chatId, limit = 100) {
    // استخدام _serialized إذا كان chatId object
    const finalChatId = typeof chatId === 'object' && chatId._serialized 
      ? chatId._serialized 
      : chatId;
    
    return this.request(`/api/${session}/chats/${encodeURIComponent(finalChatId)}/messages?limit=${limit}`);
  }

  /**
   * 🔵 وضع علامة مقروء على الرسائل (CRITICAL)
   * هذا يمنع WAHA من إعادة إرسال نفس الرسالة
   */
  async markMessagesAsRead(session, chatId, messageIds = null) {
    const data = {
      session: session || 'default',
      chatId: chatId
    };

    // إذا كان هناك messageIds محددة
    if (messageIds && messageIds.length > 0) {
      data.messageIds = messageIds;
    }

    console.log(`🔵 [WAHA-ACK] وضع علامة مقروء:`);
    console.log(`   - Chat: ${chatId}`);
    console.log(`   - Messages: ${messageIds ? messageIds.join(', ') : 'ALL'}`);

    return this.request('/api/sendSeen', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // الحصول على جميع الرسائل (يتطلب chatId حسب WAHA docs)
  async getAllMessages(session = 'default', limit = 100) {
    try {
      console.log('🔍 جاري سحب المحادثات...');
      
      // أولاً نحصل على جميع المحادثات
      const chats = await this.getChats(session);
      if (!chats || !Array.isArray(chats)) {
        console.log('❌ لم نحصل على محادثات');
        return [];
      }
      
      console.log(`✅ وجدنا ${chats.length} محادثة`);
      
      // فلترة المحادثات: فقط المحادثات الفردية (ليست مجموعات)
      const individualChats = chats.filter(chat => !chat.isGroup);
      console.log(`👤 ${individualChats.length} محادثة فردية`);
      
      // ثم نسحب الرسائل من كل محادثة
      let allMessages = [];
      const chatsToCheck = individualChats.slice(0, 30); // نأخذ أول 30 محادثة
      
      for (let i = 0; i < chatsToCheck.length; i++) {
        const chat = chatsToCheck[i];
        try {
          // استخدام chat.id._serialized للحصول على chatId الصحيح
          const chatId = chat.id._serialized || chat.id;
          console.log(`📨 [${i+1}/${chatsToCheck.length}] سحب رسائل من: ${chat.name || chatId}`);
          
          const messages = await this.getChatMessages(session, chatId, 10);
          
          if (Array.isArray(messages) && messages.length > 0) {
            console.log(`   ✓ وجدنا ${messages.length} رسالة`);
            
            // إضافة معلومات المحادثة لكل رسالة
            const messagesWithChat = messages.map(msg => ({
              ...msg,
              chat_name: chat.name,
              chat_id: chatId,
              from: msg.from || chatId,
              fromMe: msg.fromMe || false
            }));
            
            allMessages = allMessages.concat(messagesWithChat);
          }
        } catch (e) {
          console.log(`   ⚠️ تخطي المحادثة: ${e.message}`);
          continue;
        }
      }
      
      console.log(`📊 إجمالي الرسائل المسحوبة: ${allMessages.length}`);
      
      // ترتيب الرسائل حسب الوقت (الأحدث أولاً)
      allMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      return allMessages.slice(0, limit);
      
    } catch (error) {
      console.error('❌ خطأ في سحب الرسائل:', error);
      return [];
    }
  }
}