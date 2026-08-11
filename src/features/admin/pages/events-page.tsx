"use client";

/**
 * EventsPage – متابعة أحداث النظام والمستخدمين والأمان بأسلوب Monitoring Dark Minimalist.
 *
 * بنية الصفحة: ثلاثة صناديق مكدسة — "أحداث النظام" (شارات ملونة تعطي إشارة فورية
 * عن حالة الاستقرار) ثم "أحداث المستخدمين" (نص فضي هادئ للقراءة فقط) ثم
 * "أحداث الأمان" (محاولات دخول فاشلة + حظر/رفع حظر).
 *
 * الآلية:
 * - السجل المحفوظ يُجلب من `/api/admin/events/history` عبر React Query.
 * - أحداث الأمان تُجلب من `/api/admin/events/security` بترحيل مستقل.
 * - بث SSE يعيد الجلب فوراً عند وصول حدث جديد (دون خلط حمولات اللحظة مع السجل).
 * - زر "حذف كل الاحداث" يحذف الصفوف فعلياً من قاعدة البيانات.
 *
 * الألوان كلاسات دلالية فقط (`bg-card`, `border-border`, `text-muted-foreground`)
 * تُفرض قيمها داخل نطاق `.admin-layout` — لا تسريب للواجهة العامة.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, X } from "lucide-react";
import {
  useAdminEventsHistory,
  useDeleteAllEvents,
  type HistoryEvent,
} from "@/features/admin/hooks/use-admin-events-history";
import { useAdminEventsSSE } from "@/features/admin/hooks/use-admin-events-sse";
import {
  useAdminSecurityEvents,
  type AdminSecurityEvent,
} from "@/features/admin/hooks/use-admin-security-events";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/** تسمية عربية لكل إجراء مسجّل في جدول الأنشطة. */
const ACTION_LABELS: Record<string, string> = {
  db_backup: "إنشاء نسخة احتياطية من قاعدة البيانات",
  memory_alert: "تنبيه استخدام الذاكرة",
  metadata_update: "تحديث بيانات التعريف",
  media_updated: "تعديل عنصر وسائط",
  new_request: "طلب جديد",
  view_media: "مشاهدة عنصر",
  view_section: "تصفح قسم",
  user_login: "تسجيل دخول",
  logout: "تسجيل خروج",
  register: "إنشاء حساب جديد",
  user_created: "إنشاء حساب",
  create_user: "إنشاء مستخدم",
  update_user: "تعديل مستخدم",
  delete_user: "حذف مستخدم",
  update_avatar: "تحديث الصورة الرمزية",
  block_user: "حظر مستخدم",
  unblock_user: "رفع حظر مستخدم",
  grant_admin: "منح صلاحية إدارة",
  revoke_admin: "سحب صلاحية إدارة",
  db_optimize: "تحسين قاعدة البيانات",
  db_restore: "استعادة نسخة احتياطية",
  library_created: "إنشاء مكتبة",
  library_updated: "تعديل مكتبة",
  library_deleted: "حذف مكتبة",
  media_deleted: "حذف عنصر وسائط",
  media_pinned: "تثبيت عنصر",
  media_unpinned: "إلغاء تثبيت عنصر",
  scan_started: "بدء مسح مكتبة",
  scan_completed: "اكتمال مسح مكتبة",
  scan_failed: "فشل مسح مكتبة",
  scan_paused: "إيقاف مسح مؤقت",
  scan_resumed: "استئناف المسح",
  scan_stopped: "إيقاف المسح",
  news_created: "إنشاء خبر",
  news_updated: "تعديل خبر",
  news_deleted: "حذف خبر",
  ad_created: "إنشاء إعلان",
  ad_updated: "تعديل إعلان",
  ad_deleted: "حذف إعلان",
  product_created: "إنشاء منتج",
  product_updated: "تعديل منتج",
  product_deleted: "حذف منتج",
  message_sent: "إرسال رسالة",
  message_status_updated: "تحديث حالة رسالة",
  message_deleted: "حذف رسالة",
  license_activated: "تفعيل الترخيص",
  license_activation_failed: "فشل تفعيل الترخيص",
  license_deactivated: "إلغاء تفعيل الترخيص",
  report_resolved: "حل بلاغ",
  report_dismissed: "إهمال بلاغ",
  metadata_manual_edit: "تعديل بيانات يدوي",
  enrichment_approved: "اعتماد اقتراح إثراء",
  enrichment_approval_failed: "فشل اعتماد اقتراح إثراء",
  enrichment_rejected: "رفض اقتراح إثراء",
  translation_batch_completed: "اكتمال تشغيل ترجمة",
  translation_batch_cancelled: "إلغاء تشغيل ترجمة",
  request_replied: "الرد على طلب",
  request_deleted: "حذف طلب",
  requests_deleted: "حذف جميع الطلبات",
};

