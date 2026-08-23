import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/frontend/api-client";
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
 * يزيل ملف الصورة الخام من مدخلات التحويل قبل دمجها في ذاكرة React Query.
 *
 * - السبب: حقول `Library` تقبل مسار صورة كسلسلة فقط، وكائن `File` لا يمثل
 *   مساراً صالحاً للعرض؛ لذا يُستثنى الملف من التحديث المتفائل ويُعتمد على
 *   إعادة الجلب بعد نجاح الطلب (`onSettled`) لإظهار الصورة الفعلية.
 *
 * @param variables - مدخلات إنشاء/تحديث المكتبة كما وردت من النموذج.
 * @returns رقعة قابلة للدمج مع `Library` (الصورة سلسلة أو غائبة).
 */
function toOptimisticPatch(
  variables: LibraryMutationInput,
): Omit<Partial<Library>, "image"> & { image?: string } {
  const { image, ...rest } = variables;
  if (typeof image === "string") return { ...rest, image };
  return rest;
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
 * @returns The created Library object from the server.
 */
async function createLibrary(data: LibraryMutationInput): Promise<Library> {
  const res = await apiPost<Library>("/api/libraries", buildLibraryBody(data));
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل إنشاء المكتبة");
  return res.data;
}

/**
 * Update an existing library.
 *
 * @param data - Object with `id` and fields to update.
 * @returns The updated Library object from the server.
 */
async function updateLibrary(data: { id: number } & LibraryMutationInput): Promise<Library> {
  const { id, ...updates } = data;
  const res = await apiPatch<Library>(`/api/libraries/${id}`, buildLibraryBody(updates));
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحديث المكتبة");
  return res.data;
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
    refetchOnMount: false,
  });
}

/**
 * Mutation hook to create a library with optimistic update.
 * The new library appears instantly in the list before server confirmation.
 */
export function useCreateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLibrary,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: adminLibrariesKeys.all });
      const previous = queryClient.getQueryData<Library[]>(adminLibrariesKeys.all);
      queryClient.setQueryData<Library[]>(adminLibrariesKeys.all, (old) => {
        if (!old) return old;
        const optimistic: Library = {
          id: 0,
          library_id: 0,
          name: variables.name ?? "",
          type: variables.type ?? "movie",
          parent_id: variables.parent_id ?? null,
          is_container: variables.type === "container",
          media_count: 0,
          ...toOptimisticPatch(variables),
        };
        return [...old, optimistic];
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminLibrariesKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to update a library with optimistic update.
 * The library fields update instantly before server confirmation.
 */
export function useUpdateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLibrary,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: adminLibrariesKeys.all });
      const previous = queryClient.getQueryData<Library[]>(adminLibrariesKeys.all);
      queryClient.setQueryData<Library[]>(adminLibrariesKeys.all, (old) => {
        if (!old) return old;
        return old.map((lib) =>
          lib.library_id === variables.id ? { ...lib, ...toOptimisticPatch(variables) } : lib,
        );
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminLibrariesKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to delete a library with optimistic update.
 * The library disappears instantly from the list before server confirmation.
 */
export function useDeleteLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLibrary,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: adminLibrariesKeys.all });
      const previous = queryClient.getQueryData<Library[]>(adminLibrariesKeys.all);
      queryClient.setQueryData<Library[]>(adminLibrariesKeys.all, (old) => {
        if (!old) return old;
        return old.filter((lib) => lib.library_id !== variables);
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminLibrariesKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminLibrariesKeys.all });
    },
  });
}

/**
 * Mutation hook to toggle the pinned state of a library with optimistic update.
 * The pin state updates instantly before server confirmation.
 */
export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: number; is_pinned: boolean }) =>
      apiPatch(`/api/libraries/${params.id}`, { is_pinned: params.is_pinned }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: adminLibrariesKeys.all });
      const previous = queryClient.getQueryData<Library[]>(adminLibrariesKeys.all);
      queryClient.setQueryData<Library[]>(adminLibrariesKeys.all, (old) => {
        if (!old) return old;
        return old.map((lib) =>
          lib.library_id === variables.id
            ? { ...lib, is_pinned: variables.is_pinned }
            : lib,
        );
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminLibrariesKeys.all, context.previous);
      }
    },
    onSettled: () => {
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
