# إعداد تسجيل Google وصور Google

تُظهر الصفحة الرئيسية بطاقة تسجيل دخول بحساب Google. بعد نجاح الدخول، يعرض التطبيق تحية المستخدم وبريده الإلكتروني، ويربط حساب Google بهوية Firebase المجهولة الحالية إن وُجدت حتى لا يتغير معرّف محادثة مرشد. تُحفظ جلسة الدخول محليًا عبر AsyncStorage.

## المطلوب قبل البناء

1. في Firebase Console، افتح **Authentication → Sign-in method** وفعّل مزوّد **Google** للمشروع نفسه الذي يستخدمه التطبيق.
2. في Google Cloud Console، استخدم المشروع نفسه، وأكمل إعداد شاشة موافقة OAuth، ثم أنشئ معرّفات OAuth المناسبة للتطبيق.
3. تأكد من وجود OAuth client مستقل من نوع **Android** مربوط بالحزمة `com.murshid.s7` وبصمة SHA-1 الصحيحة لشهادة توقيع EAS، وأضف أيضًا SHA-1 الخاص بـ **Google Play App Signing** عند النشر عبر المتجر. معرّف Android يجب أن يكون من نوع Android، وليس نسخة من معرّف Web.
4. تُقرأ القيم المحلية من `.env`، كما أُضيفت معرّفات Android والويب وصور Google إلى بروفايل EAS الإنتاجي. هذه **معرّفات عميل عامة وليست أسرارًا**، وستكون مضمنة في التطبيق:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

في Android، يستخدم التطبيق الآن Google Credential Manager من خلال وحدة أصلية ويطلب `idToken` باستخدام `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`؛ لذلك لا يفتح تدفق OAuth داخل المتصفح ولا يعتمد على custom URI redirect الذي تسبب بالخطأ. يجب أن يكون معرّف Web من نوع **Web application**، وأن يكون مزود Google مفعّلًا في Firebase للمشروع نفسه. معرّف Android يظل مطلوبًا ومسجلًا في Google Cloud للتحقق من package + SHA-1، لكنه لا يُمرر إلى تدفق Android الأصلي. أما iOS فيبقى على تدفقه السابق ويتطلب `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. لا تضع Client Secret أو مفتاح خدمة Google داخل التطبيق أو في متغير يبدأ بـ `EXPO_PUBLIC_`.

حزمة `react-native-nitro-google-signin` لا تعمل داخل Expo Go. سجّل الدخول واختبره في نسخة Android مبنية من المشروع. لا يحتاج مسار Android ذي معرّف Web الصريح إلى `google-services.json`، لكنه يحتاج إلى بناء native جديد حتى تُضمّن وحدة Google وNitro.

## Google Photos

ميزة استرداد صور Google تستخدم `EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID` إن وُجد، وإلا تستخدم `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. ويمكن أن يكون معرّف صور Google منفصلًا إذا تطلب إعداد مشروع Google Cloud ذلك. فعّل Google Photos Picker API، وتأكد من إعداد شاشة الموافقة ونطاق منتقي الصور قبل التجربة.

## ملاحظة البناء

متغيرات `EXPO_PUBLIC_*` تُقرأ وقت إنشاء الحزمة. بعد إضافتها أو تغييرها، أنشئ APK/Build جديدًا؛ تحديث OTA وحده لا يغيّر القيم المضمّنة في نسخة مثبتة. بروفايل `production` يخرج APK، وبروفايل `production-aab` يخرج Android App Bundle:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform android --profile production-aab
```

قبل البناء، تأكد أن `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` هو معرّف Web الصحيح، وأن Android OAuth client في Google Cloud مربوط بـ`com.murshid.s7` وبصمات SHA-1 لشهادة EAS وGoogle Play. لا تستخدم Web client ID مكان Android client في Google Cloud. بعد تثبيت APK الجديد، جرّب اختيار الحساب وتحقق من ظهور البريد في بطاقة الحساب؛ لا يكفي تصدير JavaScript أو نشر OTA لإثبات نجاح التدفق الأصلي.
