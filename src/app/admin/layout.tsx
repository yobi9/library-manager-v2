// src/app/admin/layout.tsx
"use client";

import { AdminHeader } from "@/shared/components/layout/admin-header";
import { AdminSidebar } from "@/shared/components/layout/admin-sidebar";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

/**
 * [Domain] سياق حالة السايد بار للوحة الإدارة.
 *
 * - الغرض: إدارة حالة فتح/إغلاق السايد بار على الشاشات الصغيرة (Mobile Drawer).
 * - السبب: السايد بار يجب أن يكون مخفياً تلقائياً على الموبايل ويُفتح عبر Hamburger.
 * - النطاق: `AdminLayout` + `AdminSidebar` + `AdminHeader` فقط.
 */
interface SidebarContextType {
  /** هل السايد بار مفتوح على الموبايل */
  isMobileOpen: boolean;
  /** فتح السايد بار على الموبايل */
  openMobile: () => void;
  /** إغلاق السايد بار على الموبايل */
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

/**
 * Hook للوصول لحالة السايد بار.
 * يجب استخدامه داخل `AdminLayout` فقط.
 */
export const useAdminSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useAdminSidebar يجب استخدامه داخل AdminLayout");
  return ctx;
};

// ─── Theme System (معزول عن الثيم العام) ─────────────────────────
const AdminThemeContext = createContext<{
  theme: string;
  setTheme: (theme: string) => void;
} | null>(null);

export const useAdminTheme = () => {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error("useAdminTheme يجب استخدامه داخل AdminLayout");
  return ctx;
};

/**
 * [Domain] مصدر ثيم الإدارة الخارجي (localStorage) في نطاق الوحدة.
 *
 * - الغرض: عزل ثيم لوحة الإدارة تماماً عن الثيم العام للزوار — يقرأ ويكتب فقط
 *   مفتاح `admin_dashboard_theme` داخل متصفح كل مدير، ولا يمس أي مستخدم آخر
 *   أو إعدادات عامة (متطلب عزل ثيم العميل عن الخادم).
 * - السبب: `useSyncExternalStore` هو النمط المعياري لقراءة تخزين خارجي على
 *   mount بدون `useEffect`/setState، ويمنع تباين الترطيب (SSR): تُستخدم
 *   لقطة الخادم الافتراضية أثناء التوليد، ثم تُقرأ قيمة المتصفح بعد الترطيب.
 * - النطاق: ثيم الإدارة فقط داخل `AdminLayout`/`useAdminTheme`.
 */
const ADMIN_THEME_KEY = "admin_dashboard_theme";
const ADMIN_THEME_DEFAULT = "dark";
const adminThemeListeners = new Set<() => void>();

/**
 * [Domain] سكربت مدمج مبكر يمنع وميض الثيم الداكن في الوضع الفاتح.
 *
 * - الغرض: الخادم يعرض ثيم الإدارة الافتراضي الداكن دائماً (لا يقرأ
 *   `localStorage` — متطلب عزل تفضيل الثيم عن الخادم)، فيُصدَّر أول
 *   طلاء داكن قبل أن يقرأ المتصفح القيمة الحقيقية بعد الترطيب. هذا
 *   السكربت المدمج المتزامن يُنفَّذ أثناء تحليل الـ HTML وقبل أول
 *   طلاء (Pre-Paint) فيطبّق `admin-layout` و`data-theme` على `<body>`
 *   من `localStorage` مباشرة — بنفس أسلوب anti-flash الخاص بـ next-themes.
 * - السبب: السكربت المدمج (Inline) يعمل كحاجز متزامن يمنع المتصفح من
 *   الرسم حتى يُنفَّذ، فلا يظهر الوميض أصلاً لا بعد ترطيب React.
 * - النطاق: جلسة لوحة الإدارة فقط؛ لا يقرأ أو يكتب أي مفتاح آخر.
 * - ملاحظة: نصّه يُبنى من ثابتَي `ADMIN_THEME_KEY` و`ADMIN_THEME_DEFAULT`
 *   للحفاظ على مصدر الحقيقة الواحد (SSOT).
 */
