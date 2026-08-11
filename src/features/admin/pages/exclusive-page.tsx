"use client";

import { ExclusiveManager } from "@/features/admin/components/exclusive/exclusive-manager";

/**
 * صفحة إدارة المحتوى الحصري في لوحة الأدمن.
 *
 * الغرض: تغليف `ExclusiveManager` كصفحة مستقلة على المسار `/admin/exclusive`.
 */
export function ExclusivePage() {
  return <ExclusiveManager />;
}
