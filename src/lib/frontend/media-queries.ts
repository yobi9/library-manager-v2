import { useQuery, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  MediaItem,
  Library,
  MediaFilterResponse,
  MediaFilterParams,
  GenreItem,
  Person,
  Channel,
} from "./api-media";
import {
  fetchMediaByFilter,
  fetchAvailableYears,
  fetchLibraries,
  fetchLibraryMedia,
  fetchLibraryInfo,
  fetchGenres,
  fetchCertifications,
  fetchRatingBuckets,
  fetchPinnedItems,
  fetchLatestMedia,
  fetchMediaTypes,
  fetchMediaById,
  fetchRecommendations,
  fetchAllPeople,
  fetchPerson,
  fetchPersonWorks,
  fetchMediaBatch,
  fetchPublicSettings,
  fetchChannels,
} from "./api-media";

export const mediaKeys = {
  all: ["media"] as const,
  filter: (params: Record<string, unknown>) => ["media", "filter", params] as const,
  years: (libraryId?: number) => ["media", "years", libraryId] as const,
  libraries: ["libraries"] as const,
  libraryMedia: (id: number, params: Record<string, unknown>) =>
    ["libraries", id, "media", params] as const,
  libraryInfo: (id: number) => ["libraries", id, "info"] as const,
};

