"use client";

import { useMemo } from "react";
import { useMediaById } from "@/lib/frontend/media-queries";
import type { MediaItem } from "@/lib/frontend/api-media";

export function useSeasonEpisodes(seasonId: number | null) {
  const {
    data: seasonData,
    isLoading,
    isError,
  } = useMediaById(seasonId ? String(seasonId) : undefined);

  const episodes = useMemo(
    () =>
      (seasonData as MediaItem & { children?: MediaItem[] })?.children?.filter(
        (c: MediaItem) => c.type === "episode",
      ) ?? [],
    [seasonData],
  );

  const seasonTitle = (seasonData as MediaItem & { title?: string })?.title ?? "";

  return { data: episodes, seasonTitle, isLoading, isError };
}
