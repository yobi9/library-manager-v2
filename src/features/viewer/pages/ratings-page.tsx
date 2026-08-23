"use client";

import Link from "next/link";
import { AlertCircle, Star } from "lucide-react";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";
import { useRatingBuckets } from "@/lib/frontend/media-queries";

export default function RatingsPage() {
  const { data: buckets = [], isLoading, error } = useRatingBuckets();

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
      <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "التقييم" }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">اختر التقييم</h1>
        {!isLoading && <span className="text-muted-foreground text-sm">({buckets.length})</span>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">فشل تحميل التقييمات</p>
        </div>
      ) : buckets.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">لا توجد تقييمات</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {buckets.map((bucket) => (
            <Link
              key={bucket.value}
              href={ROUTES.RATING_ITEMS(bucket.value) as import("next").Route}
              className="group border-border bg-card/60 shadow-card hover:border-primary/40 hover:bg-card hover:shadow-hover flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-300"
            >
              <Star className="text-rating-star h-6 w-6" />
              <span className="text-lg font-bold">{bucket.value}+</span>
              <span className="text-muted-foreground text-xs">{bucket.count} عنصر</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
