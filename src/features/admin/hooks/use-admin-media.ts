import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiDelete, apiPost, apiPatch } from "@/lib/frontend/api";
import type { MediaItem } from "@/lib/frontend/api-media";
import type { EnrichmentOptionsPayload } from "@/features/admin/hooks/use-admin-enrichment";

/**
 * A raw row of the media_people table (used by the admin edit form to round-trip
 * the full crew list without losing roles like producer/editor).
 */
export interface MediaPersonRow {
  person_id?: number | null;
  name: string;
  role: string;
  character?: string | null;
  department?: string | null;
  profile_path?: string | null;
  importance_order?: number;
  id?: number;
}

/** Full media details returned by GET /api/media/:id (includes genres + people). */
export interface AdminMediaDetails extends MediaItem {
  logo_url: string;
  sort_order: null;
  origin_country: string;
  tagline: string;
  original_title: string;
  genres?: string[];
  people?: MediaPersonRow[];
  is_available?: boolean;
}

/**
 * Payload of the admin edit form saved via POST /api/enrich/metadata/:id.
 * Matches the whitelist of MetadataService.updateMetadataManually.
 */
export interface ItemMetadataPayload {
  title?: string;
  original_title?: string;
  overview?: string;
  runtime?: number;
  release_date?: string;
  year?: number;
  imdb_rating?: number;
  imdb_votes?: number;
  certification?: string;
  tmdb_id?: number;
  country?: string;
  language?: string;
  poster_path?: string;
  backdrop_path?: string;
  tags?: string[];
  people?: MediaPersonRow[];
  type?: string;
  is_pinned?: boolean;
  is_available?: boolean;
  origin_country?: string;
 tagline?: string;
 
  sort_order?: number;
  trailer_url?: string;
  logo_url?: string;


}

/**
 * Filters used by the admin items-control list.
 */
export interface AdminMediaFilters {
  page: number;
  limit: number;
  search?: string;
  libraryId?: string;
  type?: string;
  filterBy?: "all" | "pinned" | "no-content" | "needs-review";
}

/**
 * Editable fields of a media item (PATCH /api/media/:id).
 * Mirrors the whitelist enforced server-side.
 */
export interface MediaUpdateFields {
  title?: string;
  original_title?: string;
  overview?: string;
  year?: number;
  imdb_rating?: number;
  certification?: string;
  poster_path?: string;
  backdrop_path?: string;
  sort_order?: number;
  is_pinned?: boolean;
  is_available?: boolean;
  type?: string;
}

/** Dashboard-style stats returned with the admin media list response. */
export interface AdminMediaStats {
  totalItems: number;
  totalLibraries: number;
  needsAttention: number;
  noContent: number;
  lastSync: string | null;
}

interface AdminMediaResponse {
  items: MediaItem[];
  total: number;
  stats?: AdminMediaStats;
}

/**
 * Fetch a paginated, filterable admin media list from the API.
 * Always requests root items (no seasons/episodes) and excludes
 * non-content types by default.
 *
 * @param filters - Pagination + filtering options.
 * @returns Object with `items` array and `total` count.
 */
