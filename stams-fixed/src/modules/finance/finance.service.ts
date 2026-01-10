
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private prisma: PrismaService) {}

  async createTransaction(data: {
    userId: string;
    bookingId?: string;
    type: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    description?: string;
  }) {
    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });

    this.logger.log(`New transaction created: ${transaction.id}`);
    return transaction;
  }

  async getTransactionById(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        booking: true,
      },
    });
  }

  async getUserTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllTransactions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingRef: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count(),
    ]);

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFinancialReport(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
      },
    });

    const totalRevenue = transactions
      .filter(t => ['BOOKING_PAYMENT', 'COMMISSION'].includes(t.type))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => ['REFUND', 'SUPPLIER_PAYMENT', 'CANCELLATION_FEE'].includes(t.type))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      transactionCount: transactions.length,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    };
  }
}
