# مُرشد - S7

تطبيق Android مبني على **React Native + Expo + TypeScript**. هذا المجلد هو المشروع الرسمي الوحيد:

```text
/home/ubuntu/projects/Murshid-S7
```

ومستودع GitHub هو مصدر الحقيقة الوحيد للكود:

```text
https://github.com/seiferfan077-cmyk/Morshed_s7.git
```

لا تستخدم نسخة `/home/ubuntu/murshids7` التابعة لـWeb Dev Mobile لهذا المشروع؛ هي Starter منفصل وليست جزءًا من مصدر الحقيقة.

## ملخص التدقيق الحالي

| العنصر | الحالة الفعلية |
|---|---|
| Git branch | `main` |
| Git status | نظيف ومتزامن مع `origin/main` وقت آخر تدقيق |
| آخر Commit | `900b224 chore: prepare eas ota runtime and channels` |
| ملفات Git المتتبعة | 45 ملفًا |
| Expo | `~57.0.25` |
| React Native | `0.86.3` |
| React | `19.2.3` |
| TypeScript | `~6.0.3` |
| Android package | `com.murshid.s7` |
| Expo slug | `murshid-s7` |
| Firebase project config | معرفات عامة محليًا لمشروع `moreheads7`، غير مرفوعة داخل `.env` |
| Firestore | غير مثبت كخدمة عاملة؛ آخر فحص أعاد `403 PERMISSION_DENIED` |
| Backend | غير موجود كخدمة تشغيلية داخل هذا المستودع |
| Database | Firestore adapter وقواعد مقترحة فقط؛ لا توجد بيانات/مهاجرات تشغيلية مثبتة |
| File storage | `StorageProvider` contract فقط؛ لا يوجد Expo FileSystem أو S3 adapter عامل |
| EAS | إعدادات محلية مضافة في `eas.json` و`expo-updates` مثبت؛ لا يوجد EAS project ID أو APK/AAB أو OTA منشورة |
| التحقق الآلي | `npx tsc --noEmit` ناجح و`npx expo-doctor` ناجح: 21/21 |

> وجود ملف أو واجهة لا يعني أن الميزة مكتملة. الحالات أدناه تفصل بين **Implemented** و**Partially implemented** و**Placeholder** و**Not implemented**.

## Architecture الحالية

```text
App.tsx
  └── AppNavigator
      ├── الرئيسية → HomeScreen
      ├── المتصفح → BrowserScreen → react-native-webview
      ├── المعرض → MediaScreen
      ├── Hub → HubScreen → HubRepository → Firebase/Firestore adapter
      └── الإعدادات → SettingsScreen

Screens
  ├── shared UI components
  ├── Design System tokens
  ├── domain types
  └── provider-neutral services
          ├── Firebase/Auth/Firestore
          ├── AI provider contract
          ├── Storage provider contract
          ├── Release classification policy
          └── Update health/rollback policy
```

المبدأ الأساسي هو أن الشاشة تنسق العرض والتفاعل، بينما الخدمات والعقود تملك الوصول إلى Firebase أو التخزين أو Backend. لا ينبغي إضافة SDK خارجي مباشرة داخل شاشة جديدة.

## Folder structure ومسؤولية كل مجلد

