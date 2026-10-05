# Backend ذكاء مُرشد

هذا Backend مستقل يعمل كـ Vercel Node.js Functions. اضبط **Root Directory** على `backend`، ثم انشر. المسارات:

- `POST /api/ai/chat` — محادثة مُرشد.
- `GET /api/health` — فحص وجود الإعدادات فقط.

تستخدم ملفات API محولًا صغيرًا بين واجهة Vercel Node (`req`/`res`) وواجهة Fetch الداخلية، لذلك يمكن اختبار منطق المحادثة محليًا عبر `Request` وتشغيله على Vercel دون Edge runtime خاص.

## الإعداد المقترح للتجربة المجانية

المزود الافتراضي هو **Groq** عبر واجهة OpenAI-compatible؛ مفتاحه يبقى على الخادم. النموذج الافتراضي `qwen/qwen3.8-27b`، ويمكن تغييره إلى أي نموذج نشط ومتاح في حساب Groq. الحدود الدقيقة للخطة المجانية تتغير حسب الحساب والنموذج، وتظهر في لوحة Groq.

أضف الإعدادات التالية من Vercel → Environment Variables، ولا تحفظ مفاتيح المزود في Git أو متغيرات `EXPO_PUBLIC_*`:

- `AI_PROVIDER=groq`
- `GROQ_API_KEY` — مفتاح Groq API.
- `GROQ_MODEL=qwen/qwen3.8-27b` — اختياري.
- `FIREBASE_PROJECT_ID` — معرّف مشروع Firebase نفسه المستخدم في التطبيق؛ ليس سرًا، لكنه لازم للتحقق من ID tokens.

فعّل **Anonymous** من Firebase Console → Authentication → Sign-in method. اضبط إعدادات Firebase العامة في بيئة بناء Expo، و`FIREBASE_PROJECT_ID` في Vercel على المعرّف نفسه. اضبط `EXPO_PUBLIC_API_BASE_URL` على عنوان Vercel دون `/` في نهايته، ثم أعد بناء التطبيق. لا يحتاج المستخدم إلى مفتاح AI أو رمز Backend مشترك.

## API contract لأي عميل متوافق، بما فيه Motion إذا كان المقصود عميلًا خارجيًا

يرسل تطبيق Murshid طلبًا إلى `POST https://<backend-domain>/api/ai/chat` مع `Authorization: Bearer <Firebase ID token>` و`Content-Type: application/json`. ينشئ التطبيق هوية Firebase مجهولة تلقائيًا للمستخدم غير المسجّل، ولا يضمّن مفتاحًا مشتركًا قابلًا للاستخراج:

```json
{
  "messages": [
    { "role": "user", "content": "ساعدني أنظم يومي" }
  ],
  "memory": [{ "content": "أفضل البدء مبكرًا" }],
  "activeGoals": ["إنهاء الدراسة"],
  "activeTasks": ["مراجعة الفصل الأول"]
}
```

الحقول الاختيارية `memory` و`activeGoals` و`activeTasks` تُرسل فقط عند وجود موافقة/سياق مناسب. الرد الناجح:

```json
{ "role": "assistant", "content": "..." }
```

المستودع لا يحتوي تكاملًا باسم Motion؛ هذا endpoint هو واجهة HTTP لمستخدمي Murshid الموثّقين عبر Firebase. لا يمكن لعميل خارجي استخدامه إلا إذا حصل على Firebase ID token صالح من المشروع نفسه. لا تقبل endpoint رموزًا ثابتة من التطبيق.

## Gemini كبديل

يمكن استخدام Gemini بدل Groq بتعيين `AI_PROVIDER=gemini` و`GEMINI_API_KEY`، واختياريًا `GEMINI_MODEL=gemini-3.8-flash`. يستخدم هذا المسار Gemini Interactions API مع `store: false`.

**تنبيه الخصوصية:** تنص شروط Gemini API على أن المحتوى المرسل عبر الحصة المجانية قد يُستخدم لتحسين منتجات Google وقد يراجعه أشخاص؛ تجنب إرسال معلومات حساسة عبر الحصة المجانية. أما Groq فيذكر أن طلبات الاستدلال لا تُحتفظ بها افتراضيًا، مع احتمال تسجيل مؤقت محدود لأغراض الاعتمادية/مكافحة الإساءة حتى 30 يومًا؛ يمكن إدارة ذلك من إعدادات Data Controls وتفعيل Zero Data Retention. راجع الشروط الحالية للمزود قبل إطلاق التطبيق.

## الخصوصية والأمان وحدود الاستخدام

- يرسل التطبيق آخر 12 رسالة وما يختاره من الذكريات والسياق فقط؛ المحادثات محفوظة محليًا على الجهاز.
- لا يسجل Backend محتوى المحادثة أو المفاتيح، ويضع `Cache-Control: no-store` ويرفض الأجسام والأدوار/السياقات غير الصالحة.
- مفتاح المزود لا يغادر Backend. لا تضعه في تطبيق Expo أو GitHub. يتحقق Backend من Firebase ID token بالتوقيع ومطابقة issuer/audience/expiry، باستخدام مفاتيح Google العامة، من دون حفظ service-account key.
- Firebase Anonymous Auth يزيل شاشة تسجيل الدخول لكنه ينشئ هوية Firebase لكل مستخدم/جهاز. لا توجد حاليًا حصة استخدام دائمة أو حد يومي لكل UID؛ قبل الإطلاق العام أضف rate limiting دائمًا ومراقبة استهلاك المزود لمنع إساءة الاستخدام.
- Vercel Hobby مخصص للاستخدام الشخصي وغير التجاري. حدوده قابلة للتغيير؛ افحص لوحة Vercel قبل الإطلاق. Cloudflare Workers Free بديل معلن بحد 100,000 طلب يوميًا، لكنه يحتاج تهيئة/نقل المشروع بدل إعداد Vercel الحالي.

## الاختبارات محليًا

من مجلد المستودع الرئيسي:

```bash
npm run backend:test
```

الاختبارات تستخدم mocks لمزودي AI ولا تحتاج مفاتيح حقيقية.
