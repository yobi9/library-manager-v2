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
import { MediaCard } from "@/features/viewer/components/media-card/media-card";
import { MediaGrid } from "@/shared/components/ui/media-grid";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { Spinner } from "@/shared/components/ui/spinner";
import { ROUTES } from "@/shared/constants";
import { Film, AlertCircle } from "lucide-react";
import { extractGenres, isItemNew } from "@/lib/frontend/media-helpers";

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
  } = useLibraryItems(numericId, filters);

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
        <div className="flex items-center gap-2">
          <Spinner />
          <span className="text-muted-foreground">جاري تحميل المكتبة...</span>
        </div>
        <MediaGrid>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-muted aspect-2/3 animate-pulse rounded-lg" />
          ))}
        </MediaGrid>
      </div>
    );
  }

  if (libraryError && !libraryInfo) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">فشل تحميل معلومات المكتبة</p>
          <button
            onClick={() => router.refresh()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
          >
            إعادة المحاولة
          </button>
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
          <button
            onClick={() => router.refresh()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const libraryName = libraryInfo?.details?.name ?? "";

  return (
    //<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-4 py-6">
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
        <MediaGrid>
          {allItems.map((item) => (
            <MediaCard
              key={String(item.media_id ?? item.id)}
              id={String(item.media_id ?? item.id)}
              title={item.display_title ?? item.title ?? item.name ?? ""}
              type={item.type ?? ""}
              year={String(item.year ?? "")}
              rating={Number(item.rating ?? item.imdb_rating) || 0}
              certification={item.certification || item.age_rating || undefined}
              duration={item.duration ?? item.runtime ?? undefined}
              views={item.views ?? undefined}
              seasonsCount={item.seasons_count ?? item.seasonsCount ?? undefined}
              episodesCount={item.episodes_count ?? item.episodesCount ?? undefined}
              genres={extractGenres(item)}
              isNew={isItemNew(item.created_at ?? item.createdAt)}
            />
          ))}
        </MediaGrid>
      )}

      {hasNextPage && (
        <div ref={loadMoreRef} className="text-muted-foreground animate-pulse py-20 text-center">
          {isFetchingNextPage ? "جاري تحميل المزيد..." : "حمّل المزيد"}
        </div>
      )}
    </div>
  );
}
