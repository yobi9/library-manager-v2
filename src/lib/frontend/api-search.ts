import { apiClient } from "@/lib/frontend/api-client";

/**
 * عنصر نتيجة من نقطة البحث الفوري (`/api/search/live`).
 *
 * - المصدر الموثوق: `SearchService.liveSearch()` في الخلفية
 *   (`src/backend/services/search-service.ts`) الذي يردّ مصفوفة من هذه البنية
 *   المختصرة لعرض القائمة المنسدلة.
 * - النطاق: حقول العرض فقط (المعرف، العنوان، النوع، السنة، رابط الصورة) دون
 *   تفاصيل إضافية لتقليل حجم الاستجابة أثناء الكتابة.
 */
export interface LiveSearchResult {
  id: number;
  title: string;
  type: string;
  year?: number | null;
  imageUrl: string;
}

/**
 * عنصر نتيجة من نقطة البحث المفهرس (`/api/search`).
 *
 * - المصدر الموثوق: `SearchService.searchMedia()` في الخلفية الذي يردّ النتائج
 *   مع الحقول المزخرفة (معرف بديل، رابط صورة، الأنواع كمصفوفة).
 * - النطاق: كل حقول العرض اللازمة لبطاقة/قائمة نتائج الصفحة الكاملة.
 */
export interface SearchResultItem {
  media_id: number;
  id: number;
  title: string;
  original_title?: string;
  type?: string;
  year?: number;
  imageUrl: string;
  genres?: string[];
  certification?: string;
  overview?: string;
  library_name?: string;
  library_type?: string;
}

/** بنية استجابة `/api/search` (المفهرسة) مع بيانات الترقيم والاقتراحات. */
export interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResultItem[];
  suggestions: string[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/** بارامترات نقطة البحث المفهرس المقبولة من الواجهة. */
export interface SearchParams {
  q: string;
  type?: string;
  libraryId?: number;
  year?: number;
  page?: number;
  limit?: number;
}

/**
 * يجلب نتائج البحث الفوري (autocomplete) من `/api/search/live`.
 *
 * - السلوك: عند استعلام فارغ ترجع مصفوفة فارغة دون طلب شبكة.
 * - الحواف: تتسامح مع الاستجابات المغلّفة `{ data: [...] }` والصفيف المباشر
 *   للحفاظ على التوافق مع أشكال الاستجابة المختلفة.
 *
 * @param query - نص البحث الخام من المستخدم (يُقصّ الفراغات).
 * @param limit - أقصى عدد نتائج (افتراضي 8).
 * @returns مصفوفة نتائج البحث الفوري، أو مصفوفة فارغة عند غياب الاستعلام.
 */
export async function fetchLiveSearch(query: string, limit = 8): Promise<LiveSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const params: Record<string, string> = { q: normalized, limit: String(limit) };
  const result = await apiClient.get<LiveSearchResult[] | { data: LiveSearchResult[] }>(
    "/search/live",
    params,
  );

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result && Array.isArray(result.data)) {
    return result.data;
  }
  return [];
}

/**
 * يجلب نتائج البحث المفهرس مع الترقيم والاقتراحات من `/api/search`.
 *
 * @param params - كائن يحتوي `q` (إلزامي) ومرشحات اختيارية (النوع، المكتبة،
 *                 السنة، الصفحة، حد النتائج).
 * @returns استجابة البحث الكاملة مع النتائج والاقتراحات وبيانات الترقيم.
 */
export async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const queryParams: Record<string, string> = { q: params.q };
  if (params.type) queryParams.type = params.type;
  if (params.libraryId) queryParams.libraryId = String(params.libraryId);
  if (params.year) queryParams.year = String(params.year);
  if (params.page) queryParams.page = String(params.page);
  if (params.limit) queryParams.limit = String(params.limit);

  const result = await apiClient.get<SearchResponse | { data: SearchResponse }>(
    "/search",
    queryParams,
  );

  if (result && typeof result === "object" && "results" in result) {
    return result as SearchResponse;
  }
  if (result && typeof result === "object" && "data" in result) {
    return (result as { data: SearchResponse }).data;
  }
  return {
    success: false,
    query: params.q,
    results: [],
    suggestions: [],
    pagination: { total: 0, page: params.page ?? 1, limit: params.limit ?? 20, hasMore: false },
  };
}
