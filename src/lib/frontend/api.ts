export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options?.headers as Record<string, string> | undefined),
  };
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? "حدث خطأ");
  }

  return data;
}

export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "GET" });
}

export async function apiPost<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "POST",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "PUT",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "PATCH",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "DELETE" });
}
