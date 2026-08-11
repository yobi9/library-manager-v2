//src\features\viewer\components\home\favorites-slider.tsx
"use client";

import { useMemo } from "react";
import { useMediaBatch } from "@/lib/frontend/media-queries";
import { useFavoritesContext } from "@/lib/frontend/favorites-context";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import { Heart } from "lucide-react";
import type { MediaItem } from "@/lib/frontend/api-media";

export function FavoritesSlider() {
  const { favorites, loading } = useFavoritesContext();
  const { data: batchItems = [] } = useMediaBatch(favorites);

  const itemMap = useMemo(() => {
    const map = new Map<string | number, MediaItem>();
    for (const item of batchItems) {
      const id = item.media_id ?? item.id;
      if (id != null) map.set(id, item);
    }
    return map;
  }, [batchItems]);

  if (!loading && favorites.length === 0) return null;

  return (
    <UnifiedMedia
      mode="slider"
      title="المفضلة"
      icon={<Heart className="h-5 w-5 text-destructive" />}
      items={favorites.map((id) => itemMap.get(id)).filter(Boolean) as MediaItem[]}
      isLoading={loading}
      mapItemToProps={mapMediaToCard}
    />
  );
}
