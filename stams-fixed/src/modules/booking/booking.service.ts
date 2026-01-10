
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private prisma: PrismaService) {}

  async createBooking(data: {
    userId: string;
    flightId: string;
    passengerName: string;
    passengerEmail: string;
    passengerPhone: string;
    passportNumber?: string;
    passengerType?: string;
  }) {
    // Check flight availability
    const flight = await this.prisma.flight.findUnique({
      where: { id: data.flightId },
    });

    if (!flight) {
      throw new NotFoundException('الرحلة غير موجودة');
    }

    if (flight.availableSeats <= 0) {
      throw new BadRequestException('لا توجد مقاعد متاحة في هذه الرحلة');
    }

    // Generate booking reference
    const bookingRef = `BK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        bookingRef,
        userId: data.userId,
        flightId: data.flightId,
        passengerName: data.passengerName,
        passengerEmail: data.passengerEmail,
        passengerPhone: data.passengerPhone,
        passportNumber: data.passportNumber,
        passengerType: (data.passengerType as any) || 'ADULT',
        totalPrice: flight.basePrice,
        status: 'PENDING',
      },
      include: {
        flight: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Update flight seats
    await this.prisma.flight.update({
      where: { id: data.flightId },
      data: {
        availableSeats: {
          decrement: 1,
        },
      },
    });

    this.logger.log(`New booking created: ${bookingRef}`);

    return booking;
  }

  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        flight: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('الحجز غير موجود');
    }

    return booking;
  }

  async getBookingByRef(bookingRef: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingRef },
      include: {
        flight: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('الحجز غير موجود');
    }

    return booking;
  }

  async getUserBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        flight: true,
      },
      orderBy: {
        bookedAt: 'desc',
      },
    });
  }

  async getAllBookings(filters?: {
    status?: string;
    flightId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.flightId) where.flightId = filters.flightId;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          flight: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          bookedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateBookingStatus(id: string, status: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { flight: true },
    });

    if (!booking) {
      throw new NotFoundException('الحجز غير موجود');
    }

    // If cancelling, return seat to flight
    if (status === 'CANCELLED' && booking.status !== 'CANCELLED') {
      await this.prisma.flight.update({
        where: { id: booking.flightId },
        data: {
          availableSeats: {
            increment: 1,
          },
        },
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: status as any },
      include: {
        flight: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async deleteBooking(id: string) {
    const booking = await this.getBookingById(id);
    
    // Return seat if not already cancelled
    if (booking.status !== 'CANCELLED') {
      await this.prisma.flight.update({
        where: { id: booking.flightId },
        data: {
          availableSeats: {
            increment: 1,
          },
        },
      });
    }

    return this.prisma.booking.delete({
      where: { id },
    });
  }
}
