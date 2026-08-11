
ممتاز، هذا سؤال مهم جداً لأن src/features هي المكان الذي يتم فيه تنظيم الكود حسب الميزة الوظيفية (Feature-based folder structure)، وهو نمط شائع جداً في مشاريع Next.js الكبيرة.

التمييز هنا يعتمد على سياق الاستخدام (Context of Use). دعني أوضح لك التصنيف الدقيق وفقًا لأفضل الممارسات (Best Practices):

قاعدة "المسؤولية" (The Rule of Responsibility)
الهوكس في src/features/{feature}/hooks: توضع هنا الهوكس التي تخدم هذه الميزة فقط، ولا يمكن إعادة استخدامها في ميزة أخرى. (خاصة بالميزة).

الهوكس في src/shared/hooks: توضع هنا الهوكس العامة جداً التي لا تحتوي على أي منطق تجاري أو منطق خاص بالبيانات.

الهوكس في src/lib/frontend/hooks: توضع هنا الهوكس التي تخدم مجال التطبيق (Domain) ويتم استخدامها عبر ميزات متعددة (مثل كلاً من Viewer و Admin).

تطبيق عملي على الملفات التي حللناها
لنأخذ الهوكس الموجودة في src\features\viewer\hooks (بناءً على التحليل السابق):

الهوك	هل يُستخدم في Admin؟	مكانه الصحيح
useWatchProgress	لا، فقط المشغل (Player) للمشاهد.	✅ src/features/viewer/hooks
useLiveChannels	لا، فقط صفحة القنوات للمشاهد.	✅ src/features/viewer/hooks
useVisitorRequest	لا، طلبات الزوار خاصة بالمشاهد.	✅ src/features/viewer/hooks
useOpenFolder	نعم، يُستخدم في لوحة تحكم المسؤول (لاختيار مسار المجلد) و في صفحة تفاصيل المشاهد (لزر "فتح المجلد").	❌ خطأ إذا كان في viewer/hooks.
✅ يجب نقله إلى src/lib/frontend/hooks (أو src/shared/hooks إذا كان يعتمد فقط على fetch محلي ولا يحتاج لـ API).
ماذا عن src\features\admin\hooks؟
إذا كان لديك مجلد admin/hooks، فهذا صحيح تمامًا، ويُستخدم للهوكس التي تخدم لوحة التحكم فقط، مثل:

useAdminSettings

useLibraryScanner (للتحكم في مسح المكتبة)

useUserManagement

إذا حاولت استخدام هذه الهوكس في صفحة Viewer، فهذا خطأ في التصميم، ويجب إعادة النظر في هيكلية الميزات.

البنية النهائية المثالية بناءً على ذلك
إليك كيف يجب أن يكون التوزيع النهائي للمجلدات وفقًا لأفضل الممارسات:

text
src/
├── shared/
│   ├── hooks/             # الهوكس العامة جداً (لا تعتمد على التطبيق)
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useToggle.ts
│   │   └── useInfiniteScroll.ts
│   └── ...
│
├── lib/
│   └── frontend/
│       ├── hooks/         # هوك مشترك بين ميزات متعددة (مثل Viewer و Admin)
│       │   ├── useOpenFolder.ts       <-- (لأنه مشترك)
│       │   ├── useMediaFilters.ts     <-- (مشترك إذا استخدمه Admin أيضاً)
│       │   └── useApiBase.ts
│       ├── media-queries.ts           <-- (مشترك عبر الميزات)
│       └── ...
│
├── features/
│   ├── viewer/
│   │   ├── hooks/         # هوك مخصص للمشاهد فقط
│   │   │   ├── useWatchProgress.ts
│   │   │   ├── useLiveChannels.ts
│   │   │   └── useVisitorRequest.ts
│   │   ├── components/
│   │   └── pages/
│   │
│   └── admin/
│       ├── hooks/         # هوك مخصص للمسؤول فقط
│       │   ├── useAdminUsers.ts
│       │   └── useLibraryScanner.ts
│       └── ...
خلاصة القرار (القاعدة الذهبية)
ضع الهوك في features/feature/hooks إذا كان يقوم بشيء واحد يخص هذه الميزة فقط.

ضع الهوك في lib/frontend/hooks إذا كانت ميزتان مختلفتان (مثل المشاهد والمسؤول) تحتاجان إليه.

ضع الهوك في shared/hooks إذا لم يكن له أي علاقة بمجال التطبيق (مثل useDebounce).

توصيتي لك فوراً:
انقل هوك useOpenFolder من src/features/viewer/hooks إلى src/lib/frontend/hooks، لأنه مذكور في كود التعليقات الأصلي أنه يُستخدم أيضاً في نموذج اختيار المسار للمسؤول (Admin Library Form)، وهذا يجعله مشتركاً، ووضعه في viewer فقط هو خطأ معمارى. والباقي الذي في viewer/hooks مكانه صحيح تماماً.