# Architecture Notes

## Module contract

كل Module يجب أن يوضح: Purpose، Responsibilities، Dependencies، Data Flow، Entry Points، Outputs، Failure Cases، Future Extension.

## Current modules

- `screens/`: تجميع العرض والتنقل؛ لا يحتوي أسرارًا أو استدعاءات مزود مباشرة.
- `components/`: عناصر UI مشتركة مع accessibility labels وحالات الضغط.
- `theme/`: مصدر واحد للهوية؛ تغيير اللون أو spacing يتم من tokens لا من شاشات منفردة.
- `services/storage/`: abstraction تمنع انتشار FileSystem داخل الشاشات.
- `services/ai/`: `AIProvider` يضع حدودًا واضحة بين التطبيق وBackend.
- `services/auth/`: `AuthProvider` يسمح بتركيب Supabase/Firebase لاحقًا.
- `types/`: domain contracts لتقليل coupling مع مزود خارجي.

## Planned browser flow

Address input → URL validation أو search query → WebView navigation state → download event → DownloadManager. يجب إبقاء inputs وforms تعمل حتى مع Kiosk restrictions؛ لا نستخدم حقن JavaScript واسعًا قبل اختبار المواقع المتنوعة.

## Planned storage flow

Download إلى `.tmp` → التحقق من الحجم/الامتداد/المساحة → duplicate policy → نقل إلى filename نهائي → حفظ metadata → event إلى gallery store. الملف المؤقت لا يظهر في Gallery.

## Architecture decisions

| القرار | لماذا | البديل | لماذا لم نستخدمه الآن |
|---|---|---|---|
| Provider interfaces | تبديل Supabase/Firebase/S3/AI دون إعادة كتابة UI | استدعاء SDK مباشرة من كل شاشة | coupling وصعوبة الاختبار |
| Backend أمام AI | حماية الأسرار والتحكم في rate limits | وضع API key داخل Expo | غير آمن؛ يمكن استخراج APK |
| Local bundled icon | التطبيق يعمل Offline ويحتاج launcher قبل الشبكة | Remote icon | نظام Android لا يعتمد على URL كـ launcher icon |
| Metadata layer | Gallery تحتاج list/filter/type/status بكفاءة | قراءة FileSystem في كل render | بطيء ويصعب التعامل مع 1000+ ملف |

## Failure policy

كل service يجب أن يحول فشل الشبكة أو التخزين أو الاستجابة غير الصحيحة إلى Error typed وقابل للعرض. لا `catch {}` صامت، ولا Promise غير متعامل معها.
