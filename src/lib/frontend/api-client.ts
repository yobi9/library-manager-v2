import type { ApiResponse } from "./api";

const BASE_URL = "/api";

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const searchParams = params ? new URLSearchParams(params) : null;
  const fullUrl = searchParams ? `${BASE_URL}${url}?${searchParams}` : `${BASE_URL}${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }

  return json.data as T;
}

export const apiClient = {
  get: <T>(url: string, params?: Record<string, string>) =>
    request<T>("GET", url, undefined, params),
  post: <T>(url: string, body?: unknown) =>
    request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) =>
    request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) =>
    request<T>("PATCH", url, body),
  delete: <T>(url: string) =>
    request<T>("DELETE", url),
};