export const ADMIN_THEME_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(ADMIN_THEME_KEY)});
    var theme = stored === "light" || stored === "dark" ? stored : ${JSON.stringify(ADMIN_THEME_DEFAULT)};
    var body = document.body;
    if (body) {
      body.classList.add("admin-layout");
      body.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();`;

function subscribeAdminTheme(listener: () => void): () => void {
  adminThemeListeners.add(listener);
  return () => {
    adminThemeListeners.delete(listener);
  };
}

function getAdminThemeSnapshot(): string {
  return localStorage.getItem(ADMIN_THEME_KEY) ?? ADMIN_THEME_DEFAULT;
}

function getAdminThemeServerSnapshot(): string {
  return ADMIN_THEME_DEFAULT;
}

function notifyAdminThemeChange(): void {
  for (const listener of adminThemeListeners) listener();
}

/**
 * [Component] تخطيط لوحة الإدارة (Layout).
 *
 * - الغرض: تجميع ثيم الإدارة المعزول، السايد بار، الهيدر، وحالة الموبايل
 *   في سياق واحد لكل صفحات `/admin`.
 * - السلوك: يقرأ/يكتب ثيم الإدارة في `localStorage` حصرياً (معزول عن الثيم
 *   العام)، ويمنع وميض الثيم عبر سكربت مبكر يطبّق الثيم على `<body>` قبل
 *   أول طلاء، ثم يزامنه على التنقل العميل وعند تبديل الثيم عبر
 *   `useLayoutEffect` (يعمل قبل الرسم).
 * - النطاق: `src/app/admin/**` فقط.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // ─── Theme State ───────────────────────────────────────────────
  const theme = useSyncExternalStore(
    subscribeAdminTheme,
    getAdminThemeSnapshot,
    getAdminThemeServerSnapshot,
  );
 

  const updateTheme = useCallback((newTheme: string) => {
    localStorage.setItem(ADMIN_THEME_KEY, newTheme);
    notifyAdminThemeChange();
  }, []);

  // ─── Sidebar Mobile State ─────────────────────────────────────
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // مزامنة ثيم الإدارة على `<body>` حتى ترث كل العناصر المُعرضة عبر
  // بوابات (Portal) — النوافذ المنبثقة، قوائم الاختيار، ومختار الملفات —
  // نفس توكينات الثيم الإداري بدل توكينات ثيم الزوار العام (الذي قد يختلف).
  // - التحميل الكامل (Full Load): سكربت `ADMIN_THEME_SCRIPT` سبق أن طبّق
  //   `admin-layout` و`data-theme` على `<body>` قبل أول طلاء، وتأثير
  //   الترطيب الأول يمرّر `theme` = لقطة الخادم (`dark`) افتراضياً؛ لذا
  //   يتخطى هذا التأثير أول تشغيل إذا وُجد `admin-layout` على `<body>`
  //   حتى لا يلغي قيمة السكربت ثم يعيد الرسم داكن (مصدر الوميض).
  // - التنقل العميل (SPA) وتبديل الثيم: `useLayoutEffect` يعيد التطبيق قبل
  //   الرسم فيبقى `<body>` متزامناً دون أي وميض بين إطارين.
  const themeMountedRef = useRef(false);
  useLayoutEffect(() => {
    if (!themeMountedRef.current && document.body.classList.contains("admin-layout")) {
      themeMountedRef.current = true;
      return;
    }
    themeMountedRef.current = true;
    const body = document.body;
    body.classList.add("admin-layout");
    body.dataset.theme = theme;
  }, [theme]);

  // تنظيف مستقل (أثناء ترحيل الحالة فقط): إزالة سمات الإدارة من `<body>`
  // عند مغادرة `/admin` بالتنقل العميل حتى لا تتسرب توكينات الإدارة إلى
  // صفحات الزوار. فصل التنظيف عن التأثير أعلاه يضمن عدم حذفها مؤقتاً عند
  // تبديل الثيم (الذي كان يتسبب في وميض إضافي).
  useEffect(() => {
    return () => {
      const body = document.body;
      body.classList.remove("admin-layout");
      delete body.dataset.theme;
    };
  }, []);

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  // إغلاق السايد بار عند التحول من الموبايل إلى الديسكتوب
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setIsMobileOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // إغلاق السايد بار عند الضغط على Escape
  useEffect(() => {
    if (!isMobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobileOpen]);

  // منع التمرير عند فتح السايد بار على الموبايل
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <AdminThemeContext.Provider value={{ theme, setTheme: updateTheme }}>
      <SidebarContext.Provider value={{ isMobileOpen, openMobile, closeMobile }}>
        {/* الغلاف لا يحمل data-theme الآن — الثيم يُدار على `<body>` بواسطة
            سكربت ما قبل الطلاء والتأثير أعلاه، وCSS يستهدفهما مباشرة. */}
        <div className="admin-layout bg-background text-foreground flex min-h-screen">
          {/* Overlay للسايد بار على الموبايل */}
          {isMobileOpen && (
            <div
              className="bg-black/50 fixed inset-0 z-40 lg:hidden"
              onClick={closeMobile}
              onKeyDown={(e) => e.key === "Escape" && closeMobile()}
              role="button"
              tabIndex={-1}
              aria-label="إغلاق القائمة"
            />
          )}

          <AdminSidebar />

          <div className="flex flex-1 flex-col            ">
            <AdminHeader />
            <main className="container mx-auto flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
              
              {children}
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </AdminThemeContext.Provider>
  );
}
