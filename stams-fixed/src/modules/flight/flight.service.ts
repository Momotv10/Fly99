
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(private prisma: PrismaService) {}

  async createFlight(data: {
    flightNumber: string;
    airline: string;
    origin: string;
    destination: string;
    departureTime: Date;
    arrivalTime: Date;
    aircraft: string;
    capacity: number;
    basePrice: number;
  }) {
    const flight = await this.prisma.flight.create({
      data: {
        ...data,
        availableSeats: data.capacity,
        status: 'SCHEDULED',
      },
    });

    this.logger.log(`New flight created: ${flight.flightNumber}`);
    return flight;
  }

  async searchFlights(filters: {
    origin?: string;
    destination?: string;
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (filters.origin) {
      where.origin = { contains: filters.origin, mode: 'insensitive' };
    }
    
    if (filters.destination) {
      where.destination = { contains: filters.destination, mode: 'insensitive' };
    }

    if (filters.date) {
      const startDate = new Date(filters.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      where.departureTime = {
        gte: startDate,
        lt: endDate,
      };
    }

    const [flights, total] = await Promise.all([
      this.prisma.flight.findMany({
        where,
        orderBy: { departureTime: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.flight.count({ where }),
    ]);

    return {
      flights,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFlightById(id: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: {
        bookings: {
          select: {
            id: true,
            bookingRef: true,
            passengerName: true,
            status: true,
          },
        },
      },
    });

    if (!flight) {
      throw new NotFoundException('الرحلة غير موجودة');
    }

    return flight;
  }

  async getAllFlights(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [flights, total] = await Promise.all([
      this.prisma.flight.findMany({
        orderBy: { departureTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.flight.count(),
    ]);

    return {
      flights,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateFlight(id: string, data: any) {
    await this.getFlightById(id);

    return this.prisma.flight.update({
      where: { id },
      data,
    });
  }

  async updateFlightStatus(id: string, status: string) {
    return this.updateFlight(id, { status });
  }

  async deleteFlight(id: string) {
    await this.getFlightById(id);

    return this.prisma.flight.delete({
      where: { id },
    });
  }
}