/** تسمية عربية لكل نوع حدث أمني مسجّل في جدول `security_events`. */
const SECURITY_LABELS: Record<string, string> = {
  login_success: "تسجيل دخول ناجح",
  login_failed: "محاولة تسجيل دخول فاشلة",
  user_blocked: "حظر مستخدم",
  user_unblocked: "رفع حظر مستخدم",
  password_changed: "تغيير كلمة المرور",
};

/** حالة عرض مستخلصة من شدة الحدث. */
type EventStatus = "success" | "error" | "warning" | "info";

/**
 * يستخرج الحالة العرضية من حقل `severity`.
 *
 * @param severity - قيمة الشدة الخام من جدول الأنشطة.
 * @returns الحالة المعيارية المعروضة في الواجهة.
 */
function resolveStatus(severity: string): EventStatus {
  const s = severity?.toLowerCase() ?? "";
  if (s === "critical" || s === "error" || s === "danger") return "error";
  if (s === "warning") return "warning";
  if (s === "success") return "success";
  return "info";
}

/**
 * ملخص عربي مقروء لحقل `details` (نص أو JSON مسلسل).
 *
 * @param details - القيمة الخام المخزنة في قاعدة البيانات.
 * @returns نص مختصر جاهز للعرض، أو سلسلة فارغة عند غيابه.
 */
