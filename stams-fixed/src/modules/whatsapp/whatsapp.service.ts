
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private prisma: PrismaService) {}

  async handleWebhook(body: any) {
    this.logger.log('Received WhatsApp webhook');
    
    // Verify webhook
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        for (const message of value.messages) {
          await this.processIncomingMessage(message, value.metadata.phone_number_id);
        }
      }

      return { success: true };
    }

    return { success: false, message: 'Invalid webhook data' };
  }

  async verifyWebhook(mode: string, token: string, challenge: string) {
    const verifyToken = process.env.WA_WEBHOOK_VERIFY_TOKEN || 'STAMS_VERIFY_TOKEN';

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }

    throw new Error('Webhook verification failed');
  }

  private async processIncomingMessage(message: any, phoneNumberId: string) {
    try {
      const phoneNumber = message.from;
      const messageType = message.type;
      let content = '';

      if (messageType === 'text') {
        content = message.text.body;
      } else if (messageType === 'image') {
        content = message.image.caption || 'Image received';
      }

      // Save message to database
      await this.prisma.whatsAppMessage.create({
        data: {
          phoneNumber,
          direction: 'inbound',
          messageType,
          content,
          status: 'received',
          whatsappId: message.id,
        },
      });

      this.logger.log(`Processed message from ${phoneNumber}`);

      // Here you can add AI processing or automated responses
      // await this.sendAutoResponse(phoneNumber, content);

    } catch (error) {
      this.logger.error('Error processing message:', error);
    }
  }

  async sendMessage(phoneNumber: string, message: string) {
    // This is a placeholder - implement actual WhatsApp API call
    this.logger.log(`Sending message to ${phoneNumber}: ${message}`);

    await this.prisma.whatsAppMessage.create({
      data: {
        phoneNumber,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        status: 'sent',
      },
    });

    return {
      success: true,
      phoneNumber,
      message,
    };
  }

  async getConversationHistory(phoneNumber: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { phoneNumber },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  async getAllMessages(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppMessage.count(),
    ]);

    return {
      messages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
