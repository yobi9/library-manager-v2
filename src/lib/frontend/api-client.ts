/**
 * عميل HTTP الموحّد للواجهة — الملف الوحيد المسموح به لطلبات الشبكة.
 *
 * دُمج فيه العميلان القديمان (`api.ts` للمشرف و `api-client.ts` للمتصفح) في
 * كيان واحد (المرحلة 1 — توحيد عميل HTTP):
 * - `apiFetch` وعائلتها تعيد **كائن `ApiResponse` كاملاً** (يقرأ المتصل
 *   `.data`/`.success`/`.error`) وترمي `ApiError` عند استجابة HTTP غير ناجحة
 *   فقط — هذا هو العقد المعتمد من كل هوكات الإدارة (17 ملفاً تفحص `.success`
 *   يدوياً بعد الاستدعاء).
 * - `apiClient` طبقة رقيقة تستقبل مساراً نسبياً (تُضيف `/api` تلقائياً)،
 *   تعيد **البيانات المفكوكة `.data` مباشرة**، وترمي خطأً عند فشل HTTP أو
 *   `success: false` — العقد المعتمد من صفحات المتصفح (4 ملفات).
 *
 * يشترك الكيانان في: إرسال الاعتماديات (`credentials: "include"`)، ودعم
 * `FormData` تلقائياً (يُستثنى `Content-Type: application/json` عند وجوده)،
 * ورمي `ApiError` على أخطاء HTTP.
 *
 * الباريل `index.ts` يعيد التصدير من هذا الملف؛ الملف القديم `api.ts` محذوف.
 */

/** الاستجابة المعيارية من كل واجهات الخادم (عبر `toNextResponse`). */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** استجابة مقسّمة (ترقيم صفحات) تمتد فوق `ApiResponse` بصفوف من النوع `T`. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * خطأ شبكة يحمل رمز حالة HTTP للتمييز بين الأخطاء برمجياً.
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * تنفيذ طلب fetch موحّد لكل عائلة `apiFetch`.
 *
 * @param url - مسار الطلب المطلق (يبدأ بـ `/api/...`).
 * @param options - خيارات `RequestInit`؛ عند `body` من نوع `FormData` يُستثنى
 *   رأس `Content-Type` تلقائياً، ويُرسل `credentials: "include"` دائماً.
 * @returns كائن `ApiResponse` كاملاً بعد فكّ JSON.
 * @throws {@link ApiError} عندما تكون استجابة HTTP غير ناجحة، برسالة من
 *   حقل `error` أو «حدث خطأ» افتراضياً.
 */
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options?.headers as Record<string, string> | undefined),
  };
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? "حدث خطأ");
  }

  return data;
}

/**
 * طلب GET عبر عميل `apiFetch` الموحّد.
 *
 * @param url - المسار المطلق (يبدأ بـ `/api/...`).
 * @returns كائن `ApiResponse` كاملاً.
 */
export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "GET" });
}

/**
 * طلب POST عبر عميل `apiFetch` الموحّد — يدعم `FormData` و JSON.
 *
 * @param url - المسار المطلق (يبدأ بـ `/api/...`).
 * @param body - حمولة JSON أو `FormData` (ترسل كما هي عند وجودها).
 * @returns كائن `ApiResponse` كاملاً.
 */
export async function apiPost<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "POST",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

/**
 * طلب PUT عبر عميل `apiFetch` الموحّد — يدعم `FormData` و JSON.
 *
 * @param url - المسار المطلق (يبدأ بـ `/api/...`).
 * @param body - حمولة JSON أو `FormData` (ترسل كما هي عند وجودها).
 * @returns كائن `ApiResponse` كاملاً.
 */
export async function apiPut<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "PUT",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

/**
 * طلب PATCH عبر عميل `apiFetch` الموحّد — يدعم `FormData` و JSON.
 *
 * @param url - المسار المطلق (يبدأ بـ `/api/...`).
 * @param body - حمولة JSON أو `FormData` (ترسل كما هي عند وجودها).
 * @returns كائن `ApiResponse` كاملاً.
 */
export async function apiPatch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "PATCH",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

/**
 * طلب DELETE عبر عميل `apiFetch` الموحّد.
 *
 * @param url - المسار المطلق (يبدأ بـ `/api/...`).
 * @returns كائن `ApiResponse` كاملاً.
 */
export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "DELETE" });
}

const BASE_URL = "/api";

/**
 * طلب داخلي لعميل `apiClient` — يعيد البيانات المفكوكة ويطرح خطأً عند الفشل.
 *
 * @param method - طريقة HTTP (GET/POST/PUT/PATCH/DELETE).
 * @param url - مسار نسبي يُضاف إليه `/api` تلقائياً.
 * @param body - حمولة JSON أو `FormData`.
 * @param params - معاملات استعلام تُضاف إلى عنوان الطلب.
 * @returns الحمولة المفكوكة `.data` من النوع `T`.
 * @throws {@link ApiError} عند فشل HTTP، أو `Error` عند `success: false`.
 */
async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const searchParams = params ? new URLSearchParams(params) : null;
  const fullUrl = searchParams ? `${BASE_URL}${url}?${searchParams}` : `${BASE_URL}${url}`;
  const data = await apiFetch<T>(fullUrl, {
    method,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!data.success) {
    throw new Error(data.error ?? `Request failed: ${fullUrl}`);
  }

  return data.data as T;
}

/**
 * عميل المتصفح — مسارات نسبية مع بيانات مفكوكة.
 *
 * مثال: `apiClient.get<MediaItem[]>("/media/filter", { type: "movie" })`.
 */
export const apiClient = {
  get: <T>(url: string, params?: Record<string, string>) =>
    request<T>("GET", url, undefined, params),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};
