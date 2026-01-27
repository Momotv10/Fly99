// WAHA API Client - حسب التوثيق الرسمي
const WAHA_URL = 'https://waha.yemencode.info/api';
const WAHA_KEY = 'baaa4cf6482c4493858638795f3b478f';

export const WAHAClient = {
  // إنشاء جلسة جديدة (تبدأ تلقائياً)
  async createSession(name) {
    const res = await fetch(`${WAHA_URL}/sessions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_KEY
      },
      body: JSON.stringify({ name })
    });
    
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'فشل إنشاء الجلسة');
    }
    
    return res.json();
  },

  // الحصول على حالة الجلسة
  async getSession(name) {
    const res = await fetch(`${WAHA_URL}/sessions/${name}`, {
      headers: { 'X-Api-Key': WAHA_KEY }
    });
    
    if (!res.ok) return null;
    return res.json();
  },

  // الحصول على QR Code
  async getQR(name) {
    const res = await fetch(`${WAHA_URL}/${name}/auth/qr`, {
      headers: { 'X-Api-Key': WAHA_KEY }
    });
    
    if (!res.ok) {
      throw new Error('QR غير متاح');
    }
    
    return res.json();
  },

  // إيقاف وحذف الجلسة
  async deleteSession(name) {
    try {
      await fetch(`${WAHA_URL}/sessions/${name}/stop`, {
        method: 'POST',
        headers: { 'X-Api-Key': WAHA_KEY }
      });
    } catch (e) {}
    
    await fetch(`${WAHA_URL}/sessions/${name}/`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': WAHA_KEY }
    });
  },

  // إرسال رسالة
  async sendText(session, phone, text) {
    const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    
    const res = await fetch(`${WAHA_URL}/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_KEY
      },
      body: JSON.stringify({
        session,
        chatId,
        text
      })
    });
    
    if (!res.ok) {
      throw new Error('فشل إرسال الرسالة');
    }
    
    return res.json();
  }
};