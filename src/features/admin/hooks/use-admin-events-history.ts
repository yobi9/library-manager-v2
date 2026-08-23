import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiDelete } from "@/lib/frontend/api-client";

/**
 * Event row as persisted in the `activities` table and returned by the
 * `/api/admin/events/history` endpoint.
 */
export interface HistoryEvent {
  id: number;
  entity_type: "user" | "visitor" | "system";
  user_name?: string;
  time?: string;
  created_at: string;
  action: string;
  module: string;
  severity: string;
  details?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_id?: string | null;
  target_id?: number | null;
}

/**
 * Grouped events history payload delivered by the admin events endpoint.
 */
export interface EventsHistoryData {
  system: HistoryEvent[];
  user: HistoryEvent[];
  totals: { system: number; user: number };
}

/**
 * Fetches a single page of the persisted events history.
 *
 * @param limit - Items per group in this page (default 50).
 * @param offset - Number of rows to skip (page offset).
 * @returns The grouped history payload for this page.
 */
async function fetchEventsHistory(limit: number, offset: number): Promise<EventsHistoryData> {
  const res = await apiFetch<EventsHistoryData>(
    `/api/admin/events/history?limit=${limit}&offset=${offset}`,
  );
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الأحداث");
  return res.data;
}

export const adminEventsHistoryKeys = {
  all: ["admin", "events", "history"] as const,
};

/**
 * React Query hook for the persisted events history with infinite pagination.
 *
 * Each page loads `limit` rows per group (system + user) from the matching
 * offset; the page exposes `fetchNextPage`/`hasNextPage` for a "load more"
 * button. The query also re-fetches periodically so live changes appear without
 * a manual refresh.
 *
 * @param limit - Rows per group per page (default 50).
 * @param options.pollingInterval - Interval in ms between background refetches;
 *   pass `false` to disable polling (e.g. while the SSE stream is connected).
 */
export function useAdminEventsHistory(limit = 50, options?: { pollingInterval?: number | false }) {
  return useInfiniteQuery({
    queryKey: adminEventsHistoryKeys.all,
    queryFn: ({ pageParam }) => fetchEventsHistory(limit, pageParam as number),
    initialPageParam: 0,
    staleTime: 15_000,
    refetchInterval: options?.pollingInterval ?? 15_000,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * limit;
      const total = lastPage.totals.system + lastPage.totals.user;
      return loaded < total ? loaded : undefined;
    },
  });
}

/**
 * Mutation that permanently deletes every persisted event row.
 * Invalidates the history query on success.
 */
export function useDeleteAllEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiDelete<{ success: boolean }>("/api/admin/events/history");
      if (!res.success) throw new Error(res.error ?? "فشل حذف الأحداث");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminEventsHistoryKeys.all });
    },
  });
}
