
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Bookings')
@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'إنشاء حجز جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الحجز بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الرحلة غير موجودة' })
  async createBooking(@Request() req, @Body() body: {
    flightId: string;
    passengerName: string;
    passengerEmail: string;
    passengerPhone: string;
    passportNumber?: string;
    passengerType?: string;
  }) {
    return this.bookingService.createBooking({
      userId: req.user.userId,
      ...body,
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'الحصول على جميع الحجوزات (للإدارة فقط)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'flightId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllBookings(
    @Query('status') status?: string,
    @Query('flightId') flightId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookingService.getAllBookings({
      status,
      flightId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'الحصول على حجوزاتي' })
  async getMyBookings(@Request() req) {
    return this.bookingService.getUserBookings(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على تفاصيل حجز محدد' })
  @ApiResponse({ status: 200, description: 'تم جلب البيانات بنجاح' })
  @ApiResponse({ status: 404, description: 'الحجز غير موجود' })
  async getBookingById(@Param('id') id: string) {
    return this.bookingService.getBookingById(id);
  }

  @Get('ref/:bookingRef')
  @ApiOperation({ summary: 'الحصول على حجز برقم المرجع' })
  async getBookingByRef(@Param('bookingRef') bookingRef: string) {
    return this.bookingService.getBookingByRef(bookingRef);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'تحديث حالة الحجز' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.bookingService.updateBookingStatus(id, body.status);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف حجز (للإدارة فقط)' })
  async deleteBooking(@Param('id') id: string) {
    await this.bookingService.deleteBooking(id);
  }
}
