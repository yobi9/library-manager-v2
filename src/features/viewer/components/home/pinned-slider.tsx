//src\features\viewer\components\home\pinned-slider.tsx
"use client";

import { usePinnedItems } from "@/lib/frontend/media-queries";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import { Pin } from "lucide-react";

export function PinnedSlider() {
  const { data: items = [], isLoading } = usePinnedItems();

  return (
    <UnifiedMedia
      mode="slider"
      title="مثبت"
      icon={<Pin className="h-5 w-5  " />}
      items={items}
      isLoading={isLoading}
      mapItemToProps={mapMediaToCard}
    />
  );
}
