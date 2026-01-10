# 🔧 دليل إصلاح مشاكل Zeabur

## ❓ ما هي المشكلة التي واجهتها؟

يرجى تحديد المشكلة:
- [ ] خطأ أثناء البناء (Build Error)
- [ ] خطأ أثناء بدء التشغيل (Runtime Error)
- [ ] التطبيق لا يستجيب
- [ ] خطأ في الاتصال بقاعدة البيانات

---

## ✅ الحلول حسب المشكلة

### 1️⃣ خطأ "Cannot find module"

**الأعراض:**
```
Error: Cannot find module '/src/index.js'
Error: Cannot find module 'dist/main'
```

**الحل:**
تأكد من أن Zeabur يستخدم الأوامر الصحيحة:

#### في Zeabur Dashboard:

**أ. إذا كنت تستخدم Dockerfile:**
- اذهب إلى Service Settings
- تأكد من أن Build Method = `Dockerfile`
- لا حاجة لإعدادات إضافية

**ب. إذا كنت تستخدم Buildpack (بدون Dockerfile):**
- اذهب إلى Service Settings → Build & Deploy
- تأكد من:
  ```
  Build Command: npm run build
  Start Command: npm run start:prod
  ```

---

### 2️⃣ خطأ في البناء (Build Fails)

**الأعراض:**
```
npm ERR! code ELIFECYCLE
npm ERR! errno 1
```

**الحلول:**

#### أ. مسح Cache في Zeabur
1. اذهب إلى Service Settings
2. Danger Zone → Clear Build Cache
3. Redeploy

#### ب. التأكد من Node Version
1. في Service Settings → Environment
2. أضف:
   ```
   NODE_VERSION=18
   ```

#### ج. تحقق من Logs
1. اذهب إلى Logs tab
2. ابحث عن الخطأ الدقيق
3. إذا كان الخطأ متعلق بـ Prisma:
   ```
   # أضف في Environment:
   PRISMA_GENERATE_IN_POSTINSTALL=true
   ```

---

### 3️⃣ خطأ الاتصال بقاعدة البيانات

**الأعراض:**
```
Error: P1001: Can't reach database server
Connection timeout
```

**الحل:**

#### أ. استخدم Internal Connection String
1. اذهب إلى PostgreSQL Service في Zeabur
2. في Instructions tab → اختر **Internal**
3. انسخ `DATABASE_URL` الداخلي
4. الصق في Environment Variables للـ Backend Service

مثال على الـ URL الداخلي:
```
postgresql://user:pass@postgres.zeabur.internal:5432/stams
```

#### ب. تحقق من Environment Variable
في Backend Service → Environment:
```env
DATABASE_URL=postgresql://user:pass@postgres.zeabur.internal:5432/stams?schema=public
```

⚠️ **مهم:** استخدم Internal URL وليس External!

---

### 4️⃣ الـ Port لا يعمل

**الأعراض:**
```
Application failed health check
Port 3000 is not accessible
```

**الحل:**

تأكد من أن `main.ts` يستمع على `0.0.0.0`:

```typescript
const port = parseInt(process.env.PORT || '8080', 10);
await app.listen(port, '0.0.0.0');
```

✅ الكود في المشروع المُصلح يحتوي على هذا بالفعل!

---

### 5️⃣ Prisma Migrations تفشل

**الأعراض:**
```
Error: Prisma migrate failed
Schema not found
```

**الحلول:**

#### أ. التشغيل اليدوي (مؤقت):
1. في Zeabur → Service → Terminal
2. شغّل:
   ```bash
   npx prisma migrate deploy
   ```

#### ب. الحل الدائم:
تأكد من أن Start Command يحتوي على migrations:
```bash
npx prisma migrate deploy && node dist/main.js
```

✅ هذا موجود في `package.json` script `start:prod`

#### ج. إنشاء Migration أولية:
إذا لم تكن هناك migrations:
```bash
# محلياً على جهازك:
npx prisma migrate dev --name init
# ثم ارفع المشروع مع مجلد prisma/migrations
```

---

### 6️⃣ Environment Variables غير موجودة

**الأعراض:**
```
JWT_SECRET is not defined
DATABASE_URL is required
```

**الحل:**

تأكد من إضافة جميع المتغيرات في Zeabur:

#### المتغيرات الإلزامية:
```env
NODE_ENV=production
PORT=8080
DATABASE_URL=<من PostgreSQL service - Internal URL>
JWT_SECRET=<مفتاح عشوائي قوي - 32 حرف على الأقل>
```

