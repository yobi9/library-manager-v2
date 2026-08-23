import { apiClient } from "@/lib/frontend/api-client";
import type { PublicSettings, ExclusiveSettingItem } from "@/shared/types/settings";

// ============= CORE MEDIA TYPE =============
// Matches MediaApiDTO from backend (src/shared/types/media-api.ts)
// Dual field names: backend sends both snake_case and camelCase
export interface MediaItem {
  voteCount: any;
  media_id: number;
  id?: number;
  title: string;
  display_title?: string;
  name?: string;
  type: string;
  year?: number;
  imdb_rating?: number | string;
  imdb_votes?: number | string;
  rating?: number;
  views?: number;
  genres?: string | Array<{ id?: number; name?: string } | string>;
  genre_names?: unknown;
  overview?: string;
  cast?: Array<{
    character?: string;
    person_id?: number | string;
    name?: string;
    display_name?: string;
    profile_path?: string;
    role?: string;
    department?: string;
    order?: number;
  }>;
  directors?: unknown[];
  writers?: unknown[];
  tags?: unknown[];
  certification?: string;
  age_rating?: string;
  content_rating?: string;
  is_pinned?: boolean;
  pined?: boolean;
  has_children?: boolean;
  seasons_count?: number;
  seasonsCount?: number;
  episodes_count?: number;
  episodesCount?: number;
  season_number?: number;
  episode_number?: number;
  trailer_url?: string | null;
  created_at?: string;
  createdAt?: string;
  library_id?: number | string;
  libraryId?: number | string;
  library_name?: string;
  folder_path?: string | null;
  parent_media_id?: number | string;
  parent_id?: number | string;
  children?: MediaItem[];
  runtime?: number;
  duration?: number;
  release_date?: string;
  first_air_date?: string;
  tag_names?: string[];
  tmdb_id?: number;
  country?: string;
  language?: string;
  crew?: Array<{
    character?: string;
    person_id?: number | string;
    name?: string;
    display_name?: string;
    profile_path?: string;
    role?: string;
    department?: string;
    order?: number;
  }>;
  production_companies?: string | unknown[];
  poster_path?: string;
  backdrop_path?: string;
}

// ============= LIBRARY TYPE =============
// Matches Library from backend (src/shared/types/library.ts)
export interface Library {
  id: number;
  library_id: number;
  name: string;
  type: string;
  parent_id?: number | string | null;
  parentId?: number | string | null;
  linked_library_id?: number | string | null;
  linkedLibraryId?: number | string | null;
  is_linked?: boolean;
  isLinked?: boolean;
  image?: string;
  image_path?: string;
  media_count?: number;
  children_count?: number;
  views_count?: number;
  size?: string;
  hideSection?: boolean;
  hide_section?: boolean;
  is_pinned?: boolean;
  isContainer?: boolean;
  is_container?: boolean;
  paths?: string[];
  status?: string;
  description?: string;
  last_scanned?: string;
  scan_status?: string;
  scan_progress?: number;
  language?: string | null;
  country?: string | null;
  created_at?: string | null;
}

// ============= PERSON TYPE =============
// Matches PersonApiDTO from backend
export interface Person {
  id?: string | number;
  person_id?: number | string;
  name?: string;
  display_name?: string;
  biography?: string;
  birthday?: string;
  birth_date?: string;
  deathday?: string;
  death_date?: string;
  birthplace?: string;
  birth_place?: string;
  profile_path?: string;
  photo?: string;
  known_for_department?: string;
  character?: string;
  role?: string;
  popularity?: number;
  order?: number;
  media_count?: number;
}

