import { SearchRepository } from "../repositories/search-repository";
import { normalizeQuery } from "../utils/search-normalizer";
import { CacheService } from "./cache-service";
import { CachePrefixes } from "./cache-prefixes";

/**
 * TTL (بالثواني) لنتائج البحث والاقتراحات الحية (Phase 5).
 *
 * @remarks البحث يُطلق استعلاماً لكل حرف (debounce 300ms من جهة العميل) —
 *          الكاش 30 ثانية يقلص ضغط FTS5 + الفولباك الصوتي على الاستعلامات
 *          المكررة. يُبطَل فوراً عند أي تغيّر محتوى (تعديل/حذف/إثراء/مسح)
 *          عبر `CacheInvalidator` (بادئة `search`).
 */
const SEARCH_CACHE_TTL_SECONDS = 30;

/**
 * Orchestrates search operations across the application.
 *
 * Provides two search modes:
 *   - `searchMedia()` — paginated full-text search via FTS5 for the main search page.
 *   - `liveSearch()` — lightweight autocomplete via FTS5 for the search dropdown.
 *
 * All user queries are normalized via `normalizeQuery()` before reaching the
 * repository layer, ensuring consistent behavior with the FTS5 tokenizer.
 *
 * @see src/backend/repositories/search-repository.ts — FTS5 query execution
 * @see src/app/api/search/route.ts — paginated search endpoint
 * @see src/app/api/search/live/route.ts — autocomplete endpoint
 */
export class SearchService {
  constructor(
    private searchRepo: SearchRepository,
    private cache: CacheService,
  ) {}

  /**
   * Executes a paginated full-text search across all media items.
   *
   * Returns results ranked by FTS5 BM25 relevance, with metadata filters
   * (type, library, year) applied via JOIN conditions. Also generates
   * title-based suggestions from the first page of results.
   *
   * @param params.q - Raw search query from the user.
   * @param params.type - Optional media type filter.
   * @param params.libraryId - Optional library ID filter.
   * @param params.year - Optional production year filter.
   * @param params.page - Page number (1-indexed, default: 1).
   * @param params.limit - Results per page (default: 20).
   * @returns Search results with pagination metadata and suggestions.
   */
  async searchMedia(params: {
    q?: string;
    type?: string;
    libraryId?: number;
    year?: number;
    page?: number;
    limit?: number;
  }) {
    const { q, type, libraryId, year, page = 1, limit = 20 } = params;
    const normalizedQuery = normalizeQuery(q ?? "");

    if (!normalizedQuery) {
      return {
        success: true,
        query: q ?? "",
        results: [],
        suggestions: [],
        pagination: { total: 0, page, limit, hasMore: false },
      };
    }

    return this.cache.withCache(
      CachePrefixes.search,
      { kind: "search-media", normalizedQuery, type, libraryId, year, page, limit },
      async () => {
        const offset = (page - 1) * limit;

        const { results, total } = await this.searchRepo.searchMediaWithCount({
          normalizedQuery,
          type,
          libraryId,
          year,
          limit,
          offset,
        });

        const suggestions = this.generateSuggestions(results as Record<string, unknown>[]);

        return {
          success: true,
          query: q ?? "",
          results: (results as Record<string, unknown>[]).map((r) => ({
            ...r,
            id: r["media_id"],
            imageUrl: `/api/images/${r["media_id"]}?type=poster&w=300&h=450`,
            genres: typeof r["genres"] === "string"
              ? (r["genres"] as string).split(",").map((g) => g.trim())
              : [],
            certification: r["certification"] ?? "",
          })),
          suggestions,
          pagination: { total, page, limit, hasMore: offset + results.length < total },
        };
      },
      SEARCH_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Rebuilds the entire FTS5 search index from scratch.
   *
   * Delegates to the repository to clear and repopulate all indexed columns,
   * including denormalized genres and cast names. Purges the search cache so
   * subsequent queries reflect the rebuilt index.
   */
  async rebuildIndex() {
    const result = await this.searchRepo.rebuildIndex();
    await this.cache.deleteByPrefix(CachePrefixes.search);
    return result;
  }

  /**
   * Backfills FTS rows that are missing or lack a phonetic key.
   *
   * @remarks Called after every completed scan (composition root) so freshly
   *          scanned items are phonetically searchable without a full rebuild.
   * @returns Number of FTS rows (re)inserted.
   */
  async backfillSearchIndex(): Promise<number> {
    const inserted = await this.searchRepo.backfillMissing();
    await this.cache.deleteByPrefix(CachePrefixes.search);
    return inserted;
  }

  /**
   * Lightweight autocomplete search for the search dropdown.
   *
   * Returns minimal fields (id, title, type, year, imageUrl) with a relevance
   * ranking via FTS5's BM25 algorithm. The `imageUrl` points to the
   * `/api/images` endpoint which resolves through the full image cascade
   * (enriched → poster → parent → default).
   *
   * @param query - Raw search query from the user.
   * @param limit - Maximum results (default: 8).
   * @returns Array of matching items with display fields.
   */
  async liveSearch(query: string, limit = 8) {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return [];

    return this.cache.withCache(
      CachePrefixes.search,
      { type: "live", normalizedQuery, limit },
      async () => {
        const results = await this.searchRepo.searchMedia(normalizedQuery, limit);
        return results.map((r: Record<string, unknown>) => ({
          id: r["media_id"],
          title: r["title"],
          type: r["type"],
          year: r["year"],
          imageUrl: `/api/images/${r["media_id"]}?type=poster&w=300&h=450`,
        }));
      },
      SEARCH_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Returns aggregate statistics for the search module.
   *
   * @returns Object with `totalMedia` (available items) and `totalGenres` (distinct genres).
   */
  async getStats() {
    return this.cache.withCache(
      CachePrefixes.search,
      { type: "stats" },
      () => this.searchRepo.getStats(),
      SEARCH_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Generates title-based suggestions from search results.
   *
   * Extracts unique titles from the first 8 results to populate the
   * suggestions dropdown in the search UI.
   *
   * @param results - Array of search result objects.
   * @returns Array of unique title strings (max 8).
   */
  private generateSuggestions(results: Record<string, unknown>[]): string[] {
    const suggestions: string[] = [];
    const seen = new Set<string>();
    for (const item of results) {
      if (suggestions.length >= 8) break;
      const title = item["title"] as string;
      if (title && !seen.has(title)) {
        seen.add(title);
        suggestions.push(title);
      }
    }
    return suggestions;
  }
}
