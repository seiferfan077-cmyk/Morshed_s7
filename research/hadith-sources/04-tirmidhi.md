# جامع الترمذي (Jami at-Tirmidhi) — مذكرة مصادر

**التقليد:** Sunni. هذه المذكرة عن *جامع الترمذي* فقط، ولا تدعي أن أي نسخة رقمية أو عدد واحد يمثل كل ما في الكتاب أو كل رواياته.

## المدى والعدد

تصف صفحة Sunnah.com المجموعة بأنها نحو **4,400 حديث مع التكرار** في **46 كتابًا**، وتذكر في شرح الخصائص أن في الكتاب 83 حديثًا مكررًا. وفي المقابل، الترقيم الإنجليزي الشائع على الموقع/في نسخ API يصل إلى **3,956** (آخر صفحة مرقمة على Sunnah.com هي 3956 في نتائج الموقع)، بينما تنزيل Hadith API العربي `ara-tirmidhi.json` الذي فحصته يحتوي **3,998 سجلًا**، وملفا Open-Hadith-Data الخاصان بالترمذي يحتوي كل منهما **3,890 صفًا حديثيًا بعد صف العناوين**. هذه ليست أعدادًا قابلة للمقارنة بلا ضبط: قد تختلف الطبعة، وفصل الحديث أو جمعه، وترقيم العربي عن الإنجليزي، وإدراج الشروح/التفصيل، ومعاملة المكرر.

تشرح Sunnah.com صراحة أن المترجم فصل أو جمع بعض الكتب والأحاديث، ولذلك اختلف ترقيم الإنجليزية عن العربية، وأن موقعها ينتقل تدريجيًا إلى ترقيم موحد موافق للطبعات والعلماء. لذلك أستخدم هنا «نحو 4,000–4,400 مدخل/رواية بحسب النسخة» لا ادعاء اكتمال أو عدد فريد بلا تكرار.

## مصدر عربي كامل

وجدت مصدرين قابلين للتنزيل:

1. **Open-Hadith-Data — مجلد Sunan_Al-Tirmidhi**: ملف CSV عربي بلا تشكيل (`sunan_al-tirmidhi_ahadith.utf8.csv`) وملف عربي مشكول مع «التفصيل/الشرح» (`sunan_al-tirmidhi_ahadith_mushakkala_mufassala.utf8.csv`). README يصف المشروع بأنه قواعد كاملة لتسعة كتب، ويقول إن ملفي كل مجموعة هما النص مع التشكيل والتفصيل والنص بلا تشكيل. هذا هو أوضح تنزيل عربي كامل وجدته، مع ضرورة مراجعة مصدر Islam Ware المذكور في README قبل اعتباره تحقيقًا طباعيًا نهائيًا.
2. **Hadith API**: نسخة عربية مشكلة `ara-tirmidhi.json` ونسخة بلا تشكيل `ara-tirmidhi1.json`، ولكل منهما رابط minified. ملف `editions.json` يعرّفهما صراحة بأن اللغة Arabic وأن `ara-tirmidhi1` أزيلت منه الحركات لتسهيل البحث، لكنه يترك خانة `source` فارغة و`author` = Unknown؛ لذا فالنص متاح تقنيًا، لكن نسبته العلمية/الطبعة غير موثقة في سجل الإصدار نفسه.

Sunnah.com تقول إن نصها العربي مأخوذ من **al-eman.com** ومصادر أخرى انقرضت/لم تعد متاحة، وتقول إن هدفها التحقق بالطبعات المطبوعة المعروفة. هذه قرينة منشأ مهمة، لكنها ليست تفويضًا بإعادة نشر نسخة الموقع كاملة.

## API والتنزيل والترخيص

- **Sunnah.com الرسمي:** لديه API، لكن صفحة المطورين تقول إن الوصول يحتاج API key، ويُطلب عبر مستودعهم، وأن dump غير المتصل «not available yet». صفحة الحقوق تقول: «We do not permit the scraping of our data, nor mass reproduction of entire books or collections on other websites»، وتسمح بإعادة إنتاج حديث مفرد أو مختارات لأغراض تعليمية/عرضية. لذلك لا يوجد في الصفحات المقروءة إذن صريح لإدخال كامل جامع الترمذي داخل تطبيق جوال تجاري أو مجاني؛ الحالة **غير مثبتة/غير مسموحة على افتراض**.
- **Hadith API (`fawazahmed0/hadith-api`):** endpoint مباشر، مثال النسخة العربية الكاملة: `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-tirmidhi.json`، مع التنزيل من مستودع GitHub. المستودع يعلن **Unlicense**. نص الترخيص الذي قرأته يقول حرفيًا: “Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.” هذا تصريح واسع للبرمجية/المستودع، لكنه لا يحسم وحده حقوق كل نص مصدر أو ترجمة مستوردة؛ راجع مصدر كل edition قبل تجميع تطبيق.
- **Open-Hadith-Data:** LICENSE يقول حرفيًا: “This Open-Hadith-Data project is made available under the Open Database License: http://opendatacommons.org/licenses/odbl/1.0/. Any rights in individual contents of the database are licensed under the Database Contents License: http://opendatacommons.org/licenses/dbcl/1.0/”. ODbL تمنح استخدامًا تجاريًا صراحة، لكنها تشترط إشعارات الترخيص، ونشر قاعدة مشتقة تحت ODbL/ترخيص متوافق، وإتاحة القاعدة المشتقة آليًا عند الاستخدام العلني. كما أن ODbL تفصل حقوق «المحتويات الفردية» عن حقوق قاعدة البيانات؛ لذلك لا ينبغي تحويلها إلى ضمان بأن كل تفريغ عربي أو شرح داخلها حر بلا قيود.
- **hadith-json** (نسخة JSON منسوخة من Sunnah.com): README يقول إن البيانات (50,884 حديثًا عبر 17 كتابًا) «scraped from Sunnah.com»، ويضم جامع الترمذي، لكن المستودع المقروء لا يعرض ملف LICENSE صريحًا في الجذر. لذلك لا أعدّه مصدرًا مرخصًا لإعادة التوزيع، خصوصًا مع منع Sunnah.com للكشط وإعادة إنتاج الكتب كاملة.

