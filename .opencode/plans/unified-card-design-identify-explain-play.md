School 1: The Cinema Grid (Netflix/Disney+/Letterboxd)
Philosophy: The poster IS the product. Everything else is noise.

Hierarchy: Poster > title > metadata (only on hover)
Info density: Minimal at rest, revealed on interaction
Imagery: Full-bleed, no borders, no decorations
Hover: Card elevates + shows play action + brief info- Responsive: Horizontal scrolling rows on mobile- Light/Dark: Primarily dark (cinema context)
Strengths: Maximum visual impact, content-forward
Weaknesses: Requires hovering to get info, poor for browsing-by-metadata
School 2: The Data Card (IMDb/TMDB/JustWatch)
Philosophy: Information is king. The card is a data container.

Hierarchy: Title = metadata = poster (balanced)
Info density: High — rating, year, type, genre all visible at rest
Imagery: Poster with borders, smaller relative to card
Hover: Minimal elevation, maybe color accent
Responsive: Grid with more columns, denser on mobile
Light/Dark: Works in both (information-oriented)
Strengths: Efficient browsing, comparison-friendly
Weaknesses: Cluttered, competes with content, less emotional
School 3: The Editorial Card (Apple TV+/Criterion Channel/MUBI)
Philosophy: Curated presentation. Each item deserves breathing room.

Hierarchy: Image > title, everything else is optional
Info density: Very low — just image + title + maybe one accent
Imagery: Large, well-spaced, generous padding
Hover: Subtle scale, maybe border glow
Responsive: Fewer columns, more space per item
Light/Dark: Adapts, often light-forward- Strengths: Elegant, high-end feel, content-respecting
Weaknesses: Requires more scrolling, less efficient for large catalogs
School 4: The Hybrid Progressive (Plex/Jellyfin/Emby)
Philosophy: Show what's available, reveal depth on demand.

Hierarchy: Poster > status badges > title > key stats
Info density: Medium — some info at rest (rating, year), more on hover
Imagery: Poster-dominant with subtle overlays (progress bar, badges)
Hover: Expand card to show metadata panel
Responsive: Adapts column count, maintains badge visibility
Light/Dark: Both equally supported
Strengths: Balance of browse-ability and visual impact
Weaknesses: Jack of all trades, master of none
School 5: The Minimal Glass (Spotify/YouTube Music for albums)
Philosophy: Surface + action. The card exists to be played.

Hierarchy: Image > play button > title
Info density: Minimal — image dominates
Imagery: Full-bleed, rounded, sometimes with glass overlay
Hover: Play button appears, slight scale
Responsive: Horizontal scroll or grid
Light/Dark: Adapts image treatment
Strengths: Action-oriented, clean- Weaknesses: Poor for discovery/browsing
Now, which fits THIS platform?

Platform DNA:

Arabic movie/series library — content-rich catalog
Personal/small team — not Netflix-scale browsing
LAN deployment — likely large screen (TV/monitor) primary
Already has: sections, favorites, watch-later, ratings, genres, years, people
Content-First philosophy declared
Cinematic dusk theme
My analysis:

This is NOT Netflix (massive catalog, endless scrolling). This is a PERSONAL library — curated by the user. The user KNOWS their content. They don't need to discover — they need to ACCESS and MANAGE.

This shifts the balance toward:

Efficiency over discovery — less scrolling, more info at rest
Personal connection — favorites, watch-later are important states
Both browsing AND playing — the card serves both lookup and action
Admin dashboard — the same content is managed elsewhere, so consistency matters
The closest fit is a Hybrid Progressive approach with Editorial breathing room:

Poster is dominant but not the only thing
Key metadata visible at rest (title, year, rating)
Hover reveals action (play) + deeper info (type, certification, duration, genres)
Badges are meaningful states (new, favorites) not decorations
Generous spacing for RTL readability
But I should also consider the unique aspects:

RTL — info flow is right-to-left, so hierarchy must work in RTL
Arabic text — variable width, often longer than English equivalents
Mixed content — movies, series, theater, audio, live — different metadata needs
Personal library — smaller catalog, more intimate relationship with content
Let me structure this as a proper design school comparison and recommendation.

Actually, let me also think about the specific dimensions of comparison the user asked for:

Hierarchy — What comes first visually? Info density — How much data at rest vs on demand? Imagery — How is the poster treated? Interaction — What does hover/focus/click do? Responsive — How does it adapt? Extensibility — Can new badges/states be added without breaking? Light/Dark — How does it adapt? RTL — How does direction affect layout?

For each school, I'll rate these.

Let me write this up as a comprehensive design document. I'll present it in Arabic since the user communicates in Arabic.

فهمت تماماً. أنت تريد 𖡄 فلسفة معمارية للبطاقة، ليس تعديلاً تكتيكياً. لنبدأ من الأساس.

فلسفة UnifiedCard — مقارنة المدارس التصميمية
السياق الخاص بنا (DNA المنصة)
قبل اختيار مدرسة، يجب تعريف ما نحن عليه حقاً:

