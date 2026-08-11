"use client";

import { useState } from "react";
import { getWatchLaterIds } from "@/lib/frontend/watch-later-storage";
import { useMediaBatch } from "@/lib/frontend/media-queries";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";
import { Spinner } from "@/shared/components/ui/spinner";
import { BookmarkX } from "lucide-react";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import type { MediaItem } from "@/lib/frontend/api-media";

export default function WatchLaterPage() {
  const [ids] = useState<number[]>(() => getWatchLaterIds());
  const { data: items = [], isLoading } = useMediaBatch(ids);

  return (
  //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
  <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "شاهد لاحقاً" }]} />
      <h1 className="text-2xl font-bold">شاهد لاحقاً</h1>

      {isLoading ? (
        <div className="flex items-center gap-2 py-20">
          <Spinner />
          <span className="text-muted-foreground">جاري التحميل...</span>
        </div>
      ) : items.length === 0 ? (
       // <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
       <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8  text-muted-foreground">
          <BookmarkX className="h-12 w-12" />
          <p>لا توجد عناصر محفوظة</p>
        </div>
      ) : (
        <UnifiedMedia mode="grid" items={items} isLoading={false} mapItemToProps={mapMediaToCard} />
      )}
    </div>
  );
}
