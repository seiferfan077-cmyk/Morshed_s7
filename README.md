# مُرشد - S7

تطبيق Android مبني على **React Native + Expo** بهدف توفير مساحة عملية هادئة للتصفح، الوسائط، الملفات، والمساعد الذكي. هذا المستودع هو مصدر الحقيقة للمشروع، ويمكن تطويره من Termux أو أي بيئة Node/Expo خارج Manus.

> **الحالة الحالية:** هذه هي مرحلة تأسيس المشروع. الأساس قابل للتشغيل ويحتوي على Design System، Navigation، Home، وعقود الخدمات. الميزات الأصلية الثقيلة مثل WebView والتنزيلات وFileSystem لم تُدّعَ مكتملة بعد، وستُضاف تدريجيًا مع اختبارها وتوثيق قيودها.

## What was built

- مشروع Expo TypeScript مستقل باسم `murshid-s7`.
- تنقل سفلي عربي بين الرئيسية، المتصفح، المعرض، والإعدادات.
- شاشة Home حديثة بهوية مُرشد، بطاقات وصول سريع وملخص تخزين.
- Design System موحد في `src/theme/` للألوان، الخطوط، المسافات، الزوايا والظلال.
- مكونات UI قابلة لإعادة الاستخدام: `SurfaceCard`, `ActionButton`, `EmptyState`, `ScreenHeader`.
- عقود Modular للخدمات: Storage، AI، Authentication.
- متصفح WebView فعلي مع عنوان/بحث، Back، Forward، Refresh، Home، حالة تحميل، وقيود تكبير أساسية مع إبقاء الحقول قابلة للكتابة.
- `.env.example` بدون أسرار.
- إعداد Android أولي مع package id محلي: `com.murshid.s7`.

## What is working

- تشغيل المشروع عبر Expo.
- TypeScript check يمر بنجاح.
- التنقل بين التبويبات.
- الضغط على أدوات Home ينقل المستخدم إلى الوجهة المتاحة حاليًا.
- فتح المواقع والبحث داخل WebView، مع تحديث العنوان عند التنقل.
- واجهات الحالات الفارغة تعرض بوضوح ما هو مهيأ وما لم يُوصل بعد.

## Partially implemented / not implemented yet

| المجال | الحالة | السبب والمرحلة التالية |
|---|---|---|
| Kiosk Browser | منفذ جزئيًا | WebView والعنوان والبحث والتنقل والـ injected zoom policy تعمل؛ يلزم Development Build واختبار أجهزة حقيقية قبل اعتماد قيود Kiosk الأوسع. |
| Download Manager | عقد معماري فقط | سيُبنى حول ملفات `.tmp`، progress، retry، duplicate detection، ثم نقل الملف النهائي بعد التحقق. |
| Gallery | واجهة حالة فارغة | سيُربط بـ metadata store وvirtualized grid وthumbnail/cache. |
| Files | واجهة حالة فارغة | سيُربط بـ Expo FileSystem بعد تحديد سياسة التخزين والصلاحيات في Android الحديث. |
| AI | Provider contract فقط | يجب إنشاء Backend مستقل؛ لا توضع مفاتيح مزود AI داخل التطبيق. |
| Authentication | Provider-neutral contract | يمكن إضافة Supabase أو Firebase adapter دون تغيير الشاشات. |
| Backend / Database / S3 | غير مفعلة | لا توجد خدمة خارجية مفروضة أو اشتراكات منشأة دون موافقة المستخدم. |

## Architecture

```text
App.tsx
  └── AppNavigator
      ├── HomeScreen
      ├── BrowserScreen      (WebView + address/search + Kiosk policy)
      ├── MediaScreen        (next: metadata-driven gallery)
      └── SettingsScreen

UI Components ──> Design System
Screens       ──> Services contracts
Modules       ──> Provider adapters
Services      ──> External Backend / native APIs (future)
```

### Data flow المستهدف للتنزيل

```text
WebView
  ↓
Download Manager
  ↓
Temporary .tmp file
  ↓
Validation + duplicate check
  ↓
StorageProvider.saveFile()
  ↓
MediaMetadata
  ↓
State/event update
  ↓
Gallery UI
```

## Folder structure