الخاصية	الحقيقة
طبيعة المحتوى	مكتبة شخصية (فيلم، مسلسل، مسرح، صوتي، مباشر)
حجم الكتالوج	متوسط — ليس Netflix (آلاف) وليس معرض صور (عشرات)
علاقة المستخدم	يعرف محتواه — يديره ويستعرضه
الشاشة الرئيسية	شاشة كبيرة (TV/monitor) عبر LAN
الثيم	سينمائي غامق (الافتراضي) + فاتح ورقي (اختياري)
الاتجاه	RTL عربي — عرض متغير الطول
الأولوية	Content-First — المحتوى بطل، الواجهة هادئة
هذا يعني: ليست منصة اكتشاف ضخمة (Netflix) وليست عرض معلومات بحت (IMDb). إنها مكتبة شخصية — المستخدم يعرف ما يملكه ويحتاج وصولاً سريعاً وأنيقاً.

المدارس الخمس
المدرسة 1: «الشبكة السينمائية» (Netflix / Disney+ / Letterboxd)
الفكرة الجذرية: البوستر هو المنتج. كل شيء آخر ضجيج.

البُعد	النهج
Hierarchy	البوستر 90% → العنوان 8% → الباقي 2%
كثافة المعلومات	صفر عند الراحة، كل شيء على Hover
الصور	Full-bleed، بلا حدود، بلا زينة
التفاعل	ارتفاع + ظل + زر تشغيل + معلومات مختصرة
Hover/Focus	التأثير الرئيسي للكشف عن الإجراء
Responsive	صفوف أفقيّة (scroll) على الموبايل
L/D	داكن افتراضياً (سياق سينمائي)
RTL	محايد (البوستر لا يتأثر بالاتجاه)
قابلية التوسع	محدودة — كل زينة جديدة تُفسد النقاء
نقاط القوة: أقصى تأثير بصري، احترافية سينمائية نقاط الضعف: لا تعمل بدون hover، لا تخدم التصفح بالبيانات (تصنيف/سنة/جودة)

المدرسة 2: «بطاقة البيانات» (IMDb / TMDB / JustWatch)
الفكرة الجذرية: المعلومات هي الملك. البطاقة حاوية بيانات.

البُعد	النهج
Hierarchy	العنوان = التقييم = البوستر (متوازن)
كثافة المعلومات	عالية — تقييم + سنة + نوع + تصنيف مرئية دائماً
الصور	بوستر بحدود ومسافات، أصغر من البطاقة
التفاعل	تغيير لون الحد فقط
Hover/Focus	طفيف — لا إجراء رئيسي
Responsive	شبكة أعمدة أكثر، أكثف على الموبايل
L/D	يعمل في الوضعين (موجه للمعلومات)
RTL	يحتاج تخطيط خاص (معلومات عربية أطول)
قابلية التوسع	سهلة — إضافة حقل لا تكسر شيء
نقاط القوة: تصفح كفؤ، مقارنة سهلة نقاط الضعف: مزدحم، ينافس المحتوى، عاطفياً بارد

المدرسة 3: «البطاقة التحريرية» (Apple TV+ / Criterion Channel / MUBI)
الفكرة الجذرية: كل عنصر يستحق مساحة تنفس. العرض أنيق ومُعتنَى.

البُعد	النهج
Hierarchy	الصورة 85% → العنوان 12% → لمسة لونية 3%
كثافة المعلومات	منخفضة جداً — صورة + عنوان فقط
الصور	كبيرة، متباعدة، مع حشو سخي
التفاعل	تكبير طفيف + توهج حد خفيف
Hover/Focus	حركة أنيقة، لا تغيير محتوى
Responsive	أعمدة أقل، مساحة أكبر لكل عنصر
L/D	يتكيف، غالباً يبدأ بالفاتح
RTL	جيد — التباعد ي rộng للنصوص الطويلة
قابلية التوسع	صعبة — أي إضافة تُخرب النقاء
نقاط القوة: أناقة عالية، احترافية، محتوى يتنفس نقاط الضعف: تحتاج تمريراً أكثر، لا تخدم الكتالوجات الكبيرة

المدرسة 4: «التقدمي التكاملي» (Plex / Jellyfin / Emby)
الفكرة الجذرية: اعرض ما هو متاح، اكشف العمق عند الطلب.

البُعد	النهج
Hierarchy	البوستر > شارات الحالة > العنوان > إحصاءات
كثافة المعلومات	متوسطة — معلومات أساسية مرئية + تفاصيل على Hover
الصور	بوستر مع تراكبات خفيفة (شريط تقدم، شارات)
التفاعل	تكبير + ظهور زر التشغيل + لوحة معلومات
Hover/Focus	كشف تدريجي: إجراء → معلومات → تصنيفات
Responsive	يتكيف بعدد الأعمدة مع الحفاظ على الشارات
L/D	كلا الوضعين مدعوم بشكل متساوٍ
RTL	يحتاج عناية (التصنيفات والأرقام تتداخل مع RTL)
قابلية التوسع	جيدة — شارات جديدة لا تكسر البنية
نقاط القوة: توازن بين البصري والبيانات نقاط الضعف: لا تتفوق في أي بُعد — "jack of all trades"

المدرسة 5: «الحد الأدنى الزجاجي» (Spotify / YouTube Music)
الفكرة الجذرية: سطح + إجراء. البطاقة موجودة لتُشغَّل.

