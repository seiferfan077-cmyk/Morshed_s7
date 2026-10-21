# إعداد تسجيل Google وصور Google

تُظهر الصفحة الرئيسية بطاقة تسجيل دخول بحساب Google. بعد نجاح الدخول، يعرض التطبيق تحية المستخدم وبريده الإلكتروني، ويربط حساب Google بهوية Firebase المجهولة الحالية إن وُجدت حتى لا يتغير معرّف محادثة مرشد. تُحفظ جلسة الدخول محليًا عبر AsyncStorage.

## المطلوب قبل البناء

1. في Firebase Console، افتح **Authentication → Sign-in method** وفعّل مزوّد **Google** للمشروع نفسه الذي يستخدمه التطبيق.
2. في Google Cloud Console، استخدم المشروع نفسه، وأكمل إعداد شاشة موافقة OAuth، ثم أنشئ معرّفات OAuth المناسبة للتطبيق.
3. اضبط معرّف Android لتطابق حزمة التطبيق `com.murshid.s7` وبصمة SHA-1 لشهادة التوقيع المستخدمة في البناء. معرّف iOS اختياري إلى أن تُحدد حزمة iOS النهائية للتطبيق.
4. أضف القيم العامة التالية إلى بيئة بناء Expo/EAS. هذه **معرّفات عميل عامة وليست أسرارًا**، وستكون مضمنة في التطبيق:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

يحتاج Android إلى `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`، ويحتاج iOS إلى `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. لا تضع Client Secret أو مفتاح خدمة Google داخل التطبيق أو في متغير يبدأ بـ `EXPO_PUBLIC_`.

## Google Photos

ميزة استرداد صور Google تستخدم `EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID` إن وُجد، وإلا تستخدم `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. ويمكن أن يكون معرّف صور Google منفصلًا إذا تطلب إعداد مشروع Google Cloud ذلك. فعّل Google Photos Picker API، وتأكد من إعداد شاشة الموافقة ونطاق منتقي الصور قبل التجربة.

## ملاحظة البناء

متغيرات `EXPO_PUBLIC_*` تُقرأ وقت إنشاء الحزمة. بعد إضافتها أو تغييرها، أنشئ APK/Build جديدًا؛ تحديث OTA وحده لا يغيّر القيم المضمّنة في نسخة مثبتة. إذا ظهر تنبيه الإعداد غير مكتمل، راجع تفعيل Google في Firebase ومعرّف OAuth المطابق لنظام الهاتف.