```text
.
├── App.tsx                         # نقطة دخول التطبيق وStatusBar
├── app.json                        # Expo identity وAndroid package وassets
├── eas.json                        # Profiles والقنوات المحلية لـEAS
├── package.json                    # dependencies وscripts
├── package-lock.json               # lockfile لـnpm
├── assets/                         # icon وfavicon وadaptive icon وsplash المحلية
├── src/
│   ├── components/                 # SurfaceCard وActionButton وEmptyState وScreenHeader
│   ├── navigation/                 # Bottom tabs وRootTabParamList
│   ├── screens/                    # تركيب واجهات Home/Browser/Media/Hub/Settings/AI/Files
│   ├── services/
│   │   ├── ai/                     # AIProvider contract؛ لا يوجد Backend AI عامل
│   │   ├── auth/                   # AuthProvider contract العام
│   │   ├── firebase/               # Firebase config/client/Auth/Hub Firestore adapter
│   │   ├── monitoring/             # حساب صحة الإصدار ونسبة الفشل
│   │   ├── releases/               # تصنيف Dynamic/OTA/Native وسياسة القنوات
│   │   ├── storage/                # StorageProvider contract فقط
│   │   └── api/                    # محجوز لعقد API؛ لا يوجد client عامل حاليًا
│   ├── theme/                      # colors وspacing وradii وtypography وshadows
│   └── types/                      # MediaMetadata وAppSettings وdomain types
├── firebase/
│   └── firestore.rules             # قواعد مقترحة deny-by-default مع admin claim
├── docs/
│   ├── architecture.md             # قرارات المعمارية وتدفقات البيانات
│   ├── firebase-hub.md             # Firebase وHub ونموذج البيانات
│   └── release-management.md       # EAS policy وmonitoring وrollback boundaries
├── ideas.md                        # Design direction وهوية مُرشد
├── .env.example                    # أسماء المتغيرات فقط
├── .env                            # محلي، ignored، لا يُرفع إلى Git
└── README.md                       # هذا الدليل والتقرير
```

## حالة الـFeatures الفعلية

### Home — Implemented

الشاشة الرئيسية موجودة وتحتوي على الهوية، الوصول السريع، ملخص التخزين، وروابط للتبويبات. أزرار الوصول السريع تنقل إلى الوجهات الموجودة. لا تعرض إحصاءات Backend أو تخزين حقيقية؛ نسبة التخزين الحالية واجهة تأسيسية وليست قراءة نظام ملفات.

### Navigation — Implemented

Bottom tabs تعمل للصفحات: الرئيسية، المتصفح، المعرض، Hub، الإعدادات. شاشتا AI وFiles موجودتان في الشجرة لكنهما ليستا Tab مستقلين حاليًا.

### Browser/Kiosk — Partially implemented

`BrowserScreen` يستخدم `react-native-webview` فعليًا ويقدم عنوانًا/بحثًا، Home، Back، Forward، Refresh، loading state، وتحديث URL عند التنقل. يوجد injected viewport policy لمحاولة منع التكبير مع إبقاء input/textarea/select قابلة للكتابة.

غير مكتمل: Download event interception، تنزيلات حقيقية، قوائم domains، external-link policy كاملة، history persistence، cookies/session policy، security hardening، واختبار جهاز Android حقيقي. القيود الحالية لا تثبت Kiosk lockdown كاملًا.

### Hub — Partially implemented وقابل للتشغيل عند توفر Firebase/Admin

`HubScreen` يقدم إنشاء مقترح كـDraft، اختيار Dynamic/OTA/Native، قراءة آخر المقترحات، وإمكانية الانتقال Draft → Review → Approved → Published. `hubAuditLogs` تضاف عند انتقال الحالة من خلال Firestore adapter.

الواجهة لا تستطيع العمل فعليًا قبل تفعيل Firestore وتسجيل مستخدم Firebase بصلاحية `admin` claim. لا يوجد Backend ينفذ نشر EAS، ولا ينبغي أن تنفذه شاشة الهاتف.

### Firebase — Partially implemented

موجود: Firebase Web SDK، lazy initialization، public config loader، Auth service، Firestore repository، قواعد مقترحة، وحالة خطأ واضحة. غير موجود: تفعيل Firestore المؤكد، Authentication flow داخل شاشة Login، إنشاء Custom Claims من Backend، Cloud Functions، Remote Config فعلي، Storage فعلي، أو Admin SDK.

آخر اختبار خارجي لواجهة Firestore على مشروع `moreheads7` أعاد `403 PERMISSION_DENIED`. هذا يثبت أن الوصول غير متاح حاليًا، ولا يثبت أن Firebase مفعّل أو أن المستخدم Admin.

### Authentication — Partially implemented

