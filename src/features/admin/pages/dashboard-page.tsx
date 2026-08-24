/**
 * @file dashboard-page.tsx
 * @description لوحة قيادة الإدارة — تطابق السلوك القديم: إحصائيات حيّة، رسم بياني،
 * تفصيل الأجهزة، وجداول الأكثر/الأقل نشاطًا.
 */

"use client";

import React from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Users,
  Eye,
  Activity,
  Computer,
  Smartphone,
  Laptop,
  Apple,
  Tablet,
  RefreshCw,
  Ghost,
} from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  useAdminLive,
  useAdminDailyViews,
  useAdminWatchStats,
  useAdminOldUnwatched,
  type AdminLiveData,
  type DeviceBreakdown,
  type AdminWatchStats,
  type WatchedItemRow,
  type WatchedLibraryRow,
  type OldUnwatchedItem,
} from "@/features/admin/hooks/use-admin-dashboard";

/**
 * الرسم البياني يُحمَّل ديناميكيًا بـ `ssr: false` لأنه يعتمد على canvas في المتصفح.
 */
const DailyViewsChart = dynamic(
  () =>
    import("@/features/admin/components/dashboard/daily-views-chart").then(
      (m) => m.DailyViewsChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-50 w-full" />,
  },
);

/** قيم الأجهزة الافتراضية عند عدم توفر بيانات حيّة. */
const EMPTY_DEVICES: DeviceBreakdown = {
  windows: 0,
  samsung: 0,
  huawei: 0,
  android: 0,
  apple: 0,
  smart_tv: 0,
  other: 0,
};

/**
 * صورة مصغّرة تخدمها خدمة الصور ذات الأولوية (enriched ← مسار أساسي ← الأب).
 * تُخفى تلقائيًا عند غياب الصورة على القرص.
 */
function ThumbImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-12 w-8 shrink-0 rounded-sm object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/**
 * صف داخل جدولي الأقسام (أكثر/أقل الأقسام نشاطًا) مع صورة المكتبة.
 *
 * @param lib - صف القسم المراد عرضه.
 * @param views - عدد المشاهدات للقسم.
 */