```text
.
├── App.tsx
├── assets/                 # Local bundled icon/splash assets
├── src/
│   ├── components/         # Shared UI primitives
│   ├── navigation/         # Navigation graph and route contracts
│   ├── screens/            # Screen composition only
│   ├── services/
│   │   ├── ai/             # AIProvider and Backend adapter
│   │   ├── auth/           # AuthProvider contract
│   │   ├── storage/        # StorageProvider abstraction
│   │   └── api/            # Future API client and error policy
│   ├── modules/             # Feature-owned logic: browser/media/files/settings
│   ├── theme/               # Design tokens
│   └── types/               # Shared domain types
├── docs/                    # Architecture notes and decision records
├── .env.example             # Names only; no credentials
├── app.json                 # Expo identity and Android configuration
└── README.md
```

## لماذا هذه المعمارية؟

- **الشاشات لا تتعامل مباشرة مع FileSystem:** حتى نستطيع تبديل Expo FileSystem بـ S3 أو Provider آخر دون إعادة كتابة UI.
- **AI خلف Backend:** لأن أي secret داخل APK قابل للاستخراج. التطبيق يرسل إلى endpoint يملكه المستخدم، والمفتاح يبقى على الخادم.
- **Types مستقلة عن المزود:** `MediaMetadata`, `AppSettings`, `AuthSession` تمثل domain وليست استجابة Supabase أو Firebase.
- **Modules مستقلة:** كل Feature جديدة تملك منطقها، وتستدعي العقود المشتركة فقط.

## Local development

متطلبات أساسية:

- Node.js 20 أو أحدث.
- npm أو pnpm.
- Expo CLI عبر `npx expo`.
- Android Studio/SDK للبناء المحلي، أو Expo Go للتجارب التي لا تحتاج Native Modules إضافية.

```bash
git clone https://github.com/seiferfan077-cmyk/Morshed_s7.git
cd Murshid-S7
npm install
npm start
```

أوامر مفيدة:

```bash
npm run android   # تشغيل Metro ومحاولة فتح Android
npm run web       # معاينة الواجهات على الويب عند دعم الحزم
npx tsc --noEmit  # فحص TypeScript
npx expo doctor   # فحص توافق Expo
```

## Termux workflow

```bash
pkg update
pkg install nodejs git
npm install -g eas-cli
# داخل مجلد المشروع
npm install
npx expo start --tunnel
npx tsc --noEmit
```

البناء المحلي الكامل لـ Android قد يتطلب Android SDK وJava، وهما أثقل من تشغيل Metro. عندما نضيف WebView أو Native download/background APIs، سنحدد في README إن كان Development Build مطلوبًا بدل Expo Go.

## Environment variables and external services

حاليًا لا توجد Credentials مطلوبة لتشغيل الأساس. انسخ المثال عند الحاجة:

```bash
cp .env.example .env
```

- `EXPO_PUBLIC_API_BASE_URL`: عنوان Backend عام فقط.
- `AI_PROVIDER_API_KEY`: **للاستخدام الخادمي فقط**، ولا يوضع في Expo أو GitHub.

الخدمات المقترحة مستقبلًا، وليست مفعلة تلقائيًا:

| الحاجة | خيارات مناسبة | التكلفة/الحدود |
|---|---|---|
| Auth + Database | Supabase أو Firebase | Free tiers محدودة؛ الأسعار تتغير حسب الاستخدام. |
| AI Gateway | Backend خاص مع مزود يختاره المستخدم | تكلفة حسب المزود/التوكن؛ المفتاح يبقى على الخادم. |
| Object storage | S3-compatible provider | Free tier أو تكلفة تخزين/نقل حسب المزود. |

لا يتم إنشاء اشتراك أو ربط خدمة مدفوعة دون موافقة صريحة.

## GitHub workflow

الفرع الرئيسي `main` هو مصدر الحقيقة. استخدم Commits صغيرة مفهومة:

```bash
git checkout -b feat/webview-kiosk
git add src/modules/browser src/screens/BrowserScreen.tsx
git commit -m "feat: add kiosk browser foundation"
git push -u origin feat/webview-kiosk
```

لا تضع `.env` أو مفاتيح AWS/AI أو Tokens في Git.

## How to add a new feature

مثال: إضافة QR Scanner:

1. أنشئ `src/modules/qr-scanner/` للعقد والمنطق.
2. أضف service adapter إذا احتاج Native API.
3. أضف screen في `src/screens/`، ولا تضع business logic داخلها.
4. أضف route في `src/navigation/AppNavigator.tsx`.
5. أضف بطاقة Home وإعدادات فقط بعد تحديد السلوك الحقيقي.
6. أضف types واختبار للحالات الفاشلة.
7. حدّث هذا README و`docs/architecture.md`.
8. نفّذ `npx tsc --noEmit` ثم Commit صغيرًا.

