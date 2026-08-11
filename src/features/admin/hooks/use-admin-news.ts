import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete } from "@/lib/frontend/api";

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface NewsResponse {
  rows: NewsItem[];
  total: number;
}

/**
 * Fetch paginated news list.
 *
 * @param limit - Items per page (default 50).
 * @param offset - Offset for pagination (default 0).
 * @returns Object with `rows` array and `total` count.
 */
async function fetchNews(limit = 50, offset = 0): Promise<NewsResponse> {
  const res = await apiFetch<NewsResponse>(`/api/news?limit=${limit}&offset=${offset}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الأخبار");
  return res.data;
}

/**
 * Create a news item.
 *
 * @param data - News creation payload.
 */
async function createNews(data: Partial<NewsItem>): Promise<void> {
  const res = await apiPost("/api/news", data);
  if (!res.success) throw new Error(res.error ?? "فشل إنشاء الخبر");
}

/**
 * Update an existing news item.
 *
 * @param data - Object with `id` and fields to update.
 */
async function updateNews(data: { id: number } & Partial<NewsItem>): Promise<void> {
  const { id, ...updates } = data;
  const res = await apiPut(`/api/news/${id}`, updates);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث الخبر");
}

/**
 * Delete a news item by ID.
 *
 * @param id - News ID to delete.
 */
async function deleteNews(id: number): Promise<void> {
  const res = await apiDelete(`/api/news/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف الخبر");
}

export const adminNewsKeys = {
  all: ["admin", "news"] as const,
  list: (limit: number, offset: number) => ["admin", "news", "list", limit, offset] as const,
};

/**
 * React Query hook for paginated news list.
 */
export function useAdminNews(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminNewsKeys.list(limit, offset),
    queryFn: () => fetchNews(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to create a news item. Invalidates the news list on success.
 */
export function useCreateNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNewsKeys.all });
    },
  });
}

/**
 * Mutation hook to update a news item. Invalidates the news list on success.
 */
export function useUpdateNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNewsKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a news item. Invalidates the news list on success.
 */
export function useDeleteNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNewsKeys.all });
    },
  });
}
