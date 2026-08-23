import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiDelete } from "@/lib/frontend/api-client";

/**
 * A visitor request submitted through the public contact form and stored
 * in the `visitor_events` table with `event_type = 'request'`.
 *
 * Field naming follows the API contract exposed by `VisitorRepository.getVisitorRequests`
 * (camelCase DTO) — not the raw DB snake_case columns.
 */
export interface VisitorRequest {
  id: number;
  userId: string | null;
  device_id: string | null;
  message: string | null;
  createdAt: string;
  status: string;
  reply: string | null;
  replyCreatedAt: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Fetches all visitor requests (newest first) from the admin API.
 *
 * @returns An array of `VisitorRequest` objects.
 * @throws When the request fails or returns no data.
 */
async function fetchVisitorRequests(): Promise<VisitorRequest[]> {
  const res = await apiFetch<VisitorRequest[]>("/api/user/requests");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الطلبات");
  return res.data;
}

/**
 * Sends an admin reply to a visitor request by marking it resolved.
 *
 * @param data - Object with request `id` and the reply `reply` text.
 * @returns void.
 */
async function replyToRequest(data: { id: number; reply: string }): Promise<void> {
  const res = await apiPost(`/api/user/requests/${data.id}/reply`, {
    reply: data.reply,
  });
  if (!res.success) throw new Error(res.error ?? "فشل إرسال الرد");
}

/**
 * Deletes a single visitor request by its ID.
 *
 * @param id - The request ID to delete.
 * @returns void.
 */
async function deleteVisitorRequest(id: number): Promise<void> {
  const res = await apiDelete(`/api/user/requests/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف الطلب");
}

/**
 * Deletes all visitor requests at once.
 *
 * @returns void.
 */
async function deleteAllVisitorRequests(): Promise<void> {
  const res = await apiDelete("/api/user/requests");
  if (!res.success) throw new Error(res.error ?? "فشل حذف جميع الطلبات");
}

export const adminVisitorRequestsKeys = {
  all: ["admin", "visitor-requests"] as const,
};

/**
 * React Query hook that fetches the full list of visitor requests.
 */
export function useVisitorRequests() {
  return useQuery({
    queryKey: adminVisitorRequestsKeys.all,
    queryFn: fetchVisitorRequests,
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to reply to a visitor request. Invalidates the requests list on success.
 */
export function useReplyToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replyToRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVisitorRequestsKeys.all });
    },
  });
}

/**
 * Mutation hook to delete all visitor requests. Invalidates the requests list on success.
 */
export function useDeleteAllVisitorRequests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllVisitorRequests,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVisitorRequestsKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a single visitor request. Invalidates the requests list on success.
 */
export function useDeleteVisitorRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVisitorRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVisitorRequestsKeys.all });
    },
  });
}
