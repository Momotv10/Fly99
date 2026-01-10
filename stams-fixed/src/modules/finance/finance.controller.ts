
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Finance')
@Controller('api/v1/finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  @ApiOperation({ summary: 'إنشاء معاملة مالية' })
  async createTransaction(@Request() req, @Body() body: {
    bookingId?: string;
    type: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    description?: string;
  }) {
    return this.financeService.createTransaction({
      userId: req.user.userId,
      ...body,
    });
  }

  @Get('transactions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'الحصول على جميع المعاملات المالية (للإدارة)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.getAllTransactions(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('transactions/my')
  @ApiOperation({ summary: 'الحصول على معاملاتي المالية' })
  async getMyTransactions(@Request() req) {
    return this.financeService.getUserTransactions(req.user.userId);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'الحصول على تفاصيل معاملة محددة' })
  async getTransactionById(@Param('id') id: string) {
    return this.financeService.getTransactionById(id);
  }

  @Get('reports/summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'تقرير مالي ملخص (للإدارة)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getFinancialReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getFinancialReport(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
