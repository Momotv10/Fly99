
import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';

@Module({
  controllers: [FlightController],
  providers: [FlightService, PrismaService],
  exports: [FlightService],
})
export class FlightModule {}
