"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/frontend/auth-context";
import { usePublicSettings } from "@/lib/frontend/media-queries";
import { APP_NAME } from "@/shared/constants";

/**
 * صفحة تسجيل الدخول — نموذج اسم مستخدم/كلمة مرور مع التحقق عبر `useAuth`
 * واسم الموقع من الإعدادات أو `APP_NAME`.
 */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { data: settings } = usePublicSettings();

  const title = String(settings?.site_title ?? APP_NAME);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">تسجيل الدخول إلى لوحة التحكم</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-border bg-card space-y-4 rounded-lg border p-6"
        >
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
          )}

          <div>
            <label htmlFor="login-username" className="mb-1 block text-sm font-medium">
              اسم المستخدم
            </label>
            <input
              id="login-username"
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
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
              كلمة المرور
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              dir="rtl"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 transition-colors disabled:opacity-50"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
