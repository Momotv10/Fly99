
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('WhatsApp')
@Controller('api/v1/whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp webhook endpoint' })
  async handleWebhook(@Body() body: any) {
    return this.whatsappService.handleWebhook(body);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'WhatsApp webhook verification' })
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const result = await this.whatsappService.verifyWebhook(mode, token, challenge);
    return result;
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'إرسال رسالة WhatsApp' })
  async sendMessage(@Body() body: { phoneNumber: string; message: string }) {
    return this.whatsappService.sendMessage(body.phoneNumber, body.message);
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'الحصول على جميع الرسائل' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllMessages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.whatsappService.getAllMessages(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('conversation/:phoneNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'الحصول على سجل المحادثة' })
  async getConversation(@Param('phoneNumber') phoneNumber: string) {
    return this.whatsappService.getConversationHistory(phoneNumber);
  }
}
