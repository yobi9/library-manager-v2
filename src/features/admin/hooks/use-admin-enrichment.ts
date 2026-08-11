"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/frontend/api";

/** A row of the pending_enrichment_approvals table. */
export interface AdminApproval {
  id: number;
  media_id: number;
  media_title: string;
  tmdb_id: number;
  tmdb_title: string;
  similarity_score: number;
  details_json?: string;
  status: string;
  created_at?: string;
}

/** Options forwarded to enrichment download/storage settings. */
export interface EnrichmentOptionsPayload {
  downloadImages?: boolean;
  storageMode?: string;
  downloadCastImages?: boolean;
}

export const adminEnrichmentKeys = {
  pending: ["admin", "enrich", "pending"] as const,
};

/**
 * Fetch the list of pending enrichment approvals awaiting admin review.
 *
 * @returns Array of pending approval rows.
 */
async function fetchPendingApprovals(): Promise<AdminApproval[]> {
  const res = await apiFetch<{ pending: AdminApproval[] }>("/api/enrich/pending-approvals");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الموافقات المعلقة");
  return res.data.pending;
}

/**
 * Approve a single pending enrichment by ID.
 *
 * @param id - Approval row ID.
 * @param options - Download/storage options.
 */
async function approveEnrichment(
  id: number,
  options: EnrichmentOptionsPayload = {},
): Promise<void> {
  const res = await apiPost(`/api/enrich/approve/${id}`, options);
  if (!res.success) throw new Error(res.error ?? "فشل الموافقة على الإثراء");
}

/**
 * Reject a single pending enrichment by ID.
 *
 * @param id - Approval row ID.
 */
async function rejectEnrichment(id: number): Promise<void> {
  const res = await apiPost(`/api/enrich/reject/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل رفض الإثراء");
}

/**
 * Approve all pending enrichments at once.
 *
 * @param options - Download/storage options forwarded to every approval.
 */
async function approveAllPending(options: EnrichmentOptionsPayload = {}): Promise<void> {
  const res = await apiPost("/api/enrich/pending-approve-all", options);
  if (!res.success) throw new Error(res.error ?? "فشل الموافقة على الكل");
}

/**
 * Test the TMDB connection with the given API key.
 *
 * @param apiKey - TMDB API key to validate.
 * @returns The test movie title on success.
 */
async function testEnrichmentConnection(apiKey: string): Promise<{ testMovie?: string }> {
  const res = await apiPost<{ testMovie?: string }>("/api/enrich/test-connection", { apiKey });
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل اختبار الاتصال");
  return res.data;
}

/**
 * Persist a new TMDB API key for enrichment.
 *
 * @param apiKey - TMDB API key to store.
 */
async function updateEnrichmentApiKey(apiKey: string): Promise<void> {
  const res = await apiPost("/api/enrich/update-apikey", { apiKey });
  if (!res.success) throw new Error(res.error ?? "فشل حفظ مفتاح API");
}

/**
 * Start translation of all items matching a filter, in the background.
 *
 * @param body - Optional library/type filters.
 * @returns The started session id.
 */
async function translateByFilter(body: {
  libraryId?: string;
  type?: string;
}): Promise<{ sessionId?: string }> {
  const res = await apiPost<{ sessionId?: string }>("/api/translate/by-filter", body);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل بدء ترجمة الكل");
  return res.data;
}

/**
 * React Query hook to fetch pending enrichment approvals.
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: adminEnrichmentKeys.pending,
    queryFn: fetchPendingApprovals,
    staleTime: 30_000,
  });
}

/**
 * Mutation hook to approve a single pending enrichment. Invalidates the approvals list.
 */
export function useApproveEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: number; options?: EnrichmentOptionsPayload }) =>
      approveEnrichment(payload.id, payload.options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminEnrichmentKeys.pending });
    },
  });
}

/**
 * Mutation hook to reject a single pending enrichment. Invalidates the approvals list.
 */
export function useRejectEnrichment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rejectEnrichment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminEnrichmentKeys.pending });
    },
  });
}

/**
 * Mutation hook to approve all pending enrichments. Invalidates the approvals list.
 */
export function useApproveAllPending() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAllPending,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminEnrichmentKeys.pending });
    },
  });
}

/**
 * Mutation hook to test the TMDB connection with an API key.
 */
export function useTestEnrichmentConnection() {
  return useMutation({ mutationFn: testEnrichmentConnection });
}

/**
 * Mutation hook to persist a new TMDB API key.
 */
export function useUpdateEnrichmentApiKey() {
  return useMutation({ mutationFn: updateEnrichmentApiKey });
}

/**
 * Mutation hook to start translation of all items matching a filter.
 */
export function useTranslateByFilter() {
  return useMutation({ mutationFn: translateByFilter });
}
