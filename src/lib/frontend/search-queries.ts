import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchLiveSearch, fetchSearch } from "./api-search";
import type { LiveSearchResult, SearchResponse } from "./api-search";

/** مفاتيح كاش React Query لخدمة البحث (لمنع الالتباس مع مفاتيح الوسائط). */
export const searchKeys = {
  live: (query: string) => ["search", "live", query] as const,
  search: (params: Record<string, unknown>) => ["search", "page", params] as const,
};

/**
 * Hook بحث فوري مع debounce مدمج لخدمة البحث المنسدلة.
 *
 * - السلوك: يؤخر الطلب 300ms بعد آخر حرف (مطابقة لتجربة البحث الفوري في
 *   المشروع القديم)، ويفعّل الطلب فقط عندما يبلغ طول الاستعلام حرفين فأكثر
 *   (متوافق مع حد البحث الفوري في الخلفية).
 * - التخزين المؤقت: `staleTime` لمدة 30 ثانية + `keepPreviousData` لعرض
 *   النتائج السابقة أثناء التحميل (تجنب وميض فارغ عند كل حرف).
 *
 * @param rawQuery - نص البحث الخام من الحقل (قبل debounce).
 * @returns كائن `useQuery` مع النتائج وحالة التحميل والخطأ.
 */
export function useLiveSearch(rawQuery: string) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => clearTimeout(handler);
  }, [rawQuery]);

  return useQuery<LiveSearchResult[]>({
    queryKey: searchKeys.live(query),
    queryFn: () => fetchLiveSearch(query, 8),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook البحث المفهرس الكامل (مع الترقيم والاقتراحات) من صفحة النتائج.
 *
 * @param params - بارامترات البحث (نص إلزامي + مرشحات اختيارية).
 * @returns كائن `useQuery` مع `SearchResponse`، معطّل عندما يكون النص فارغاً.
 */
export function useSearch(params: {
  q: string;
  type?: string;
  libraryId?: number;
  year?: number;
  page?: number;
  limit?: number;
}) {
  const query = params.q.trim();
  return useQuery<SearchResponse>({
    queryKey: searchKeys.search(params as Record<string, unknown>),
    queryFn: () => fetchSearch(params),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
