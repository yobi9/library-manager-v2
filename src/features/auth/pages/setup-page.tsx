"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/shared/constants";

/**
 * صفحة التهيئة الأولى — إنشاء حساب المدير الأول على تثبيت نظيف (users فارغ).
 *
 * - السلوك: عند الاكتمال المسبق (initialized=true) تعيد التوجيه فوراً إلى
 *   /login ولا تعرض النموذج؛ لا تُربط من أي تنقل دائم حتى لا تبدو بديلاً لتسجيل
 *   الدخول. بعد النجاح ينتقل المستخدم إلى /login لتسجيل الدخول بالآلية القائمة.
 */
export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "done">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // جلب الحالة لحظياً: نظام مهيأ ⇒ لا نموذج إطلاقاً.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data: { data?: { initialized?: boolean } }) => {
        if (cancelled) return;
        if (data?.data?.initialized) {
          router.replace("/login");
          return;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setError("تعذر التحقق من حالة الإعداد");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  /**
   * يرسل طلب إنشاء أول مدير ويعالج الاستجابة.
   *
   * @param e - حدث إرسال النموذج.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "فشل إنشاء الحساب");
        return;
      }
      setStatus("done");
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">جارٍ التحقق من حالة النظام…</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="border-border bg-card w-full max-w-md space-y-4 rounded-lg border p-6 text-center">
          <h1 className="text-2xl font-bold">تم إنشاء حساب المدير الأول</h1>
          <p className="text-muted-foreground">
            يمكنك الآن تسجيل الدخول باسم المستخدم وكلمة المرور التي أنشأتهما.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-full rounded-md px-4 py-2 transition-colors"
          >
            الانتقال إلى تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{APP_NAME}</h1>
          <p className="text-muted-foreground">إعداد النظام — إنشاء حساب المدير الأول</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-border bg-card space-y-4 rounded-lg border p-6"
        >
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="setup-username" className="mb-1 block text-sm font-medium">
              اسم المستخدم
            </label>
            <input
              id="setup-username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              dir="rtl"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="setup-display-name" className="mb-1 block text-sm font-medium">
              اسم العرض (اختياري)
            </label>
            <input
              id="setup-display-name"
              name="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              dir="rtl"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="setup-password" className="mb-1 block text-sm font-medium">
              كلمة المرور
            </label>
            <input
              id="setup-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              dir="rtl"
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="setup-confirm-password" className="mb-1 block text-sm font-medium">
              تأكيد كلمة المرور
            </label>
            <input
              id="setup-confirm-password"
              name="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              dir="rtl"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-full rounded-md px-4 py-2 transition-colors"
          >
            {submitting ? "جارٍ الإنشاء…" : "إنشاء حساب المدير"}
          </button>
        </form>
      </div>
    </div>
  );
}