// ============= MEDIA FILTER =============
export interface MediaFilterParams {
  year?: number;
  genre?: string;
  certification?: string;
  minRating?: number;
  /** If true, only root items (parent_media_id IS NULL) are returned. */
  rootOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface MediaFilterResponse {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
  hasMore?: boolean;
}

// ============= LIBRARY MEDIA =============

/**
 * معاملات قائمة وسائط المكتبة. الترقيم بوضعين: `offset` (توافق قديم) أو
 * `cursor` (keyset — المفضل للتمرير اللانهائي، محصّن ضد الإدراج المتزامن).
 * لا يُرسل الوضعان معاً؛ وجود cursor يلغي أثر offset في الخادم.
 */
export interface LibraryMediaParams {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  rootOnly?: string;
  year?: string;
  search?: string;
  genre?: string;
  certification?: string;
  /** رمز ترقيم keyset معتم أعادته الصفحة السابقة في pagination.nextCursor. */
  cursor?: string;
}

/**
 * استجابة قائمة وسائط المكتبة. حقول `items/media/data` و`total/hasMore`
 * العلوية توافق دفاعي مع أشكال تاريخية؛ الشكل الفعلي من الخادم هو
 * `pagination` + `items`. في وضع المؤشر يأتي `nextCursor` (نص لصفحة تالية،
 * null عند النهاية) ويغيب `offset`؛ وفي وضع OFFSET يأتي `offset` ويغيب `nextCursor`.
 */
export interface LibraryMediaResponse {
  items?: MediaItem[];
  media?: MediaItem[];
  data?: MediaItem[];
  total?: number;
  hasMore?: boolean;
  pagination?: {
    total: number;
    hasMore: boolean;
    limit?: number;
    offset?: number;
    nextCursor?: string | null;
  };
}

// ============= SECTIONS =============
export interface SectionsResponse {
  libraries?: Library[];
  data?: Library[];
}

// ============= GENRE =============
export interface GenreItem {
  name: string;
  count: number;
}

// ============= CERTIFICATION =============
export interface CertificationItem {
  name: string;
  count: number;
}

// ============= RATING BUCKET =============
export interface RatingBucket {
  value: number;
  count: number;
}

// ============= CHANNEL =============
export interface Channel {
  id: string | number;
  name: string;
  logo?: string;
  stream_url?: string;
  url?: string;
  is_live?: boolean;
  category?: string;
}

// ============= PUBLIC SETTINGS =============
export type { PublicSettings, ExclusiveSettingItem };

// ============= API FUNCTIONS =============

export async function fetchMediaByFilter(params: MediaFilterParams): Promise<MediaFilterResponse> {
  const searchParams: Record<string, string> = {
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 30),
  };
  if (params.year) searchParams.year = String(params.year);
  if (params.genre) searchParams.genre = params.genre;
  if (params.certification) searchParams.certification = params.certification;
  if (params.minRating) searchParams.minRating = String(params.minRating);
  if (params.rootOnly !== undefined) searchParams.rootOnly = String(params.rootOnly);

  return apiClient.get<MediaFilterResponse>("/media/filter", searchParams);
}

export async function fetchAvailableYears(libraryId?: number): Promise<number[]> {
  const params: Record<string, string> = {};
  if (libraryId) params.libraryId = String(libraryId);

  const result = await apiClient.get<number[] | { years: number[] }>("/search/years", params);

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "years" in result) return result.years;
  return [];
}

export async function fetchLibraries(): Promise<Library[]> {
  const result = await apiClient.get<SectionsResponse | Library[]>("/libraries");

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    if ("libraries" in result && Array.isArray(result.libraries)) return result.libraries;
    if ("data" in result && Array.isArray(result.data)) return result.data;
  }
  return [];
}

/**
 * يجلب قائمة وسائط مكتبة عبر `GET /api/libraries/:id/media` بدعم وضعَي
 * ترقيم متبادلَين وفق عقد `LibraryMediaParams`:
 *
 * - وضع المؤشر (keyset): عند وجود `cursor` يُرسَل وحده **دون** `offset`،
 *   ويعيد الخادم `pagination.nextCursor` لطلب الصفحة التالية.
 * - وضع OFFSET (توافق قديم): عند غياب `cursor` يُرسَل `offset`
 *   (افتراضياً 0).
 *
 * @remarks إسقاط `cursor` من معاملات الطلب كان السبب الجذري لتكرار عناصر
 * التمرير اللانهائي: كل طلب صفحة لاحقة كان يصل بلا مؤشر ومع `offset=0`،
 * فيعيد الخادم رأس القائمة من جديد فتتكرر العناصر المعروضة (تحذير React
 * keys المكررة في UnifiedMedia).
 *
 * @param libraryId - معرّف المكتبة الرقمي.
 * @param params - معاملات القائمة: الترقيم (`cursor` أو `offset` —
 *        متبادلان لا يُرسَلان معاً)، حجم الصفحة، الفرز والاتجاه، والفلاتر
 *        الاختيارية (year/search/genre/certification) التي تُرسَل فقط عند
 *        تحديدها.
 * @returns استجابة الخادم الخام: عناصر الوسائط مع `pagination`
 *          ({total, hasMore, nextCursor} في وضع المؤشر أو {total, offset,
 *          hasMore} في وضع OFFSET).
 * @throws {@link ApiError} عند فشل HTTP أو استجابة `success: false`.
 */