function formatDetails(details: string | null | undefined): string {
  if (!details) return "";
  const trimmed = details.trim();
  if (!trimmed || trimmed === "{}") return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const parts: string[] = [];
      for (const key of [
        "message",
        "title",
        "itemTitle",
        "mediaTitle",
        "username",
        "size",
        "type",
        "usageMB",
      ]) {
        const value = record[key];
        if (typeof value === "string" || typeof value === "number") {
          parts.push(String(value));
        }
      }
      // `avatar` هو مسار URL كامل — نعرض اسم الملف فقط بدل JSON الخام.
      const avatarValue = record.avatar;
      if (typeof avatarValue === "string") {
        parts.push(avatarValue.split("/").pop() ?? avatarValue);
      }
      return parts.join(" · ") || trimmed;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * جملة عربية كاملة لحدث الإثراء (`metadata_update`): تدمج اسم العنصر مع النتيجة
 * ("تم تحديث بيانات العنصر X بنجاح" / "خطأ في تحديث بيانات العنصر X · السبب")
 * بدل التسمية العامة التي كانت تُظهر العنوان فقط أو لا شيء عند الفشل.
 *
 * @param details - القيمة الخام المخزنة (JSON: `{ mediaId, title, success, error }`).
 * @returns الجملة الجاهزة للعرض، أو سلسلة فارغة عند تعذّر الصياغة.
 */
function formatMetadataDetails(details: string | null | undefined): string {
  if (!details) return "";
  const trimmed = details.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return trimmed;
    const record = parsed as Record<string, unknown>;
    const title =
      typeof record.title === "string" && record.title.trim()
        ? record.title
        : typeof record.mediaId === "number"
          ? `#${record.mediaId}`
          : null;
    const target = title ? `العنصر ${title}` : "العنصر";
    if (record.success === true) return `تم تحديث بيانات ${target} بنجاح`;
    if (record.success === false) {
      const reason = typeof record.error === "string" && record.error.trim() ? record.error : null;
      return `خطأ في تحديث بيانات ${target}${reason ? ` · ${reason}` : ""}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * وقت نسبي عربي: "الآن" / "منذ X دقيقة" / "منذ X ساعة" / التاريخ.
 *
 * @param date - طابع زمني ISO من قاعدة البيانات.
 * @returns سلسلة الوقت النسبي الجاهزة للعرض.
 */
function getRelativeTime(date: string): string {
  // `activities` تُخزَّن بتوقيت ISO مع Z، بينما `security_events` تُخزَّن
  // بتوقيت SQLite بدون منطقة (datetime('now')) — نعامل الأخيرة كـ UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)
    ? `${date.replace(" ", "T")}Z`
    : date;
  const parsed = new Date(normalized).getTime();
  if (Number.isNaN(parsed)) return "";
  const diff = Date.now() - parsed;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return new Date(parsed).toLocaleDateString("ar-SA");
}

/** عنوان الإجراء النهائي مع سقوط على الاسم الخام. */
function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

/** فئات الشارات الملونة حسب الحالة (يغطي النص بالكامل بتباين عالٍ). */
const STATUS_CHIP_CLASSES: Record<EventStatus, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-700 text-white",
  warning: "bg-amber-600 text-white",
  info: "bg-muted text-foreground",
};

/** فئات الشارات الملونة لأحداث الأمان حسب نوع الحدث. */
const SECURITY_CHIP_CLASSES: Record<string, string> = {
  login_failed: "bg-amber-600 text-white",
  user_blocked: "bg-red-700 text-white",
  user_unblocked: "bg-emerald-600 text-white",
  password_changed: "bg-emerald-600 text-white",
};

/**
 * شارة الوقت الموحدة في كلا الصندوقين (أقصى اليمين في RTL).
 *
 * @param date - الطابع الزمني للحدث.
 * @param className - كلاسات إضافية (مثل `ms-auto` لدفع الشارة لنهاية الصف).
 */
function TimeChip({ date, className }: { date: string; className?: string }) {
  return (
    <span className={cn("text-muted-foreground shrink-0 text-xs", className)}>
      {getRelativeTime(date)}
    </span>
  );
}

/** صف حدث نظام: شارة ملونة compact على اليمين + شارة الوقت على اليسار. */
function SystemEventRow({ event }: { event: HistoryEvent }) {
  const status = resolveStatus(event.severity);
  const details = formatDetails(event.details);
  const isEnrichment = event.action === "metadata_update";
  const enrichmentText = isEnrichment ? formatMetadataDetails(event.details) : "";
  const label = enrichmentText || getActionLabel(event.action);
  const showSuffix = !isEnrichment && details;

  return (
    <div className="hover:bg-muted/30 flex items-center gap-1 px-3 py-1 transition-colors">
      <span
        className={cn(
          "shrink-0 rounded px-2 py-1 text-xs font-medium",
          STATUS_CHIP_CLASSES[status],
          isEnrichment ? "max-w-[85%] whitespace-normal" : "max-w-[70%] truncate",
        )}
      >
        {label}
        {showSuffix && (
          <span className="ms-2 font-normal opacity-90">
            <span className="opacity-60">·</span> {details}
          </span>
        )}
      </span>
      <TimeChip date={event.created_at} className="ms-auto" />
    </div>
  );
}

/** صف حدث مستخدم: نص فضي هادئ للقراءة فقط على اليمين + شارة الوقت على اليسار. */
function UserEventRow({ event }: { event: HistoryEvent }) {
  const details = formatDetails(event.details);
  const actor = event.user_name && event.user_name !== "زائر" ? event.user_name : "زائر";

  return (
    <div className="hover:bg-muted/30 flex items-center justify-between gap-1 px-3 py-1 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-xs">
          <span className="font-medium">{actor}</span>
          <span className="text-muted-foreground mx-1">·</span>
          <span className="text-muted-foreground">{getActionLabel(event.action)}</span>
        </p>
        {details && <p className="text-muted-foreground/70 mt-0.5 truncate text-xs">{details}</p>}
      </div>
      <TimeChip date={event.created_at} />
    </div>
  );
}

/**
 * ملخص عربي مقروء لحقل `details` الخاص بأحداث الأمان (نص JSON مسلسل).
 *
 * @param details - القيمة الخام المخزنة في `security_events.details`.
 * @returns نص مقروء، أو سلسلة فارغة عند غيابه.
 */
function formatSecurityDetails(details: string | null): string {
  if (!details) return "";
  const trimmed = details.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const reason = record.reason;
      if (reason === "user_not_found") return "المستخدم غير موجود";
      if (reason === "invalid_password") return "كلمة المرور خاطئة";
      if (reason === "account_locked") return "الحساب مقفل";
      if (typeof record.username === "string") return `محاولة باسم: ${record.username}`;
      if (record.targetUserId != null) return `المستهدف: #${String(record.targetUserId)}`;
      // `login_success` التاريخية كانت تخزّن `session_id` فقط — لا فائدة من
      // عرضها (التسمية "تسجيل دخول ناجح" كافية).
      if (Object.keys(record).length === 1 && record.session_id != null) return "";
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * صف حدث أمني: شارة ملوّنة حسب النوع + اسم المستخدم المسبّب + شارة الوقت.
 *
 * @param event - حدث أمني من `useAdminSecurityEvents`.
 */
function SecurityEventRow({ event }: { event: AdminSecurityEvent }) {
  const chipClass = SECURITY_CHIP_CLASSES[event.event_type] ?? "bg-muted text-foreground";
  const details = formatSecurityDetails(event.details);
  const actor = event.username ?? "مستخدم محذوف";

  return (
    <div className="hover:bg-muted/30 flex items-center gap-1 px-3 py-1 transition-colors">
      <span
        className={cn(
          "max-w-[70%] shrink-0 truncate rounded px-2 py-1 text-xs font-medium",
          chipClass,
        )}
      >
        {SECURITY_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " ")}
        {details && (
          <span className="ms-2 font-normal opacity-90">
            <span className="opacity-60">·</span> {details}
          </span>
        )}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">{actor}</span>
      <TimeChip date={event.created_at} className="ms-auto" />
    </div>
  );
}

/** صفوف هيكلية أثناء تحميل صندوق الأحداث. */
function EventsBoxSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-muted/40 h-12 animate-pulse rounded-md" />
      ))}
    </div>
  );
}