#### المتغيرات الاختيارية:
```env
JWT_EXPIRES_IN=24h
FRONTEND_URL=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### كيفية إضافتها:
1. Service Settings → Environment
2. انقر **Add Variable**
3. أدخل Key و Value
4. انقر **Save**
5. **Redeploy** (مهم!)

---

### 7️⃣ Health Check تفشل

**الأعراض:**
```
Health check failed on /
Application not responding
```

**الحل:**

#### أ. تحقق من Health Endpoint:
تأكد من أن التطبيق يعمل:
```bash
curl https://your-app.zeabur.app/api/v1/health
```

يجب أن ترى:
```json
{
  "status": "OK",
  "timestamp": "..."
}
```

#### ب. إعداد Health Check في Zeabur:
1. Service Settings → Health Check
2. Path: `/api/v1/health/ping`
3. Port: `8080` (أو PORT من Environment)

---

### 8️⃣ التطبيق بطيء أو يتوقف

**الأعراض:**
- استجابة بطيئة
- Timeout errors
- Out of Memory

**الحلول:**

#### أ. زيادة الموارد:
1. Service Settings → Resources
2. اختر Plan أعلى

#### ب. تحسين الأداء:
تأكد من أن `NODE_ENV=production`:
```env
NODE_ENV=production
```

#### ج. تقليل Logs:
في `main.ts`:
```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn'], // فقط الأخطاء
});
```

---

## 🔍 كيفية قراءة Logs

### في Zeabur Dashboard:
1. اذهب إلى Service
2. انقر على **Logs** tab
3. ابحث عن:
   - ❌ `ERROR` - أخطاء
   - ⚠️ `WARN` - تحذيرات
   - ✅ `Server Running` - التطبيق يعمل

### أنواع الـ Logs:

#### Build Logs:
```
[Build] Installing dependencies...
[Build] Building application...
[Build] ✓ Build completed
```

#### Runtime Logs:
```
[Runtime] Starting application...
[Runtime] ✅ Database connected
[Runtime] 🚀 Server Running: http://...
```

#### Error Logs:
```
[Runtime] ❌ Error: Cannot connect to database
[Runtime] Error: MODULE_NOT_FOUND
```

---

## 📋 Checklist للنشر الناجح

قبل النشر، تحقق من:

- [ ] ✅ PostgreSQL Service تم إنشاؤه في Zeabur
- [ ] ✅ نسخت `DATABASE_URL` من PostgreSQL (Internal)
- [ ] ✅ أضفت جميع Environment Variables
- [ ] ✅ رفعت المشروع على GitHub بشكل صحيح
- [ ] ✅ Zeabur مرتبط بـ GitHub Repository
- [ ] ✅ Build Method = Dockerfile (أو Buildpack)
- [ ] ✅ Port = 8080 في Environment
- [ ] ✅ مجلد `prisma` موجود في المشروع
- [ ] ✅ ملف `package.json` يحتوي على scripts صحيحة

---

## 🆘 الخطوات الطارئة

إذا فشل كل شيء، جرب هذا:

### 1. حذف كل شيء وإعادة البدء:
```bash
# في Zeabur:
1. احذف Service الحالي
2. احذف PostgreSQL Service
3. أنشئ مشروع جديد
4. ابدأ من الصفر
```

### 2. النشر المحلي أولاً:
```bash
# اختبر محلياً:
npm install
npx prisma generate
npm run build
npm run start:prod

# إذا عمل محلياً، المشكلة في Zeabur config
```

### 3. استخدم Docker محلياً:
```bash
docker build -t stams-test .
docker run -p 8080:8080 --env-file .env stams-test

# إذا عمل، المشكلة في Zeabur environment
```

---

## 📞 الحصول على مساعدة إضافية

### أ. معلومات مفيدة لتوفيرها:
عند طلب المساعدة، أرسل:
1. **Logs** من Zeabur (Build + Runtime)
2. **Environment Variables** (أخفِ القيم الحساسة)
3. **Screenshots** من Dashboard
4. **الخطأ الدقيق** الذي تراه

### ب. موارد مفيدة:
- [Zeabur Docs](https://zeabur.com/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)

---

## ✅ بعد الحل

بمجرد أن يعمل التطبيق:

### اختبر هذه Endpoints:
```bash
# Health Check
curl https://your-app.zeabur.app/api/v1/health

# Swagger UI
https://your-app.zeabur.app/api/docs

# تسجيل مستخدم
curl -X POST https://your-app.zeabur.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "fullName": "Test User"
  }'
```

---

**💡 نصيحة أخيرة:**
أكثر المشاكل شيوعاً هي:
1. ❌ استخدام External DATABASE_URL بدلاً من Internal
2. ❌ نسيان إضافة Environment Variables
3. ❌ عدم Redeploy بعد تغيير Environment

---

**🎉 حظاً موفقاً!**

إذا اتبعت هذا الدليل، يجب أن يعمل التطبيق بنجاح!
