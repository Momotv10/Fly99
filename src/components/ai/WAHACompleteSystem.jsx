/**
 * 🚀 نظام WAHA الكامل والنهائي
 * ========================================
 * يدعم: Webhooks + WebSockets + Polling
 * مبني حسب وثائق WAHA الرسمية
 */

import { base44 } from '@/api/base44Client';

// ═══════════════════════════════════════════════════════════════
// 🔧 الإعدادات
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  waha: {
    baseUrl: 'https://waha.yemencode.info',
    apiKey: 'baaa4cf6482c4493858638795f3b478f',
    session: 'default',
  },
  polling: {
    enabled: true,
    interval: 3000, // كل 3 ثوانٍ
  },
  websocket: {
    enabled: false,
    reconnectDelay: 5000,
  },
  dedup: {
    ttl: 86400000, // 24 ساعة
  },
  cooldown: 2000, // ثانيتين بين الردود
};

// ═══════════════════════════════════════════════════════════════
// 1️⃣ WAHA API CLIENT
// ═══════════════════════════════════════════════════════════════

class WAHAApiClient {
  constructor() {
    this.baseUrl = CONFIG.waha.baseUrl;
    this.apiKey = CONFIG.waha.apiKey;
    this.session = CONFIG.waha.session;
  }

  async loadFromDatabase() {
    try {
      const gateways = await base44.entities.WhatsAppGateway.filter(
        { is_active: true, is_default: true },
        '-created_date',
        1
      );

      if (gateways.length > 0) {
        const gw = gateways[0];
        this.baseUrl = (gw.waha_server_url || '').replace(/\/+$/, '').replace(/\/api\/?$/, '');
        this.apiKey = gw.waha_api_key || '';
        this.session = gw.session_id || 'default';
        console.log(`✅ [WAHA] تحميل من DB: ${this.baseUrl}`);
      }
    } catch (e) {
      console.warn('⚠️ استخدام الإعدادات الافتراضية');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    console.log(`📡 [API] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        ...options.headers,
      },
    });

    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(text || `HTTP ${response.status}`);
    }

    return text ? JSON.parse(text) : {};
  }

  // ═══ إرسال رسالة نصية ═══
  async sendText(phone, text) {
    const chatId = this.formatChatId(phone);
    console.log(`📤 إرسال إلى ${chatId}: ${text.substring(0, 30)}...`);

    const result = await this.request('/sendText', {
      method: 'POST',
      body: JSON.stringify({
        session: this.session,
        chatId: chatId,
        text: text,
      }),
    });

    return { success: true, id: result.id };
  }

  // ═══ إرسال صورة ═══
  async sendImage(phone, imageUrl, caption = '') {
    const chatId = this.formatChatId(phone);

    const result = await this.request('/sendImage', {
      method: 'POST',
      body: JSON.stringify({
        session: this.session,
        chatId: chatId,
        file: { url: imageUrl },
        caption: caption,
      }),
    });

    return { success: true, id: result.id };
  }

  // ═══ إرسال ملف ═══
  async sendFile(phone, fileUrl, filename) {
    const chatId = this.formatChatId(phone);

    const result = await this.request('/sendFile', {
      method: 'POST',
      body: JSON.stringify({
        session: this.session,
        chatId: chatId,
        file: { url: fileUrl, filename: filename },
      }),
    });

    return { success: true, id: result.id };
  }

  // ═══ تأكيد القراءة ═══
  async sendSeen(chatId) {
    try {
      await this.request('/sendSeen', {
        method: 'POST',
        body: JSON.stringify({
          session: this.session,
          chatId: chatId,
        }),
      });
      console.log(`👁️ تأكيد قراءة: ${chatId}`);
    } catch (e) {
      console.warn('⚠️ خطأ في sendSeen:', e.message);
    }
  }

  // ═══ جلب المحادثات ═══
  async getChats() {
    return await this.request(`/${this.session}/chats`);
  }

  // ═══ جلب رسائل محادثة ═══
  async getChatMessages(chatId, limit = 50) {
    return await this.request(`/${this.session}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`);
  }

  // ═══ جلب جميع الرسائل غير المقروءة ═══
  async getUnreadMessages() {
    try {
      // جلب المحادثات أولاً
      const chats = await this.getChats();
      
      if (!Array.isArray(chats)) {
        console.warn('⚠️ لا توجد محادثات');
        return [];
      }

      // فقط المحادثات الفردية مع رسائل غير مقروءة
      const unreadChats = chats.filter(c => !c.isGroup && c.unreadCount > 0);
      console.log(`📨 ${unreadChats.length} محادثة بها رسائل غير مقروءة`);

      let allMessages = [];

      for (const chat of unreadChats.slice(0, 10)) {
        try {
          const chatId = chat.id?._serialized || chat.id;
          const messages = await this.getChatMessages(chatId, chat.unreadCount + 5);
          
          if (Array.isArray(messages)) {
            // فقط الرسائل الواردة الجديدة
            const incoming = messages.filter(m => !m.fromMe);
            allMessages = allMessages.concat(incoming.map(m => ({
              ...m,
              chatId: chatId,
              chatName: chat.name,
            })));
          }
        } catch (e) {
          console.warn(`⚠️ خطأ في جلب رسائل ${chat.name}:`, e.message);
        }
      }

      return allMessages;
    } catch (e) {
      console.error('❌ خطأ في getUnreadMessages:', e.message);
      return [];
    }
  }

  // ═══ اختبار الاتصال ═══
  async testConnection() {
    try {
      const result = await this.request('/sessions');
      console.log('✅ الاتصال بـ WAHA ناجح');
      return { success: true, sessions: result };
    } catch (e) {
      console.error('❌ فشل الاتصال:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ═══ الحصول على حالة الجلسة ═══
  async getSessionStatus() {
    try {
      const result = await this.request(`/sessions/${this.session}`);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ═══ تسجيل Webhook ═══
  async registerWebhook(webhookUrl) {
    try {
      // تحديث الجلسة بـ webhook
      const result = await this.request(`/sessions/${this.session}`, {
        method: 'PUT',
        body: JSON.stringify({
          config: {
            webhooks: [{
              url: webhookUrl,
              events: ['message', 'message.any'],
            }],
          },
        }),
      });
      console.log('✅ تم تسجيل Webhook');
      return { success: true };
    } catch (e) {
      console.error('❌ فشل تسجيل Webhook:', e.message);
      return { success: false, error: e.message };
    }
  }

  formatChatId(phone) {
    if (!phone) return phone;
    if (phone.includes('@')) return phone;
    let cleaned = phone.replace(/[^\d]/g, '').replace(/^0+/, '');
    return `${cleaned}@c.us`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2️⃣ DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

class Deduplication {
  constructor() {
    this.processed = new Map();
    this.active = new Set();
    this.startCleanup();
  }

  isDuplicate(id) {
    return this.processed.has(id) || this.active.has(id);
  }

  startProcessing(id) {
    this.active.add(id);
  }

  markDone(id) {
    this.active.delete(id);
    this.processed.set(id, Date.now());
  }

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, time] of this.processed) {
        if (now - time > CONFIG.dedup.ttl) {
          this.processed.delete(id);
        }
      }
    }, 3600000);
  }

  getStats() {
    return { processed: this.processed.size, active: this.active.size };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3️⃣ AI SERVICE
// ═══════════════════════════════════════════════════════════════

class AIService {
  constructor() {
    this.memory = new Map();
  }

  async process(message, phone, mediaUrl = null) {
    console.log(`🧠 [AI] معالجة: ${message?.substring(0, 50)}...`);

    try {
      let prompt = `أنت مساعد خدمة عملاء ذكي لشركة طيران يمنية.

رسالة العميل: "${message || '[وسائط]'}"

قواعد الرد:
1. رد بالعربية
2. كن مختصراً (جملة أو جملتين)
3. إذا سأل عن حجز، اسأل عن الوجهة والتاريخ
4. كن ودوداً ومحترفاً

أرجع JSON: {"reply": "..."}`;

      const options = {
        prompt: prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
          },
        },
      };

      if (mediaUrl) {
        options.file_urls = [mediaUrl];
        options.prompt = `تحليل الصورة/الملف المرفق مع الرسالة: "${message || 'بدون نص'}"\n\nرد بشكل مفيد ومختصر بالعربية.\n\nأرجع JSON: {"reply": "..."}`;
      }

      const result = await base44.integrations.Core.InvokeLLM(options);
      const reply = result?.reply || this.fallback(message);
      
      console.log(`✅ [AI] الرد: ${reply.substring(0, 50)}...`);
      return reply;

    } catch (e) {
      console.error('❌ [AI] خطأ:', e.message);
      return this.fallback(message);
    }
  }

  fallback(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('حجز') || m.includes('رحلة')) return 'مرحباً! أي مدينة تريد السفر إليها؟';
    if (m.includes('حالة') || m.includes('رقم')) return 'يرجى إرسال رقم الحجز للتحقق من حالته.';
    if (m.includes('شكر')) return 'شكراً لتواصلك معنا!';
    return 'مرحباً! كيف يمكنني مساعدتك؟';
  }
}

// ═══════════════════════════════════════════════════════════════
// 4️⃣ MESSAGE POLLER - سحب الرسائل
// ═══════════════════════════════════════════════════════════════

class MessagePoller {
  constructor(api, dedup, ai, onMessage) {
    this.api = api;
    this.dedup = dedup;
    this.ai = ai;
    this.onMessage = onMessage;
    this.running = false;
    this.lastResponseTime = new Map();
    this.stats = { received: 0, processed: 0, errors: 0 };
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🔄 [POLLER] بدء السحب...');
    this.poll();
  }

  stop() {
    this.running = false;
    console.log('⏹️ [POLLER] توقف');
  }

  async poll() {
    if (!this.running) return;

    try {
      const messages = await this.api.getUnreadMessages();
      
      for (const msg of messages) {
        await this.handleMessage(msg);
      }

    } catch (e) {
      console.error('❌ [POLLER] خطأ:', e.message);
      this.stats.errors++;
    }

    // الجولة التالية
    if (this.running) {
      setTimeout(() => this.poll(), CONFIG.polling.interval);
    }
  }

  async handleMessage(msg) {
    const msgId = msg.id?._serialized || msg.id;
    const chatId = msg.chatId;
    const body = msg.body || '';
    const type = msg.type;

    // تجاهل المكرر
    if (this.dedup.isDuplicate(msgId)) {
      return;
    }

    // تجاهل الرسائل منا
    if (msg.fromMe) return;

    console.log(`\n📨 [POLLER] رسالة جديدة:`);
    console.log(`   ID: ${msgId}`);
    console.log(`   من: ${chatId}`);
    console.log(`   النص: ${body.substring(0, 50)}...`);

    this.dedup.startProcessing(msgId);
    this.stats.received++;

    try {
      // تأكيد القراءة
      await this.api.sendSeen(chatId);

      // حفظ الرسالة
      await this.saveMessage({
        messageId: msgId,
        from: chatId,
        body: body,
        type: type,
        direction: 'incoming',
      });

      // التحقق من cooldown
      const lastTime = this.lastResponseTime.get(chatId);
      if (lastTime && Date.now() - lastTime < CONFIG.cooldown) {
        console.log('⏳ في فترة انتظار');
        this.dedup.markDone(msgId);
        return;
      }

      // معالجة AI
      const mediaUrl = msg.clientUrl || msg.mediaUrl || null;
      const reply = await this.ai.process(body, chatId, mediaUrl);

      // إرسال الرد
      if (reply) {
        await this.api.sendText(chatId, reply);
        this.lastResponseTime.set(chatId, Date.now());

        // حفظ الرد
        await this.saveMessage({
          messageId: `out_${Date.now()}`,
          to: chatId,
          body: reply,
          type: 'text',
          direction: 'outgoing',
        });

        this.stats.processed++;
      }

      this.dedup.markDone(msgId);
      console.log('✅ [POLLER] تمت المعالجة\n');

    } catch (e) {
      console.error('❌ [POLLER] خطأ في المعالجة:', e.message);
      this.dedup.markDone(msgId);
      this.stats.errors++;
    }
  }

  async saveMessage(data) {
    try {
      await base44.entities.WhatsAppMessage.create({
        message_id: data.messageId,
        direction: data.direction,
        from_number: data.from || null,
        to_number: data.to || null,
        content: data.body,
        message_type: data.type || 'text',
        status: data.direction === 'incoming' ? 'received' : 'sent',
        processed: true,
        processed_by_ai: data.direction === 'outgoing',
      });
    } catch (e) {
      console.warn('⚠️ خطأ في الحفظ:', e.message);
    }
  }

  getStats() {
    return this.stats;
  }
}

// ═══════════════════════════════════════════════════════════════
// 5️⃣ WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════

class WebhookHandler {
  constructor(dedup, ai, api) {
    this.dedup = dedup;
    this.ai = ai;
    this.api = api;
    this.queue = [];
    this.processing = false;
    this.lastResponseTime = new Map();
    this.stats = { received: 0, processed: 0, duplicates: 0, errors: 0 };

    this.startWorker();
  }

  async handle(payload) {
    this.stats.received++;

    try {
      const event = payload.event;
      const data = payload.payload || payload;

      if (event !== 'message' && event !== 'message.any') {
        return { status: 'ok', event };
      }

      const msgId = data?.id?._serialized || data?.id;
      const chatId = data?.from || data?.chatId;
      const body = data?.body || data?.text || '';

      if (!msgId || !chatId) {
        return { status: 'ok', reason: 'missing_data' };
      }

      if (data?.fromMe) {
        return { status: 'ok', reason: 'fromMe' };
      }

      if (this.dedup.isDuplicate(msgId)) {
        this.stats.duplicates++;
        return { status: 'ok', duplicate: true };
      }

      // إضافة للطابور
      this.queue.push({
        msgId,
        chatId,
        body,
        type: data?.type,
        mediaUrl: data?.clientUrl || data?.mediaUrl,
      });

      return { status: 'ok', queued: true };

    } catch (e) {
      this.stats.errors++;
      return { status: 'ok', error: e.message };
    }
  }

  startWorker() {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;
      this.processing = true;

      while (this.queue.length > 0) {
        const item = this.queue.shift();
        await this.processItem(item);
      }

      this.processing = false;
    }, 500);
  }

  async processItem(item) {
    const { msgId, chatId, body, type, mediaUrl } = item;

    try {
      this.dedup.startProcessing(msgId);

      // تأكيد القراءة
      await this.api.sendSeen(chatId);

      // cooldown
      const lastTime = this.lastResponseTime.get(chatId);
      if (lastTime && Date.now() - lastTime < CONFIG.cooldown) {
        this.dedup.markDone(msgId);
        return;
      }

      // AI
      const reply = await this.ai.process(body, chatId, mediaUrl);

      // إرسال
      if (reply) {
        await this.api.sendText(chatId, reply);
        this.lastResponseTime.set(chatId, Date.now());
        this.stats.processed++;
      }

      this.dedup.markDone(msgId);

    } catch (e) {
      console.error('❌ خطأ:', e.message);
      this.dedup.markDone(msgId);
      this.stats.errors++;
    }
  }

  getStats() {
    return { ...this.stats, queueSize: this.queue.length };
  }
}

// ═══════════════════════════════════════════════════════════════
// 6️⃣ WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════

class WebSocketClient {
  constructor(api, dedup, ai) {
    this.api = api;
    this.dedup = dedup;
    this.ai = ai;
    this.ws = null;
    this.connected = false;
    this.lastResponseTime = new Map();
    this.stats = { received: 0, processed: 0, errors: 0 };
  }

  connect() {
    const wsUrl = `${this.api.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/ws?x-api-key=${this.api.apiKey}&session=${this.api.session}&events=message`;

    console.log(`🔌 [WS] الاتصال بـ ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ [WS] متصل');
        this.connected = true;
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleMessage(data);
        } catch (e) {
          console.error('❌ [WS] خطأ:', e.message);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 [WS] انقطع الاتصال');
        this.connected = false;
        
        // إعادة الاتصال
        if (CONFIG.websocket.enabled) {
          setTimeout(() => this.connect(), CONFIG.websocket.reconnectDelay);
        }
      };

      this.ws.onerror = (e) => {
        console.error('❌ [WS] خطأ:', e.message);
      };

    } catch (e) {
      console.error('❌ [WS] فشل الاتصال:', e.message);
    }
  }

  async handleMessage(data) {
    const payload = data.payload || data;
    const msgId = payload?.id?._serialized || payload?.id;
    const chatId = payload?.from || payload?.chatId;
    const body = payload?.body || '';

    if (!msgId || !chatId || payload?.fromMe) return;
    if (this.dedup.isDuplicate(msgId)) return;

    this.stats.received++;
    this.dedup.startProcessing(msgId);

    try {
      await this.api.sendSeen(chatId);

      const lastTime = this.lastResponseTime.get(chatId);
      if (lastTime && Date.now() - lastTime < CONFIG.cooldown) {
        this.dedup.markDone(msgId);
        return;
      }

      const reply = await this.ai.process(body, chatId);

      if (reply) {
        await this.api.sendText(chatId, reply);
        this.lastResponseTime.set(chatId, Date.now());
        this.stats.processed++;
      }

      this.dedup.markDone(msgId);

    } catch (e) {
      this.stats.errors++;
      this.dedup.markDone(msgId);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getStats() {
    return { ...this.stats, connected: this.connected };
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 MAIN SYSTEM
// ═══════════════════════════════════════════════════════════════

class WAHACompleteSystem {
  constructor() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🚀 نظام WAHA الكامل                   ║');
    console.log('╚════════════════════════════════════════╝\n');

    this.api = new WAHAApiClient();
    this.dedup = new Deduplication();
    this.ai = new AIService();
    this.poller = new MessagePoller(this.api, this.dedup, this.ai);
    this.webhook = new WebhookHandler(this.dedup, this.ai, this.api);
    this.websocket = new WebSocketClient(this.api, this.dedup, this.ai);

    this.initialized = false;
    this.mode = 'polling'; // polling | webhook | websocket

    this.initialize();
  }

  async initialize() {
    try {
      await this.api.loadFromDatabase();
      
      // اختبار الاتصال
      const conn = await this.api.testConnection();
      
      if (conn.success) {
        console.log('✅ الاتصال ناجح - بدء السحب...');
        
        // بدء Polling تلقائياً
        if (CONFIG.polling.enabled) {
          this.poller.start();
          this.mode = 'polling';
        }

        // WebSocket (اختياري)
        if (CONFIG.websocket.enabled) {
          this.websocket.connect();
          this.mode = 'websocket';
        }

        this.initialized = true;
      } else {
        console.error('❌ فشل الاتصال:', conn.error);
      }

    } catch (e) {
      console.error('❌ خطأ في التهيئة:', e.message);
    }
  }

  // Webhook handler
  async handleWebhook(payload) {
    return await this.webhook.handle(payload);
  }

  // إرسال رسالة
  async sendText(phone, text) {
    return await this.api.sendText(phone, text);
  }

  async sendImage(phone, url, caption) {
    return await this.api.sendImage(phone, url, caption);
  }

  async sendFile(phone, url, filename) {
    return await this.api.sendFile(phone, url, filename);
  }

  // اختبار
  async testConnection() {
    return await this.api.testConnection();
  }

  // الحالة
  getStatus() {
    return {
      initialized: this.initialized,
      mode: this.mode,
      config: {
        url: this.api.baseUrl,
        session: this.api.session,
      },
      poller: this.poller.getStats(),
      webhook: this.webhook.getStats(),
      websocket: this.websocket.getStats(),
      dedup: this.dedup.getStats(),
    };
  }

  // التحكم
  startPolling() {
    this.poller.start();
    this.mode = 'polling';
  }

  stopPolling() {
    this.poller.stop();
  }

  startWebSocket() {
    this.websocket.connect();
    this.mode = 'websocket';
  }

  stopWebSocket() {
    this.websocket.disconnect();
  }
}

// تصدير
export const wahaSystem = new WAHACompleteSystem();
export { WAHACompleteSystem, CONFIG };