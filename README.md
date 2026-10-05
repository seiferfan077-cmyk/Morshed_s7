# مُرشد - S7

تطبيق Android مبني على **React Native + Expo + TypeScript**. هذا المجلد هو المشروع الرسمي الوحيد:

```text
~/workspaces/Morshed_s7
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
| آخر Commit | يُحدّث بعد كل مرحلة عبر GitHub |
| ملفات Git المتتبعة | 45 ملفًا |
| Expo | `~57.0.26` |
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
│   │   ├── ai/                     # AIProvider وBackendAIProvider؛ السر يبقى في Backend
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

Bottom tabs تعمل للصفحات: الرئيسية، المتصفح، المعرض، مرشد AI، Hub، الإعدادات. يجمع تبويب مرشد AI بين المحادثة وإدارة الذاكرة، بينما تظل الملفات متاحة من المعرض.

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

### Gallery & Files — Implemented locally with native permissions

`MediaScreen` يطلب إذن الصور والفيديوهات من الجهاز قبل القراءة. يستطيع المستخدم نسخ مكتبة الصور والفيديو إلى مساحة مُرشد عند الطلب، أو استيراد صور وفيديوهات وملفات محددة عبر `expo-document-picker`. تُنسخ العناصر المستوردة إلى مساحة محلية خاصة بالتطبيق عبر `expo-file-system` مع metadata في `AsyncStorage`. قسم التصفية يفرّق بين الكل والصور والفيديو والملفات، والضغط يفتح عارضًا أفقيًا بالسحب بين العناصر، مع تشغيل الفيديو عبر `expo-video`.

المعرض يعرض نسخًا محفوظة داخل مساحة مُرشد، وليس روابط مباشرة لمكتبة الجهاز. زر نسخ صور الجهاز ينسخ الصور والفيديوهات إلى مساحة التطبيق على حساب Gigabytes الجهاز، وزر الاستيراد ينسخ العناصر المحددة. بعد نجاح النسخ، حذف الأصل من معرض الجهاز لا يحذف نسخة مُرشد. الحذف من مُرشد يزيل النسخة المحلية فقط ولا ينفذ حذفًا على الجهاز.

الضغط المطوّل يفتح إجراءات الحذف أو الإخفاء. عند أول إخفاء، ينشئ المستخدم رمزًا من 4 إلى 32 حرفًا أو رقمًا بالعربية أو الإنجليزية، ويكتب سؤال استرجاع وإجابته مع تحذير واضح بعدم نسيان الرمز. العناصر المخفية تظهر في قسم `الخصوصية` بعد الضغط ثلاث مرات على البلاطة السوداء أسفل المعرض ثم إدخال الرمز. عند نسيان الرمز، يظهر سؤال الاسترجاع، وبعد الإجابة الصحيحة يمكن تعيين رمز جديد؛ لا يعرض التطبيق الرمز كاملًا، ويعرض في تذكير الحفظ آخر حرف فقط. الرمز والإجابة محفوظان في `SecureStore` ولا يُرسلان إلى Backend. لا يوجد ادعاء بتشفير ملفات الوسائط نفسها؛ النسخ المحلية ليست بديلًا عن تشفير جهاز Android/iOS.

هذه الإضافة Native وليست OTA-only: يلزم Development Build أو Build جديد بعد تثبيت `expo-document-picker` و`expo-file-system` و`expo-video`.

### Android Default Dialer — Foundation implemented, production integration pending

بدأت بنية Murshid كتطبيق اتصال افتراضي على Android داخل المسارات `native/android` و`plugins/withMurshidDialer.js`. الـConfig Plugin يضيف صلاحيات الاتصال، مسار `ACTION_DIAL`، خدمة `InCallService`، وبيانات Android المطلوبة لدور الاتصال الافتراضي. تم تنفيذ لوحة أرقام Native وإجراء الاتصال عبر `TelecomManager.placeCall`، كما تعرض الخدمة إشعار المكالمة الواردة مع الرنين وشاشة الرد والرفض، وتعرض شاشة المكالمة الجارية مع زر إنهاء المكالمة.

تمت إضافة بطاقة مكالمة واردة Native تعرض شعار مُرشد، اسم المتصل عند وجوده في جهات الاتصال، الرقم، واسم خط الهاتف/الشريحة المستخرج من `PhoneAccount`. تظهر شارة `موثق لدى مُرشد` فقط للأرقام الموجودة في قائمة التوثيق المحلية. يبدأ النظام بإشعار عالي الأولوية، ثم ينطق اسم المتصل عبر Android Text-to-Speech، ثم يشغل رنين الهاتف برمجيًا حتى لا يسبق النطق. يلزم منح إذن جهات الاتصال لرؤية الاسم؛ عند رفضه يظهر الرقم فقط.

ما زال يلزم ربط جهات الاتصال، التحقق المتقدم من الأرقام، واجهة إدارة قائمة الأرقام الموثقة من داخل UI، اختيار رنة لكل جهة اتصال، واختبار أجهزة Android متعددة. لا يتم تفعيل الدور تلقائيًا دون موافقة المستخدم من إعدادات Android، ولا يجوز للتطبيق تجاوز تطبيق الاتصال الافتراضي أو المكالمات الطارئة.

لإنشاء Development Build بعد سحب المستودع:

```bash
npm ci
npx expo prebuild --platform android
npx expo run:android
```

يجب تنفيذ هذه الأوامر من Termux أو جهاز يحتوي Android SDK و`ANDROID_HOME`. `expo-doctor` وTypeScript نجحا في بيئة البناء، أما تجميع APK داخل Sandbox فلم يبدأ بسبب عدم وجود Android SDK. تغييرات Dialer Native تتطلب Build جديدًا ولا تصل عبر OTA.

مراجع Android الرسمية: [Default Phone App](https://developer.android.com/develop/connectivity/telecom/dialer-app)، [Call Screening](https://developer.android.com/develop/connectivity/telecom/dialer-app/screen-calls)، و[Call Notifications](https://developer.android.com/develop/connectivity/telecom/voip-app/notifications).

### AI BYOK — User-owned API keys

يدعم التطبيق الآن نموذج **Bring Your Own Key** اختياريًا: يختار المستخدم مزودًا، يفتح صفحة API الرسمية، ينشئ مفتاحًا، ثم يدخله داخل لوحة `مرشد`. المفتاح يُحفظ عبر `expo-secure-store` باستخدام إعداد `WHEN_UNLOCKED_THIS_DEVICE_ONLY`، ولا يدخل GitHub أو Expo bundle أو أي رسالة إلى Manus. عند إرسال رسالة، يتصل التطبيق مباشرة بالمزود الذي اختاره المستخدم؛ لذلك يتلقى ذلك المزود الرسالة والذاكرة المرتبطة بها.

اللوحة تحتوي على 30 preset قابلًا للتعديل، منها OpenAI وGoogle Gemini وxAI/Grok وOpenRouter وGroq وDeepSeek وMistral وTogether وFireworks وPerplexity وCerebras وSambaNova وNVIDIA NIM وCloudflare وHugging Face وAzure OpenAI وGitHub Models وReplicate وNovita وSiliconFlow وZhipu وMoonshot وQwen وLM Studio وOllama وvLLM وLiteLLM، إضافة إلى `مزود مخصص OpenAI-compatible`. المزودات العامة تستخدم adapter `/chat/completions`، وGemini يستخدم Interactions API الحالية بمسار مستقل (`/interactions`) وموديل افتراضي `gemini-3.8-flash`؛ ويمكن تعديل `Base URL` واسم النموذج.

روابط إنشاء المفاتيح الرسمية الموجودة داخل اللوحة تشمل:

- [OpenAI API keys](https://platform.openai.com/api-keys)
- [Google AI Studio API key](https://aistudio.google.com/apikey)
- [xAI Console](https://console.x.ai/)
- [OpenRouter keys](https://openrouter.ai/settings/keys)
- [Groq keys](https://console.groq.com/keys)

طريقة الاستخدام: سجّل الدخول في صفحة المزود، أنشئ API key من لوحة API، الصقه في إعدادات مرشد AI، اختر النموذج، ثم اضغط «اختبار المفتاح وحفظه». يرسل التطبيق طلب اختبار قصيرًا مباشرة إلى المزود قبل حفظ المفتاح في SecureStore؛ قد يستهلك قدرًا بسيطًا من رصيد API. لا ترسل المفتاح في المحادثة ولا تضعه في ملفات المشروع. يمكن حذفه من الجهاز في أي وقت.

**مهم أمنيًا:** SecureStore يحمي التخزين المحلي على الجهاز، لكنه لا يجعل المفتاح غير قابل للاستخراج من جهاز مكسور الحماية أو تطبيق معدّل. هذا النموذج مناسب لمن يوافق على اتصال مباشر بالمزود؛ للمؤسسات أو الاستخدام الحساس ما زال Backend الوسيط الأكثر أمانًا.

### إعداد متغيرات البيئة

للتطوير المحلي، انسخ النموذج إلى ملفك المحلي:

```bash
cp .env.example .env
```

اضبط `EXPO_PUBLIC_API_BASE_URL` على عنوان Backend الذي تملكه و`EXPO_PUBLIC_MURSHID_API_TOKEN` على رمز الوصول الخاص ببنائك الشخصي، ثم أعد تشغيل Expo مع تنظيف الكاش:

```bash
npx expo start --clear
```

**لا تضع مفتاح Gemini في `.env` الخاص بتطبيق Expo أو GitHub.** كل متغير يبدأ بـ`EXPO_PUBLIC_` يدخل حزمة التطبيق ويمكن استخراجه؛ لذلك يوضع مفتاح Gemini في متغير بيئة سري على Backend فقط. أُضيف Backend مستقل في `backend/`، قابل للنشر كمشروع Vercel منفصل باختيار `backend` كـRoot Directory، ويوفر `POST /api/ai/chat`. خزّن `GEMINI_API_KEY` و`MURSHID_API_TOKEN` في إعدادات Vercel؛ واجعل `EXPO_PUBLIC_API_BASE_URL` و`EXPO_PUBLIC_MURSHID_API_TOKEN` في بيئة بناء التطبيق الشخصي. رمز التطبيق المضمّن في APK ليس مصادقة قوية، لذا هذا الإعداد مناسب للاستخدام الشخصي الخاص فقط؛ للنشر العام يلزم ربطه بمصادقة مستخدم حقيقية. ألغِ أي مفتاح Gemini سبق إرساله في رسالة أو رفعه إلى GitHub، وأنشئ بديلًا لا تشاركه في المحادثات.

### AI — Chat UI + Backend contract

تبويب `مرشد AI` يجمع شاشة المحادثة وإدارة الذاكرة مع زر انتقال مباشر بينهما. تُحفظ المحادثات محليًا عبر AsyncStorage، ويمكن إنشاء محادثات متعددة. يدعم الرد عبر Backend مرشد عند ضبط عنوان الخادم ورمز وصول البناء الشخصي، أو يختار المستخدم زر المفتاح لربط Gemini أو مزود متوافق بمفتاحه الخاص عبر BYOK؛ إعداد المستخدم الشخصي يأخذ الأولوية، ومفتاحه محفوظ في SecureStore. لا يوجد مفتاح مزود افتراضي داخل التطبيق أو GitHub. عند غياب الإعدادين تظهر حالة واضحة ولا تُنشأ ردود وهمية.

### Living Memory — Memory Intelligence Engine

إدارة الذاكرة متاحة من داخل تبويب `مرشد AI`، وتعود منه مباشرة إلى المحادثة. يستطيع المستخدم إضافة معلومة بموافقة صريحة، تصنيفها (معلومة، تفضيل، سياق، عادة، هدف، موقف)، البحث فيها، حذف عنصر أو كل الذاكرة، وإيقاف حفظ عناصر جديدة. كل `MemoryItem` يحمل نوعًا ومصدرًا وتواريخ وثقة وأهمية وحساسية وموافقة ووسومًا، والتخزين الحالي محلي عبر `AsyncStorage` خلف `MemoryProvider` قابل للاستبدال بقاعدة سحابية لاحقًا.

المرحلة الحالية تضيف **Memory Intelligence Engine** بشكل فعلي:

- `memoryExtractor.ts`: يلتقط مرشحات منخفضة المخاطر من عبارات مثل «أفضل»، «عايز»، «عادة»، و«حاليًا» دون حفظ تلقائي.
- `MemoryScreen`: يعرض المرشحات في قسم «اقتراحات مرشد للمراجعة»، ولا تنتقل إلى الذاكرة إلا بالضغط على «حفظ»، أو تُزال بالضغط على «تجاهل».
- `memoryRetrieval.ts`: يفرز الذاكرة المقبولة حسب تطابق الكلمات، الأهمية، الثقة، والحداثة؛ ولا يرسل إلا عددًا محدودًا من العناصر المرتبطة.
- `contextAssembly.ts`: يبني حزمة سياق من الرسالة الحالية، آخر 12 رسالة، والذكريات المرتبطة فقط.
- `BackendAIProvider` وموفر BYOK يرسلان `conversationId` والسياق المرتبط فقط؛ يظل مفتاح BYOK في SecureStore على الجهاز. يلتزم الإرسال بآخر 12 رسالة ويحترم إيقاف الذاكرة أو استرجاعها. Gemini BYOK وBackend يستخدمان Interactions API مع `store: false` حتى لا يخزن Gemini التفاعل على خوادمه.
- دورة الحياة: العناصر المنتهية الصلاحية تُستبعد وتُنظف عند القراءة، وتحديث المرشح المقبول يدمج المعلومة بدل إنشاء تكرار مطابق.

هذه ليست ذاكرة سحابية أو تحليلًا لغويًا شاملًا بعد؛ الاستخراج الحالي heuristic عربي محافظ، وحقول الأهداف والمهام جاهزة للتوسعة من دون ادعاء أنها موصولة بمصدر خارجي. المعلومات المؤقتة تحصل على انتهاء افتراضي 7 أيام، وتعارض التفضيل المقبول يظهر كاقتراح تحديث بدل تكرار.

### Download Manager — Not implemented

لا توجد إدارة `.tmp` أو progress أو pause/cancel أو retry أو duplicate detection أو نقل نهائي إلى Storage. المسار موثق فقط.

### Dynamic UI — Not implemented كـEngine

Hub يدير مقترحات وتصنيفًا، لكنه لا يقرأ schema آمنًا من Firebase ليعيد بناء صفحات أو مكونات كاملة. لا يوجد renderer ديناميكي ولا validation schema ولا preview/publish snapshot.

### EAS OTA — Prepared locally, not published

`updatePolicy.ts` يصنف التغيير ويقترح قناة. أضيف `expo-updates` و`runtimeVersion` و`eas.json` محليًا، لكن لا يوجد EAS project ID أو `updates.url` أو نشر فعلي بعد.

### Monitoring/Rollback — Partially implemented

`updateMonitor.ts` يحسب applied/failed/failureRate وruntime compatibility ويوصي Continue/Pause/Rollback. لا توجد telemetry حقيقية أو خدمة تستقبل الأحداث أو توقف EAS rollout فعليًا.

## اختبارات المرحلة الحالية

```bash
npm run memory:test
npm run ai:test
npm run backend:test
npx tsc --noEmit
```

اختبار `memory:test` يترجم الخدمات النقية مؤقتًا إلى `.tmp-memory-test` ثم يشغل:

- `memory:unit`: اختبارات استخراج المرشح وسياسة ترتيب الاسترجاع.
- `memory:integration`: اختبارات `LocalMemoryProvider` بمخزن AsyncStorage وهمي معزول، وتشمل الموافقة، الرفض، التحديث المتعارض، انتهاء المعلومة المؤقتة، تعطيل الذاكرة، الحذف، حد 12 رسالة، منع غير المرتبط/الحساس/منخفض الثقة، وشكل طلب Backend.

نتيجة آخر تشغيل ناجح: اختبارات الوحدة والتكامل مرّت. المجلد المؤقت لا يُحفظ في Git.

## نتيجة Real-World Memory Validation & Integration Audit

تم تنفيذ التدقيق داخل المشروع الرسمي، وليس عبر ادعاء اختبار واجهة Android حقيقية. النتائج الفعلية:

| السيناريو | النتيجة |
|---|---|
| تفضيل واضح يظهر كمرشح بلا حفظ تلقائي | ناجح |
| الموافقة ثم الاسترجاع بسؤال مرتبط | ناجح |
| تصحيح ذكرى قديمة | ناجح؛ يظهر `suggestedAction: update` ويُحدّث نفس `id` |
| معلومة مؤقتة | ناجح؛ انتهاء افتراضي بعد 7 أيام |
| تجاهل مرشح | ناجح؛ لا يُحفظ ولا يُسترجع |
| تعطيل الذاكرة | ناجح؛ يمنع حفظ المرشح والاسترجاع |
| حذف ذكرى ثم بناء Context | ناجح؛ لا تظهر بعد الحذف |
| سؤال غير مرتبط | ناجح؛ لا تُرسل ذاكرة |
| آخر 12 رسالة | ناجح؛ `conversation` لا يتجاوز 12 |
| حمولة Backend | ناجح؛ تُرسل الحقول الدنيا للذاكرة فقط |
| حساس/ثقة أقل من 0.6 | ناجح؛ يُستبعد من الاسترجاع |

### الخصوصية والأمان

- التخزين الحالي هو `AsyncStorage` المحلي، **وليس مشفرًا** في هذه المرحلة. لا ينبغي تخزين أسرار أو بيانات شديدة الحساسية فيه.
- الحذف يزيل العنصر من مفتاح الذاكرة المحلي، وتعطيل الذاكرة يمنع الاستخراج المحفوظ والاسترجاع.
- المرشح لا يصبح `MemoryItem` إلا عبر `approveCandidate`؛ الفشل في الاستخراج لا يستدعي الحفظ.
- `Context Package` لا يضمّن `userId` أو `source` أو `sensitivity` أو التواريخ في حمولة AI؛ ويستبعد الحساس والمنخفض الثقة.
- لا يوضع مفتاح Gemini في التطبيق أو GitHub؛ يحتفظ Backend بنسخته في متغير سرّي. يبقى رمز الوصول الشخصي الذي يضمّنه بناء Expo قابلًا للاستخراج، لذا لا توزّع هذا البناء للعامة قبل إضافة مصادقة حقيقية. يمكن للمستخدم بدلًا من ذلك ربط API الخاص به من إعدادات مرشد.

### مخاطر متبقية

- التخزين المحلي غير مشفر؛ يلزم قرار أمني لاحق قبل اعتماد معلومات حساسة.
- استخراج التعارضات heuristic وليس فهمًا لغويًا شاملًا؛ لذلك يعرض اقتراح تحديث للمراجعة ولا ينفذ تحديثًا دون موافقة.
- الاختبارات الحالية لا تثبت صلاحيات Android أو أداء جهاز فعلي أو اتصال Backend حقيقي؛ اختبار Backend هنا يتحقق من عقد HTTP باستخدام `fetch` معزول.

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
| `@react-native-async-storage/async-storage` | `2.2.0` | local conversations and approved memory persistence |
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
cd ~/workspaces/Morshed_s7
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
cd ~/workspaces/Morshed_s7
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
- Downloads وDynamic UI Engine ما زالت غير مكتملة؛ Gallery/Files تعمل محليًا بعد طلب الصلاحيات، وواجهة AI تدعم BYOK أو Backend حسب الإعداد.
- لا يوجد اختبار جهاز Android حقيقي موثق.

## الوثائق المرتبطة

- [`docs/architecture.md`](docs/architecture.md): قرارات المعمارية وتدفقات التنزيل والتخزين.
- [`docs/firebase-hub.md`](docs/firebase-hub.md): طبقة Firebase وHub ونموذج البيانات وقواعد الأمان.
- [`docs/release-management.md`](docs/release-management.md): تصنيف التحديثات، قنوات EAS، المراقبة والتراجع.
- [`docs/ota-strategy.md`](docs/ota-strategy.md): تدقيق OTA، runtimeVersion، القنوات، workflow، والحدود.
- [`ideas.md`](ideas.md): اتجاه التصميم وهوية مُرشد S7.
- [`firebase/firestore.rules`](firebase/firestore.rules): القواعد الأولية المقترحة.

## آخر تدقيق مؤكد

تم تنفيذ آخر تدقيق على المشروع الرسمي فقط في `~/workspaces/Morshed_s7`، وتحقق من Git وremote والملفات والإصدارات و`runtimeVersion` و`eas.json` و`expo-updates` و`npx tsc --noEmit` و`npx expo-doctor`. إعداد EAS و`updates.url` موجودان، بينما أول Production Build واختبار OTA الفعلي يحتاجان تنفيذًا من Termux على حساب Expo.

### App icon

تم اعتماد `assets/icon.png` كأيقونة عربية مربعة محسّنة: لا تحتوي على أحرف لاتينية، وتستخدم شعار مُرشد مع إطار تركوازي وتباين مناسب للأيقونات.
