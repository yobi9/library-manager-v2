

// في src/lib/frontend/media-helpers.ts

import type { MediaItem } from "./api-media";
import { ROUTES } from "@/shared/constants";
 



 
export function getImageUrl(
  id: string | number,
  type: "poster" | "backdrop" | "still" = "poster",
  options?: { width?: number; height?: number; season?: number; episode?: number },
): string {
  const params = new URLSearchParams();
  params.append("type", type);
  if (options?.width) params.append("w", String(options.width));
  if (options?.height) params.append("h", String(options.height));
  if (options?.season !== undefined) params.append("s", String(options.season));
  if (options?.episode !== undefined) params.append("e", String(options.episode));
  const query = params.toString();
  return `/api/images/${id}${query ? `?${query}` : ""}`;
}














export function getPosterUrl(id?: string | number | null): string | undefined {
  if (id === undefined || id === null) return undefined;
  return getImageUrl(id, "poster", { width: 300, height: 450 });
}

export function getBackdropUrl(id?: string | number | null): string | undefined {
  if (id === undefined || id === null) return undefined;
  return getImageUrl(id, "backdrop", { width: 1920, height: 1080 });
}

export function getEpisodeStillUrl(
  id?: string | number | null,
  options?: { season?: number; episode?: number },
): string | undefined {
  if (id === undefined || id === null) return undefined;
  return getImageUrl(id, "still", { width: 640, height: 360, ...options });
}

export function getLibraryImageUrl(libraryId: number | { library_id?: number; id?: number }): string {
  const id = typeof libraryId === "number" ? libraryId : (libraryId.library_id || libraryId.id || 0);
  return `/api/images/${id}?type=library`;
}



 