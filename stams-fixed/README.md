# STAMS Aero Intelligence - Enterprise Platform 🚀

منظومة الربط التشغيلي الموحد لقطاع الطيران - إصدار المؤسسات

## ✨ المميزات

- 🔐 **نظام مصادقة متكامل** - JWT Authentication مع دعم الأدوار المتعددة
- ✈️ **إدارة الرحلات** - نظام متكامل لإدارة جدول الرحلات والمخزون
- 📋 **إدارة الحجوزات** - حجز وإدارة التذاكر بشكل احترافي
- 💰 **نظام محاسبي متقدم** - Double-Entry Accounting System
- 💬 **تكامل WhatsApp Business** - Webhook Integration للرد الآلي
- 🔔 **إشعارات فورية** - WebSocket real-time notifications
- 📊 **تقارير مالية** - Dashboard متكامل للتقارير والإحصائيات
- 📝 **توثيق API تفاعلي** - Swagger/OpenAPI Documentation

## 🛠️ التقنيات المستخدمة

- **Backend Framework**: NestJS 10
- **Database**: PostgreSQL 15 + Prisma ORM
- **Authentication**: JWT + Passport
- **API Documentation**: Swagger/OpenAPI
- **Real-time**: Socket.IO WebSockets
- **Security**: Helmet, Rate Limiting, CORS
- **Validation**: class-validator, class-transformer

## 📦 المتطلبات

- Node.js 18+
- PostgreSQL 15+
- npm 9+

## 🚀 التثبيت والتشغيل

### 1. تثبيت Dependencies

```bash
npm install
```

### 2. إعداد قاعدة البيانات

إنشاء ملف `.env`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/stams?schema=public"
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
```

### 3. تشغيل Migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. تشغيل التطبيق

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 🌐 النشر على Zeabur

### الطريقة الأولى: من GitHub

1. ادفع المشروع إلى GitHub
2. اربط Repository مع Zeabur
3. أضف متغيرات البيئة في Zeabur Dashboard
4. انشر!

### الطريقة الثانية: Docker

```bash
docker build -t stams-backend .
docker run -p 3000:3000 --env-file .env stams-backend
```

## 📚 API Endpoints

بعد التشغيل، يمكنك الوصول إلى التوثيق التفاعلي:

```
http://localhost:3000/api/docs
```

### أهم النقاط:

#### المصادقة
- `POST /api/v1/auth/register` - تسجيل مستخدم جديد
- `POST /api/v1/auth/login` - تسجيل الدخول
- `GET /api/v1/auth/profile` - معلومات المستخدم

#### الرحلات
- `GET /api/v1/flights/search` - البحث عن رحلات
- `GET /api/v1/flights` - قائمة الرحلات
- `POST /api/v1/flights` - إضافة رحلة (Admin/Supplier)

#### الحجوزات
- `POST /api/v1/bookings` - إنشاء حجز جديد
- `GET /api/v1/bookings/my-bookings` - حجوزاتي
- `GET /api/v1/bookings/:id` - تفاصيل حجز

#### المالية
- `POST /api/v1/finance/transactions` - إنشاء معاملة
- `GET /api/v1/finance/reports/summary` - تقرير مالي

#### WhatsApp
- `POST /api/v1/whatsapp/webhook` - Webhook endpoint
- `POST /api/v1/whatsapp/send` - إرسال رسالة

#### الصحة
- `GET /api/v1/health` - فحص حالة النظام
- `GET /api/v1/health/ping` - Ping

## 🔒 الأمان

- ✅ Helmet.js للحماية من الثغرات الشائعة
- ✅ Rate Limiting لمنع هجمات DDoS
- ✅ CORS Configuration
- ✅ Input Validation مع class-validator
- ✅ JWT Authentication
- ✅ Role-Based Access Control (RBAC)

## 👥 الأدوار المتاحة

- `ADMIN` - مدير النظام (صلاحيات كاملة)
- `AGENT` - موظف الحجوزات
- `SUPPLIER` - مزود الخدمة
- `CUSTOMER` - العميل
- `ACCOUNTANT` - المحاسب

## 🐛 استكشاف الأخطاء

### خطأ "Cannot find module"
تأكد من تشغيل:
```bash
npm install
npx prisma generate
npm run build
```

### خطأ الاتصال بقاعدة البيانات
تحقق من `DATABASE_URL` في ملف `.env`

### خطأ Port مستخدم
غيّر المنفذ في `.env`:
```env
PORT=3001
```

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License

## 📞 الدعم الفني

للدعم الفني والاستفسارات:
- البريد الإلكتروني: support@stams-aero.com
- الموقع: https://stams-aero.com

---

صُنع بـ ❤️ في مصر