`firebaseAuthService.ts` يوفّر sign-in بالبريد وكلمة المرور، مراقبة المستخدم، sign-out، والتحقق من `admin` claim. لا توجد شاشة Login ولا Backend يعيّن claims ولا سياسة استرجاع كلمة المرور.

### Gallery — Placeholder

`MediaScreen` يعرض Empty State. توجد `MediaMetadata` types فقط. لا توجد قراءة صور من الجهاز، thumbnails، virtualization، viewer، share، delete، أو cache.

### Files — Placeholder

`FilesScreen` يعرض Empty State. `StorageProvider` contract موجود، لكن Expo FileSystem/MediaStore/S3 غير موصل. لا توجد صلاحيات أو تنزيلات أو مساحة حقيقية.

### AI — Placeholder contract

`AIProvider` يحدد عقد الإرسال، لكن لا يوجد Backend أو مزود AI أو Chat UI متصل. لا توجد مفاتيح AI داخل التطبيق، وهذا مقصود أمنيًا.

### Download Manager — Not implemented

لا توجد إدارة `.tmp` أو progress أو pause/cancel أو retry أو duplicate detection أو نقل نهائي إلى Storage. المسار موثق فقط.

### Dynamic UI — Not implemented كـEngine

Hub يدير مقترحات وتصنيفًا، لكنه لا يقرأ schema آمنًا من Firebase ليعيد بناء صفحات أو مكونات كاملة. لا يوجد renderer ديناميكي ولا validation schema ولا preview/publish snapshot.

### EAS OTA — Prepared locally, not published

`updatePolicy.ts` يصنف التغيير ويقترح قناة. أضيف `expo-updates` و`runtimeVersion` و`eas.json` محليًا، لكن لا يوجد EAS project ID أو `updates.url` أو نشر فعلي بعد.

### Monitoring/Rollback — Partially implemented

`updateMonitor.ts` يحسب applied/failed/failureRate وruntime compatibility ويوصي Continue/Pause/Rollback. لا توجد telemetry حقيقية أو خدمة تستقبل الأحداث أو توقف EAS rollout فعليًا.

## Dependencies والإصدارات

الإصدارات الحالية من `package.json`:

| الحزمة | الإصدار | الاستخدام |
|---|---:|---|
| `expo` | `~57.0.25` | runtime وMetro |
| `react-native` | `0.86.3` | native UI |
| `react` | `19.2.3` | rendering |
| `typescript` | `~6.0.3` | static checking |
| `react-native-webview` | `13.16.1` | Browser |
| `@react-navigation/native` | `^7.4.1` | navigation core |
| `@react-navigation/bottom-tabs` | `^7.19.2` | tabs |
| `@expo/vector-icons` | `^15.0.2` | icons |
| `expo-font` | `~57.0.4` | font peer dependency |
| `firebase` | `^12.19.0` | Firebase Web SDK |
| `@react-native-async-storage/async-storage` | `2.2.0` | dependency prepared for persistence |
| `react-native-safe-area-context` | `~5.7.0` | safe areas |
| `react-native-screens` | `~4.26.0` | navigation native optimization |
| `expo-updates` | SDK-compatible | OTA runtime and update client |

النصوص التنفيذية المتاحة هي `npm start`, `npm run android`, `npm run ios`, و`npm run web`. فحص Expo الصحيح في هذا الإصدار هو `npx expo-doctor` وليس `npx expo doctor`.

## Android وExpo configuration

- Display name: `مُرشد - S7`.
- Expo slug: `murshid-s7`.
- App version: `0.1.0`.
- Runtime version: `appVersion` policy؛ Binary `0.1.0` يقبل تحديثات runtime `0.1.0` فقط.
- Orientation: portrait.
- Android package/application ID: `com.murshid.s7`.
- Android predictive back: disabled via `predictiveBackGestureEnabled: false`.
- Adaptive icon: local foreground/background/monochrome assets.
- Web favicon: `assets/favicon.png`.
- App icon: `assets/icon.png`.
- Expo plugin: `expo-font`.
- iOS tablet support is enabled in config، لكن هذا المشروع موجه أساسًا إلى Android.