export function useMediaByFilter(params: {
  year?: number;
  genre?: string;
  certification?: string;
  minRating?: number;
  rootOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: mediaKeys.filter(params as Record<string, unknown>),
    queryFn: () => fetchMediaByFilter(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Infinite-scroll variant of `useMediaByFilter`: appends extra pages of results
 * on demand via `fetchNextPage` (driven by an IntersectionObserver in the UI).
 * Page and limit are managed internally.
 *
 * @param params - Base filter params (`page`/`limit` are overridden internally).
 * @param limit - Items per page (default 30).
 * @returns Flattened `allItems`, `total`, pagination state, and `fetchNextPage`.
 */
export function useInfiniteMediaByFilter(
  params: Omit<MediaFilterParams, "page" | "limit">,
  limit = 30,
) {
  return useInfiniteQuery({
    queryKey: [...mediaKeys.filter(params as Record<string, unknown>), "infinite", limit],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchMediaByFilter({ ...params, page: pageParam, limit }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore === false) return undefined;
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return allPages.length + 1;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useMediaByYear(year: number, page = 1) {
  return useMediaByFilter({ year, page, limit: 30, rootOnly: true });
}

export function useMediaByGenre(genre: string, page = 1) {
  return useMediaByFilter({ genre, page, limit: 30, rootOnly: true });
}

export function useMediaByRating(rating: number, page = 1) {
  return useMediaByFilter({ minRating: rating, page, limit: 30, rootOnly: true });
}

export function useMediaByCertification(certification: string, page = 1) {
  return useMediaByFilter({ certification, page, limit: 30, rootOnly: true });
}

export function useAvailableYears(libraryId?: number) {
  return useQuery({
    queryKey: mediaKeys.years(libraryId),
    queryFn: () => fetchAvailableYears(libraryId),
    staleTime: 10 * 60 * 1000,
  });
}

export function useLibraries() {
  return useQuery({
    queryKey: mediaKeys.libraries,
    queryFn: fetchLibraries,
    staleTime: 10 * 60 * 1000,
  });
}

export function useLibraryInfo(libraryId: number) {
  return useQuery({
    queryKey: mediaKeys.libraryInfo(libraryId),
    queryFn: () => fetchLibraryInfo(libraryId),
    staleTime: 10 * 60 * 1000,
    enabled: !!libraryId,
  });
}

export function useLibraryItems(
  libraryId: number | undefined,
  filters: {
    search: string;
    genre: string;
    year: string;
    certification: string;
    sortBy: string;
  },
) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading, // ← مستخرج حديثاً
    isError, // ← مستخرج حديثاً
    error, // ← مستخرج حديثاً
  } = useInfiniteQuery({
    queryKey: mediaKeys.libraryMedia(libraryId ?? 0, filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await fetchLibraryMedia(libraryId!, {
        offset: pageParam,
        limit: 24,
        sortBy: filters.sortBy,
        sortOrder: filters.sortBy === "alpha" ? "ASC" : "DESC",
        rootOnly: "true",
        ...(filters.year !== "all" && { year: filters.year }),
        ...(filters.search && { search: filters.search }),
        ...(filters.genre !== "all" && { genre: filters.genre }),
        ...(filters.certification !== "all" && { certification: filters.certification }),
      });

      const media = result?.items ?? result?.media ?? result?.data ?? [];
      const total = result?.pagination?.total ?? result?.total ?? 0;
      const hasMore = result?.pagination?.hasMore ?? result?.hasMore ?? false;

      return { media, total, hasMore };
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) return undefined;
      return (lastPageParam as number) + lastPage.media.length;
    },
    enabled: !!libraryId,
    placeholderData: keepPreviousData, // ← إضافة لمنع فقدان البيانات
  });

  const allItems = data?.pages.flatMap((page) => page.media) ?? [];
  const totalCount = data?.pages?.[0]?.total;

  return {
    allItems,
    totalCount,
    hasNextPage,
    isFetchingNextPage,

    isLoading, // ← جديد
    isError, // ← جديد
    error, // ← جديد
    fetchNextPage,
  };
}

export function useLibrariesMap() {
  const { data: libraries = [], ...rest } = useLibraries();

  const map = new Map<number, Library>();
  for (const lib of libraries) {
    map.set(lib.library_id, lib);
  }

  return { libraries, map, ...rest };
}

export function useBreadcrumbs(libraryId: number, libraryMap: Map<number, Library>) {
  const defaultItems: { label: string; href?: string }[] = [
    { label: "الأقسام", href: "/sections" },
  ];

  if (!libraryId || !libraryMap.has(libraryId)) {
    return defaultItems;
  }

  const chain: { label: string; href?: string }[] = [];
  let currentId: number | null = libraryId;

  // 1. اصعد من الورقة إلى الجذر
  while (currentId) {
    const lib = libraryMap.get(currentId);
    if (!lib) break;
    chain.push({
      label: lib.name,
      href: lib.type === "main" ? `/sections/${lib.library_id}` : `/items/${lib.library_id}`,
    });
    currentId = (lib.parent_id ?? null) as number | null;
  }

  // 2. اعكس الترتيب: الجذر أولاً، ثم الفرع حتى الطفل
  chain.reverse();

  // 3. أضف "الأقسام" في البداية
  return [...defaultItems, ...chain];
}
export function useGenres() {
  return useQuery({
    queryKey: ["media", "genres", "all"],
    queryFn: fetchGenres,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCertifications() {
  return useQuery({
    queryKey: ["media", "certifications", "all"],
    queryFn: fetchCertifications,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRatingBuckets() {
  return useQuery({
    queryKey: ["media", "ratings", "all"],
    queryFn: fetchRatingBuckets,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePinnedItems() {
  return useQuery({
    queryKey: ["media", "pinned"],
    queryFn: fetchPinnedItems,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLatestMedia(type?: string) {
  return useQuery({
    queryKey: ["media", "latest", type ?? "all"],
    queryFn: () => fetchLatestMedia(type),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaTypes() {
  return useQuery({
    queryKey: ["media", "types"],
    queryFn: fetchMediaTypes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMediaById(id: string | number | undefined) {
  return useQuery({
    queryKey: ["media", "byId", id],
    queryFn: () => fetchMediaById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Response contract of `GET /api/media/:id/check` (MediaController.checkPlayable).
 * `file_path` is intentionally NOT exposed to the client.
 */
export interface VideoCheckResponse {
  playable: boolean;
  media_id?: number;
  file_size?: number;
  mime_type?: string;
  duration?: number | null;
  title?: string;
}

/**
 * Queries whether the media item has a playable video file and its stream metadata.
 * A valid "not playable" response resolves to `{ playable: false }`, while a
 * network/server failure rejects so the caller can distinguish an error from a
 * genuine "no video" result.
 *
 * @param id - Media id to check.
 * @returns The check payload, or `{ playable: false }` when the item has no playable file.
 * @throws Error when the server responds with a failure status or an invalid payload.
 */
export function useVideoCheck(id: string | number | undefined) {
  return useQuery({
    queryKey: ["media", "videoCheck", id],
    queryFn: async (): Promise<VideoCheckResponse> => {
      const res = await fetch(`/api/media/${id}/check`);
      if (!res.ok) {
        throw new Error(`تعذر التحقق من الفيديو (HTTP ${res.status})`);
      }
      const body = (await res.json()) as { success: boolean; data?: VideoCheckResponse };
      if (!body.data) {
        throw new Error("استجابة غير صالحة من الخادم");
      }
      return body.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useRecommendations(
  libraryId: number | undefined,
  mediaId: string | number | undefined,
  mediaType?: string,
  limit = 20,
) {
  return useQuery({
    queryKey: ["media", "recommendations", mediaId, libraryId],
    queryFn: () => fetchRecommendations(libraryId!, mediaId!, mediaType, limit),
    enabled: !!libraryId && !!mediaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllPeople(params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: ["people", "list", params],
    queryFn: () => fetchAllPeople(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePerson(id: string | number | undefined) {
  return useQuery({
    queryKey: ["people", "detail", id],
    queryFn: () => fetchPerson(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePersonWorks(id: string | number | undefined) {
  return useQuery({
    queryKey: ["people", "works", id],
    queryFn: () => fetchPersonWorks(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMediaBatch(ids: (string | number)[]) {
  const validIds = ids.filter((id) => id !== undefined && id !== null && id !== "");
  const key = [...validIds].sort((a, b) => Number(a) - Number(b)).join(",");
  return useQuery({
    queryKey: ["media", "batch", key],
    queryFn: () => fetchMediaBatch(validIds),
    enabled: validIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: fetchPublicSettings,
    staleTime: 10 * 60 * 1000,
  });
}

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: fetchChannels,
    staleTime: 2 * 60 * 1000,
  });
}
