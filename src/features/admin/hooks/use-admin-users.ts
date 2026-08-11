import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPut, apiDelete } from "@/lib/frontend/api";

export interface AdminUser {
  user_id: number;
  username: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  is_blocked: number;
  created_at: string;
  last_active: string | null;
  watched_count: number;
  active_sessions: number;
  avatar: string | null;
  phone_number?: string | null;
  about?: string | null;
  date_of_birth?: string | null;
}

/**
 * Editable profile fields sent to `PUT /api/user/[id]`.
 */
export interface AdminUserUpdate {
  username?: string;
  display_name?: string;
  email?: string;
  password?: string;
  phone_number?: string;
  about?: string;
  date_of_birth?: string;
  is_admin?: boolean;
  is_blocked?: number;
}

/**
 * Active session row returned by `GET /api/user/[id]/sessions`.
 */
export interface UserSession {
  id: number;
  user_id: number;
  ip_address: string;
  user_agent: string;
  os: string | null;
  last_active: string;
  expires_at: string;
  is_active: number;
  created_at: string;
}

/**
 * Activity row returned by `GET /api/user/[id]/activity`.
 */
export interface UserActivity {
  id: number;
  user_id: number | null;
  action: string;
  module: string;
  details: unknown;
  created_at: string;
}

/**
 * Aggregated stats returned by `GET /api/user/[id]/stats`.
 */
export interface UserDetailStats {
  watched_count: number;
  in_progress_count: number;
  total_sessions: number;
  active_sessions: number;
  last_active: string | null;
}

interface UsersResponse {
  rows: AdminUser[];
  total: number;
}

export const adminUserKeys = {
  all: ["admin", "users"] as const,
  list: (limit: number, offset: number) => ["admin", "users", "list", limit, offset] as const,
  detail: (id: number) => ["admin", "users", id] as const,
  sessions: (id: number) => ["admin", "users", id, "sessions"] as const,
  activity: (id: number) => ["admin", "users", id, "activity"] as const,
  stats: (id: number) => ["admin", "users", id, "stats"] as const,
};

/**
 * Fetch paginated user list from the admin API.
 */
async function fetchAdminUsers(limit: number, offset: number): Promise<UsersResponse> {
  const res = await apiFetch<UsersResponse>(`/api/user?limit=${limit}&offset=${offset}`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل المستخدمين");
  return res.data;
}

/**
 * Create a new user via the admin API.
 *
 * @returns The created user (with `user_id`) for follow-up actions like avatar upload.
 */
async function createAdminUser(data: {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
  is_admin?: boolean;
}): Promise<AdminUser> {
  const res = await apiPost<AdminUser>("/api/user", data);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل إنشاء المستخدم");
  return res.data;
}

/**
 * Delete a user via the admin API.
 */
async function deleteAdminUser(id: number): Promise<void> {
  const res = await apiDelete(`/api/user/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف المستخدم");
}

/**
 * Toggle block status for a user.
 */
async function toggleBlockUser(id: number, block: boolean): Promise<void> {
  const res = await apiPost(`/api/user/${id}/block`, { block });
  if (!res.success) throw new Error(res.error ?? "فشل تغيير حالة الحظر");
}

/**
 * Toggle admin status for a user.
 */
async function toggleAdminUser(id: number, makeAdmin: boolean): Promise<void> {
  const res = await apiPost(`/api/user/${id}/admin`, { makeAdmin });
  if (!res.success) throw new Error(res.error ?? "فشل تغيير صلاحية المدير");
}

/**
 * Update a user's profile via the admin API.
 */
async function updateAdminUser(id: number, data: AdminUserUpdate): Promise<void> {
  const res = await apiPut(`/api/user/${id}`, data);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث المستخدم");
}

/**
 * Upload an avatar image for a user via `POST /api/user/[id]/avatar`.
 * Uses raw `fetch` because the body is `FormData`.
 */
async function uploadAdminAvatar(id: number, file: File): Promise<void> {
  const form = new FormData();
  form.append("avatar", file);
  const res = await fetch(`/api/user/${id}/avatar`, { method: "POST", body: form });
  const data = (await res.json()) as { success: boolean; error?: string };
  if (!res.ok || !data.success) throw new Error(data.error ?? "فشل رفع الصورة");
}

/**
 * Fetch active sessions for a user.
 */
async function fetchUserSessions(id: number): Promise<UserSession[]> {
  const res = await apiFetch<UserSession[]>(`/api/user/${id}/sessions`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الجلسات");
  return res.data;
}

/**
 * Fetch recent activity for a user.
 */
async function fetchUserActivity(id: number): Promise<UserActivity[]> {
  const res = await apiFetch<UserActivity[]>(`/api/user/${id}/activity?limit=20`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل النشاط");
  return res.data;
}

/**
 * Fetch aggregated stats for a user.
 */
async function fetchUserStats(id: number): Promise<UserDetailStats> {
  const res = await apiFetch<UserDetailStats>(`/api/user/${id}/stats`);
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الإحصائيات");
  return res.data;
}

/**
 * React Query hook for a user's active sessions. Disabled when `id` is null.
 */
export function useUserSessions(id: number | null) {
  return useQuery({
    queryKey: adminUserKeys.sessions(id ?? 0),
    queryFn: () => fetchUserSessions(id as number),
    enabled: id != null,
  });
}

/**
 * React Query hook for a user's recent activity. Disabled when `id` is null.
 */
export function useUserActivity(id: number | null) {
  return useQuery({
    queryKey: adminUserKeys.activity(id ?? 0),
    queryFn: () => fetchUserActivity(id as number),
    enabled: id != null,
  });
}

/**
 * React Query hook for a user's aggregated stats. Disabled when `id` is null.
 */
export function useUserStats(id: number | null) {
  return useQuery({
    queryKey: adminUserKeys.stats(id ?? 0),
    queryFn: () => fetchUserStats(id as number),
    enabled: id != null,
  });
}

/**
 * React Query hook for paginated admin user list.
 */
export function useAdminUsers(limit = 50, offset = 0) {
  return useQuery({
    queryKey: adminUserKeys.list(limit, offset),
    queryFn: () => fetchAdminUsers(limit, offset),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to create a new user. Invalidates the user list on success.
 */
export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

/**
 * Mutation hook to update a user's profile. Invalidates the user list on success.
 */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminUserUpdate }) => updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

/**
 * Mutation hook to upload a user avatar. Invalidates the user list on success.
 */
export function useUploadAdminAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadAdminAvatar(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a user. Invalidates the user list on success.
 */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

/**
 * Mutation hook to toggle block status. Invalidates the user list on success.
 */
export function useToggleBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, block }: { id: number; block: boolean }) => toggleBlockUser(id, block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

/**
 * Mutation hook to toggle admin status. Invalidates the user list on success.
 */
export function useToggleAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, makeAdmin }: { id: number; makeAdmin: boolean }) =>
      toggleAdminUser(id, makeAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}
