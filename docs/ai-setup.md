# إعداد مُرشد الذكي

تستخدم شاشة **مرشد** الخدمة المركزية الآمنة المنشورة على Cloudflare Worker افتراضيًا. عنوان الخدمة هو:

`https://murshid-ai-backend.murshid-s7.workers.dev`

يستقبل التطبيق رسالة المستخدم، ويرسلها إلى الخدمة مع Firebase ID token، ثم يعرض رد مرشد داخل المحادثة. لا يحتاج المستخدم إلى إدخال مفتاح Gemini في التطبيق. الحد الأدنى لزمن الرد الناجح عشر ثوانٍ.

## إعداد نسخة التطبيق

اضبط قيم Firebase العامة التالية في بيئة Expo/EAS المستخدمة لبناء التطبيق:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` (اختياري؛ لا يلزم للمصادقة أو المحادثة)

فعّل Anonymous sign-in في Firebase Authentication. يمكن ترك `EXPO_PUBLIC_API_BASE_URL` غير مضبوط؛ سيستخدم التطبيق عنوان الخدمة المنشورة تلقائيًا. وللتطوير المحلي، انسخ `.env.example` إلى `.env` وأدخل إعدادات Firebase العامة فقط. يمكن تعيين متغير `EXPO_PUBLIC_API_BASE_URL` إلى عنوان Backend بديل.

تُحفظ `GEMINI_API_KEY` و`FIREBASE_PROJECT_ID` كأسرار على Cloudflare Worker، ولا يجوز وضعهما في التطبيق أو في Git أو في متغيرات `EXPO_PUBLIC_*`. إعداد Gemini وFirebase السري موجود في [دليل Backend](../backend/README.md).

للبناء البعيد عبر EAS، أضف قيم Firebase العامة إلى بيئتي `production` و`preview` (و`development` عند الحاجة)، واجعلها متغيرات نصية عادية لأنها ستُضمّن في حزمة التطبيق. يقرأ البناء المحلي القيم من ملف البيئة المحلي. لا تضع مفاتيح Gemini أو كلمات مرور القناة في متغيرات `EXPO_PUBLIC_*`.

إذا ظهرت حالة **إعداد الدخول مطلوب** داخل الشاشة، فتحقق من ضبط قيم Firebase العامة في بيئة بناء التطبيق ومن تفعيل Anonymous sign-in. زر **اختبر اتصال مرشد** يختبر مسار الطلب من الجهاز.

## القناة الرسمية

- تفتح القناة من تبويب **القناة الرسمية** أو زر **فتح القناة** في الصفحة الرئيسية. يرسل التطبيق Firebase ID token إلى المسار `/api/channel/feed` على عنوان `EXPO_PUBLIC_API_BASE_URL`.
- يحتاج Cloudflare Worker إلى `FIREBASE_PROJECT_ID` مطابق لمشروع التطبيق، وربط D1 باسم `CHANNEL_DB`، ثم تطبيق `backend/channel-schema.sql` مرة واحدة.
- قراءة المنشورات لا تحتاج كلمة مرور إدارة. النشر الإداري فقط يحتاج أسرار التهيئة `CHANNEL_OWNER_TEMP_PASSWORD` أو `CHANNEL_ADMIN_TEMP_PASSWORD` وقائمة UID المسموح بها على Worker؛ لا تحفظ هذه القيم داخل التطبيق.

## المحادثة والخصوصية

- تُحفظ أحدث 12 رسالة محليًا على الجهاز؛ زر سلة المهملات يمسح سجل هذا الجهاز.
- لا تُرسل الذاكرة إلى المزود إلا بعد تفعيل زر **استخدام الذاكرة**. عند تفعيله، يرسل التطبيق حتى خمس ذكريات مقبولة وغير حساسة وذات صلة.
- لا ترسل كلمات مرور أو معلومات شخصية حساسة.
- الردود مولدة آليًا وقد تخطئ؛ تحقّق من المعلومات المهمة، وخصوصًا الدينية أو الصحية أو القانونية.

## الاختبارات

```bash
npm run ai:test
npm run lint
npm run typecheck
npm run backend:test
```

تستخدم الاختبارات مزودات وهمية ولا تحتاج مفتاح API حقيقيًا.
