import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Current license state exposed by `GET /api/license/status`.
 * Mirrors the old project's `LicenseStatus` contract.
 */
export interface LicenseStatus {
  activated: boolean;
  licenseKey: string | null;
  clientName: string | null;
  expiryDate: string | null;
  features: string[] | null;
  reason: string | null;
  message: string | null;
}

/** Persisted license fields returned after a successful activation. */
export interface LicenseActivationData {
  clientName: string;
  expiryDate: string | null;
  features: string[];
}

/** Raw API envelope for license endpoints. */
interface LicenseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Prefers the Arabic `message` over the English `error` reason code when
 * building a human-readable failure message.
 *
 * @param data - Parsed API error envelope.
 * @returns The display-ready failure message.
 */
function extractError(data: Pick<LicenseEnvelope<unknown>, "error" | "message">): string {
  if (data.message) return data.message;
  return data.error ?? "حدث خطأ";
}

/**
 * Generic fetch for license endpoints. Uses the raw `fetch` (instead of the
 * shared JSON helpers) so activation failures keep both the reason code and
 * the Arabic message, and so multipart file uploads work without a JSON header.
 *
 * @param url - License API path.
 * @param init - Optional fetch options (method, body, headers).
 * @returns The unwrapped `data` payload on success.
 * @throws When the request fails or returns `success: false`.
 */
async function licenseRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as LicenseEnvelope<T>;
  if (!response.ok || !data.success) {
    throw new Error(extractError(data));
  }
  return data.data as T;
}

export const licenseKeys = {
  status: ["admin", "license", "status"] as const,
};

/**
 * React Query hook that loads the current license status for the admin page.
 */
export function useLicenseStatus() {
  return useQuery({
    queryKey: licenseKeys.status,
    queryFn: () => licenseRequest<LicenseStatus>("/api/license/status"),
    staleTime: 60_000,
  });
}

/**
 * Mutation hook that activates a license from pasted `.lic` JSON content.
 * Invalidates the status query on success.
 */
export function useActivateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (licenseData: string) =>
      licenseRequest<LicenseActivationData>("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseData }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: licenseKeys.status });
    },
  });
}

/**
 * Mutation hook that activates a license from an uploaded `.lic` file.
 * Invalidates the status query on success.
 */
export function useActivateLicenseFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("licenseFile", file);
      return licenseRequest<LicenseActivationData>("/api/license/activate-file", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: licenseKeys.status });
    },
  });
}

/**
 * Mutation hook that removes the persisted license and disables activation.
 * Invalidates the status query on success.
 */
export function useDeactivateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      licenseRequest<{ success: boolean }>("/api/license/deactivate", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: licenseKeys.status });
    },
  });
}

/**
 * Mutation hook that reloads the license from disk and re-verifies it.
 * Invalidates the status query on success.
 */
export function useRefreshLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      licenseRequest<{
        activated: boolean;
        clientName: string | null;
        expiryDate: string | null;
        reason: string | null;
      }>("/api/license/refresh", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: licenseKeys.status });
    },
  });
}
