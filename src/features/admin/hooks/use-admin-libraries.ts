import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/frontend/api";
import type { Library } from "@/lib/frontend/api-media";

/**
 * Response shape from scan progress endpoint.
 */
export interface ScanProgress {
  libraryId: number;
  libraryName: string;
  status: "idle" | "scanning" | "paused" | "stopped" | "failed" | "completed";
  currentActivity: string;
  currentRootFolder: string | null;
  currentRootType: string | null;
}

/**
 * نوع بيانات إنشاء/تحديث مكتبة مع دعم ملف صورة مرفوع.
 *
 * - المصدر الموثوق: `LibraryFormValues` في `library-form.tsx` (يحمل `image?: File`).
 * - النطاق: نفس حقول المكتبة المعروفة إضافة إلى `image` الذي قد يكون مساراً
 *   موجوداً (سلسلة) أو ملفاً جديداً يُرفع عبر multipart.
 */
export type LibraryMutationInput = Omit<Partial<Library>, "image"> & {
  image?: File | string;
};

/**
 * يبني جسم الطلب: `FormData` عند وجود ملف صورة (multipart)، وإلا JSON عادي.
 *
 * - السلوك: عند رفع صورة، تُضاف الحقول كسلاسل/JSON مضغوط وملف الصورة تحت
 *   مفتاح `image`؛ عند عدم وجود ملف يُعاد الكائن كما هو ليرسل JSON.
 *
 * @param data - مدخلات إنشاء/تحديث المكتبة.
 * @returns `FormData` عند وجود ملف صورة، أو الكائن الأصلي.
 */
function buildLibraryBody(data: LibraryMutationInput): FormData | LibraryMutationInput {
  const imageFile = data.image instanceof File ? data.image : undefined;
  if (!imageFile) return data;

  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key === "image" || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      form.append(key, JSON.stringify(value));
    } else if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }
  form.append("image", imageFile);
  return form;
}

/**
 * Fetch all libraries from the API.
 *
 * @returns Array of Library objects.
 */
async function fetchLibraries(): Promise<Library[]> {
  const res = await apiFetch<Library[]>("/api/libraries");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل المكتبات");
  return res.data;
}

/**
 * Create a new library.
 *
 * @param data - Library creation payload.
 */
async function createLibrary(data: LibraryMutationInput): Promise<void> {
  const res = await apiPost("/api/libraries", buildLibraryBody(data));
  if (!res.success) throw new Error(res.error ?? "فشل إنشاء المكتبة");
}

/**
 * Update an existing library.
 *
 * @param data - Object with `id` and fields to update.
 */
async function updateLibrary(data: { id: number } & LibraryMutationInput): Promise<void> {
  const { id, ...updates } = data;
  const res = await apiPatch(`/api/libraries/${id}`, buildLibraryBody(updates));
  if (!res.success) throw new Error(res.error ?? "فشل تحديث المكتبة");
}

/**
 * Delete a library by ID.
 *
 * @param id - Library ID to delete.
 */
async function deleteLibrary(id: number): Promise<void> {
  const res = await apiDelete(`/api/libraries/${id}`);
  if (!res.success) throw new Error(res.error ?? "فشل حذف المكتبة");
}

/**
 * Start a scan for a specific library.
 *
 * @param params - Object with library id, deepScan and forceRescan flags.
 */
async function startScan(params: {
  id: number;
  deepScan?: boolean;
  forceRescan?: boolean;
}): Promise<void> {
  const { id, ...body } = params;
  const res = await apiPost(`/api/libraries/${id}/scan`, body);
  if (!res.success) throw new Error(res.error ?? "فشل بدء الفحص");
}

/**
 * Scan all libraries.
 *
 * @param params - Object with deepScan and forceRescan flags.
 */
async function scanAll(params: { deepScan?: boolean; forceRescan?: boolean }): Promise<void> {
  const res = await apiPost("/api/libraries/scan-all", params);
  if (!res.success) throw new Error(res.error ?? "فشل فحص الكل");
}

/**
 * Stop an active scan for a library.
 *
 * @param id - Library ID.
 */
async function stopScan(id: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${id}/scan/stop`, {});
  if (!res.success) throw new Error(res.error ?? "فشل إيقاف الفحص");
}

/**
 * Pause an active scan for a library.
 *
 * @param id - Library ID.
 */
async function pauseScan(id: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${id}/scan/pause`, {});
  if (!res.success) throw new Error(res.error ?? "فشل إيقاف الفحص مؤقتاً");
}

/**
 * Resume a paused scan for a library.
 *
 * @param id - Library ID.
 */
async function resumeScan(id: number): Promise<void> {
  const res = await apiPost(`/api/libraries/${id}/scan/resume`, {});
  if (!res.success) throw new Error(res.error ?? "فشل استئناف الفحص");
}

/**
 * React Query cache key factory for admin libraries and settings.
 * Use these keys to invalidate or optimistically update the cache.
 */
export const adminLibrariesKeys = {
  all: ["admin", "libraries"] as const,
};

/**
 * React Query hook to fetch all libraries.
 */
export function useAdminLibraries() {
  return useQuery({
    queryKey: adminLibrariesKeys.all,
    queryFn: fetchLibraries,
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to create a library. Invalidates the library list on success.
 */
export function useCreateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to update a library. Invalidates the library list on success.
 */
export function useUpdateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a library. Invalidates the library list on success.
 */
export function useDeleteLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to toggle the pinned state of a library.
 * Invalidates the library list on success.
 */
export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: number; is_pinned: boolean }) =>
      apiPatch(`/api/libraries/${params.id}`, { is_pinned: params.is_pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to start a scan for a specific library.
 *
 * @param onSuccess - Optional callback to retrieve the library id that was scanned.
 */
export function useStartScan() {
  return useMutation({
    mutationFn: startScan,
  });
}

/**
 * Mutation hook to scan all libraries.
 */
export function useStartScanAll() {
  return useMutation({
    mutationFn: scanAll,
  });
}

/**
 * Mutation hook to stop an active scan.
 */
export function useStopScan() {
  return useMutation({
    mutationFn: stopScan,
  });
}

/**
 * Mutation hook to pause an active scan.
 */
export function usePauseScan() {
  return useMutation({
    mutationFn: pauseScan,
  });
}

/**
 * Mutation hook to resume a paused scan.
 */
export function useResumeScan() {
  return useMutation({
    mutationFn: resumeScan,
  });
}
