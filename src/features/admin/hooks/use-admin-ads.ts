import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete } from "@/lib/frontend/api";

export interface AdItem {
  id: number;
  title: string;
  position: string;
  status: string;
  impressions: number;
  clicks: number;
  [key: string]: unknown;
}

/** @deprecated Use `AdItem` instead. Kept for backward compatibility. */
export type AdminAd = AdItem;

interface AdsResponse {
  rows: AdItem[];
  total: number;
}

/**
 * Fetch paginated ads list.
 *
 * @param limit - Items per page (default 50).
 * @param offset - Offset for pagination (default 0).
 * @returns Object with `rows` array and `total` count.
 */
async function fetchAds(limit = 50, offset = 0): Promise<AdsResponse> {
  const res = await apiFetch<AdsResponse>(`/api/ads?limit=${limit}&offset=${offset}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الإعلانات");
  return res.data;
}

/**
 * Create a new ad.
 *
 * @param data - Ad creation payload.
 */
async function createAd(data: Partial<AdItem>): Promise<void> {
  const res = await apiPost("/api/ads", data);
  if (!res.success) throw new Error(res.error ?? "فشل إنشاء الإعلان");
}

/**
 * Update an existing ad.
 *
 * @param data - Object with `id` and fields to update.
 */
async function updateAd(data: { id: number } & Partial<AdItem>): Promise<void> {
  const { id, ...updates } = data;
  const res = await apiPut(`/api/ads/${id}`, updates);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث الإعلان");
}

/**
 * Delete an ad by ID.
 *
 * @param id - Ad ID to delete.
 */
async function deleteAd(id: number): Promise<void> {
  const res = await apiDelete(`/api/ads/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف الإعلان");
}

export const adminAdsKeys = {
  all: ["admin", "ads"] as const,
  list: (limit: number, offset: number) => ["admin", "ads", "list", limit, offset] as const,
};

/**
 * React Query hook for paginated ads list.
 */
export function useAdminAds(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminAdsKeys.list(limit, offset),
    queryFn: () => fetchAds(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to create an ad. Invalidates the ads list on success.
 */
export function useCreateAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAdsKeys.all });
    },
  });
}
/** @deprecated Use `useCreateAd` instead. */
export const useCreateAdminAd = useCreateAd;

/**
 * Mutation hook to update an ad. Invalidates the ads list on success.
 */
export function useUpdateAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAdsKeys.all });
    },
  });
}
/** @deprecated Use `useUpdateAd` instead. */
export const useUpdateAdminAd = useUpdateAd;

/**
 * Mutation hook to delete an ad. Invalidates the ads list on success.
 */
export function useDeleteAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAdsKeys.all });
    },
  });
}
/** @deprecated Use `useDeleteAd` instead. */
export const useDeleteAdminAd = useDeleteAd;
