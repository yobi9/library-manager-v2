//src\features\admin\hooks\use-admin-messages.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete } from "@/lib/frontend/api";

export interface MessageItem {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface MessagesResponse {
  rows: MessageItem[];
  total: number;
}

/**
 * Fetch paginated messages list.
 *
 * @param limit - Items per page (default 50).
 * @param offset - Offset for pagination (default 0).
 * @returns Object with `rows` array and `total` count.
 */
async function fetchMessages(limit = 50, offset = 0): Promise<MessagesResponse> {
  const res = await apiFetch<MessagesResponse>(`/api/messages?limit=${limit}&offset=${offset}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الرسائل");
  return res.data;
}

/**
 * Update a message's status (e.g. read, replied).
 *
 * @param data - Object with message `id` and status fields to update.
 */
async function updateMessage(data: { id: number } & Partial<MessageItem>): Promise<void> {
  const { id, ...updates } = data;
  const res = await apiPut(`/api/messages/${id}`, updates);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث الرسالة");
}

/**
 * Delete a message by ID.
 *
 * @param id - Message ID to delete.
 */
async function deleteMessage(id: number): Promise<void> {
  const res = await apiDelete(`/api/messages/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف الرسالة");
}

/**
 * Create a broadcast message sent to all clients.
 *
 * @param data - Object with `title` and `body` of the message.
 * @returns The created message item.
 */
async function createMessage(data: { title: string; body: string }): Promise<MessageItem> {
  const res = await apiPost<MessageItem>("/api/messages", {
    ...data,
    type: "broadcast",
  });
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل إرسال الرسالة");
  return res.data;
}

export const adminMessagesKeys = {
  all: ["admin", "messages"] as const,
  list: (limit: number, offset: number) => ["admin", "messages", "list", limit, offset] as const,
};

/**
 * React Query hook for paginated messages list.
 */
export function useAdminMessages(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminMessagesKeys.list(limit, offset),
    queryFn: () => fetchMessages(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to update a message status. Invalidates the messages list on success.
 */
export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMessagesKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a message. Invalidates the messages list on success.
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMessagesKeys.all });
    },
  });
}

/**
 * Mutation hook to create a broadcast message. Invalidates the messages list on success.
 */
export function useCreateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMessagesKeys.all });
    },
  });
}
