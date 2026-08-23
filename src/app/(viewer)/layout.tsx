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
 * القرارات كلها في `ViewerAccessService` (قراءة `viewer_access_mode` +
 * `maintenance_mode`، التحقق من رمز الجلسة، وتتبع الزيارات)؛ هنا فقط جمع
 * الإدخالات من الكوكيز/الهيدرات والتصرف (عرض صيانة أو إعادة توجيه).
 *
 * @remarks `cookies()` تُستدعى هنا صراحةً لتفرض العرض الديناميكي لكل طلب حتى
 * تظهر تغييرات قاعدة البيانات فوراً دون إعادة بناء.
 */
export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headersList = await headers();

  const services = getServices();
  const decision = await services.viewerAccess.evaluateAccess({
    sessionToken: cookieStore.get("session_token")?.value,
    visitorSessionId:
      headersList.get("x-visitor-session-id") || cookieStore.get("visitor_session_id")?.value,
    ip:
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "127.0.0.1",
    userAgent: headersList.get("user-agent") || "",
  });

  if (decision.maintenanceMode && !decision.isAdmin) {
    return <MaintenanceScreen />;
  }

  if (decision.mode === "protected" && !decision.isAuthenticated) {
    const xUrl = headersList.get("x-url") || "/";
    redirect(`/login?callbackUrl=${encodeURIComponent(xUrl)}`);
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