## How to modify an existing feature

لتعديل الصور: ابدأ من `src/modules/media/`، ثم راجع `src/services/storage/`، ثم metadata/state، ثم `MediaScreen`. لا تجعل الشاشة تنفذ عمليات الملفات بنفسها.

## Security and Android notes

- أقل صلاحيات ممكنة فقط، وبعد معرفة API Android المستهدف.
- لا يوجد تصميم لتجاوز DRM أو paywalls أو authentication أو protected media.
- Launcher icon وSplash محليان ولا يعتمدان على الإنترنت.
- امتلاء التخزين، فقد الاتصال، أو فشل Backend يجب أن ينتج Error State وليس crash.
- Background downloads وMediaStore وWebView restrictions قد تتطلب Development Build أو Native module؛ سنوثق ذلك قبل تفعيلها.

## Build APK / AAB

لم يتم تفعيل EAS أو إنشاء Credentials في هذه المرحلة. بعد اختيار سياسة التوقيع:

```bash
npx eas login
npx eas build:configure
npx eas build --platform android --profile preview   # APK حسب profile
npx eas build --platform android --profile production # AAB حسب profile
```

لا تحفظ keystore أو EAS token في المستودع. OTA Updates تحتاج اختيار `expo-updates` وسياسة release واضحة، ولا تصلح لتغييرات Native.

## Testing and release gates

قبل اعتبار أي Phase مكتملة:

1. فحص TypeScript.
2. فحص Expo Doctor عند تغييرات Native.
3. اختبار حالات النجاح والفشل المرتبطة بالميزة.
4. تحديث README بما يعمل فعليًا وما بقي جزئيًا.
5. Commit واضح، ثم push إلى GitHub.

## Roadmap

1. WebView + address/search + navigation/back policy.
2. Download manager resilient with temporary files and retry.
3. Real local storage and metadata repository.
4. Gallery virtualization, thumbnails, viewer/share/delete.
5. Files module and Android MediaStore strategy.
6. Backend adapter + authentication choice.
7. AI chat backed by user-owned server.
8. Performance, lifecycle, offline cache, automated tests.
9. APK/AAB profiles and release documentation.

## Known issues / technical notes

- الشاشات الحالية Foundation وليست بديلًا عن WebView أو Gallery أصلية.
- `react-native-webview` والتنزيلات في الخلفية لم تُثبت عمدًا قبل اختيار Development Build المناسب.
- Expo Go لا يمثل كل قدرات Android Native؛ لا نعد بعمل Native features قبل بناء Development Build واختبار جهاز فعلي.
- تكلفة وخيارات Backend/AI/S3 متغيرة ويجب تأكيدها وقت الاختيار.

## Delivery report

- **What was built:** Expo TypeScript foundation، design system، navigation، screens، service contracts، docs، Git-ready structure.
- **What is working:** تشغيل، تنقل، واجهات أساسية، TypeScript check.
- **Partially implemented:** Browser/Media/Files/AI/Auth contracts and empty states.
- **Not implemented:** Native WebView، downloads، persistence، real auth/backend، EAS credentials.
- **Required external services:** لا شيء حاليًا؛ ستُقترح الخيارات قبل الربط.


## Firebase + Improvement Hub (alternative path)

بسبب عدم ظهور بطاقة Web Dev، تم إنشاء طبقة Firebase وواجهة Hub في المستودع المحلي المرتبط بـGitHub بدل إيقاف العمل. الطبقة لا تفترض وجود مشروع Firebase ولا تعرض بيانات وهمية: عند غياب الإعداد تظهر حالة `Firebase غير موصل بعد`، وعند اكتمال public configuration يستخدم التطبيق Firestore adapter.

الملفات الأساسية هي `src/services/firebase/` و`src/screens/HubScreen.tsx` و`firebase/firestore.rules`. واجهة Hub تعرض حالة الاتصال، دورة `draft → review → approved → published`، وتصنيف `dynamic / ota / native`. تفاصيل نموذج البيانات، قواعد الأمان، والخطوات التي تحتاج حساب المالك موجودة في [`docs/firebase-hub.md`](docs/firebase-hub.md).

القيم `EXPO_PUBLIC_FIREBASE_*` معرفات عامة وليست بديلًا عن قواعد الأمان. لا تضع Firebase Admin credentials أو EAS token داخل Expo أو GitHub. نشر EAS يجب أن يتم عبر Backend محمي مع admin claims وaudit log، وبعد الاختبار والموافقة.
