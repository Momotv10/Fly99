
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FlightService } from './flight.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Flights')
@Controller('api/v1/flights')
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Get('search')
  @ApiOperation({ summary: 'البحث عن رحلات' })
  @ApiQuery({ name: 'origin', required: false })
  @ApiQuery({ name: 'destination', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async searchFlights(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.flightService.searchFlights({
      origin,
      destination,
      date,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'الحصول على جميع الرحلات' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllFlights(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.flightService.getAllFlights(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'الحصول على تفاصيل رحلة محددة' })
  @ApiResponse({ status: 200, description: 'تم جلب البيانات بنجاح' })
  @ApiResponse({ status: 404, description: 'الرحلة غير موجودة' })
  async getFlightById(@Param('id') id: string) {
    return this.flightService.getFlightById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPPLIER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'إضافة رحلة جديدة (للإدارة والموردين)' })
  async createFlight(@Body() body: {
    flightNumber: string;
    airline: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    aircraft: string;
    capacity: number;
    basePrice: number;
  }) {
    return this.flightService.createFlight({
      ...body,
      departureTime: new Date(body.departureTime),
      arrivalTime: new Date(body.arrivalTime),
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPPLIER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'تحديث بيانات رحلة' })
  async updateFlight(@Param('id') id: string, @Body() body: any) {
    if (body.departureTime) body.departureTime = new Date(body.departureTime);
    if (body.arrivalTime) body.arrivalTime = new Date(body.arrivalTime);
    return this.flightService.updateFlight(id, body);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPPLIER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'تحديث حالة الرحلة' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.flightService.updateFlightStatus(id, body.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف رحلة (للإدارة فقط)' })
  async deleteFlight(@Param('id') id: string) {
    await this.flightService.deleteFlight(id);
  }
}
