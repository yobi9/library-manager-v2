//src\features\viewer\pages\library-items-page.tsx
"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  useLibraryItems,
  useLibraryInfo,
  useLibrariesMap,
  useBreadcrumbs,
} from "@/lib/frontend/media-queries";
import { LibraryFilters } from "@/shared/components/layout/library-filters";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { ROUTES } from "@/shared/constants";
import { Film, AlertCircle } from "lucide-react";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";

const SORT_OPTIONS = [
  { value: "recent", label: "تاريخ الإضافة" },
  { value: "year", label: "سنة الإنتاج" },
  { value: "rating", label: "التقييم" },
  { value: "alpha", label: "الأبجدية" },
];

/**
 * صفحة قائمة أيتمات مكتبة معيّنة: عرض النتائج مع بحث وفلترة (تصنيف/سنة/شهادة) وفرز وترقيم صفحات.
 *
 * @returns صفحة المكتبة كاملة.
 */
export default function LibraryItemsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const numericId = id ? Number(id) : undefined;
  const isValidId = numericId !== undefined && !isNaN(numericId);

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    genre: "all",
    year: "all",
    certification: "all",
    sortBy: "recent",
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchTerm }));
    }, 600);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const {
    data: libraryInfo,
    isLoading: isInfoLoading,
    error: libraryError,
  } = useLibraryInfo(numericId!);
  const { map: libraryMap } = useLibrariesMap();
  const breadcrumbItems = useBreadcrumbs(numericId!, libraryMap);

  const {
    allItems,
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErrorDetail,
  } = useLibraryItems(numericId, filters, {
    initialLimit: 24,
    subsequentLimit: 12,
  });

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
    return [
      { value: "all", label: "الكل" },
      ...years.map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, []);

  const genreOptions = useMemo(() => {
    const genres = libraryInfo?.genres ?? [];
    return [{ value: "all", label: "الكل" }, ...genres.map((g) => ({ value: g, label: g }))];
  }, [libraryInfo?.genres]);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">معرف المكتبة غير صالح</p>
        </div>
      </div>
    );
  }

  if (isInfoLoading || itemsLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex items-center justify-center py-4">
          <Spinner size="lg" label="جاري تحميل المكتبة..." labelPosition="bottom" />
        </div>
        <UnifiedMedia mode="grid" isLoading skeletonCount={12} />
      </div>
    );
  }

  if (libraryError && !libraryInfo) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">فشل تحميل معلومات المكتبة</p>
          <Button variant="default" onClick={() => router.refresh()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (itemsError && allItems.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">
            فشل تحميل العناصر: {itemsErrorDetail?.message ?? "خطأ غير معروف"}
          </p>
          <Button variant="default" onClick={() => router.refresh()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const libraryName = libraryInfo?.details?.name ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
      <Breadcrumbs
        items={[{ label: "الأقسام", href: ROUTES.SECTIONS }, ...breadcrumbItems.slice(1)]}
      />

      <LibraryFilters
        yearOptions={yearOptions}
        genreOptions={genreOptions}
        sortOptions={SORT_OPTIONS}
        filters={filters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onFilterChange={(newFields) => setFilters((prev) => ({ ...prev, ...newFields }))}
      />

      {libraryName && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{libraryName}</h1>
            <Film className="text-primary h-6 w-6" />
          </div>
          {totalCount !== undefined && (
            <span className="text-muted-foreground text-sm">({totalCount})</span>
          )}
        </div>
      )}

      {allItems.length === 0 && !itemsLoading && !isFetchingNextPage ? (
        <div className="text-muted-foreground py-20 text-center">لا توجد نتائج</div>
      ) : (
        <UnifiedMedia mode="grid" items={allItems} mapItemToProps={mapMediaToCard} />
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="text-muted-foreground animate-pulse py-20 text-center">
          {isFetchingNextPage ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              جاري تحميل المزيد...
            </span>
          ) : (
            "حمّل المزيد"
          )}
        </div>
      )}
    </div>
  );
}
