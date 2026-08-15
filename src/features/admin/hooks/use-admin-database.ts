import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, type ApiResponse } from "@/lib/frontend/api";

export interface DatabaseStats {
  size?: number;
  sizeFormatted?: string;
  tableCount?: number;
  lastOptimized?: string | null;
  lastBackup?: string | null;
  [key: string]: unknown;
}

/**
 * A backup file entry returned by `GET /api/database/backups`.
 */
export interface BackupFileInfo {
  name: string;
  size: string;
  timeLabel: string;
  mtime: number;
}

/**
 * Fetch database statistics.
 *
 * @returns DatabaseStats object with size, table count, and timestamps.
 */
async function fetchDatabaseStats(): Promise<DatabaseStats> {
  const res = await apiFetch<DatabaseStats>("/api/database");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل إحصائيات قاعدة البيانات");
  return res.data;
}

/**
 * Optimize the database (VACUUM / reindex).
 */
async function optimizeDatabase(): Promise<void> {
  const res = await apiPost("/api/database/optimize");
  if (!res.success) throw new Error(res.error ?? "فشل تحسين قاعدة البيانات");
}

/**
 * Create a database backup.
 *
 * يُنشئ النسخة في مجلد `data/backups` على الخادم باسم يحمل الطابع الزمني
 * ويُبقيها هناك — الملف يظهر بعدها في قائمة النسخ المحلية بزر تنزيل، ولا
 * يُنشأ أي ملف جديد عند النقر على زر التنزيل (الزر يقرأ الملف الموجود فقط).
 */
async function backupDatabase(): Promise<void> {
  const res = await apiPost("/api/database/backup");
  if (!res.success) throw new Error(res.error ?? "فشل إنشاء نسخة احتياطية");
}

/**
 * Fetch the list of local backup files (newest first).
 *
 * @returns Backup file entries from the server.
 */
async function fetchBackups(): Promise<BackupFileInfo[]> {
  const res = await apiFetch<{ backups: BackupFileInfo[] }>("/api/database/backups");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل النسخ الاحتياطية");
  return res.data.backups ?? [];
}

/**
 * Restore the database from an uploaded backup file (multipart form data).
 *
 * @param file - The `.db` backup file selected by the admin.
 */
async function restoreDatabaseBackup(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("backup", file);
  const res = await fetch("/api/database/restore", { method: "POST", body: formData });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) throw new Error(json.error ?? "فشل استعادة النسخة الاحتياطية");
}

/**
 * Reset all user data (factory reset).
 */
async function resetDatabaseFactory(): Promise<void> {
  const res = await apiPost("/api/database/factory-reset");
  if (!res.success) throw new Error(res.error ?? "فشل تصفير البيانات");
}

export const adminDatabaseKeys = {
  all: ["admin", "database"] as const,
  backups: ["admin", "database", "backups"] as const,
};

/**
 * React Query hook to fetch database stats.
 */
export function useAdminDatabaseStats() {
  return useQuery({
    queryKey: adminDatabaseKeys.all,
    queryFn: fetchDatabaseStats,
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to optimize the database. Invalidates the database cache on success.
 */
export function useOptimizeDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: optimizeDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDatabaseKeys.all });
    },
  });
}

/**
 * Mutation hook to create a database backup. Invalidates the backups list so
 * the newly created file appears immediately — الإنشاء يُحفظ في `data/backups`
 * ولا يُنزَّل هنا؛ زر التنزيل يقرأ الملف الموجود عبر نهاية التنزيل.
 */
export function useBackupDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: backupDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDatabaseKeys.backups });
    },
  });
}

/**
 * React Query hook to fetch the local backups list.
 *
 * يُحدَّث تلقائياً كل 30 ثانية (حتى مع تبويب خلفي) كي تظهر نسخة الجدولة
 * التلقائية في القائمة دون إعادة تحميل الصفحة يدوياً.
 */
export function useBackupsList() {
  return useQuery({
    queryKey: adminDatabaseKeys.backups,
    queryFn: fetchBackups,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

/**
 * Mutation hook to restore the database from an uploaded backup file.
 * Invalidates the backups list on success.
 */
export function useRestoreDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreDatabaseBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDatabaseKeys.backups });
    },
  });
}

/**
 * Mutation hook to perform a factory reset (truncate all user data).
 */
export function useFactoryReset() {
  return useMutation({
    mutationFn: resetDatabaseFactory,
  });
}
