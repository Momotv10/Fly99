import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function WAHAWebhookReceiver() {
  const [status, setStatus] = useState('Waiting...');
  const [receivedCount, setReceivedCount] = useState(0);

  useEffect(() => {
    // هذه الصفحة موجودة فقط لاستقبال webhook من WAHA
    const urlParams = new URLSearchParams(window.location.search);
    const webhook = urlParams.get('webhook');

    if (webhook) {
      try {
        const data = JSON.parse(decodeURIComponent(webhook));
        handleWebhook(data);
      } catch (error) {
        console.error('Webhook parse error:', error);
      }
    }
  }, []);

  const handleWebhook = async (data) => {
    console.log('🎣 Webhook received:', data);

    if (data.event === 'message' && !data.payload.fromMe) {
      const msg = data.payload;
      
      // حفظ الرسالة في قاعدة البيانات
      try {
        const phoneNumber = msg.from?.split('@')[0] || msg.from;
        
        await base44.entities.WhatsAppMessage.create({
          direction: 'incoming',
          from_number: phoneNumber,
          to_number: msg.to?.split('@')[0] || '',
          from_name: msg.pushName || '',
          message_type: msg.hasMedia ? 'media' : 'text',
          content: msg.body || '',
          gateway_id: null, // سيتم تحديثه لاحقاً
          status: 'received',
          processed_by_ai: false,
          sent_at: new Date(msg.timestamp * 1000).toISOString()
        });

        setReceivedCount(prev => prev + 1);
        setStatus('Message saved successfully');
        console.log('✅ Message saved to database');
      } catch (error) {
        console.error('❌ Error saving message:', error);
        setStatus('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
        <h1 className="text-2xl font-bold mb-4">WAHA Webhook Receiver</h1>
        <p className="text-gray-600 mb-4">Status: {status}</p>
        <p className="text-gray-600">Messages Received: {receivedCount}</p>
        <div className="mt-6 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            This endpoint receives webhooks from WAHA server
          </p>
        </div>
      </div>
    </div>
  );
}