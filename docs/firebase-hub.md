# Firebase + Improvement Hub

## لماذا هذا المسار؟

بسبب تعطل بطاقة Web Dev، تم بناء الطبقة في المستودع المحلي المرتبط بـGitHub. هذا يمنح المشروع طبقة قابلة للاختبار دون ربط حساب Firebase أو إنشاء اشتراك تلقائي. عندما ينشئ المالك مشروع Firebase، نضيف القيم العامة عبر `.env` ونضع أسرار Admin SDK وEAS في Backend فقط.

## طبقات النظام

```text
Mobile UI
  └── HubScreen
      └── HubRepository
          ├── UnconfiguredHubRepository (حالة صادقة بلا بيانات وهمية)
          └── FirestoreHubRepository
              └── Firebase Web SDK

Backend / Functions (next)
  ├── Admin SDK
  ├── EAS Update service
  ├── approval and rollout policy
  └── audit log
```

## الملفات الحالية

| الملف | المسؤولية |
|---|---|
| `src/services/firebase/firebaseConfig.ts` | قراءة public Firebase identifiers وإظهار حالة الإعداد دون أسرار. |
| `src/services/firebase/firebaseClient.ts` | تهيئة Firebase App/Auth/Firestore بشكل lazy فقط عند اكتمال الإعداد. |
| `src/services/firebase/hubRepository.ts` | عقد المقترحات وFirestore adapter ومحول حالة غير موصل. |
| `src/services/firebase/firebaseAuthService.ts` | تسجيل دخول المدير والتحقق من `admin` custom claim قبل السماح بإدارة Hub. |
| `src/screens/HubScreen.tsx` | واجهة Hub أولية تعرض حالة الربط، دورة التحسين، والتحديثات بلا بيانات وهمية. |
| `firebase/firestore.rules` | قواعد بداية deny-by-default مع admin claim. |
| `.env.example` | أسماء Firebase العامة فقط. |

## Firebase configuration

القيم التالية ليست Admin secrets، لكنها لا تُغني عن قواعد Firestore:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

لا تضف `service-account.json` أو `FIREBASE_PRIVATE_KEY` أو EAS token إلى التطبيق أو GitHub. هذه القيم مكانها Backend secret store.

## Data model المقترح

- `hubProposals/{proposalId}`: `title`, `summary`, `status`, `updateClass`, `createdAt`, `updatedAt`, `authorId`, `reviewerId`.
- `hubReleases/{releaseId}`: `channel`, `runtimeVersion`, `commitSha`, `status`, `rolloutPercent`, `createdAt`, `stoppedAt`.
- `hubAuditLogs/{logId}`: `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `createdAt`.
- `hubSettings/{key}`: versioned remote configuration with `schemaVersion`, `value`, `updatedBy`, `updatedAt`.

## Update classification

| النوع | مثال | طريقة النشر |
|---|---|---|
| Dynamic | نص، ترتيب قسم، flag، لون من schema مسموح | Firestore/Remote Config بعد validation وrollback. |
| OTA | تعديل JS/TS لا يغيّر native runtime | EAS Update channel بعد tests وapproval. |
| Native | صلاحيات، WebView native config، package/build settings | APK/AAB جديد؛ OTA غير كافٍ. |

## Approval flow

`draft → review → approved → published`، مع فرع `rolled_back` عند ظهور خطأ. لا تنفذ واجهة الهاتف نشر EAS مباشرة؛ التنفيذ يجب أن يكون Backend endpoint يستخدم secret ويكتب audit log، مع صلاحية admin وidempotency key.

## الخطوات التي تحتاج حسابات المالك

1. إنشاء Firebase project واختيار المنطقة وBilling policy.
2. تفعيل Authentication وFirestore بعد مراجعة التكلفة والحدود.
3. إضافة تطبيق Android/Expo والحصول على القيم العامة.
4. تحديد admin users عبر Custom Claims من Backend، وليس من التطبيق.
5. إعداد EAS project، runtimeVersion، وchannels: development/preview/production.
6. إضافة `EXPO_TOKEN` وFirebase Admin credentials في secure secret input عندما يصبح Backend جاهزًا.

لا يتم تنفيذ هذه الخطوات تلقائيًا ولا يتم إنشاء اشتراك مدفوع دون موافقة.

## الحالة الحالية

تم تنفيذ العقود والتهيئة وواجهة Hub التشغيلية، مع نجاح TypeScript. يمكن إنشاء المقترحات ونقلها بين الحالات عندما يكون Firebase مفعّلًا والمستخدم مسجلًا بصلاحية Admin. لم يتم ادعاء نشر EAS أو Backend، لأن هذه العمليات تحتاج أسرارًا وحسابات خارجية. عند إضافة القيم العامة فقط يصبح عميل Firebase قادرًا على الاتصال، لكن الكتابة والنشر يظلان محكومين بقواعد وصلاحيات Backend.
