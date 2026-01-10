# Zeabur Deployment Guide 🚀

## خطوات النشر على Zeabur

### 1. التحضير

تأكد من أن لديك:
- حساب على [Zeabur](https://zeabur.com)
- المشروع جاهز ومرفوع على GitHub (اختياري)

### 2. إعداد قاعدة البيانات

في لوحة تحكم Zeabur:
1. أنشئ Service جديد من نوع **PostgreSQL**
2. انسخ `DATABASE_URL` من إعدادات قاعدة البيانات

### 3. إعداد متغيرات البيئة

في Service الخاص بالتطبيق، أضف:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<من PostgreSQL Service>
JWT_SECRET=your_production_jwt_secret_here_change_this
JWT_EXPIRES_IN=24h
FRONTEND_URL=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. النشر

#### الطريقة الأولى: من GitHub
1. اربط Repository مع Zeabur
2. اختر Branch (main/master)
3. Zeabur سيكتشف Dockerfile تلقائياً
4. انقر Deploy

#### الطريقة الثانية: Zeabur CLI
```bash
# تثبيت CLI
npm install -g zeabur

# تسجيل الدخول
zeabur auth login

# النشر
zeabur deploy
```

### 5. التحقق من النجاح

بعد النشر، افتح:
- `https://your-app.zeabur.app/api/v1/health` - يجب أن ترى `"status": "OK"`
- `https://your-app.zeabur.app/api/docs` - توثيق Swagger

### 6. إعداد Domain مخصص (اختياري)

1. اذهب إلى Service Settings
2. Domains → Add Custom Domain
3. أدخل النطاق الخاص بك
4. اتبع التعليمات لإعداد DNS

## استكشاف الأخطاء الشائعة

### Error: Cannot find module '/src/index.js'
✅ **الحل**: هذا المشروع يستخدم NestJS، وليس Express البسيط
- ملف Entry Point الصحيح: `dist/main.js`
- Dockerfile يحتوي على Build steps الصحيحة
- تأكد من `package.json` يحتوي على script: `"start:prod": "node dist/main"`

### Error: Prisma Client not generated
```bash
# أضف في Dockerfile قبل npm run build:
RUN npx prisma generate
```

### Error: Database connection failed
- تحقق من `DATABASE_URL` صحيح
- تأكد من أن PostgreSQL Service يعمل
- في Zeabur، استخدم Internal Connection String

### Port Issues
Zeabur يستخدم متغير `PORT` تلقائياً. تأكد من:
```typescript
// في main.ts
const port = parseInt(process.env.PORT || '3000', 10);
await app.listen(port, '0.0.0.0'); // مهم: '0.0.0.0'
```

## Performance Tips

### 1. Enable Production Optimizations
```json
// في package.json
"scripts": {
  "build": "nest build",
  "start:prod": "node dist/main"
}
```

### 2. Database Pooling
إذا كنت تواجه مشاكل في الاتصال:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

### 3. Health Checks
Zeabur يستخدم Health Check للتأكد من أن التطبيق يعمل:
```
/api/v1/health/ping
```

## إعداد CI/CD

إذا كنت تستخدم GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Zeabur

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Zeabur
        uses: zeabur/deploy-action@v1
        with:
          token: ${{ secrets.ZEABUR_TOKEN }}
```

## Monitoring

في لوحة تحكم Zeabur:
- **Logs**: شاهد السجلات الفورية
- **Metrics**: استهلاك الموارد
- **Deployments**: تاريخ النشر

## Scaling

لزيادة القوة:
1. اذهب إلى Service Settings
2. Resources
3. اختر Plan أعلى

## Backup

قاعدة البيانات:
```bash
# من Zeabur Dashboard
PostgreSQL Service → Backup → Create Backup
```

---

**ملاحظة**: تأكد من تغيير `JWT_SECRET` في Production!

للمزيد من المساعدة: https://zeabur.com/docs