/** رسالة الفراغ الموحّدة داخل الصناديق. */
function EventsBoxEmpty({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex items-center justify-center p-8 text-center text-sm">
      {message}
    </div>
  );
}

/**
 * EventsPage – متابعة أحداث النظام والمستخدمين والأمان (ثلاثة صناديق، سجل محفوظ + تحديث لحظي).
 */

/** أحداث SSE التي تولّد صفاً مُخزَّناً فعلياً في جدول `activities` — فقط عندها يُعاد جلب السجل. */
const PERSISTED_SSE_EVENTS = new Set([
  "user_view",
  "visitor_view",
  "media_updated",
  "media_deleted",
  "metadata_completed",
  "system_alert",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_paused",
  "scan_resumed",
  "scan_stopped",
]);

export function EventsPage() {
  const [isEnabled, setIsEnabled] = useState(true);
  const { data: sse, connected, clear } = useAdminEventsSSE({ enabled: isEnabled });
  const {
    data: historyData,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminEventsHistory(50, { pollingInterval: connected ? false : 15_000 });
  const {
    data: securityData,
    isLoading: securityLoading,
    fetchNextPage: fetchNextSecurityPage,
    hasNextPage: hasMoreSecurity,
    isFetchingNextPage: isFetchingSecurityPage,
  } = useAdminSecurityEvents(50, { pollingInterval: connected ? false : 15_000 });
  const deleteAll = useDeleteAllEvents();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // عند وصول حدث لحظي مُخزَّن فعلاً: إعادة جلب السجل بعد debounce قصير
  // (بدل refetch عند كل حدث SSE بما فيها غير المُخزَّنة زي enrichment_progress).
  const persistedLiveCount = (sse ?? []).filter((e) => PERSISTED_SSE_EVENTS.has(e.action)).length;
  useEffect(() => {
    if (persistedLiveCount === 0) return;
    const timer = setTimeout(() => void refetch(), 500);
    return () => clearTimeout(timer);
  }, [persistedLiveCount, refetch]);

  const handleRefresh = () => {
    setIsEnabled(false);
    void refetch();
    setTimeout(() => setIsEnabled(true), 100);
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll.mutateAsync();
      clear();
      toast.success("تم حذف جميع الأحداث");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حذف الأحداث");
    } finally {
      setConfirmOpen(false);
    }
  };

  const pages = historyData?.pages ?? [];
  const systemEvents = pages.flatMap((p) => p.system);
  const userEvents = pages.flatMap((p) => p.user);
  const systemTotal = pages[0]?.totals.system ?? 0;
  const userTotal = pages[0]?.totals.user ?? 0;
  const hasMore = hasNextPage;
  const securityEvents = securityData?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <div className="space-y-6">
      {/* العنوان والوصف فقط — خارج الحاوية، على اليمين */}
      <div>
        <h1 className="text-foreground text-xl font-bold sm:text-2xl md:text-3xl">
          متابعة احداث النظام
        </h1>
        <p className="text-muted-foreground text-sm">تتابع جميع احداث النظام..</p>
      </div>

      {/* الحاوية البارزة: الأزرار + الصندوقان الغارقان */}
      <div className="admin-raised space-y-5 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                connected ? "bg-emerald-500" : "bg-red-500",
              )}
              aria-hidden
            />
            <span className="text-muted-foreground text-xs">
              {connected ? "متصل بالتحديث اللحظي" : "غير متصل"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRefresh}
              disabled={isFetchingNextPage}
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={systemTotal + userTotal === 0 || deleteAll.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <X className="h-4 w-4" />
              حذف كل الاحداث
            </Button>
          </div>
        </div>

        {/* بانر الخطأ عند فشل جلب السجل */}
        {isError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">
              {error instanceof Error ? error.message : "فشل تحميل الأحداث"}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* صندوق أحداث النظام */}
        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-bold">احداث النظام</h2>
          <div className="admin-sunken admin-scroll max-h-105 overflow-y-auto rounded-xl border">
            {isLoading ? (
              <EventsBoxSkeleton />
            ) : systemEvents.length === 0 ? (
              <EventsBoxEmpty message="لا توجد أحداث نظام بعد" />
            ) : (
              systemEvents.map((event) => <SystemEventRow key={event.id} event={event} />)
            )}
          </div>
        </section>

        {/* صندوق أحداث المستخدمين */}
        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-bold">احداث المستخدمين</h2>
          <div className="admin-sunken admin-scroll max-h-80 overflow-y-auto rounded-xl border">
            {isLoading ? (
              <EventsBoxSkeleton />
            ) : userEvents.length === 0 ? (
              <EventsBoxEmpty message="لا توجد أحداث مستخدمين بعد" />
            ) : (
              userEvents.map((event) => <UserEventRow key={event.id} event={event} />)
            )}
          </div>
        </section>

        {/* صندوق أحداث الأمان */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-bold">احداث الامان</h2>
            {hasMoreSecurity && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchNextSecurityPage()}
                disabled={isFetchingSecurityPage}
              >
                {isFetchingSecurityPage ? "جاري التحميل..." : "عرض المزيد"}
              </Button>
            )}
          </div>
          <div className="admin-sunken admin-scroll max-h-80 overflow-y-auto rounded-xl border">
            {securityLoading ? (
              <EventsBoxSkeleton />
            ) : securityEvents.length === 0 ? (
              <EventsBoxEmpty message="لا توجد أحداث أمان بعد" />
            ) : (
              securityEvents.map((event) => <SecurityEventRow key={event.event_id} event={event} />)
            )}
          </div>
        </section>

        {/* تحميل المزيد */}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "جاري التحميل..." : "عرض المزيد"}
            </Button>
          </div>
        )}
      </div>

      {/* حوار تأكيد الحذف */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تأكيد حذف جميع الأحداث"
        description="هل أنت متأكد من حذف جميع الأحداث المحفوظة نهائياً؟ هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel="نعم، احذف الكل"
        cancelLabel="إلغاء"
        variant="destructive"
        onConfirm={handleDeleteAll}
        loading={deleteAll.isPending}
      />
    </div>
  );
}
