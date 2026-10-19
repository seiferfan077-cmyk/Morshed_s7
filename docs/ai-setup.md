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

إذا ظهرت حالة **إعداد الدخول مطلوب** داخل الشاشة، فتحقق من ضبط قيم Firebase العامة في بيئة بناء التطبيق ومن تفعيل Anonymous sign-in. زر **اختبر اتصال مرشد** يختبر مسار الطلب من الجهاز.

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
