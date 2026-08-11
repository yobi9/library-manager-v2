"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/frontend/api-client";

/**
 * Normalized live channel as delivered by `GET /api/live-channels` — the
 * server-side proxy of the external live-stream system. All URLs are absolute
 * and ready to open in the browser.
 */
export interface LiveChannel {
  /** Channel id from the external system (used inside the player URL). */
  id: string | number;
  /** Channel display name (Arabic). */
  name: string;
  /** Absolute image URL, or null when the upstream has no image. */
  image: string | null;
  /** Player key understood by the external player page. */
  player: string;
  /** Raw source URL provided by the upstream (may be empty). */
  src: string;
  /** Absolute player page URL opened in a new tab. */
  url: string;
}

/** Polling interval (ms) so newly added channels appear without a reload. */
const CHANNELS_REFETCH_MS = 30_000;

/**
 * Fetches the live channel list from the server-side proxy and polls every 30
 * seconds, so channels added in the external live-stream system show up
 * automatically on the viewer page.
 *
 * @returns The React Query result exposing `data`, `isLoading`, `error`,
 *          `isFetching` and `refetch` (manual refresh).
 */
export function useLiveChannels() {
  return useQuery({
    queryKey: ["live", "channels"],
    queryFn: () => apiClient.get<LiveChannel[]>("/live-channels"),
    staleTime: CHANNELS_REFETCH_MS,
    refetchInterval: CHANNELS_REFETCH_MS,
  });
}
