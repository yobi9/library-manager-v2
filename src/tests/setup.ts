/**
 * تهيئة بيئة الاختبار قبل تحميل أي وحدة.
 *
 * `auth-service.ts` يقرأ `JWT_SECRET` وقت التحميل ويرمي FATAL عند غيابه،
 * و`getEnv()` في `@lib/config/env` يتحقق من صحة كل المتغيرات عند أول استدعاء —
 * لذلك نضبط قيماً معقولة افتراضية قابلة للتجاوز (أي متغير مضبوط مسبقاً في
 * بيئة التشغيل يبقى كما هو ولا يُستبدل).
 *
 * ملاحظة: `process.env.NODE_ENV` معرف كخاصية للقراءة فقط في `@types/node`،
 * لذلك نمرر عبر مرجع `Record<string, string | undefined>`.
 */
const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = env.NODE_ENV ?? "test";
env.JWT_SECRET = env.JWT_SECRET ?? "vitest-secret-0123456789abcdef";
env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000";
env.DATABASE_URL = env.DATABASE_URL ?? ":memory:";
