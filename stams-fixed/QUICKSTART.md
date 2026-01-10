# Quick Start Guide ⚡

دليل سريع لتشغيل المشروع في أقل من 5 دقائق!

## 🎯 الخطوات السريعة

### 1. التثبيت (دقيقة واحدة)

```bash
# استنساخ المشروع
git clone <your-repo-url>
cd stams-aero-intelligence

# تثبيت Dependencies
npm install
```

### 2. قاعدة البيانات (دقيقتان)

```bash
# إنشاء ملف .env
cp .env.example .env

# تعديل DATABASE_URL في .env
# مثال: DATABASE_URL="postgresql://user:pass@localhost:5432/stams"

# إنشاء قاعدة البيانات
npx prisma generate
npx prisma migrate dev --name init
```

### 3. التشغيل (30 ثانية)

```bash
# Development mode
npm run start:dev

# سيعمل على: http://localhost:3000
# التوثيق: http://localhost:3000/api/docs
```

## 🧪 اختبار سريع

```bash
# فحص الصحة
curl http://localhost:3000/api/v1/health

# تسجيل مستخدم
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "fullName": "Test User"
  }'
```

## 📊 بيانات تجريبية (اختياري)

```bash
# إنشاء بيانات تجريبية
npx prisma db seed
```

## 🐳 Docker (بديل)

```bash
# البناء
docker build -t stams-backend .

# التشغيل
docker run -p 3000:3000 --env-file .env stams-backend
```

## 🚀 النشر السريع على Zeabur

```bash
# 1. أنشئ حساب على zeabur.com
# 2. اربط GitHub Repository
# 3. أضف متغيرات البيئة:
#    - DATABASE_URL
#    - JWT_SECRET
# 4. انقر Deploy!
```

## 📱 اختبار API بسرعة

افتح Swagger UI:
```
http://localhost:3000/api/docs
```

أو استخدم الطلبات الجاهزة في `tests/requests.http`

## ❓ مشاكل شائعة

### Port مستخدم؟
```bash
# غيّر PORT في .env
PORT=3001
```

### خطأ في Prisma؟
```bash
npm install @prisma/client
npx prisma generate
```

### خطأ في Database؟
تأكد من:
- PostgreSQL يعمل
- DATABASE_URL صحيح
- قاعدة البيانات موجودة

## 🎉 تم!

الآن لديك API جاهز للعمل!

التالي:
- استكشف API Documentation في `/api/docs`
- جرّب Endpoints مختلفة
- ابدأ في التطوير!

---

للمزيد من التفاصيل، راجع [README.md](README.md)