async function fetchAdminMedia(filters: AdminMediaFilters): Promise<AdminMediaResponse> {
  const params = new URLSearchParams({
    admin: "true",
    page: String(filters.page),
    limit: String(filters.limit),
    rootOnly: "true",
    excludeTypes: "season,episode,series_sports,series_deen",
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.libraryId && filters.libraryId !== "all") params.set("libraryId", filters.libraryId);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.filterBy && filters.filterBy !== "all") params.set("filterBy", filters.filterBy);

  const res = await apiFetch<AdminMediaResponse>(`/api/media?${params.toString()}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الوسائط");
  return res.data;
}

/**
 * Delete a media item by ID.
 *
 * @param id - Media ID to delete.
 */
async function deleteMedia(id: number): Promise<void> {
  const res = await apiDelete(`/api/media/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف الوسيط");
}

/**
 * Toggle the pinned state of a media item.
 *
 * @param id - Media ID to toggle.
 * @returns Object with the new `pinned` state.
 */
async function togglePinMedia(id: number): Promise<{ pinned: boolean }> {
  const res = await apiPost<{ pinned: boolean }>(`/api/media/${id}/toggle-pin`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تغيير حالة التثبيت");
  return res.data;
}

/**
 * Start metadata enrichment (TMDB) for a single item in the background.
 * Optional `tmdbId` + `force` allow the "quick enrich" flow of the edit form.
 *
 * @param id - Media ID to enrich.
 * @param options - Optional override options (explicit tmdbId, force flag).
 */
 async function enrichMediaItem(
  id: number,
  options?: {
    tmdbId?: number;
    force?: boolean;
    downloadImages?: boolean;
    downloadCastImages?: boolean;
    storageMode?: string;
  },
): Promise<void> {
  const res = await apiPost(`/api/enrich/item/${id}`, options ?? {});
  if (!res.success) throw new Error(res.error ?? "فشل بدء الإثراء");
}
/**
 * Start metadata enrichment for a batch of items in the background.
 *
 * @param ids - Array of media IDs to enrich.
 * @param options - Download/storage options forwarded to the batch job.
 */
async function enrichMediaBatch(ids: number[], options?: EnrichmentOptionsPayload): Promise<void> {
  const res = await apiPost(`/api/enrich/batch`, { mediaIds: ids, options });
  if (!res.success) throw new Error(res.error ?? "فشل بدء الإثراء الجماعي");
}

/**
 * Start Arabic translation for a single item in the background.
 *
 * @param id - Media ID to translate.
 */
async function translateMediaItem(id: number): Promise<void> {
  const res = await apiPost(`/api/translate/item/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل بدء الترجمة");
}

/**
 * Start Arabic translation for a batch of items in the background.
 *
 * @param ids - Array of media IDs to translate.
 */
async function translateMediaBatch(ids: number[]): Promise<void> {
  const res = await apiPost(`/api/translate/batch`, { mediaIds: ids });
  if (!res.success) throw new Error(res.error ?? "فشل بدء الترجمة الجماعية");
}

/**
 * Update the editable fields of a media item.
 *
 * @param id - Media ID to update.
 * @param updates - Field whitelist to patch.
 */
async function updateMediaItem(id: number, updates: MediaUpdateFields): Promise<void> {
  const res = await apiPatch(`/api/media/${id}`, updates);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث الوسيط");
}

/**
 * Reset enrichment metadata for a single item.
 *
 * @param id - Media ID to reset.
 */
async function resetMediaEnrichment(id: number): Promise<void> {
  const res = await apiPost(`/api/enrich/reset/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل تصفير الإثراء");
}

/**
 * Start enrichment for every item matching a filter, in the background.
 *
 * @param body - Filter + enrichment options for /api/enrich/by-filter.
 */
async function enrichByFilter(body: {
  libraryId?: string;
  type?: string;
  onlyEmpty?: boolean;
  downloadImages?: boolean;
  storageMode?: string;
  downloadCastImages?: boolean;
}): Promise<void> {
  const res = await apiPost(`/api/enrich/by-filter`, body);
  if (!res.success) throw new Error(res.error ?? "فشل بدء الإثراء حسب الفلتر");
}

/**
 * Fetch the full details of a media item (including genres + people) for the edit form.
 *
 * @param id - Media ID to load.
 * @returns Full media details object.
 */
export async function fetchAdminMediaDetails(id: number): Promise<AdminMediaDetails> {
  const res = await apiFetch<AdminMediaDetails>(`/api/media/${id}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل التفاصيل");
  return res.data;
}

/**
 * Save the full edit-form payload through the manual metadata endpoint.
 *
 * @param id - Media ID to update.
 * @param payload - ItemMetadataPayload with the edited fields.
 */
async function updateItemMetadata(id: number, payload: ItemMetadataPayload): Promise<void> {
  const res = await apiPost(`/api/enrich/metadata/${id}`, payload);
  if (!res.success) throw new Error(res.error ?? "فشل حفظ البيانات");
}

 
/**
 * تحميل صورة من رابط خارجي وتخزينها في التخزين المحلي أو جانب الميديا.
 *
 * @param mediaId - معرّف العنصر الذي ستُرفق به الصورة.
 * @param imageUrl - رابط الصورة المصدر (يجب أن يكون HTTP/HTTPS وآمناً).
 * @param type - نوع الصورة: "poster" أو "backdrop".
 * @param storageMode - وضع التخزين: "local" (المجلد العام) أو "media_folder" (جانب الميديا).
 * @returns كائن يحتوي على `path` (المسار النسبي للصورة المحفوظة).
 * @throws خطأ إذا فشل التحميل أو كان الرابط غير آمن.
 */

async function uploadMediaImage(
  mediaId: number,
  imageUrl: string,
  type: "poster" | "backdrop",
  storageMode: string = "local", // ← قيمة افتراضية
): Promise<{ path: string }> {
  const res = await apiPost<{ path: string }>("/api/enrich/upload-image", {
    mediaId,
    imageUrl,
    type,
     storageMode, // ← تمرير القيمة المستلمة
  });
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الصورة");
  return res.data;
}

export const adminMediaKeys = {
  all: ["admin", "media"] as const,
  list: (filters: AdminMediaFilters) => ["admin", "media", "list", filters] as const,
};

/**
 * React Query hook for the paginated admin media list.
 * Re-fetches whenever any filter value changes.
 */
export function useAdminMedia(filters: AdminMediaFilters) {
  return useQuery({
    queryKey: adminMediaKeys.list(filters),
    queryFn: () => fetchAdminMedia(filters),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to delete a media item. Invalidates the media list on success.
 */
export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
    },
  });
}

/**
 * Mutation hook to toggle a media item's pinned state. Invalidates the media list on success.
 */
export function useTogglePinMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: togglePinMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
    },
  });
}

/**
 * Mutation hook to start enrichment for a single item.
 * Accepts either a plain media ID or `{ id, tmdbId?, force? }` for the quick-enrich flow.
 */
 export function useEnrichItem() {
  return useMutation({
    mutationFn: (payload: number | {
      id: number;
      tmdbId?: number;
      force?: boolean;
      downloadImages?: boolean;
      downloadCastImages?: boolean;
      storageMode?: string;
    }) => {
      if (typeof payload === "number") {
        return enrichMediaItem(payload, {});
      }
      return enrichMediaItem(payload.id, {
        tmdbId: payload.tmdbId,
        force: payload.force,
        downloadImages: payload.downloadImages,
        downloadCastImages: payload.downloadCastImages,
        storageMode: payload.storageMode,
      });
    },
  });
}
/**
 * Mutation hook to start enrichment for a batch of items.
 */
export function useEnrichBatch() {
  return useMutation({
    mutationFn: (payload: { ids: number[]; options?: EnrichmentOptionsPayload }) =>
      enrichMediaBatch(payload.ids, payload.options),
  });
}

/**
 * Mutation hook to start translation for a single item.
 */
export function useTranslateItem() {
  return useMutation({ mutationFn: translateMediaItem });
}

/**
 * Mutation hook to start translation for a batch of items.
 */
export function useTranslateBatch() {
  return useMutation({ mutationFn: translateMediaBatch });
}

/**
 * Mutation hook to update a media item's editable fields.
 * Invalidates the media list on success.
 */
export function useUpdateMediaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number; updates: MediaUpdateFields }) =>
      updateMediaItem(payload.id, payload.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
    },
  });
}

/**
 * Mutation hook to reset a single item's enrichment metadata.
 */
export function useResetEnrichment() {
  return useMutation({ mutationFn: resetMediaEnrichment });
}

/**
 * Mutation hook to save the full edit-form payload through the manual metadata endpoint.
 * Invalidates the admin media list on success.
 */
export function useUpdateItemMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number; data: ItemMetadataPayload }) =>
      updateItemMetadata(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
    },
  });
}

/**
 * Mutation hook to download an image from a URL into local storage.
 */
// export function useUploadMediaImage() {
//   return useMutation({
//     mutationFn: (payload: { mediaId: number; imageUrl: string; type: "poster" | "backdrop" }) =>
//       uploadMediaImage(payload.mediaId, payload.imageUrl, payload.type),
//   });
// }
/**
 * React Query mutation hook لتحميل صورة من رابط وتخزينها.
 *
 * @returns كائن mutation مع دوال `mutate` و `mutateAsync`.
 */
export function useUploadMediaImage() {
  return useMutation({
    mutationFn: (payload: { 
      mediaId: number; 
      imageUrl: string; 
      type: "poster" | "backdrop";
      storageMode?: string; // ← اختياري
    }) =>
      uploadMediaImage(
        payload.mediaId, 
        payload.imageUrl, 
        payload.type, 
        payload.storageMode ?? "local" // ← قيمة افتراضية
      ),
  });
}
/**
 * Mutation hook to start enrichment for all items matching a filter.
 */
export function useEnrichByFilter() {
  return useMutation({ mutationFn: enrichByFilter });
}
