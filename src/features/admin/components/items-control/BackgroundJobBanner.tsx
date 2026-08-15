"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCw } from "lucide-react";
import type { AdminRealtimeSession } from "@/features/admin/hooks/use-admin-realtime";
import { cn } from "@/lib/utils";

interface BackgroundJobBannerProps {
  /** جلسة الخلفية الحالية (null يخفي الشريط). */
  session: AdminRealtimeSession | null;
  /** تسمية نوع الجلسة (مثل "الإثراء" أو "الترجمة"). */
  label: string;
}

const COMPLETED_VISIBLE_MS = 4000;

/**
 * شريط تقدّم عائم لجلسات الخلفية (الإثراء/الترجمة).
 * يعرض نسبة الإنجاز وعدد النجاح/الفشل أثناء النشاط، ثم يظهر ملخصاً
 * أخضر/أحمر لمدة 4 ثوانٍ بعد الاكتمال قبل الاختفاء تلقائياً.
 *
 * @param session - حالة الجلسة اللحظية من useAdminRealtimeEvents.
 * @param label - تسمية النوع (الإثراء/الترجمة).
 */
export function BackgroundJobBanner({ session, label }: BackgroundJobBannerProps) {
  /** مفتاح آخر ملخص (sessionId+status) تم إخفاؤه، لإعادة إظهار الملخص لكل جلسة جديدة. */
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const sessionKey = session ? `${session.sessionId}-${session.status}` : null;
  const showSummary = session !== null && session.status !== "active" && sessionKey !== dismissedKey;

  useEffect(() => {
    if (!showSummary || !sessionKey) return;
    const timer = setTimeout(() => setDismissedKey(sessionKey), COMPLETED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showSummary, sessionKey]);

  if (!session) {
    return null;
  }

  if (session.status === "active") {
    const percentage = Math.min(100, Math.max(0, session.percentage));
    return (
      <div
        className="fixed bottom-6 left-1/2 z-40 w-80 max-w-[95vw] -translate-x-1/2 rounded-2xl border border-border bg-background p-3 shadow-lg"
        role="status"
        aria-live="polite"
      >
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
            {label} جارٍ...
          </span>
          <span className="font-bold text-muted-foreground">{percentage}%</span>
        </div>
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {session.processed} / {session.total || session.processed} عنصر —
          نجح {session.successful} / فشل {session.failed}
        </p>
      </div>
    );
  }

  if (!showSummary) {
    return null;
  }

  const isError = session.status === "failed";
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border px-4 py-2 text-sm shadow-lg",
        isError
          ? "border-destructive/40 bg-destructive text-destructive-foreground"
          : "border-border bg-background text-foreground",
      )}
      role="status"
    >
      {isError ? (
        <XCircle className="h-4 w-4 shrink-0" />
      ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" />
      )}
      <span className="font-bold">{label}:</span>
      <span>
        {isError
          ? "فشلت الجلسة"
          : `اكتملت (نجح ${session.successful} / فشل ${session.failed})`}
      </span>
    </div>
  );
}
