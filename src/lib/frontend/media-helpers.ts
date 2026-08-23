import type { MediaItem } from "./api-media";
import type { UnifiedCardProps } from "@/features/viewer/components/unified-card/unified-card";
import { ROUTES } from "@/shared/constants";
import { isAudioType } from "@/features/viewer/components/audio-player/types";

// ============= HELPER FUNCTIONS =============
// Matches old project's mediaHelpers.ts

/**
 * Clean title by removing year suffix like "(2023)" or "2023"
 * Matches old project's cleanTitle
 */
export function cleanTitle(title?: string): string {
  if (!title) return "";
  const cleaned = title.replace(/\s?\(?\d{4}\)?$/g, "").trim();
  return cleaned === "" ? title : cleaned;
}

/**
 * Check if item was created within last N days
 * Matches old project's isItemNew
 */
export function isItemNew(createdAt?: string, daysThreshold = 7): boolean {
  if (!createdAt) return false;
  const diffDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 3600 * 24);
  return diffDays >= 0 && diffDays <= daysThreshold;
}

/**
 * يبني مسار العرض الصحيح للعنصر حسب نوعه:
 * - `library` → صفحة المكتبة (`/items/{id}`).
 * - `album` → صفحة مشغّل الألبوم (`/itemView/singer/{id}`).
 * - `song` → صفحة التشغيل الفردي (`/player/{id}`).
 * - بقية الأنواع الصوتية (`music`/`singer`/` `) وأنواع الفيديو → `/itemView/{type}/{id}`.
 *
 * @param item - كائن الوسائط مع معرّف اختياري (`media_id`/`id`) ونوع اختياري (`type`).
 * @returns مسار جاهز للاستخدام في روابط البطاقات والصفحات.
 */
export function buildMediaUrl(item: {
  media_id?: number;
  id?: number | string;
  type?: string;
}): string {
  const id = item.media_id ?? item.id;
  const type = item.type || "movie";
  if (type === "library") return `${ROUTES.ITEMS}/${id}`;

  if (isAudioType(type)) {
    if (type === "album") return ROUTES.ALBUM_PLAYER(String(id));
    if (type === "song") return ROUTES.PLAYER(String(id));
    return ROUTES.ITEM_VIEW(type, String(id));
  }

  return ROUTES.ITEM_VIEW(type, String(id));
}

/**
 * Extract genres from various formats
 * Matches old project's extractGenres
 * Handles: string, JSON string, array of strings, array of objects
 */
// export function extractGenres(item: { genres?: unknown }): string[] {
//   if (!item.genres) return [];

//   const genresArray = typeof item.genres === "string" ? JSON.parse(item.genres) : item.genres;

//   if (!Array.isArray(genresArray)) return [];

//   return genresArray
//     .map((genre: unknown) =>
//       typeof genre === "string" ? genre : (genre as { name?: string }).name || "",
//     )
//     .filter(Boolean);
// }
export function extractGenres(item: { genres?: unknown }): string[] {
  if (!item.genres) return [];

  let genresArray: unknown;

  if (typeof item.genres === "string") {
    try {
      genresArray = JSON.parse(item.genres);
    } catch {
      // ليس JSON — نفصل النص مباشرة على الفاصلة
      return item.genres
        .split(/[,،]/)
        .map((g) => g.trim())
        .filter(Boolean);
    }
  } else {
    genresArray = item.genres;
  }

  if (!Array.isArray(genresArray)) return [];

  return genresArray
    .flatMap((genre: unknown) => {
      const text =
        typeof genre === "string"
          ? genre
          : (genre as { name?: string }).name || "";
      // كل عنصر ممكن يحتوي على فاصلة — نفصله أيضاً
      return text.split(/[,،]/).map((g) => g.trim()).filter(Boolean);
    })
    .filter(Boolean);
}

/**
 * Extract year from various date fields
 * Matches old project's adapter extractYear
 */
export function extractYear(item: MediaItem): number | undefined {
  if (item.year != null) return Number(item.year);
  const dateFields = ["release_date", "first_air_date", "releaseDate"] as const;
  for (const dateField of dateFields) {
    const val = item[dateField as keyof MediaItem];
    if (typeof val === "string" || typeof val === "number") {
      const y = new Date(val).getFullYear();
      if (!isNaN(y)) return y;
    }
  }
  return undefined;
}

