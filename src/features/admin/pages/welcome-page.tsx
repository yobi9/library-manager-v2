"use client";

import { useAuth } from "@/lib/frontend/auth-context";
import Link from "next/link";

/**
 * صفحة الترحيب في لوحة الإدارة — ترحّب بالمستخدم واسمه وروابط سريعة
 * (لوحة القيادة، الإعدادات، الشروط).
 */
export function WelcomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">مرحبًا بك {user?.username}</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          هذه هي صفحة الترحيب الخاصة بلوحة التحكم. استخدم القائمة الجانبية للتنقل.
        </p>
      </div>

      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/admin/dashboard"
          className="bg-card hover:bg-accent/50 block rounded-lg border p-6 transition-colors"
        >
          <h3 className="text-xl font-semibold">لوحة القيادة</h3>
          <p className="text-muted-foreground mt-1 text-sm">عرض الإحصائيات والتقارير</p>
        </Link>

        <Link
          href="/admin/settings"
          className="bg-card hover:bg-accent/50 block rounded-lg border p-6 transition-colors"
        >
          <h3 className="text-xl font-semibold">الإعدادات</h3>
          <p className="text-muted-foreground mt-1 text-sm">تعديل إعدادات الموقع</p>
        </Link>
      </div>
    </div>
  );
}
