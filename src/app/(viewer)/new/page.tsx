"use client";

import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";
import { useLatestMedia } from "@/lib/frontend/media-queries";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import { AlertCircle } from "lucide-react";
import { Spinner } from "@/shared/components/ui/spinner";

/**
 * صفحة "جديد" – تعرض أحدث المحتويات المضافة إلى النظام.
 * تستخدم `useLatestMedia` لجلب العناصر مرتبة حسب تاريخ الإضافة (تنازلياً).
 *
 * @returns صفحة تعرض شبكة من أحدث العناصر.
 */
export default function NewPage() {
  const { data: items = [], isLoading, error } = useLatestMedia();

  // حالة التحميل
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs
          items={[
            { label: "الرئيسية", href: ROUTES.HOME },
            { label: "جديد" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Spinner />
          <span className="text-muted-foreground">جاري تحميل أحدث المحتويات...</span>
        </div>
        <UnifiedMedia mode="grid" isLoading skeletonCount={12} />
      </div>
    );
  }

  // حالة الخطأ
  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs
          items={[
            { label: "الرئيسية", href: ROUTES.HOME },
            { label: "جديد" },
          ]}
        />
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">فشل تحميل أحدث المحتويات</p>
        </div>
      </div>
    );
  }

  // حالة عدم وجود عناصر
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs
          items={[
            { label: "الرئيسية", href: ROUTES.HOME },
            { label: "جديد" },
          ]}
        />
        <h1 className="text-2xl font-bold">جديد</h1>
        <div className="text-muted-foreground py-20 text-center">
          لا توجد محتويات جديدة حالياً.
        </div>
      </div>
    );
  }

  // عرض العناصر
  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: ROUTES.HOME },
          { label: "جديد" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">أحدث المحتويات</h1>
        <span className="text-sm text-muted-foreground">({items.length})</span>
      </div>

      <UnifiedMedia
        mode="grid"
        items={items}
        mapItemToProps={mapMediaToCard}
      />
    </div>
  );
}