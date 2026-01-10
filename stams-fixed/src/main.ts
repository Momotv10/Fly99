
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Security - Helmet
  app.use(helmet());

  // CORS Configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,Accept',
  });

  // Rate Limiting
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      message: {
        statusCode: 429,
        message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Documentation with Swagger
  const config = new DocumentBuilder()
    .setTitle('STAMS Aero Intelligence API')
    .setDescription(
      'التوثيق الرسمي لمنظومة الربط التشغيلي الموحد لقطاع الطيران - إصدار المؤسسات',
    )
    .setVersion('2.5.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'نقاط نهاية المصادقة وإدارة الجلسات')
    .addTag('Bookings', 'إدارة الحجوزات والتذاكر')
    .addTag('Flights', 'إدارة الرحلات والمخزون')
    .addTag('Finance', 'نظام المحاسبة والتقارير المالية')
    .addTag('WhatsApp', 'تكامل WhatsApp Business API')
    .addTag('Health', 'فحص حالة النظام')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  // Start Server
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 STAMS Aero Intelligence Enterprise Platform              ║
║                                                               ║
║   📍 Server Running: http://localhost:${port}                   ║
║   📝 API Documentation: http://localhost:${port}/api/docs       ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                              ║
║   📦 Version: 2.5.0                                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
