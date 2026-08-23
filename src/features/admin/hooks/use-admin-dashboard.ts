import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/frontend/api-client";

/**
 * Shape of the admin dashboard page state.
 * All counters mirror the backend `/api/dashboard` payload (camelCase mapped below).
 */
export interface DashboardStats {
  total_media: number;
  total_users: number;
  active_streams: number;
  used_storage: string;
  recent_activities: Array<{
    action: string;
    details?: string;
    created_at: string;
  }>;
}

/** Raw camelCase payload returned by the backend dashboard service. */
interface DashboardApiResponse {
  totalMedia?: number;
  totalStorageFormatted?: string;
  totalUsers?: number;
  activeStreams?: number;
  [key: string]: unknown;
}

/** Single recent-activity record delivered by `/api/dashboard/recent-activities`. */
export interface DashboardActivity {
  id: number;
  user_name?: string;
  action: string;
  details?: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Fetch and merge dashboard data for the admin dashboard page.
 * Combines backend stats (camelCase) + recent activities into a single
 * `DashboardStats` object consumed by `DashboardPage`.
 *
 * @returns Promise resolving to the normalized `DashboardStats` state.
 */
async function fetchAdminDashboard(): Promise<DashboardStats> {
  const [statsRes, activitiesRes] = await Promise.all([
    apiFetch<DashboardApiResponse>("/api/dashboard"),
    apiFetch<DashboardActivity[]>("/api/dashboard/recent-activities?limit=10"),
  ]);

  const stats = statsRes.data ?? {};
  const activities = activitiesRes.data ?? [];

  return {
    total_media: (stats.totalMedia as number) ?? 0,
    total_users: (stats.totalUsers as number) ?? 0,
    active_streams: (stats.activeStreams as number) ?? 0,
    used_storage: (stats.totalStorageFormatted as string) ?? "0 MB",
    recent_activities: activities.map((a) => ({
      action: a.action,
      details: a.details,
      created_at: a.created_at,
    })),
  };
}

/**
 * Shape of the lightweight `/api/dashboard/summary` response used to show
 * quick totals (total media count, formatted total storage, total views).
 */
export interface DashboardSummary {
  totalMedia: number;
  totalStorage: string;
  totalViews: number;
}

/** Raw camelCase payload returned by `/api/dashboard/summary`. */
interface DashboardSummaryApiResponse {
  totalMedia?: number;
  totalStorage?: string;
  totalViews?: number;
  [key: string]: unknown;
}

/**
 * Fetch the admin dashboard summary from `/api/dashboard/summary`.
 *
 * @returns Promise resolving to the normalized `DashboardSummary` state.
 */
async function fetchAdminSummary(): Promise<DashboardSummary> {
  const res = await apiFetch<DashboardSummaryApiResponse>("/api/dashboard/summary");
  const data = res.data ?? {};
  return {
    totalMedia: (data.totalMedia as number) ?? 0,
    totalStorage: (data.totalStorage as string) ?? "0 B",
    totalViews: (data.totalViews as number) ?? 0,
  };
}

export const adminSummaryKeys = {
  detail: ["admin", "dashboard", "summary"] as const,
};

/**
 * React Query hook that fetches the dashboard summary totals.
 * Leaner than `useAdminDashboard` — it does not fetch recent activities.
 */
export function useAdminSummary() {
  return useQuery({
    queryKey: adminSummaryKeys.detail,
    queryFn: fetchAdminSummary,
    staleTime: 60_000,
  });
}

export const adminDashboardKeys = {
  all: ["admin", "dashboard"] as const,
};

/**
 * React Query hook that fetches all dashboard data in one combined response.
 * This is the primary hook consumed by `DashboardPage`.
 */
export function useAdminDashboard() {
  return useQuery({
    queryKey: adminDashboardKeys.all,
    queryFn: fetchAdminDashboard,
    staleTime: 60_000,
  });
}

/** Per-device view counts delivered by `/api/dashboard/live`. */
export interface DeviceBreakdown {
  windows: number;
  samsung: number;
  huawei: number;
  android: number;
  apple: number;
  smart_tv: number;
  other: number;
}

/** Live dashboard payload delivered by `/api/dashboard/live`. */
export interface AdminLiveData {
  storageGB: string;
  storageFormatted: string;
  onlineVisitors: number;
  totalViews: number;
  deviceBreakdown: DeviceBreakdown;
}

/** Raw camelCase payload returned by `/api/dashboard/live`. */
interface AdminLiveApiResponse {
  storageGB?: string;
  storageFormatted?: string;
  onlineVisitors?: number;
  totalViews?: number;
  deviceBreakdown?: Partial<DeviceBreakdown>;
  [key: string]: unknown;
}

/**
 * Fetch live dashboard counters from `/api/dashboard/live`.
 *
 * @returns Promise resolving to the normalized `AdminLiveData` state.
 */
async function fetchAdminLive(): Promise<AdminLiveData> {
  const res = await apiFetch<AdminLiveApiResponse>("/api/dashboard/live");
  const data = res.data ?? {};
  const devices = data.deviceBreakdown ?? {};
  return {
    storageGB: (data.storageGB as string) ?? "0.00",
    storageFormatted: (data.storageFormatted as string) ?? "0 B",
    onlineVisitors: (data.onlineVisitors as number) ?? 0,
    totalViews: (data.totalViews as number) ?? 0,
    deviceBreakdown: {
      windows: (devices.windows as number) ?? 0,
      samsung: (devices.samsung as number) ?? 0,
      huawei: (devices.huawei as number) ?? 0,
      android: (devices.android as number) ?? 0,
      apple: (devices.apple as number) ?? 0,
      smart_tv: (devices.smart_tv as number) ?? 0,
      other: (devices.other as number) ?? 0,
    },
  };
}

export const adminLiveKeys = {
  all: ["admin", "dashboard", "live"] as const,
};

/**
 * React Query hook that fetches live dashboard counters.
 * Polls every 30 seconds to keep the header badge and live stats fresh.
 */
export function useAdminLive() {
  return useQuery({
    queryKey: adminLiveKeys.all,
    queryFn: fetchAdminLive,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}

/**
 * Fetch daily view counts from `/api/dashboard/daily-views`.
 *
 * @param days - Number of trailing days to aggregate (default 7).
 * @returns Promise resolving to an array of daily view counts (oldest first).
 */
async function fetchAdminDailyViews(days: number): Promise<number[]> {
  const res = await apiFetch<number[]>(`/api/dashboard/daily-views?days=${days}`);
  return res.data ?? [];
}

export const adminDailyViewsKeys = {
  list: (days: number) => ["admin", "dashboard", "daily-views", days] as const,
};

/**
 * React Query hook that fetches daily view counts for the line chart.
 */
export function useAdminDailyViews(days = 7) {
  return useQuery({
    queryKey: adminDailyViewsKeys.list(days),
    queryFn: () => fetchAdminDailyViews(days),
    staleTime: 60_000,
  });
}

/** Watched library row (most/least active sections). */
export interface WatchedLibraryRow {
  id: number;
  title: string;
  icon?: string | null;
  views: number;
}

/** Watched media item row (most/least viewed content). */
export interface WatchedItemRow {
  id: number;
  title: string;
  type: string;
  views: number;
}

/** Combined most/least watched lists for sections and items. */
export interface AdminWatchStats {
  mostLibraries: WatchedLibraryRow[];
  leastLibraries: WatchedLibraryRow[];
  mostItems: WatchedItemRow[];
  leastItems: WatchedItemRow[];
}

/**
 * Fetch most/least watched libraries and items in one combined request.
 *
 * @returns Promise resolving to the normalized `AdminWatchStats` state.
 */
async function fetchAdminWatchStats(): Promise<AdminWatchStats> {
  const [mostLibraries, leastLibraries, mostItems, leastItems] = await Promise.all([
    apiFetch<WatchedLibraryRow[]>("/api/dashboard/most-watched/libraries?limit=5"),
    apiFetch<WatchedLibraryRow[]>("/api/dashboard/least-watched/libraries?limit=5"),
    apiFetch<WatchedItemRow[]>("/api/dashboard/most-watched/items?limit=5"),
    apiFetch<WatchedItemRow[]>("/api/dashboard/least-watched/items?limit=5"),
  ]);

  return {
    mostLibraries: mostLibraries.data ?? [],
    leastLibraries: leastLibraries.data ?? [],
    mostItems: mostItems.data ?? [],
    leastItems: leastItems.data ?? [],
  };
}

export const adminWatchStatsKeys = {
  all: ["admin", "dashboard", "watch-stats"] as const,
};

/**
 * React Query hook that fetches the four watch-stat lists in one call.
 */
export function useAdminWatchStats() {
  return useQuery({
    queryKey: adminWatchStatsKeys.all,
    queryFn: fetchAdminWatchStats,
    staleTime: 60_000,
  });
}

/** Old unwatched media row delivered by `/api/dashboard/old-unwatched`. */
export interface OldUnwatchedItem {
  id: number;
  title: string;
  type: string;
  views: number;
  added_date?: string | null;
  library?: string | null;
}

/**
 * Fetch old items that were never watched from `/api/dashboard/old-unwatched`.
 *
 * @param daysOld - Minimal age in days for an item to be considered old (default 30).
 * @param limit - Maximum number of items to fetch (default 10).
 * @returns Promise resolving to the list of old unwatched items.
 */
async function fetchAdminOldUnwatched(daysOld: number, limit: number): Promise<OldUnwatchedItem[]> {
  const res = await apiFetch<OldUnwatchedItem[]>(
    `/api/dashboard/old-unwatched?daysOld=${daysOld}&limit=${limit}&onlyAvailable=true`,
  );
  return res.data ?? [];
}

export const adminOldUnwatchedKeys = {
  list: (daysOld: number, limit: number) =>
    ["admin", "dashboard", "old-unwatched", daysOld, limit] as const,
};

/**
 * React Query hook that fetches old unwatched items for the dashboard table.
 */
export function useAdminOldUnwatched(daysOld = 30, limit = 10) {
  return useQuery({
    queryKey: adminOldUnwatchedKeys.list(daysOld, limit),
    queryFn: () => fetchAdminOldUnwatched(daysOld, limit),
    staleTime: 60_000,
  });
}