export async function fetchLibraryMedia(
  libraryId: number,
  params: LibraryMediaParams,
): Promise<LibraryMediaResponse> {
  const searchParams: Record<string, string> = {
    limit: String(params.limit ?? 24),
    sortBy: params.sortBy ?? "recent",
    sortOrder: params.sortOrder ?? "DESC",
    rootOnly: params.rootOnly ?? "true",
  };
  // وضعا الترقيم متبادلان تعاقدياً: وجود المؤشر يحذف offset والعكس صحيح.
  if (params.cursor) {
    searchParams.cursor = params.cursor;
  } else {
    searchParams.offset = String(params.offset ?? 0);
  }
  if (params.year) searchParams.year = params.year;
  if (params.search) searchParams.search = params.search;
  if (params.genre) searchParams.genre = params.genre;
  if (params.certification) searchParams.certification = params.certification;

  return apiClient.get<LibraryMediaResponse>(`/libraries/${libraryId}/media`, searchParams);
}

export async function fetchLibraryInfo(
  libraryId: number,
): Promise<{ details: Library; genres: string[]; ageRatings: string[] }> {
  const [details, genres, ageRatings] = await Promise.all([
    apiClient.get<Library>(`/libraries/${libraryId}`),
    apiClient.get<string[] | { data: string[] }>(`/libraries/${libraryId}/genres`),
    apiClient.get<string[] | { data: string[]; ratings: string[] }>(
      `/libraries/${libraryId}/age-ratings`,
    ),
  ]);

  const genreList = Array.isArray(genres) ? genres : "data" in genres ? genres.data : [];

  let ratingList: string[] = [];
  if (Array.isArray(ageRatings)) {
    ratingList = ageRatings;
  } else if (ageRatings && typeof ageRatings === "object") {
    const obj = ageRatings as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      ratingList = obj.data;
    } else if (Array.isArray(obj.ratings)) {
      ratingList = obj.ratings;
    }
  }

  return {
    details,
    genres: genreList,
    ageRatings: ratingList,
  };
}

export async function fetchGenres(): Promise<GenreItem[]> {
  const result = await apiClient.get<GenreItem[] | { data: GenreItem[] }>("/media/genres");

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchCertifications(): Promise<CertificationItem[]> {
  const result = await apiClient.get<CertificationItem[] | { data: CertificationItem[] }>(
    "/media/certifications",
  );

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchRatingBuckets(): Promise<RatingBucket[]> {
  const result = await apiClient.get<RatingBucket[] | { data: RatingBucket[] }>("/media/ratings");

  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchPinnedItems(): Promise<MediaItem[]> {
  const result = await apiClient.get<MediaItem[] | { data: MediaItem[] }>("/media/pinned");
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchLatestMedia(type?: string): Promise<MediaItem[]> {
  const url = type ? `/media/latest/${type}` : "/media/latest";
  const result = await apiClient.get<MediaItem[] | { data: MediaItem[] }>(url);
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchMediaTypes(): Promise<string[]> {
  const result = await apiClient.get<string[] | { data: string[] }>("/media/types");
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchMediaById(id: string | number): Promise<MediaItem> {
  return apiClient.get<MediaItem>(`/media/${id}`);
}

export async function fetchRecommendations(
  libraryId: number,
  mediaId: string | number,
  mediaType?: string,
  limit = 20,
): Promise<MediaItem[]> {
  const params: Record<string, string> = { limit: String(limit) };
  if (mediaType) params.type = mediaType;
  const result = await apiClient.get<MediaItem[] | { data: MediaItem[] }>(
    `/media/recommended/${mediaId}/${libraryId}`,
    params,
  );
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchAllPeople(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {},
): Promise<{ items: Person[]; total: number }> {
  const searchParams: Record<string, string> = {};
  if (params.page) searchParams.page = String(params.page);
  if (params.limit) searchParams.limit = String(params.limit);
  if (params.search) searchParams.search = params.search;

  const result = await apiClient.get<{ items: Person[]; total: number } | Person[]>(
    "/media/people",
    searchParams,
  );

  if (Array.isArray(result)) return { items: result, total: result.length };
  return result ?? { items: [], total: 0 };
}

export async function fetchPerson(id: string | number): Promise<Person> {
  return apiClient.get<Person>(`/media/person/${id}`);
}

export async function fetchPersonWorks(id: string | number): Promise<MediaItem[]> {
  const result = await apiClient.get<MediaItem[] | { data: MediaItem[] }>(
    `/media/person/${id}/works`,
  );
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchMediaBatch(ids: (string | number)[]): Promise<MediaItem[]> {
  if (ids.length === 0) return [];
  const params = { ids: ids.join(",") };
  const result = await apiClient.get<MediaItem[] | { data: MediaItem[] }>("/media/batch", params);
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  return apiClient.get<PublicSettings>("/settings");
}

export async function fetchChannels(): Promise<Channel[]> {
  const result = await apiClient.get<Channel[] | { data: Channel[] }>("/live-channels");
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "data" in result) return result.data;
  return [];
}