function renderLibraryRow(lib: WatchedLibraryRow, views: number) {
  return (
    <div
      key={lib.id}
      className="hover:bg-bg-hover flex items-center justify-between gap-3 border-b border-border px-3 py-2 transition-colors last:border-0"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ThumbImage src={`/api/images/${lib.id}?type=library`} alt={lib.title} />
        <span className="text-foreground truncate text-sm">{lib.title}</span>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {views?.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * صف داخل جدولي العناصر (أكثر/أقل العناصر مشاهدة) مع بوستر مصغّر.
 *
 * @param item - صف العنصر المراد عرضه.
 * @param views - عدد المشاهدات للعنصر.
 */
function renderItemRow(item: WatchedItemRow, views: number) {
  return (
    <div
      key={item.id}
      className="hover:bg-bg-hover flex items-center justify-between gap-3 border-b border-border px-3 py-2 transition-colors last:border-0"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ThumbImage src={`/api/images/${item.id}?type=poster&w=40&h=60`} alt={item.title} />
        <span className="text-foreground truncate text-sm">{item.title}</span>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {views?.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * صف داخل جدول العناصر القديمة غير المشاهدة.
 * يعرض بوستر مصغّر مع العنوان وتاريخ الإضافة بدل عدد المشاهدات (صفر دائمًا).
 *
 * @param item - صف العنصر القديم غير المشاهدة.
 */
function renderOldUnwatchedRow(item: OldUnwatchedItem) {
  const date = item.added_date ? new Date(item.added_date).toLocaleDateString("ar") : "—";
  return (
    <div
      key={item.id}
      className="hover:bg-bg-hover flex items-center justify-between gap-3 border-b border-border px-3 py-2 transition-colors last:border-0"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ThumbImage src={`/api/images/${item.id}?type=poster&w=40&h=60`} alt={item.title} />
        <span className="text-foreground truncate text-sm">{item.title}</span>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">{date}</span>
    </div>
  );
}

/**
 * مكوّن لوحة القيادة الرئيسية.
 * يعرض الرأس مع شارة الاتصال، الرسم البياني، الإحصائيات الحيّة، تفصيل الأجهزة،
 * الجداول التفصيلية، والنشاطات الأخيرة.
 *
 * @returns واجهة لوحة القيادة.
 */
export function DashboardPage(): React.ReactNode {
  const live = useAdminLive();
  const dailyViews = useAdminDailyViews(7);
  const watchStats = useAdminWatchStats();
  const oldUnwatched = useAdminOldUnwatched(30, 10);

  const hasError = live.isError || dailyViews.isError || watchStats.isError || oldUnwatched.isError;
  const handleRetry = () => {
    void live.refetch();
    void dailyViews.refetch();
    void watchStats.refetch();
    void oldUnwatched.refetch();
  };

  const liveData: AdminLiveData | undefined = live.data;
  const devices: DeviceBreakdown = liveData?.deviceBreakdown ?? EMPTY_DEVICES;
  const storageTB = Number(liveData?.storageGB ?? "0") / 1024;

  const topStats = [
    {
      title: "تم بثها عبر Youbi",
      value: `${storageTB.toFixed(2)} TB`,
      icon: <Download size={18} />,
    },
    {
      title: "عدد المتواجدين الآن",
      value: (liveData?.onlineVisitors ?? 0).toLocaleString(),
      icon: <Users size={18} />,
    },
    {
      title: "إجمالي المشاهدات",
      value: (liveData?.totalViews ?? 0).toLocaleString(),
      icon: <Eye size={18} />,
    },
  ];

  const deviceStats = [
    { label: "ويندوز", value: devices.windows, icon: <Computer size={18} /> },
    { label: "شاشات ذكية", value: devices.smart_tv, icon: <Activity size={18} /> },
    { label: "سامسونج", value: devices.samsung, icon: <Smartphone size={18} /> },
    { label: "اندرويد", value: devices.android, icon: <Laptop size={18} /> },
    { label: "ابل", value: devices.apple, icon: <Apple size={18} /> },
    { label: "هواوي", value: devices.huawei, icon: <Tablet size={18} /> },
  ];

  const watch: AdminWatchStats = watchStats.data ?? {
    mostLibraries: [],
    leastLibraries: [],
    mostItems: [],
    leastItems: [],
  };

  return (
    <div className="space-y-10 pb-10" dir="rtl">
      {/* الرأس + شارة حالة الاتصال */}
      <header className="border-accent flex items-start justify-between gap-4 border-r-4 pr-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-accent text-xl tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">
            القيادة <span className="text-accent">لوحةُ</span>
          </h1>
          <p className="text-secondary-foreground text-sm font-medium">
            متابعة أداء النظام وإحصائيات الشبكة الحية
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            live.isError
              ? "border-border text-secondary-foreground"
              : "border-accent/30 bg-accent/5 text-accent"
          }
        >
          {live.isError ? "تحديث دوري" : "متصل مباشر"}
        </Badge>
      </header>

      {/* بانر الخطأ + إعادة المحاولة */}
      {hasError && (
        <div className="border-destructive/30 bg-destructive/10 flex items-center justify-between rounded-lg border p-3">
          <span className="text-destructive text-sm">تعذر تحميل بعض البيانات</span>
          <button
            type="button"
            onClick={handleRetry}
            className="bg-destructive text-destructive-foreground flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-opacity hover:opacity-90"
          >
            <RefreshCw size={14} />
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* الرسم البياني اليومي */}
      <Card className="border-border bg-card shadow-card">
        <CardContent className="p-4">
          <p className="text-secondary-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
            <span className="bg-accent inline-block h-3 w-3 rounded-sm" />
            نقل البيانات اليومي
          </p>
          <div className="h-50">
            {dailyViews.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <DailyViewsChart data={dailyViews.data ?? []} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات الحيّة الثلاث */}
      <div className="grid gap-6 sm:grid-cols-3">
        {live.isLoading
          ? topStats.map((_, i) => (
              <div
                key={i}
                className="border-border bg-card shadow-card relative rounded-lg border p-4 text-center"
              >
                <Skeleton className="mx-auto mb-2 h-4 w-16" />
                <Skeleton className="mx-auto h-3 w-24" />
              </div>
            ))
          : topStats.map((stat, i) => (
              <div
                key={i}
                className="border-border bg-card shadow-card relative rounded-lg border p-4 text-center"
              >
                <div className="text-muted-foreground absolute top-2.5 right-5">{stat.icon}</div>
                <p className="text-foreground mb-0.5 text-lg font-bold sm:text-xl md:text-2xl">
                  {stat.value}
                </p>
                <p className="text-secondary-foreground text-sm">{stat.title}</p>
              </div>
            ))}
      </div>

      {/* تفصيل الأجهزة */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {live.isLoading
          ? deviceStats.map((_, i) => (
              <div
                key={i}
                className="border-border bg-card flex items-center gap-2 rounded-lg border p-2.5"
              >
                <Skeleton className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-2 w-14" />
                </div>
              </div>
            ))
          : deviceStats.map((d, i) => (
              <div
                key={i}
                className="border-border bg-card flex items-center gap-2 rounded-lg border p-2.5"
              >
                <div className="text-muted-foreground">{d.icon}</div>
                <div>
                  <p className="text-foreground text-base font-bold">{d.value}</p>
                  <p className="text-secondary-foreground text-xs">{d.label}</p>
                </div>
              </div>
            ))}
      </div>

      {/* الجداول التفصيلية */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {watchStats.isLoading || oldUnwatched.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary border-b p-3">
                <Skeleton className="h-3 w-28" />
              </div>
              {Array.from({ length: 4 }).map((__, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0"
                >
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ))
        ) : (
          <>
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary text-foreground border-b p-3 font-bold">
                أكثر الأقسام نشاطاً
              </div>
              {watch.mostLibraries.map((lib) => renderLibraryRow(lib, lib.views))}
            </div>
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary text-foreground border-b p-3 font-bold">
                أقل الأقسام نشاطاً
              </div>
              {watch.leastLibraries.map((lib) => renderLibraryRow(lib, lib.views))}
            </div>
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary text-foreground border-b p-3 font-bold">
                أكثر العناصر مشاهدة
              </div>
              {watch.mostItems.map((item) => renderItemRow(item, item.views))}
            </div>
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary text-foreground border-b p-3 font-bold">
                أقل العناصر مشاهدة
              </div>
              {watch.leastItems.map((item) => renderItemRow(item, item.views))}
            </div>
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="border-border bg-secondary text-foreground flex items-center gap-2 border-b p-3 font-bold">
                <Ghost size={16} />
                عناصر قديمة لم يشاهدها أحد
              </div>
              {oldUnwatched.data?.length ? (
                oldUnwatched.data.map((item) => renderOldUnwatchedRow(item))
              ) : (
                <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                  لا توجد عناصر قديمة غير مشاهدة
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