لا توجد مجلدات `android/` أو `ios/` متتبعة حاليًا؛ هي ignored. هذا يعني أن المشروع يستخدم Managed Expo configuration وليس Native projects committed.

## هل يعمل خارج Manus؟

نعم، من ناحية المصدر والتثبيت: المشروع Git repository عادي، و`package-lock.json` موجود، ولا يعتمد تشغيل Metro الأساسي على Manus. تم سابقًا استنساخه في مجلد اختبار وتشغيل `npm ci` و`npx tsc --noEmit` بنجاح.

تشغيل قياسي:

```bash
git clone https://github.com/seiferfan077-cmyk/Morshed_s7.git
cd Morshed_s7
npm ci
npx tsc --noEmit
npx expo start
```

لـTermux:

```bash
pkg update
pkg install nodejs-lts git
termux-setup-storage
git clone https://github.com/seiferfan077-cmyk/Morshed_s7.git
cd Morshed_s7
npm ci
npx expo start --tunnel
```

يمكن فتح وتعديل المشروع من Acode أو أي محرر؛ يجب تعديل الملفات داخل نسخة Git المحلية ثم تشغيل الفحوصات من Termux. لا تضع `node_modules` في Git أو التخزين المشترك إذا سبب ذلك مشاكل أداء.

## Expo Go وDevelopment Build وAPK/AAB

الواجهات الأساسية وWebView قد تعمل للتجربة عبر Expo Go بحسب دعم الإصدار والجهاز، لكن لا نعتبر ذلك اختبارًا native كاملًا. Development Build مطلوب عمليًا عندما نضيف أو نثبت Native modules/configuration غير المتاحة في Expo Go، وعند اختبار دورة Android الحقيقية والصلاحيات والتخزين والتنزيلات والخلفية.

يمكن إخراج APK/AAB من حيث المسار التقني، لكن لم يتم إخراج artifact فعلي بعد لأن EAS project وcredentials غير مهيأة:

```bash
npx eas login
npx eas build:configure
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

لا تحفظ keystore أو `EXPO_TOKEN` داخل GitHub. تغييرات Native تحتاج Build جديدًا. تغييرات JS/TS المتوافقة يمكن أن تستخدم EAS Update بعد تهيئة `expo-updates`, `runtimeVersion`, المشروع والقنوات، لكن OTA غير مفعلة حاليًا.

## الخدمات الخارجية والحالة

| الخدمة | الحالة | ما يلزم |
|---|---|---|
| GitHub | متصل ويعمل | لا شيء حاليًا؛ `origin/main` هو المصدر الرسمي |
| Firebase project `moreheads7` | public config محلي | تفعيل Firestore/Auth وقواعده وإنشاء Admin claim |
| Firestore | adapter/rules فقط؛ آخر فحص 403 | Create database + تطبيق rules + Auth |
| Firebase Auth | service جزئي | تفعيل Email/Password أو provider تختاره، وشاشة Login لاحقًا |
| Firebase Storage | غير موصل | اختيار سياسة التخزين وتفعيل الخدمة إذا لزم |
| Firebase Admin SDK | غير موجود | Backend آمن وsecret storage |
| Backend/API | غير موجود تشغيليًا | خدمة مستقلة للنشر وAI وclaims وaudit policy |
| EAS | غير مهيأ | Expo account/project/token/channels |
| AI provider | غير موصل | Backend ومزود يختاره المالك |
| S3/Object storage | غير موصل | اختيار مزود وسياسة تكلفة |

## OTA Architecture وRuntime Version

الاستراتيجية المختارة هي `runtimeVersion.policy = appVersion`. لذلك يحمل كل Binary قيمة runtime مساوية لإصدار التطبيق في `app.json`، مثل `0.1.0`. أي تغيير Native أو dependency/configuration يؤثر على native runtime يجب أن يرفع `expo.version` إلى قيمة جديدة، ثم يبني APK/AAB جديدًا. لا نرسل OTA من runtime قديم إلى Binary غير متوافق.

التغييرات التي يمكن نشرها OTA بعد وجود Binary مناسب هي React/TypeScript، الشاشات والمكونات، navigation/business logic، النصوص، إصلاحات JavaScript، وassets المضمنة في bundle. التغييرات التي تحتاج Build جديدًا هي package/native dependency جديدة، Android permissions، package ID، adaptive icon/splash، WebView native configuration، SDK/React Native/Expo upgrade، `app.json` native settings، أو أي تغيير في `runtimeVersion`.

### إعداد EAS الحالي

`eas.json` موجود ويحتوي على profiles للقنوات التالية:

| Profile | Channel | الغرض |
|---|---|---|
| `development` | `development` | Development Build داخلي للاختبار |
| `preview` | `preview` | APK داخلي لمجموعة الاختبار |
| `production` | `production` | الإصدار العام |

لم يتم تشغيل `eas init` أو `eas update:configure` لأن ذلك يحتاج حساب Expo وربط EAS project. لا يتم اختلاق `projectId` أو `updates.url`. بعد تسجيل الدخول وربط المشروع نفّذ مرة واحدة:

```bash
npx eas login
npx eas init
npx eas update:configure
npx eas build --profile development --platform android
```

ثم، بعد وجود Binary مناسب واختبار Preview:

```bash
npx eas update --channel preview --message "preview: describe change"
npx eas update --channel production --message "production: describe approved change"
```

تأكد من استخدام channel/branch mapping الذي يعرضه EAS عند الإعداد؛ لا تخلط بين branch وchannel يدويًا. لا تنشر Production مباشرة، ولا تستخدم OTA لتغيير Native.

### GitHub → EAS workflow من Termux/Acode

```bash
cd ~/projects/Murshid-S7
git pull --rebase origin main
# عدّل الكود في Acode أو المحرر
npm ci
npx expo-doctor
npx tsc --noEmit
npx expo start --tunnel
git add .
git commit -m "fix: describe change"
git push origin main
# بعد موافقة الاختبار فقط:
npx eas update --channel preview --message "preview: tested change"
# وبعد قبول Preview:
npx eas update --channel production --message "production: approved change"
```

هذا المسار لا يعتمد على Manus. GitHub هو مصدر الكود، وEAS هو نشر OTA بعد تسجيل حساب Expo. لا تضع `EXPO_TOKEN` في المشروع؛ استخدم `eas login` أو secret manager/CI.

### Rollback وRecovery

احتفظ برسائل Update واضحة وسجّل commit SHA في سجل الإصدار. عند اكتشاف خلل، أوقف التوزيع ولا ترسل Update جديدًا عشوائيًا؛ استخدم EAS rollback/republish وفق حالة القناة، أو انشر آخر commit مستقر إلى القناة بعد التحقق. إذا فشل تحديث أثناء التحميل يجب أن يبقى التطبيق على bundle السابق/المضمن. تحديث Native الخاطئ يحتاج إصلاحًا وبناءً جديدًا، ولا يمكن علاجه بادعاء OTA.

## Environment Variables وSecrets

`.env.example` يحتوي أسماء المتغيرات فقط. يوجد `.env` محلي في بيئة التطوير، وهو ignored وغير متتبع. لا تعتمد نسخة جديدة على وجوده؛ انسخه يدويًا وأدخل القيم العامة من Firebase Console:

```bash
cp .env.example .env
```

متغيرات العميل العامة هي `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, و`EXPO_PUBLIC_FIREBASE_APP_ID`. هذه لا تحمي Firestore وحدها؛ الحماية من Rules/Auth.

المتغيرات التي لا يجب وضعها في التطبيق أو GitHub هي Firebase Admin private key، Service Account JSON، `EXPO_TOKEN`، وAI provider secrets. مكانها Backend secret manager أو input آمن في منصة النشر.

