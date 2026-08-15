//src\app\(viewer)\layout.tsx
import { getServices } from "@/backend/services";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ViewerHeader } from "@/shared/components/layout/viewer-header";
import { ViewerFooter } from "@/shared/components/layout/viewer-footer";
import { MaintenanceScreen } from "@/shared/components/layout/maintenance-screen";

/**
 * تخطيط الواجهة العامة — يطبّق سياسات الحماية المركزية (protected + maintenance).
 *
 * - `viewer_access_mode === "protected"` → يفرض تسجيل الدخول على الزوار.
 * - `maintenance_mode === true` → يغلق الواجهة العامة أمام غير المدراء فقط.
 *
 * @remarks كلا القرارين يُقرآن من قاعدة البيانات في كل طلب (ديناميكي عبر `cookies()`).
 */
export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  const services = getServices();
  const settings = await services.settings.getAllSettings();
  const mode = settings["viewer_access_mode"] as string | undefined;
  const maintenanceMode = settings["maintenance_mode"] === true;

  const cookieStore = await cookies();
  const headersList = await headers();
  const token = cookieStore.get("session_token")?.value;

  const payload = token ? services.auth.verifyToken(token) : null;
  const isAdmin = payload?.["is_admin"] === true;

  if (maintenanceMode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  if (mode === "protected" && !payload) {
    const xUrl = headersList.get("x-url") || "/";
    redirect(`/login?callbackUrl=${encodeURIComponent(xUrl)}`);
  }

  // Read the visitor session id from the forwarded header (covers the FIRST
  // visit, since the cookie only exists from the next request onward), falling
  // back to the cookie.
  const visitorSessionId =
    headersList.get("x-visitor-session-id") || cookieStore.get("visitor_session_id")?.value;
  if (visitorSessionId && !isAdmin) {
    // التتبع غير حرج (Best-Effort): أي فشل في تسجيل الزيارة (تعارض مؤقت مع
    // كاتب الماسح أو غيرها) يجب ألا يُسقط الصفحة العامة — نلتقط الخطأ ونسجّله
    // فقط ونكمل عرض الصفحة.
    try {
      await services.visitor.trackView({
        sessionId: visitorSessionId,
        ip:
          headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          headersList.get("x-real-ip") ||
          "127.0.0.1",
        userAgent: headersList.get("user-agent") || "",
      });
    } catch (error) {
      console.error(
        "[ViewerLayout] Visitor tracking failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        تخطي إلى المحتوى
      </a>
      <ViewerHeader />
      <main id="main-content" className="flex-1 pt-20">
        {children}
      </main>
      <ViewerFooter />
    </div>
  );
}
