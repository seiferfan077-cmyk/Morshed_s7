# بحث مزود AI واستضافة Backend — مُرشد

**تاريخ التحقق:** 2026-10-05. الحصص تتغير، والقيود الدقيقة تُراجع في حساب الخدمة قبل الإطلاق.

## القرار

- **مزود inference:** Groq Cloud API. اختير كتجربة مجانية مناسبة لـMurshid لأن له واجهة OpenAI-compatible سهلة الإدماج، وتذكر وثائقه أن طلبات inference لا تُحتفظ بها افتراضيًا، مع استثناءات محدودة وأدوات ZDR. النموذج المضبوط افتراضيًا `qwen/qwen3.8-27b` وقابل للتغيير من `GROQ_MODEL`.
- **استضافة Backend:** Vercel Hobby لأن المستودع كان يحتوي مسبقًا على Node.js Functions متوافقة مع Vercel وجذر نشر مستقل `backend/`. هذه الخطة للاستخدام الشخصي وغير التجاري، وتُراجع حدودها من لوحة الحساب. البديل Cloudflare Workers Free موثق بـ100,000 طلب يوميًا، لكنه يتطلب نقل/تهيئة المشروع.
- **Gemini:** يبقى اختيارًا بديلًا في Backend، لكن الحصة المجانية لديها مفاضلة خصوصية غير مناسبة لبيانات الذاكرة الشخصية دون موافقة واعية.

## مقارنة مختصرة

| الخدمة | ما يفيد Murshid | القيود التي يجب مراعاتها |
|---|---|---|
| Groq Cloud | Chat Completions متوافقة مع OpenAI، استجابة سريعة، عدم الاحتفاظ ببيانات inference افتراضيًا بحسب الوثائق | حدود الخطة والنموذج تتغير وتختلف حسب الحساب؛ تسجيل مؤقت قد يحدث للاعتمادية/مكافحة الإساءة حتى 30 يومًا؛ يمكن إدارة خيارات Data Controls/ZDR |
| Google Gemini API | Gemini 3.8 Flash متاح دون تكلفة على بعض الحصص/النماذج، وموجود أصلًا في كود Murshid | حدود RPM/TPM/RPD خاصة بكل مشروع ونموذج ولا تُضمن؛ شروط الاستخدام غير المدفوع تسمح باستخدام المدخلات والمخرجات لتحسين الخدمات والمراجعة البشرية، وتنصح بعدم إرسال معلومات حساسة |
| OpenRouter Free Models | واجهة واحدة لعدة نماذج مجانية | الحد يعتمد على نوع الحساب ويُفحص من API؛ الوثائق تنص أن شراء أرصدة يرفع سقف الاستخدام، لذلك لا يعادل سعة مجانية مضمونة |
| Vercel Hobby | أقصر مسار نشر لأن الكود الحالي Vercel Node.js Functions؛ السعر الحالي يعرض حصة شهرية للـFunction invocations | للاستخدام الشخصي وغير التجاري فقط؛ يلزم مراقبة السقوف وملاءمة الاستخدام لشروط الخطة |
| Cloudflare Workers Free | سقف منشور 100,000 طلب/يوم مناسب لخدمات HTTP الخفيفة | حد CPU هو 10ms لكل طلب وبعض خصائص الاستضافة/التخزين تختلف؛ يتطلب تهيئة منفصلة عن مشروع Vercel الحالي |

## الخصوصية

- تذكر Groq أن مدخلات/مخرجات inference لا تُحتفظ بها افتراضيًا، لكن يمكن تسجيلها مؤقتًا لتحقيق الاعتمادية أو التحقيق في سوء الاستخدام حتى 30 يومًا؛ يمكن تفعيل Zero Data Retention من Data Controls وفق الوثائق.
- تذكر Google أن المحتوى في الخدمات غير المدفوعة، بما يشمل الحصة المجانية لـGemini API، قد يُستخدم لتقديم وتحسين خدمات Google وقد يراجعه أشخاص. لهذا السبب لا يُنصح بإرسال بيانات شخصية حساسة إلى Gemini المجاني.
- يبقى مفتاح مزود AI في متغير بيئة سري على Backend، وليس في APK أو متغيرات `EXPO_PUBLIC_*`.

## المصادر الرسمية

- Groq — limits: https://console.groq.com/docs/rate-limits
- Groq — active models: https://console.groq.com/docs/models
- Groq — data handling, retention and ZDR: https://console.groq.com/docs/your-data
- Google — Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Google — Gemini API pricing/free tier: https://ai.google.dev/gemini-api/docs/pricing
- Google — Gemini API terms/data handling: https://ai.google.dev/gemini-api/terms
- Vercel — plan pricing and Hobby restrictions: https://vercel.com/pricing
- Vercel — limits: https://vercel.com/docs/limits/overview
- Cloudflare — Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- OpenRouter — free-model request limits: https://openrouter.ai/docs/api_reference/limits
