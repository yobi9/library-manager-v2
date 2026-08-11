import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * إعداد Vitest للمشروع.
 *
 * - النطاق: اختبارات الوحدات فقط حاليًا (بيئة node) في `src/tests/**`؛
 *   اختبارات الواجهة (jsdom) واختبارات التكامل تُضاف لاحقًا عند الحاجة.
 * - aliases: تعكس `paths` في `tsconfig.json` حتى تعمل الاستيرادات
 *   المطلقة (`@/`, `@backend/`, ...) داخل الاختبارات دون تغيير.
 * - setupFiles: `src/tests/setup.ts` يهيئ متغيرات البيئة المطلوبة وقت
 *   تحميل الوحدات (مثل `JWT_SECRET` الذي يرمي `auth-service` عند غيابه).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["./src/tests/setup.ts"],
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@backend": path.resolve(process.cwd(), "src", "backend"),
      "@lib": path.resolve(process.cwd(), "src", "lib"),
      "@features": path.resolve(process.cwd(), "src", "features"),
      "@shared": path.resolve(process.cwd(), "src", "shared"),
      "@tests": path.resolve(process.cwd(), "src", "tests"),
    },
  },
});
