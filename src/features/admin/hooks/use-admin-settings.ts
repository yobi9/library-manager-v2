import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPut } from "@/lib/frontend/api";
import type { AdminSettings } from "@/shared/types/settings";

/**
 * Fetch all admin settings.
 *
 * @returns Record of all settings key/value pairs.
 */
async function fetchSettings(): Promise<AdminSettings> {
  const res = await apiFetch<AdminSettings>("/api/settings/all");
  if (!res.success || !res.data) throw new Error(res.error ?? "فشل تحميل الإعدادات");
  return res.data;
}

/**
 * Update admin settings. Sends the full settings object.
 *
 * @param data - Key/value map of settings to update.
 */
async function updateSettings(data: Record<string, unknown>): Promise<void> {
  const res = await apiPut("/api/settings", data);
  if (!res.success) throw new Error(res.error ?? "فشل تحديث الإعدادات");
}

export const adminSettingsKeys = {
  all: ["admin", "settings"] as const,
  public: ["settings", "public"] as const,
};

/**
 * React Query hook to fetch all admin settings.
 */
export function useAdminSettings() {
  return useQuery({
    queryKey: adminSettingsKeys.all,
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
}

/**
 * Mutation hook to update settings with an optimistic cache update.
 *
 * Upon mutation start the partial payload is merged into the admin settings
 * cache immediately (so toggles flip without waiting for the server), then the
 * cache is invalidated and refetched so the UI always reflects server truth.
 * On error the previous cache snapshot is restored before refetching.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: adminSettingsKeys.all });
      const previous = queryClient.getQueryData<AdminSettings>(adminSettingsKeys.all);
      queryClient.setQueryData<AdminSettings>(adminSettingsKeys.all, (old) => ({
        ...(old ?? {}),
        ...data,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminSettingsKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.all });
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.public });
    },
  });
}
