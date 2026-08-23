import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPut } from "@/lib/frontend/api-client";

export interface ReportItem {
  id: number;
  report_type: string;
  status: string;
  media_id: number;
  reported_by: string;
  reason: string;
  created_at: string;
  [key: string]: unknown;
}

interface ReportsResponse {
  rows: ReportItem[];
  total: number;
}

/**
 * Fetch paginated media reports list.
 *
 * @param limit - Items per page (default 50).
 * @param offset - Offset for pagination (default 0).
 * @returns Object with `rows` array and `total` count.
 */
async function fetchReports(limit = 50, offset = 0): Promise<ReportsResponse> {
  const res = await apiFetch<ReportsResponse>(`/api/media-reports?limit=${limit}&offset=${offset}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل البلاغات");
  return res.data;
}

/**
 * Update a report's status (e.g. dismissed, resolved).
 *
 * @param data - Object with report `id` and the new `status`.
 */
async function updateReportStatus(data: { id: number; status: string }): Promise<void> {
  const res = await apiPut(`/api/media-reports/${data.id}/status`, { status: data.status });
  if (!res.success) throw new Error(res.error ?? "فشل تحديث حالة البلاغ");
}

export const adminReportsKeys = {
  all: ["admin", "reports"] as const,
  list: (limit: number, offset: number) => ["admin", "reports", "list", limit, offset] as const,
};

/**
 * React Query hook for paginated reports list.
 */
export function useAdminReports(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminReportsKeys.list(limit, offset),
    queryFn: () => fetchReports(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to update a report's status. Invalidates the reports list on success.
 */
export function useUpdateReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateReportStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReportsKeys.all });
    },
  });
}