البُعد	النهج
Hierarchy	الصورة > زر التشغيل > العنوان
كثافة المعلومات	صفر — الصورة تسيطر
الصور	Full-bleed، مستديرة أحياناً، زجاج فوقها
التفاعل	ظهور زر تشغيل فقط
Hover/Focus	زر + تكبير طفيف
Responsive	أفقي أو شبكة
L/D	يتكيف مع معالجة الصورة
RTL	محايد
قابلية التوسع	محدودة — أي معلومة تُخرب النقاء
نقاط القوة: موجه للفعل (تشغيل)، نظيف نقاط الضعف: لا تخدم الاكتشاف أو التصفح

المقارنة المتقاطعة
البُعد	1. سينمائية	2. بيانات	3. تحريرية	4. تكاملي	5. حد أدنى
arbonate on posters	★★★★★	★★★	★★★★★	★★★★	★★★★★
تصفح بالبيانات	★	★★★★★	★	★★★	★
التفاعل والإجراء	★★★★	★★	★★	★★★★	★★★
اتساق RTL	★★★	★★	★★★★	★★★	★★★
Mo/Dark مرونة	★★★	★★★★	★★★★	★★★★★	★★★
قابلية التوسع	★★	★★★★★	★	★★★★	★★
الشعور	سينمائي	إداري	فاخر	عملي	موسيقي
ماذا نحتاج نحن تحديداً؟
لا نحتاج:
❌ ال纯 سينمائية (Netflix): لأننا نعرض تصنيفات + سنوات + تقييمات — لا يمكن لكل شيء انتظار Hover
❌ ال纯 بيانات (IMDb): لأننا نريد أنيقة Content-First، لا جدول بيانات
❌ ال纯 تحريرية (MUBI): لأن لدينا 5 أنواع وسائط وشارات حالة — النقاء المطلق لا ي服务 التنوع
❌ ال纯 حد أدنى (Spotify): لأننا لا نُوسيقى فقط — أفلام + مسلسلات + مسرحيات
نحتاج: مدرسة رابعة مخصصة — «المكتبة السينمائية المعتنية»
فلسفة تجمع بين:

.poster-first من السينمائية (البوستر بطل)
meta-at-rest من التقدمي (عنوان + سنة + تقييم مرئية بدون Hover)
breathing room من التحريرية (مسافات سخية، لا ازدحام)
progressive disclosure من التقدمي (Hover يكشف العمق)
RTL-native بال设计 من البداية (ليس︵oad-on)
الفلسفة المقترحة: «المكتبة السينمائية المعتنية»
المبادئ الخمسة
١. Poster Primacy (البوستر أولاً)

البوستر يشغل ≥75% من مساحة البطاقة. لا تrik overlay يخفيه بالكامل. المعلومات تأتي حوله أو فوقه بشفافية.

٢. Calm Metadata (بيانات هادئة)

العنوان + السنة + التقييم مرئية دائماً لكن بهدوء (أحجام صغيرة، ألوان محايدة). لا تتنافس مع البوستر.

٣. Progressive Depth (عمق تدريجي)

Hover لا يُخفي البوستر — يُضيف: زر الإجراء + معلومات إضافية. البوستر يبقى ظاهراً دائماً.

٤. Contextual Badges (شارات سياقية)

الشارات لحالات حقيقية فقط (جديد، مُقيَّم). لا شارات زينة. تتكيّف مع الثيم.

٥. Direction-Agnostic Layout (تخطيط محايد للاتجاه)

البطاقة تعمل بالضبط بنفس الطريقة في RTL وLTR. المعلومات الثانوية (سنة، مشاهدات) في مواقع لا تتأثر بالاتجاه.

كيف تبدو البطاقة حسب هذه الفلسفة:
┌─────────────────────┐
│ ★ 8.5   │          │  ← شارة تقييم (يسار في RTL)
│         │          │     شارة جديد (يمين في RTL)
│   BOPOSTER          │
│   (aspect-2/3)      │
│                     │
│─────────────────────│
│ عنوان العنصر        │  ← 14px، سطر واحد
│ 2024 · فيلم · 120 دقيقة │  ← 11px، metadata row
└─────────────────────┘

On Hover:
┌─────────────────────┐
│ ★ 8.5   │          │
│         │          │
│   BOPOSTER          │  ← البوستر يبقى ظاهراً
│
The user is clarifying what they want. They don't want me to pick a color or badge or copy Netflix. They want a philosophical and architectural discussion about card design:

Present multiple design schools/philosophies for content platform cards
Explain HOW each school THINKS about cards (not just what they look like)
Compare them on: hierarchy, info density, images/posters, interaction, hover/focus, responsive, extensibility, Light/Dark, RTL
Determine what fits their specific platform
Reach an architectural decision for UnifiedCard
After philosophy is adopted, THEN move to implementation
The key insight: they don't want "this is the prettiest card" or "copy Netflix"; they want the best global design principles selected and assembled into an original system.

I'm in plan mode — read-only. I should present this analysis comprehensively.

Let me structure this as a proper design philosophy comparison.

Let me think about what schools of card design exist in the wild:

Netflix/Disney+ — Cinema-First: Poster dominance, zero information at rest, everything on hover. The card exists to sell the visual.
IMDb/TMDB — Data-Dense: Information is king. Rating, year, genre all visible at rest. The card is a data container.
Apple TV+/MUBI/Criterion — Editorial Minimalist: Generous whitespace, large imagery, very little text. The card breathes.
Plex/Jellyfin/Emby — Progressive Disclosure: Poster-first but with visible status badges. Hover reveals metadata + action. Hybrid of cinema and data.
Letterboxd/Trakt — Social-Data: Rating-centric with social proof. Data wrapped in aesthetic presentation.
For THIS platform, the user established:

Personal library (not discovery platform)
Cinematic dark theme as default
Content-First (posters are hero)
Arabic RTL
LAN deployment (big screens)
Multiple media types (movie, series, theater, audio, live)
Needs: rating, genre, year, views, certification, duration, "new" indicator- Calm, professional, not competing with posters
Let me map these against the platform's real needs and propose an architecture.

Actually, I realize my response was cut off in the previous message. The user's second message (m0320) is a meta-instruction clarifying what they want. Let me give them the comprehensive design philosophy analysis they're asking for.

Let me structure it properly.

ممتاز — فهمت التحول بالضبط. أنت لا تريد تعديلاً تكتيكياً، بل فلسفة معمارية للبطاقة. لنبدأ من الصفر.

فلسفة UnifiedCard — مقارنة المدارس التصميمية
أولاً: DNA المنصة (السياق الذي نصمم إليه)
الخاصية	الحقيقة
طبيعة المحتوى	مكتبة شخصية (فيلم، مسلسل، مسرح، صوتي، مباشر)
حجم الكتالوج	متوسط — ليس Netflix (آلاف) وليس معرض صور (عشرات)
علاقة المستخدم	يعرف محتواه — يُديره ويستعرضه
الشاشة	شاشة كبيرة (TV/monitor) عبر LAN
الثيم	سينمائي غامق (الافتراضي) + فاتح ورقي (اختياري)
الاتجاه	RTL عربي — نصوص متغيرة الطول
الأولوية	Content-First — المحتوى بطل، الواجهة هادئة
هذا يعني: ليست منصة اكتشاف ضخمة (Netflix) وليست عرض معلومات بحت (IMDb). إنها مكتبة شخصية — المستخدم يعرف ما يملكه ويحتاج وصولاً سريعاً وأنيقاً.

ثانياً: المدارس الخمس
المدرسة 1: «الشبكة السينمائية» (Netflix / Disney+ / Letterboxd)
الفلسفة الجذرية: البوستر هو المنتج. كل شيء آخر ضجيج.

البُعد	النهج	تقييم لحالتنا
Hierarchy	البوستر 90% → العنوان 8% → الباقي 2%	✓ متوافق مع Content-First
كثافة المعلومات	صفر عند الراحة، كل شيء على Hover	✗ نحتاج: نوع + سنة + تقييم مرئية دائماً
الصور	Full-bleed، بلا حدود، بلا زينة	✓ جيد
التفاعل	ارتفاع + ظل + زر تشغيل + معلومات مختصرة	✓ مفيد
Hover/Focus	التأثير الرئيسي للكشف عن الإجراء	✓ مفيد لكنه الوحيد — خطر إذا فشل Hover
Responsive	صفوف أفقيّة (scroll) على الموبايل	✓ بسيط
L/D	داكن افتراضياً (سياق سينمائي)	✓ متوافق
RTL	محايد (البوستر لا يتأثر)	✓ بسيط
قابلية التوسع	محدودة — كل زينة جديدة تُفسد النقاء	✗ نحتاج: 5 أنواع وسائط + شارات حالة
لماذا لا ن Adoptها كاملة: لا تعمل بدون hover، ولا تخدم التصفح بالبيانات (تصنيف/سنة/جودة).

المدرسة 2: «بطاقة البيانات» (IMDb / TMDB / JustWatch)
الفلسفة الجذرية: المعلومات هي الملك. البطاقة حاوية بيانات.

البُعد	النهج	تقييم لحالتنا
Hierarchy	العنوان = التقييم = البوستر (متوازن)	✗ ينافس المحتوى
كثافة المعلومات	عالية — تقييم + سنة + نوع + تصنيف مرئية دائماً	✓ جزئياً — نحتاج مرئية لكن بهدوء
الصور	بوستر بحدود ومسافات، أصغر من البطاقة	✗ يُضعف البوستر
التفاعل	تغيير لون الحد فقط	✗ ضعيف
Hover/Focus	طفيف — لا إجراء رئيسي	✗ نحتاج إجراء تشغيل
Responsive	شبكة أعمدة أكثر، أكثف على الموبايل	✓ مرن
L/D	يعمل في الوضعين	✓ جيد
RTL	يحتاج تخطيط خاص (معلومات عربية أطول)	✗ نقطة ضعف
قابلية التوسع	سهلة — إضافة حقل لا تكسر شيء	✓ ممتاز
لماذا لا ن Adoptها كاملة: مزدحمة، تتنافس مع المحتوى، عاطفياً باردة.

المدرسة 3: «البطاقة التحريرية» (Apple TV+ / Criterion Channel / MUBI)
الفلسفة الجذرية: كل عنصر يستحق مساحة تنفس. العرض أنيق ومُعتنَى.