**الحكم لتطبيق جوال:** النسخة العربية الأصلية الكلاسيكية عمل مؤلف من القرن الثالث الهجري، ومن ثم لا أتعامل مع المؤلف الأصلي كصاحب حق مؤلف حديث؛ لكن ذلك لا يساوي ترخيصًا لتفريغ رقمي حديث أو تصحيح طباعي أو تشكيل أو ترجمة أو شرح. حقوق تلك الطبقات منفصلة بحسب الناشر/المحقق/المستودع والولاية القضائية. بالنسبة لـ Open-Hadith-Data يوجد مسار ترخيص قاعدة بيانات يمكن أن يدعم تطبيقًا تجاريًا مع ODbL/DBCL والامتثال للشروط. بالنسبة لـ Sunnah.com أو hadith-json، الإذن الصريح لإعادة توزيع المجموعة كاملة داخل تطبيق جوال تجاري أو مجاني **غير مثبت**؛ لا تفترض السماح.

## أصل أحكام الصحة والاختلاف

هناك مستويان مختلفان:

1. **حكم الإمام الترمذي داخل النص:** الترمذي نفسه يورد عبارات مثل «هذا حديث حسن» و«هذا أصح» ويشرح أحيانًا العلل والطرق. هذه جزء من النص/المنهج التراثي، وليست بالضرورة حكمًا حديثًا موحدًا لكل حديث.
2. **وسوم رقمية لاحقة:** Sunnah.com تقول إن أحكامها المعروضة في الكتب غير الصحيحين هي قرارات للشيخ **الألباني** و**دارالسلام (حافظ زبير علي زئي)**، وتأمل إضافة أحكام الأرناؤوط وغيرهم. صفحة حديث ترمذي 1 تعرض مثالًا: `Grade: Sahih (Darussalam)`، بينما صفحة 3956 تعرض `Grade: Hasan (Darussalam)`. أما `info.json` في Hadith API فيحمل لعدد من أحاديث الترمذي حقول grades بأسماء متعددة، منها **Al-Albani، Muhammad Muhyi Al-Din Abdul Hamid، Shuaib Al-Arnaut، Zubair Ali Zai**، وأحيانًا يختلف الوصف بينهم مثل Sahih/Hasan أو «Isnaad Hasan». إذن اسم المصحح/مصدر الوسم يجب تخزينه مع الدرجة، ولا يجوز اختزال الوسم إلى «صحيح» بلا نسبة.

نعم، قد يختلف الحكم بين العلماء والمناهج. كما أن «حسن/صحيح/غريب» في اصطلاح الترمذي ليس بالضرورة مطابقًا لتصنيف كل ناقد متأخر؛ والوسم في موقع أو API هو قرار/نقل مصدر بعينه، لا إجماعًا مستقلًا. لا أستنتج من وجود المجموعة في «الكتب الستة» أن كل أحاديثها صحيحة؛ صفحة About نفسها تنبه إلى أن ليس كل ما في كل مجموعة صحيحًا.

## ملاحظات تنفيذية

- خزّن `collection`, و`hadithnumber`, و`arabicnumber`, و`book/section`, و`source edition`, و`grader`, و`grade` كلّها منفصلة.
- ثبّت إصدارًا/commit أو tag للتنزيل؛ README في hadith-json يحذر من الاعتماد على `main` لأن شكل البيانات قد يتغير.
- لا تخلط النص العربي المشكول مع نسخة البحث بلا تشكيل على أنهما نصان مستقلان؛ النسخة الثانية تحويل/تنظيف بحثي.
- لا تنسب `source` علميًا لنسخة Hadith API دون تحقيق إضافي؛ سجل الإصدار نفسه يتركه Unknown/فارغًا.

## الروابط المقروءة

[1]: https://sunnah.com/tirmidhi/about "Sunnah.com — About Jami at-Tirmidhi"
[2]: https://sunnah.com/about "Sunnah.com — Sources, numbering, grading, and reproduction"
[3]: https://sunnah.com/developers "Sunnah.com — Developers/API"
[4]: https://github.com/mhashim6/Open-Hadith-Data "Open-Hadith-Data repository"
[5]: https://github.com/fawazahmed0/hadith-api "Hadith API repository and edition endpoints"
[6]: https://github.com/AhmedBaset/hadith-json "hadith-json repository (scraped from Sunnah.com; no root LICENSE shown)"
