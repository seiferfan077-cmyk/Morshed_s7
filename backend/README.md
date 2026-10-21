# Backend ذكاء مُرشد

يدعم هذا المجلد **Cloudflare Workers** و**Vercel Functions** باستخدام منطق المحادثة والمصادقة نفسه. خيار الاستضافة المختار حاليًا هو Cloudflare Worker عبر `worker.js` و`wrangler.toml`؛ تبقى ملفات `api/` متاحة لـVercel.

## النشر على Cloudflare Workers

من جذر المستودع:

```bash
cd backend
npx wrangler login
npx wrangler deploy
```

ينشئ هذا Worker باسم `murshid-ai-backend` على نطاق `workers.dev` إذا كان مفعّلًا في حساب Cloudflare. المسارات:

- `POST /api/ai/chat` — محادثة مُرشد، وتتطلب رمز Firebase ID صالحًا.
- `GET /api/health` — فحص وجود الإعدادات دون إرجاع قيمها.

في Cloudflare Dashboard افتح **Workers & Pages → murshid-ai-backend → Settings → Variables and Secrets**، ثم أضف:

- `GEMINI_API_KEY` بالنوع **Secret**؛ لا تضعه في التطبيق أو Git.
- `FIREBASE_PROJECT_ID` كمتغير عادي؛ يجب أن يطابق معرّف مشروع Firebase المستخدم في التطبيق.

يحدد `wrangler.toml` مسبقًا `AI_PROVIDER=gemini` و`GEMINI_MODEL=gemini-3.8-flash`. ويمكن إضافة السر من الطرفية بدل لوحة Cloudflare عبر `npx wrangler secret put GEMINI_API_KEY`؛ لا تكتب قيمته داخل الملفات. ملفات `.dev.vars*` مستثناة من Git محليًا.

بعد نشر الـWorker وضبط إعداداته، عيّن `EXPO_PUBLIC_API_BASE_URL` في بيئة بناء Expo/EAS على أصل نطاقه دون `/` في النهاية، مثل `https://murshid-ai-backend.<subdomain>.workers.dev`. اضبط إعدادات Firebase العامة في Expo، وفعّل **Anonymous** من Firebase Console → Authentication → Sign-in method. ينشئ التطبيق هوية Firebase للمستخدم تلقائيًا؛ لا يحتاج المستخدم إلى مفتاح Gemini خاص به.

### القناة الرسمية وكلمات مرور الإدارة

المنشورات محفوظة في D1 على الخادم، وهو المصدر المشترك بين الأجهزة وإصدارات التطبيق؛ ويحتفظ كل جهاز بنسخة SQLite محلية للقراءة عند انقطاع الاتصال. طبّق مخطط القناة مرة واحدة:

```bash
npm --prefix backend run channel:migrate
```

على Worker عيّن `CHANNEL_OWNER_TEMP_PASSWORD` و/أو `CHANNEL_ADMIN_TEMP_PASSWORD` كـSecrets قوية للاستخدام مرة واحدة. بعد إدخال السر المؤقت في التطبيق، يختار المسؤول كلمة مرور دائمة من 10 أحرف على الأقل، وتُحفظ مشتقة ومملّحة في D1. يمكن تشديد التهيئة بقوائم UID اختيارية `CHANNEL_OWNER_BOOTSTRAP_UIDS` و`CHANNEL_ADMIN_BOOTSTRAP_UIDS`. جلسة النشر تصدر بعد التحقق من كلمة المرور وتنتهي بعد 12 ساعة.

لإشعارات المنشورات، يسجّل التطبيق رمز Expo Push للجهاز بعد منح إذن الإشعارات وفتح القناة، ويحفظه Worker في `channel_devices`. عند النشر يرسل Worker إشعارًا للأجهزة المسجلة؛ يمكن ضبط `EXPO_ACCESS_TOKEN` كـSecret اختياري على Worker. يحتاج بناء Android إلى بيانات Firebase Cloud Messaging الخاصة بـEAS، كما يلزم أن يسمح المستخدم بإشعارات التطبيق. الضغط على الإشعار يفتح تبويب القناة.

## إعداد Gemini والتحقق

يستخدم تكامل Gemini Interactions API مع `store: false`. طلبات المحادثة تستخدم Firebase ID token في `Authorization: Bearer …`، ويرفض Backend الطلبات غير الموثقة.

بعد ضبط `GEMINI_API_KEY` و`FIREBASE_PROJECT_ID` وإعادة نشر البيئة، افحص:

```text
https://<worker-domain>/api/health
```

الرد `{"ok":true,"configured":true}` يعني أن إعدادات الخادم موجودة، لكنه لا يختبر صلاحية مفتاح Gemini. لاختبار المزود فعليًا، أرسل رسالة من شاشة مُرشد AI بعد إعداد عنوان الـWorker في التطبيق.

## API contract

يرسل التطبيق طلبًا إلى `POST https://<backend-domain>/api/ai/chat` مع `Authorization: Bearer <Firebase ID token>` و`Content-Type: application/json`:

```json
{
  "messages": [{ "role": "user", "content": "ساعدني أنظم يومي" }],
  "memory": [{ "content": "أفضل البدء مبكرًا" }],
  "activeGoals": ["إنهاء الدراسة"],
  "activeTasks": ["مراجعة الفصل الأول"]
}
```

الرد الناجح:

```json
{ "role": "assistant", "content": "..." }
```

لا يضمّن التطبيق مفتاحًا مشتركًا قابلًا للاستخراج، ولا يقبل Backend رموزًا ثابتة من التطبيق. لا يمكن لعميل خارجي استخدام endpoint إلا إذا حصل على Firebase ID token صالح من المشروع نفسه.

## الخصوصية والأمان وحدود الاستخدام

- يرسل التطبيق آخر 12 رسالة والسياق الذي يختاره المستخدم فقط؛ المحادثات محفوظة محليًا على الجهاز.
- لا يسجل Backend محتوى المحادثة أو المفاتيح، ويضع `Cache-Control: no-store` ويرفض الأجسام والأدوار والسياقات غير الصالحة.
- يبقى مفتاح المزود على الخادم. يتحقق Backend من Firebase ID token بالتوقيع ومطابقة issuer/audience/expiry، باستخدام مفاتيح Google العامة، دون حفظ service-account key.
- Firebase Anonymous Auth ينشئ هوية Firebase لكل مستخدم/جهاز. لا توجد حاليًا حصة استخدام دائمة أو حد يومي لكل UID؛ قبل الإطلاق العام أضف rate limiting دائمًا ومراقبة استهلاك المزود لمنع إساءة الاستخدام.
- راجع أسعار Gemini وحدود حساب Cloudflare قبل الإطلاق. قد تختلف أسعار Gemini وشروط استخدام بيانات الحصة المجانية باختلاف مستوى الحساب.

## التوافق مع Vercel والاختبارات

تبقى ملفات `api/` و`lib/vercel-adapter.js` قابلة للنشر على Vercel. اختر `backend` كـRoot Directory، وأضف متغيرات `AI_PROVIDER` و`GEMINI_API_KEY` و`GEMINI_MODEL` و`FIREBASE_PROJECT_ID` في إعدادات المشروع. لا تحفظ مفاتيح المزود في Git أو متغيرات `EXPO_PUBLIC_*`.

لتشغيل الاختبارات المحلية من جذر المستودع:

```bash
npm run backend:test
```

الاختبارات تستخدم mocks ولا تحتاج مفاتيح حقيقية.