البُعد	النهج	تقييم لحالتنا
Hierarchy	الصورة 85% → العنوان 12% → لمسة لونية 3%	✓ Content-First مثالي
كثافة المعلومات	منخفضة جداً — صورة + عنوان فقط	✗ نحتاج تقييم + نوع + سنة
الصور	كبيرة، متباعدة، مع حشو سخي	✓ راقٍ
التفاعل	تكبير طفيف + توهج حد خفيف	✓ هادئ
Hover/Focus	حركة أنيقة، لا تغيير محتوى	✓ أنيق لكن لا إجراء
Responsive	أعمدة أقل، مساحة أكبر لكل عنصر	✓ ممتاز
L/D	يتكيف، غالباً يبدأ بالفاتح	✓ جيد
RTL	جيد — التباعد واسع للنصوص الطويلة	✓ ممتاز
قابلية التوسع	صعبة — أي إضافة تُخرب النقاء	✗ نحتاج شارات وبيانات
لماذا لا ن Adoptها كاملة: تحتاج تمريراً أكثر، لا تخدم الكتالوجات المتوسطة.

المدرسة 4: «التقدمي التكاملي» (Plex / Jellyfin / Emby)
الفلسفة الجذرية: اعرض ما هو متاح، اكشف العمق عند الطلب.

البُعد	النهج	تقييم لحالتنا
Hierarchy	البوستر > شارات الحالة > العنوان > إحصاءات	✓ متوازن
كثافة المعلومات	متوسطة — معلومات أساسية مرئية + تفاصيل على Hover	✓ متوافق مع احتياجنا
الصور	بوستر مع تراكبات خفيفة (شريط تقدم، شارات)	✓ وظيفي
التفاعل	تكبير + ظهور زر التشغيل + لوحة معلومات	✓ واضح
Hover/Focus	كشف تدريجي: إجراء → معلومات → تصنيفات	✓ مناسب
Responsive	يتكيف بعدد الأعمدة مع الحفاظ على الشارات	✓ مرن
L/D	كلا الوضعين مدعوم بشكل متساوٍ	✓ ممتاز
RTL	يحتاج عناية (التصنيفات والأرقام تتداخل)	✓ متوسط
قابلية التوسع	جيدة — شارات جديدة لا تكسر البنية	✓ ممتاز
لماذا لا ن Adoptها كاملة: "jack of all trades" — لا تتفوق في أي بُعد. قد تبدو عادية.

المدرسة 5: «الحد الأدنى الزجاجي» (Spotify / YouTube Music)
الفلسفة الجذرية: سطح + إجراء. البطاقة موجودة لتُشغَّل.

البُعد	النهج	تقييم لحالتنا
Hierarchy	الصورة > زر التشغيل > العنوان	✓ بسيط
كثافة المعلومات	صفر — الصورة تسيطر	✗ لا تخدم أفلام/مسلسلات
الصور	Full-bleed، مستديرة أحياناً، زجاج فوقها	✓ جميل
التفاعل	ظهور زر تشغيل فقط	✓ لكنه الوحيد
Hover/Focus	زر + تكبير طفيف	✓ بسيط
Responsive	أفقي أو شبكة	✓
L/D	يتكيف مع معالجة الصورة	✓
RTL	محايد	✓
قابلية التوسع	محدودة	✗ لا تخدم 5 أنواع
لماذا لا ن Adoptها كاملة: مصممة للموسيقى فقط — لا تخدم الاكتشاف أو التصفح.

ثالثاً: المقارنة المتقاطعة
البُعد	1. سينمائية	2. بيانات	3. تحريرية	4. تكاملي	5. حد أدنى
سيطرة البوستر	★★★★★	★★★	★★★★★	★★★★	★★★★★
تصفح بالبيانات	★	★★★★★	★	★★★	★
التفاعل والإجراء	★★★★	★★	★★	★★★★	★★★
اتساق RTL	★★★	★★	★★★★	★★★	★★★
Light/Dark مرونة	★★★	★★★★	★★★★	★★★★★	★★★
قابلية التوسع	★★	★★★★★	★	★★★★	★★
الشعور	سينمائي	إداري	فاخر	عملي	موسيقي
رابعاً: ماذا نحتاج نحن تحديداً؟
لا نحتاج:
❌ 纯 سينمائية (Netflix): لأننا نعرض تصنيفات + سنوات + تقييمات — لا يمكن لكل شيء انتظار Hover
❌ 纯 بيانات (IMDb): لأننا نريد أنيقة Content-First، لا جدول بيانات
❌ 纯 تحريرية (MUBI): لأن لدينا 5 أنواع وسائط وشارات حالة — النقاء المطلق لا يخدم التنوع
❌ 纯 حد أدنى (Spotify): لأننا لا نُوسيقى فقط — أفلام + مسلسلات + مسرحيات
نحتاج: مدرسة خامسة مخصصة — «المكتبة السينمائية المعتنية»
فلسفة تجمع العناصر الأقوى من كل مدرسة وتُعيد تركيبها:

تأخذ من	ماذا بالضبط	لماذا
السينمائية	البوستر ي	
تابع 
The user wants me to continue with the design philosophy discussion. I'm in plan mode - read only. Let me continue from where I left off. I was building the "Cinematic Curated Library" philosophy that combines elements from the five schools.

Let me continue with:

The specific philosophy for this platform
How it maps to concrete design rules
The architectural blueprint for UnifiedCard
Get user approval before any implementation
Let me think deeply about what makes this platform unique and what card architecture fits best.

Key constraints:

Arabic RTL (text changes length dramatically)
Multiple content types (movie, series, theater, audio, live)
Personal library (not discovery — the user knows their content)
Dark cinematic default, light warm paper alternative
Poster-centric (2:3 aspect ratio)
Needs: rating, genre, year, views, certification, duration, "new" indicator
Hover interaction for actions (play, link)
LAN deployment — likely large screens
Admin dashboard has its own separate design system
Let me think about what's REALLY wrong with the current card from a design philosophy perspective, not just color fixes:

The hover overlay completely hides the poster — This contradicts Content-First. The poster is the hero, but on hover (when you're most engaged) it disappears behind a dark gradient.
The info panel under the poster is too small — 13px title, 11px meta. On large screens this is tiny.
Two badges competing — "جديد" OR genre tag on one side, rating on the other. When both exist, they frame the poster like bookends.
The play button is small and centered — On a poster, the natural action is to click the poster itself, not a small button in the middle.
The hover gradient is heavy — from-overlay-scrim/70 via/40 to/80 — this is essentially blacking out the poster.
Now let me think about what the IDEAL card looks like for this specific platform.

What the user actually does with cards:

Browses their library visually (posters)
Checks what's new (new badge)
Sees ratings at a glance (quick quality judgment)
Clicks to view details (not directly to play — they go to item-detail first)
Sometimes plays directly (link/play icon)
Compares items by year, type, genre
The card's real job:

Show me the poster (visual recognition)
Tell me the title (text recognition)
Show me the quality (rating)
Tell me what it is (type/year)
Let me act (click to detail or play)
Current problems in order of impact:

Hover overlay hides the poster — contradicts Content-First
Below-poster text is too small
Play button competes with poster click
Info density under hover is too high
No visual distinction between content types
Let me now formulate a proper architectural decision. I need to present this as a clear philosophical framework with concrete rules that will govern every design decision in the card.

I should present:

The philosophy name and principles
Concrete architectural rules (spacing, sizing, hierarchy)
How it handles each interaction state
How it handles each content type
How it adapts to L/D and RTL
Get user approval
This is purely thinking and reading — no file changes.

أكمل — أ航ض الفلسفة المقترحة والعمليات المعمارية.

رابعاً (تكملة): الفلسفة المقترحة — «المكتبة السينمائية المعتنية»
التعريف
بطاقة تُظهر البوستر والبيانات الأساسية معاً عند الراحة، وتكشف الإجراء والعمق عند التفاعل — دون إخفاء البوستر أبداً.

هذه ليست نسخة من Netflix أو Plex — إنها فلسفة مبنية على حقيقة هذه المنصة تحديداً: مكتبة شخصية يعرفها صاحبها.

المبادئ الخمسة (Contracts)
البند ① — Poster is Always Visible (البوستر لا يُخفي أبداً)

عند التمرير (hover)، لا توجد طبقة سوداء تُخفي البوستر. بدلاً من ذلك: تظهر أزرار وإجراءات فوق البوستر مع خلفية شفافة.

ではない	الحالي	المقترح
Netflix	طبقة سوداء كاملة + زر في المنتصف	بوستر ظاهر + أزرار طفو
Plex	تعتيم جزئي + معلومات	تعتيم خفيف سفلي فقط
لماذا؟ لأن في مكتبة شخصية، المستخدم يتصفح بالمشاهد (visual browsing). إخفاء البوستر يكسر التصفح البصري.

البند ② — Calm Data Row (صف بيانات هادئ)

تحت البوستر مباشرة: سطر واحد يحتوي العنوان + السنة + التقييم. لا صفوف متعددة. لا تفاصيل إضافية.

Current:  13px title | 11px views + year  (جملتين صغيرتين)
Proposed: 14px title · 12px year · rating  (سطر واحد متماسك)
لماذا؟ لأن البطاقة ليست صفحة تفاصيل. دورها: تعريفي + بصري. التفاصيل في item-detail.

البند ③ — Action on Hover, Not on Rest (الإجراء عند التمرير فقط)

زر التشغيل/الفتح لا يظهر إلا عند Hover. عند الراحة: لا يوجد زر — البطاقة تفاعلية بالكامل (نقر anywhere → الانتقال).

Rest:    Poster + Title + Meta Row
Hover:   Poster + Play/Favorite icons (floating, transparent bg)
لماذا؟ لأن في المكتبة الشخصية، معظم النقرات هي "عرض التفاصيل". التشغيل مباشرة حالة ثانوية. الزر_fixed يشوه الراحة البصرية.

البند ④ — Badges are Meaningful, Not Decorative (شارات ذات مغزى فقط)

شارة واحدة فقط في كل مرة. لا تتراكم.

الحالة	الشارة	الموضع
جديد	نبضة خضراء صغيرة	أعلى اليمين (RTL)
تقييم	نجمة + رقم	أعلى اليسار (RTL)
نوع	لا شارة	معلومات في صف البيانات
تصنيف	لا شارة	معلومات في صف البيانات
لماذا؟ كل شارة تُضيف حساً معلوماتياً لكنها تُ klç视觉噪音. شارة واحدة = قرار واحد = معلومة واحدة.

البند ⑤ — Type-Aware Metadata (بيانات ت่าน نوع المحتوى)

صف البيانات يتكيف حسب نوع الوسائط:

النوع	صف البيانات
فيلم	العنوان · 2024 · 120 دقيقة
مسلسل	العنوان · 2024 · 3 مواسم
مسرحية	العنوان · 2024 · 90 دقيقة
صوتي	العنوان · 2024 · 45 دقيقة
مباشر	العنوان · مباشر 🔴
لماذا؟ لأن نوع الوسائط يُغيّر ما هو مفيد للمستخدم. مسلسل بـ "120 دقيقة" لا معنى له — seasons أهم.

خامساً: البنية المعمارية للبطاقة
الأبعاد والنسب
البطاقة:
  maxWidth: 280px (mobile) → 320px (desktop) → none (slider)
  aspect-ratio: 2/3 (البوستر)
  gap: 12px (بين البوستر وصف البيانات)
  borderRadius: 12px

البوستر:
  width: 100%
  aspect-ratio: 2/3
  object-fit: cover
  borderRadius: 12px (العلوي والجانبي)

صف البيانات (تحت البوستر):
  padding: 0 4px
  height: ~40px (سطر العنوان + سطر البيانات)
ألوان البوستر (المnumbers)
Rest:    لا تعتيم — البوستر كامل السطوع
Hover:   تعتيم سفلي خفيف only (from-overlay-scrim/30 to-transparent)
         + ظل خفيف حول البطاقة
vs الحالي: from-overlay-scrim/50 دائم + from-overlay-scrim/70 via/40 to/80 عند Hover = 5 طبقات تعتيم. المقترح: طبقة واحدة عند Hover فقط.

التفاعل (Hover Flow)
1. البطاقة تتحرك للأعلى 4px (scale-[1.02])
2. ظل خفيف يظهر (shadow-hover)
3. حد ذهبي خفيف (border-ring/40)
4. أيقونة play/فتح تظهر في أسفل البوستر (متحركة من الأسفل)
5. لا تعتيم إضافي — البوستر يبقى ظاهراً
vs الحالي: البوستر يختفي خلف طبقة سوداء → يظهر زر في المنتصف → تظهر لوحة معلومات كاملة. المقترح: البوستر يبقى البطل، الأدوات تظهر حوله.

التباين والثيم
Light: البوستر يتحدث — لا حاجة لتعتيم
Dark:  البوستر يتحدث — لا حاجة لتعتيم
       الفرق الوحيد: ظل البطاقة أعمق في الداكن
المبدأ: البوستر هو مصدر اللون والحيوية. الواجهة لا تُضيف ألوان على البوستر — هي فقط تُظهره.

سادساً: الأسئلة المفتوحة قبل التنفيذ
قبل أن ننتقل للتنفيذ، هناك 4 قرارات تحتاج تأكيدك:

The JSON was malformed. Let me fix it.

The user confirmed all my recommendations:

Hover: No scrim - poster stays 100% visible
Metadata: Single merged line
Click: Entire card → detail page
Badge: One at most
Now I need to continue building the architectural blueprint and present it for approval. Let me now translate these decisions into a concrete architectural specification.

I'm in plan mode — READ ONLY. I should present the full architecture, get final approval, then write it to a plan file.

Let me build the complete architecture now.

ممتاز — كل القرارات متوافقة مع الفلسفة. الآن أبني المعمارية النهائية بالكامل.

المعمارية النهائية لـ UnifiedCard
الفلسفة المعتمدة: «المكتبة السينمائية المعتنية»
التعريف المختصر:

البطاقة تُظهر البوستر والبيانات الأساسية معاً عند الراحة. عند التفاعل: الإجراءات تظهر فوق البوستر دون إخفائه. شارة واحدة كحد أقصى. صف بيانات واحد تحت البوستر.

① البنية العلوية (Poster Zone)
┌──────────────────────────┐
│                          │
│                          │
│      [BOPOSTER]          │  aspect-ratio: 2/3
│      object-cover         │  border-radius: 12px
│                          │
│   ┌──────┐               │  شارة واحدة فقط (أعلى يسار RTL):
│   │ ★ 8.5│               │  bg-rating-star / text-rating-star-foreground
│   └──────┘               │  
│                          │
└──────────────────────────┘
القواعد:

لا تعتيم عند الراحة — البوستر كامل السطوع
لا gradient سفلي دائم (حذف from-overlay-scrim/50)
شارة واحدة فقط: تقييم (يسار RTL) أو جديد (يمين RTL) — لا二者 معاً
border-radius: 12px واحد للعلوي والجانبي (لا rounded-xl على البوستر + rounded-xl على الحاوية)
② صف البيانات (Metadata Row)
عنوان الفيلم الطويل · 2024 · 8.5 ★
───────────────────────────────────
14px semibold     12px medium  12px bold
text-foreground   text-muted-foreground/60  text-rating-star
القواعد:

سطر واحد مدمج، فاصل نقطي ·
العنوان: text-[14px] font-semibold text-foreground line-clamp-1
السنة + المدة/الموسم: text-[12px] text-muted-foreground/60
التقييم: text-[12px] font-bold text-rating-star (مع نجمة SVG صغيرة)
إذا لم يكن هناك تقييم → العنوان والبيانات تملأ المساحة
dir="auto" يكفي للـ RTL/LTR التلقائي
لا views في صف البيانات (معلومات ثانوية — تظهر في item-detail)
③ التفاعل عند التمرير (Hover)
Rest state:           Hover state:
┌──────────────┐     ┌──────────────┐
│              │     │           ▶  │  ← زر play يظهر (متحرك من الأسفل)
│   POSTER     │     │   POSTER     │  ← البوستر يبقى ظاهراً 100%
│   (full)     │     │   (full)     │
│              │     │              │
│  ┌──────┐    │     │  ┌──────┐    │
│  │ ★8.5 │    │     │  │ ★8.5 │    │
│  └──────┘    │     │  └──────┘    │
└──────────────┘     └──────────────┘
                     + shadow-hover
                     + border-ring/30
                     + translateY(-2px)
القواعد:

لا طبقة سوداء — البوستر يبقى ظاهراً دائماً
زر play/فتح: absolute bottom-3 left-1/2 -translate-x-1/2 مع opacity-0 → 100 و translateY(8px) → 0
الزر: bg-overlay-scrim/60 backdrop-blur-md text-overlay-chip (خلفية شفافة داكنة فوق البوستر)
البطاقة تتحرك للأعلى: group-hover:-translate-y-0.5
ظل خفيف: group-hover:shadow-hover
حد ذهبي خفيف: group-hover:border-ring/30
④ الشارات (Badges)
الحالة	الشارة	التوكن	الموضع
جديد	نبضة خضراء + «جديد»	bg-success/90 text-success-foreground	أعلى يمين RTL
تقييم	نجمة + رقم	bg-rating-star text-rating-star-foreground	أعلى يسار RTL
لا شيء	—	—	—
القواعد:

حد أقصى شارة واحدة — الأولوية: جديد > تقييم
إذا كان isNew = true → شارة جديد
وإلا إذا كان rating > 0 → شارة تقييم
وإلا → لا شارة
الشارات: px-2 py-0.5 text-[10px] font-semibold rounded-md backdrop-blur-sm shadow-sm
لا shadow-lg — ظل خفيف فقط
⑤ الفراغات والقياسات (Spacing & Sizing)
Card:
  max-w: 280px (mobile) / 320px (desktop)
  gap: 10px (poster → metadata)

Poster:
  aspect-ratio: 2/3
  border-radius: 12px

Metadata:
  padding: 0 2px
  height: ~38px (عنوان سطر + بيانات سطر)
  gap: 4px between lines

Badge:
  position: absolute inset-s-2 top-2
  z-index: 40
⑥ حالات خاصة
لا صورة (fallback):

┌──────────────────┐
│                  │
│    ▶ (icon)      │  bg-muted + border-dashed
│                  │
│  عنوان العنصر    │
└──────────────────┘
محدد (isSelected):

ring-2 ring-ring/50 + shadow-hover
بدون scale (ثابت الحجم)
صغير (slider):

same architecture, max-width smaller
metadata row قد يتقلص (screen < 640px)
⑦ المقارنة: الحالي vs المقترح
العنصر	الحالي (288 سطر)	المقترح
البوستر عند Hover	يختفي خلف 5 طبقات overlay	يبقى ظاهراً 100%
زر التشغيل	في منتصف البوستر (h-8/h-10)	في أسفل البوستر (أصغر، شفاف)
الشارات	现存2 (جديد أو نوع + تقييم)	1 فقط
صف البيانات	في طبقة Hover فقط	مرئي دائماً تحت البوستر
العنوان	13px تحت البطاقة فقط	14px + metadata في صف واحد
الYear	11px في أسفل يمين	12px في صف البيانات
المشاهدات	مرئية دائماً (Eye icon)	غير مرئية في البطاقة
Svelte count	~15 ألوان صلبة	كلها توكنز (موجودة بالفعل)
Shadow	shadow-card + shadow-hover + shadow-lg on badges	shadow-card + shadow-hover فقط
Scale	scale-[1.04] card + scale-110 image (مضاعف)	-translate-y-0.5 فقط
Transition	500ms card + 700ms image	300ms واحد
⑧ الخريطة المعمارية للملفات المتأثرة
الملف	التعديل المتوقع
unified-card.tsx	إعادة كتابة أنظف — حذف overlay tray الكامل، إضافة metadata row ثابت، تبسيط hover
globals.css	لا تغيير — التوكنز الحالية كافية (overlay-scrim + overlay-chip + rating-star + success)
section-card.tsx	لا تغيير — يخدم سياق آخر
unified-media.tsx	لا تغيير — يُمرر props فقط
item-detail-page.tsx	لا تغيير — صفحة تفاصيل مستقلة
⑨ معايير النجاح
المعيار	كيف نتحقق
البوستر ظاهر دائماً	لا opacity-0 على البوستر في أي حالة
لا ألوان صلبة	grep يُعيد صفر نتائج لـ bg-black / bg-white / text-white / from-black
RTL يعمل	البطاقة تبدو متماثلة (mirror) في RTL وLTR
Dark/Light يعمل	البوستر يتحدث في الوضعين — لا تعتيم زائد
Contrast pass	audit-dusk.mjs يُعيد ALL GATED PASSED
Build pass	npm run build ✓ Compiled
لاTSregression	Typecheck = خطأي baseline فقط
هذا هو الإطار المعماري الكامل. قبل الانتقال لأي تعديل: هل هذه الفلسفة والمعمارية تعكس ما تتخيله؟ أم هناك بند يريد تعديله أو إضافته؟