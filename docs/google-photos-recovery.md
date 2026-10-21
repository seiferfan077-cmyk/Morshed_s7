# استرداد صور Google داخل مُرشد

## ما يدعمه المسار

يستخدم مُرشد Google Photos Picker API الرسمي. يختار المستخدم الصور والفيديوهات داخل Google Photos، ثم ينزل التطبيق نسخًا حقيقية إلى مجلد `murshid-vault` المحلي. لا تُرفع هذه الملفات إلى Worker أو Firebase، ولا تُحذف النسخ الأصلية من Google Photos أو من معرض الجهاز.

يتم طلب نطاق `photospicker.mediaitems.readonly` فقط. يحفظ التطبيق رموز OAuth في SecureStore على الجهاز، وليس في Git أو AsyncStorage أو الخادم. روابط `baseUrl` المؤقتة من Google صالحة لفترة محدودة، لذلك ينفذ التنزيل فور اختيار العناصر وبشكل متسلسل.

## ما لا يدعمه Google Photos API

لا يتيح Google Photos API الحالي قراءة مكتبة المستخدم كاملة أو تنزيلها دفعة واحدة من داخل التطبيق. Picker API يعيد فقط العناصر التي اختارها المستخدم. للاستيراد الكامل، ينشئ المستخدم أرشيفًا بنفسه عبر Google Takeout ثم يستخدم زر «استيراد ملفات» في المعرض. لا يتحايل مُرشد على هذه الحدود ولا يستخدم واجهات Library API القديمة للوصول العام إلى مكتبة المستخدم.

## إعداد Google Cloud المطلوب

1. إنشاء أو اختيار مشروع في Google Cloud.
2. تفعيل Google Photos Picker API.
3. إعداد شاشة OAuth للمستخدمين الخارجيين، وإضافة سياسة الخصوصية ونطاق التطبيق.
4. إنشاء OAuth Client ID مناسب لتطبيق الهاتف/التدفق المستخدم.
5. ضبط redirect URI الناتج من مخطط التطبيق `murshid://google-photos-oauth` وفق إعداد Google Cloud/Expo.
6. إضافة قيمة `EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID` إلى بيئة EAS development/preview/production. هذا Client ID ليس سرًا، لكن لا يوضع Client Secret داخل التطبيق.
7. قبل الإطلاق العام، إكمال مراجعة Google المطلوبة لنطاق Photos واختبار التطبيق بحسابات الاختبار.

## تنزيل المكتبة الكبيرة

يتم جلب صفحات العناصر عبر `nextPageToken`، ثم تنزيل ملف واحد في كل مرة إلى cache مؤقت، ونسخه إلى مساحة مُرشد، وحذف الملف المؤقت. يحفظ الفهرس `sourceId` لمنع التكرار ويحفظ الحجم والتاريخ المتاحين. تحفظ حالة الجلسة والعناصر المختارة في SecureStore حتى يمكن إيقاف التنزيل واستئنافه لاحقًا. عند فشل عنصر، يستمر باقي التنزيل وتظهر حصيلة الفشل للمستخدم.

## OTA مقابل APK

إضافة OAuth و`expo-auth-session` و`expo-web-browser` ومخطط التطبيق `murshid` تغييرات Native. لذلك تم رفع إصدار التطبيق إلى `0.4.0` و`versionCode` إلى `8`، وتحتاج الميزة إلى APK/AAB جديد. بعد تثبيت هذا الـBinary يمكن نشر إصلاحات JavaScript اللاحقة عبر OTA إذا لم تغيّر runtime أو إعدادات Native.

## المصادر الرسمية

- [Google Photos Picker: Get started](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Google Photos Picker: List and retrieve media items](https://developers.google.com/photos/picker/guides/media-items)
- [About the Google Photos APIs](https://developers.google.com/photos/overview/about)
- [Configure your app](https://developers.google.com/photos/overview/configure-your-app)
