import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/frontend/api-client";

/**
 * A single persisted security event as returned by the
 * `/api/admin/events/security` route.
 */
export interface AdminSecurityEvent {
  event_id: number;
  user_id: number | null;
  event_type: string;
  severity: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  resolved: number;
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
  username: string | null;
  resolver_username: string | null;
}

export interface SecurityEventsData {
  rows: AdminSecurityEvent[];
  total: number;
}

/**
 * Fetches one page of security events from the admin API.
 *
 * @param limit - Maximum number of rows per page (50 by default).
 * @param offset - Number of rows already loaded (pagination cursor).
 * @returns The resolved rows plus the total count for "load more" detection.
 * @throws If the API call fails or returns no data.
 */
async function fetchSecurityEvents(limit: number, offset: number): Promise<SecurityEventsData> {
  const res = await apiFetch<SecurityEventsData>(
    `/api/admin/events/security?limit=${limit}&offset=${offset}`,
  );
  if (!res.success || !res.data) {
    throw new Error(res.error ?? "فشل تحميل أحداث الأمان");
  }
  return res.data;
}

/**
 * Infinite-query hook for the security events box on the admin events page.
 *
 * Polls periodically so new login failures and block/unblock actions appear
 * without a manual refresh, and exposes `fetchNextPage` for "load more".
 *
 * @param limit - Page size passed to the API.
 * @param options.pollingInterval - Interval in ms between background refetches;
 *   pass `false` to disable polling (e.g. while the SSE stream is connected).
 * @returns The standard TanStack infinite-query result for security events.
 */
export function useAdminSecurityEvents(limit = 50, options?: { pollingInterval?: number | false }) {
  return useInfiniteQuery({
    queryKey: ["admin", "events", "security"],
    queryFn: ({ pageParam }) => fetchSecurityEvents(limit, pageParam as number),
    initialPageParam: 0,
    staleTime: 15_000,
    refetchInterval: options?.pollingInterval ?? 15_000,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * limit;
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}
