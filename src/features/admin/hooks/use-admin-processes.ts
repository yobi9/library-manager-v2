import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/frontend/api-client";

export interface ScanProcess {
  library_id: number;
  library_name: string;
  status: string;
  progress: number;
  scanned_items: number;
  total_items: number;
  [key: string]: unknown;
}

interface ProcessesResponse {
  rows: ScanProcess[];
  total: number;
}

/**
 * Fetch all library scan processes from the scan-status endpoint.
 *
 * @returns Object with `rows` array of ScanProcess and `total` count.
 */
async function fetchAdminProcesses(): Promise<ProcessesResponse> {
  const res = await apiFetch<ProcessesResponse>("/api/scan/processes");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل العمليات");
  return res.data;
}

/**
 * Start a scan for a specific library.
 *
 * @param libraryId - Library ID to start scanning.
 */
async function startScan(libraryId: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${libraryId}/scan`);
  if (!res.success) throw new Error(res.error ?? "فشل بدء المسح");
}

/**
 * Stop a running scan for a specific library.
 *
 * @param libraryId - Library ID to stop scanning.
 */
async function stopScan(libraryId: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${libraryId}/scan/stop`);
  if (!res.success) throw new Error(res.error ?? "فشل إيقاف المسح");
}

/**
 * Resume a paused scan for a specific library.
 *
 * @param libraryId - Library ID to resume scanning.
 */
async function resumeScan(libraryId: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${libraryId}/scan/resume`);
  if (!res.success) throw new Error(res.error ?? "فشل استئناف المسح");
}

export const adminProcessesKeys = {
  all: ["admin", "processes"] as const,
};

/**
 * React Query hook to fetch all scan processes.
 */
export function useAdminProcesses() {
  return useQuery({
    queryKey: adminProcessesKeys.all,
    queryFn: fetchAdminProcesses,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

/**
 * Mutation hook to start a scan. Invalidates processes on success.
 */
export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProcessesKeys.all });
    },
  });
}

/**
 * Mutation hook to stop a scan. Invalidates processes on success.
 */
export function useStopScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: stopScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProcessesKeys.all });
    },
  });
}

/**
 * Mutation hook to resume a paused scan. Invalidates processes on success.
 */
export function useResumeScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumeScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProcessesKeys.all });
    },
  });
}
