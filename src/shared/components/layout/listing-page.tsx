"use client";

import { useEffect, useRef, useCallback } from "react";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { Spinner } from "@/shared/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import type { MediaItem } from "@/lib/frontend/api-media";
import type { UnifiedCardProps } from "@/features/viewer/components/unified-card/unified-card";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ListingPageProps {
  items: MediaItem[];
  total?: number;
  isLoading: boolean;
  error: Error | null;
  title: string;
  breadcrumbs: BreadcrumbItem[];
  renderItem?: (item: MediaItem) => React.ReactNode;
  mapItemToProps?: (item: MediaItem) => UnifiedCardProps;
  /** When provided, enables infinite scroll: loads the next page when the sentinel becomes visible. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function defaultMapItemToProps(item: MediaItem): UnifiedCardProps {
  return mapMediaToCard(item);
}

export function ListingPage({
  items,
  total,
  isLoading,
  error,
  title,
  breadcrumbs,
  mapItemToProps,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: ListingPageProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target?.isIntersecting && hasMore && !isLoadingMore) {
        onLoadMore?.();
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  );

  useEffect(() => {
    if (!onLoadMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver, onLoadMore]);

  if (isLoading) {
    return (
    //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex items-center gap-2">
          <Spinner />
          <span className="text-muted-foreground">جاري التحميل...</span>
        </div>
        <UnifiedMedia mode="grid" isLoading skeletonCount={12} />
      </div>
    );
  }

  if (error) {
    return (
    //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
  //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
  <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {total !== undefined && (
          <span className="text-sm text-muted-foreground">({total})</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          لا توجد نتائج
        </div>
      ) : (
        <UnifiedMedia
          mode="grid"
          items={items}
          mapItemToProps={mapItemToProps ?? defaultMapItemToProps}
        />
      )}

      {hasMore && onLoadMore && (
        <div ref={loadMoreRef} className="text-muted-foreground animate-pulse py-20 text-center">
          {isLoadingMore ? "جاري تحميل المزيد..." : "حمّل المزيد"}
        </div>
      )}
    </div>
  );
}