## Git workflow الرسمي

قبل أي تعديل، تحقق من المكان والربط:

```bash
cd /home/ubuntu/projects/Murshid-S7
git remote -v
git status --short --branch
```

بعد تعديل مهم:

```bash
npx tsc --noEmit
npx expo-doctor
git status
git add <files>
git commit -m "feat: describe the change"
git push origin main
```

لا تستخدم Repository آخر لهذا التطبيق، ولا تغيّر `origin`، ولا ترفع `.env`. استخدم Commit صغيرًا وواضحًا. قبل العمل المتزامن، نفّذ `git pull --rebase origin main` بدل force push.

## كيف تضيف Feature مستقبلية

ابدأ من module مستقل في `src/modules/<feature>` للعقود والمنطق، أضف service adapter في `src/services` إذا احتجت API أو Native capability، ثم أنشئ الشاشة في `src/screens` واربطها في navigation. حدّث domain types، حالات الفشل، README والوثيقة المناسبة. نفّذ TypeScript وExpo Doctor واختبارًا مناسبًا قبل Commit.

لا تضع business logic أو FileSystem أو Firebase queries مباشرة في مكون UI. لا تضف secret إلى `EXPO_PUBLIC_*`. لا تعتبر Empty State تنفيذًا للميزة.

## ما يحتاج إعدادًا شخصيًا من المالك

1. تأكيد Firestore Database والمنطقة وBilling policy في مشروع `moreheads7`.
2. تفعيل Firebase Authentication واختيار provider.
3. إنشاء حساب المدير وإسناد `admin` Custom Claim من Backend آمن.
4. مراجعة Firestore Rules قبل أي بيانات حقيقية.
5. اختيار Backend hosting وAI provider وStorage policy، مع مراعاة التكلفة والحدود.
6. إنشاء/ربط EAS project وتحديد signing policy وقنوات Development/Preview/Production.
7. اختبار نسخة Development Build على جهاز Android حقيقي.
8. مراجعة والموافقة على أول نشر Production.

## بوابات قبول المراحل

لا تعتبر المرحلة مكتملة إلا إذا كانت الوظيفة تعمل فعليًا، وفحوصاتها ناجحة، وتوثيقها محدثًا، وCommitها مرفوعًا. الحالات الخارجية الحالية تمنع ادعاء اكتمال Production:

- Firebase Firestore/Auth غير مؤكدين بسبب `403`.
- لا يوجد Admin Backend.
- لا يوجد EAS OTA أو APK/AAB فعلي.
- Gallery/Files/Downloads/AI/Dynamic UI Engine ما زالت غير مكتملة.
- لا يوجد اختبار جهاز Android حقيقي موثق.

## الوثائق المرتبطة

- [`docs/architecture.md`](docs/architecture.md): قرارات المعمارية وتدفقات التنزيل والتخزين.
- [`docs/firebase-hub.md`](docs/firebase-hub.md): طبقة Firebase وHub ونموذج البيانات وقواعد الأمان.
- [`docs/release-management.md`](docs/release-management.md): تصنيف التحديثات، قنوات EAS، المراقبة والتراجع.
- [`docs/ota-strategy.md`](docs/ota-strategy.md): تدقيق OTA، runtimeVersion، القنوات، workflow، والحدود.
- [`ideas.md`](ideas.md): اتجاه التصميم وهوية مُرشد S7.
- [`firebase/firestore.rules`](firebase/firestore.rules): القواعد الأولية المقترحة.

## آخر تدقيق مؤكد

تم تنفيذ آخر تدقيق على المشروع الرسمي فقط في `/home/ubuntu/projects/Murshid-S7`، وتحقق من Git وremote والملفات والإصدارات و`runtimeVersion` و`eas.json` و`expo-updates` و`npx tsc --noEmit` و`npx expo-doctor`. إعداد OTA المحلي موجود في Commit `900b224`، لكن EAS project ID و`updates.url` وProduction Build/Update ما زالت غير مهيأة.
