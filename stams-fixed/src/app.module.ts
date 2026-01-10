
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';

// Core Services
import { PrismaService } from './prisma/prisma.service';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { FlightModule } from './modules/flight/flight.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // Environment Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Passport & JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'STAMS_SECRET_KEY_2024',
      signOptions: { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    }),

    // Feature Modules
    AuthModule,
    BookingModule,
    FlightModule,
    FinanceModule,
    WhatsappModule,
    HealthModule,
    NotificationsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
