//src\providers\index.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/frontend/auth-context";
import { FavoritesProvider } from "@/lib/frontend/favorites-context";

/**
 * التحديدات الافتراضية لعميل React Query على مستوى التطبيق.
 *
 * الغرض: توفير سياسة جلب موحّدة (staleness/GC/retry) تمنع تكرار طلبات الشبكة
 * لنفس المفتاح داخل نافذة الزمن، مع بقاء الإعدادات الصريحة لكل Hook هي المسيطرة.
 *
 * المصدر: `docs/plans/cache-system-implementation-plan.md` — Phase 1.
 *
 * - `staleTime: 30s` — تعتبر البيانات حديثة 30 ثانية فلا يُعاد جلبها ضمن ذلك.
 * - `gcTime: 5m` — تُهمل الكاش غير المستخدم بعد 5 دقائق.
 * - `retry: 1` — محاولة واحدة فقط بعد الفشل (لتقليل الضغط على SQLite).
 * - `refetchOnWindowFocus: false` — لا إعادة جلب تلقائية عند العودة للنافذة
 *   (التحديثات الحية تدار صراحة عبر `refetchInterval`/SSE في hooks الأدمن).
 */
const QUERY_DEFAULTS = {
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
} as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: QUERY_DEFAULTS }));

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
      >
        <AuthProvider>
          <FavoritesProvider>
            {children}
            <Toaster
              position="top-left"
              richColors
              duration={5000}
              toastOptions={{
                classNames: {
                  toast: "font-sans",
                },
              }}
            />
          </FavoritesProvider>
        </AuthProvider>
    </NextThemesProvider>
    </QueryClientProvider>
  );
}