/**
 * Format rating as string (e.g., "7.5" or "N/A")
 * Matches old project's formatRating
 */
export function formatRating(rating?: number | string | null): string {
  if (rating === undefined || rating === null || rating === 0 || rating === "0") return "N/A";
  return Number(rating).toFixed(1);
}

/**
 * Format certification label
 * Matches old project's formatCertificationLabel
 */
export function formatCertificationLabel(cert?: string): string {
  if (!cert) return "";
  const LABELS: Record<string, string> = {
    G: "لجميع الأعمار",
    PG: "إشراف أبوي",
    "PG-13": "+13",
    R: "للكبار فقط",
    "NC-17": "+17",
  };
  return LABELS[cert] || cert;
}

// ============= ADAPTER FUNCTIONS =============
// Matches old project's media-card.adapter.ts

/**
 * Map MediaItem (API DTO) to UnifiedCardProps (card view model)
 * Matches old project's mapMediaToCard
 */
export function mapMediaToCard(apiItem: MediaItem, layout?: "grid" | "slider"): UnifiedCardProps {
  const id = apiItem.media_id ?? apiItem.id ?? 0;
  const numId = Number(id);
  const title = cleanTitle(apiItem.display_title || apiItem.title || apiItem.name);
  const posterUrl = isNaN(numId) ? undefined : `/api/images/${numId}?type=poster&w=300&h=450`;

  return {
    id: String(id),
    title,
    imageUrl: posterUrl,
    year: extractYear(apiItem),
    rating: apiItem.imdb_rating ?? apiItem.rating,
    genres: extractGenres(apiItem),
    isNew: isItemNew(apiItem.created_at ?? apiItem.createdAt),
    votes: Number(apiItem.imdb_votes ?? apiItem.voteCount ?? 0) || undefined,  // ← أضف هذا
    href: buildMediaUrl(apiItem),
    mediaType: apiItem.type || "movie",
    mediaId: id,
    views: apiItem.views ?? 0,
    certification:
      apiItem.certification || apiItem.age_rating || apiItem.content_rating || undefined,
    duration: apiItem.duration ?? apiItem.runtime,
  };
}

/**
 * Map MediaItem to MediaItem detail props
 * Matches old project's mapMediaToDetail
 */
export function mapMediaToDetail(apiItem: MediaItem) {
  const id = apiItem.media_id ?? apiItem.id ?? 0;
  const numId = Number(id);
  const title = cleanTitle(apiItem.display_title || apiItem.title || apiItem.name);
  const posterUrl = isNaN(numId) ? undefined : `/api/images/${numId}?type=poster&w=300&h=450`;
  const backdropUrl = isNaN(numId) ? undefined : `/api/images/${numId}?type=backdrop&w=1920&h=1080`;

  return {
    id: String(id),
    mediaId: numId,
    title,
    type: apiItem.type || "movie",
    year: extractYear(apiItem),
    rating: apiItem.rating ?? (apiItem.imdb_rating ? Number(apiItem.imdb_rating) : undefined),
    views: apiItem.views,
    genres: extractGenres(apiItem),
    overview: apiItem.overview,
    backdropUrl,
    posterUrl,
    cast: (apiItem.cast || []).map((c) => ({
      character: c.character || "",
      person_id: c.person_id ?? "",
      name: c.display_name || c.name || "",
      profile_path: c.profile_path,
    })),
    directors: (apiItem.directors || [])
      .map((d: unknown) =>
        typeof d === "string"
          ? d
          : d != null && typeof d === "object" && "name" in d
            ? String((d as { name: unknown }).name)
            : "",
      )
      .filter(Boolean),
    writers: (apiItem.writers || [])
      .map((w: unknown) =>
        typeof w === "string"
          ? w
          : w != null && typeof w === "object" && "name" in w
            ? String((w as { name: unknown }).name)
            : "",
      )
      .filter(Boolean),
    certification: apiItem.certification || apiItem.age_rating || apiItem.content_rating || "",
    isSeries: (apiItem.type?.startsWith("series") ?? false) || apiItem.type === "series" || false,
    seasonsCount: apiItem.seasons_count ?? apiItem.seasonsCount ?? 0,
    episodesCount: (apiItem.episodes_count ?? apiItem.episodesCount ?? 0) as number,
    libraryId: apiItem.library_id ?? apiItem.libraryId ?? 0,
    href: buildMediaUrl(apiItem),
  };
}
