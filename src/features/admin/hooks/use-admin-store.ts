import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete } from "@/lib/frontend/api";

export interface StoreProduct {
  id: number;
  name: string;
  price: number;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface StoreProductsResponse {
  rows: StoreProduct[];
  total: number;
}

/**
 * Fetch paginated store products list.
 *
 * @param limit - Items per page (default 50).
 * @param offset - Offset for pagination (default 0).
 * @returns Object with `rows` array and `total` count.
 */
async function fetchStoreProducts(limit = 50, offset = 0): Promise<StoreProductsResponse> {
  const res = await apiFetch<StoreProductsResponse>(
    `/api/store-products?limit=${limit}&offset=${offset}`,
  );
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل المنتجات");
  return res.data;
}

/**
 * Create a store product.
 *
 * @param data - Product creation payload.
 */
async function createStoreProduct(data: Partial<StoreProduct>): Promise<void> {
  const res = await apiPost("/api/store-products", data);
  if (!res.success) throw new Error(res.error ?? "فشل إنشاء المنتج");
}

/**
 * Update a store product.
 *
 * @param data - Object with `id` and fields to update.
 */
async function updateStoreProduct(data: { id: number } & Partial<StoreProduct>): Promise<void> {
  const { id, ...updates } = data;
  const res = await apiPut(`/api/store-products/${id}`, updates);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث المنتج");
}

/**
 * Delete a store product by ID.
 *
 * @param id - Product ID to delete.
 */
async function deleteStoreProduct(id: number): Promise<void> {
  const res = await apiDelete(`/api/store-products/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف المنتج");
}

export const adminStoreKeys = {
  all: ["admin", "store"] as const,
  list: (limit: number, offset: number) => ["admin", "store", "list", limit, offset] as const,
};

/**
 * React Query hook for paginated store products list.
 */
export function useAdminStoreProducts(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminStoreKeys.list(limit, offset),
    queryFn: () => fetchStoreProducts(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to create a store product. Invalidates the products list on success.
 */
export function useCreateStoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStoreProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStoreKeys.all });
    },
  });
}

/**
 * Mutation hook to update a store product. Invalidates the products list on success.
 */
export function useUpdateStoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStoreProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStoreKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a store product. Invalidates the products list on success.
 */
export function useDeleteStoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStoreProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStoreKeys.all });
    },
  });
}
