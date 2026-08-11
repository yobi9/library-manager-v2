import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";
import { getArabicPhoneticKey } from "../utils/search-normalizer";

/** حجم الدفعة عند إعادة بناء فهرس FTS5 (كل دفعة داخل معاملة مستقلة). */
const INDEX_BATCH_SIZE = 100;

/**
 * Repository for the FTS5 `media_search` virtual table.
 *
 * Provides two complementary search paths:
 *   - `searchMedia()` — lightweight FTS5 MATCH used by the autocomplete/live-search endpoint.
 *   - `searchMediaWithCount()` — paginated FTS5 MATCH with JOIN filters used by the main search endpoint.
 *
 * The FTS5 tokenizer (`unicode61 remove_diacritics 1`) handles Arabic diacritics,
 * Unicode normalization, and tokenization. Queries are pre-normalized by
 * `SearchService.normalizeQuery()` before reaching this layer.
 *
 * Index maintenance methods (`addToIndex`, `removeFromIndex`, `rebuildIndex`)
 * keep the FTS index in sync with `media_items` changes.
 *
 * @see src/backend/services/search-service.ts — query normalization and orchestration
 * @see src/backend/db/migrations/001_initial_schema.sql — FTS5 table DDL and triggers
 */
export class SearchRepository extends BaseRepository {
  constructor() {
    super("media_search");
  }

  /**
   * Lightweight FTS5 search for the autocomplete / live-search endpoint.
   *
   * Returns minimal fields needed for the dropdown (id, title, type, year, poster_path).
   * Results are ranked by BM25 relevance via FTS5's built-in `rank` column.
   *
   * @param query - Pre-normalized search query (passed to FTS5 MATCH).
   * @param limit - Maximum results to return.
   * @returns Array of matching media items with display fields.
   */
  async searchMedia(query: string, limit = 20) {
    const db = await getDatabase();
    const primary = (await db.all(
      `SELECT ms.*, m.title, m.type, m.year,   m.imdb_rating
       FROM media_search ms
       JOIN media_items m ON ms.media_id = m.media_id
       WHERE media_search MATCH ? AND m.is_available = 1
          AND m.type NOT IN ('season', 'episode')     -- استبعاد الموسم/الحلقة من نطاق البحث (طبقة دفاع إضافية)
       ORDER BY rank
       LIMIT ?`,
      [query, limit],
    )) as Record<string, unknown>[];

    // فولباك صوتي: عندما تقل النتائج عن 3 والاستعلام ≥ 3 أحرف.
    if (primary.length >= 3 || query.length < 3) return primary;

    const phoneticKey = getArabicPhoneticKey(query);
    if (!phoneticKey) return primary;

    const fallback = (await db.all(
      `SELECT ms.*, m.title, m.type, m.year, m.imdb_rating
       FROM media_search ms
       JOIN media_items m ON ms.media_id = m.media_id
       WHERE media_search MATCH ? AND m.is_available = 1
          AND m.type NOT IN ('season', 'episode')        -- نفس الاستبعاد للفولباك الصوتي  -- استبعاد الموسم/الحلقة من نطاق البحث (طبقة دفاع إضافية)
       ORDER BY rank * 0.9
       LIMIT ?`,
      [`phonetic_key : ${phoneticKey}*`, limit],
    )) as Record<string, unknown>[];

    return this.dedupeAppend(primary, fallback, limit);
  }

  /**
   * Rebuilds the entire FTS5 index from scratch.
   *
   * Clears all existing entries and re-inserts from `media_items`, including
   * denormalized `genres` (from `media_genres`) and `cast_names` (from `media_people`)
   * to enable full-text search across genres and cast.
   *
   * Skips items that are soft-deleted or unavailable, and excludes seasons/episodes
   * (consistent with the auto-insert trigger).
   */
  async rebuildIndex() {
    const db = await getDatabase();

    const rows = (await db.all(`
      SELECT
        m.media_id,
        COALESCE(m.title, '') AS title,
        COALESCE(m.original_title, '') AS original_title,
        COALESCE(m.overview, '') AS overview,
        COALESCE(m.created_at, datetime('now')) AS created_at,
        COALESCE((
          SELECT GROUP_CONCAT(mg.genre) FROM media_genres mg WHERE mg.media_id = m.media_id
        ), '') AS genres,
        COALESCE((
          SELECT GROUP_CONCAT(mp.name) FROM media_people mp WHERE mp.media_id = m.media_id
        ), '') AS cast_names
      FROM media_items m
      WHERE m.is_available = 1
        AND m.deleted_at IS NULL
        AND m.type NOT IN ('season', 'episode')
    `)) as Record<string, unknown>[];

    await db.run("DELETE FROM media_search");

    // إدراج دفعات (100/دفعة) مع حساب المفتاح الصوتي في JS — لا يمكن حسابه في SQL.
    // تُدار المعاملة عبر `withTransaction` (SAVEPOINT قابل للتطعيس الآمن) بدلاً من
    // `BEGIN` الخام: الاتصال مشترك (singleton) وقد يكون داخل معاملة مفتوحة في نفس
    // اللحظة (مثل `cleanupOrphanedItems` بعد اكتمال المسح) — و`BEGIN` الخام داخل
    // معاملة قائمة يفشل بـ "cannot start a transaction within a transaction".
    for (let i = 0; i < rows.length; i += INDEX_BATCH_SIZE) {
      const batch = rows.slice(i, i + INDEX_BATCH_SIZE);
      await this.withTransaction(async () => {
        for (const row of batch) {
          const phoneticKey = getArabicPhoneticKey(
            `${row["title"]} ${row["original_title"]} ${row["genres"]} ${row["cast_names"]}`,
          );
          await db.run(
            `INSERT INTO media_search (
               media_id, title, original_title, overview, genres, cast_names, created_at, phonetic_key
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row["media_id"],
              row["title"],
              row["original_title"],
              row["overview"],
              row["genres"],
              row["cast_names"],
              row["created_at"],
              phoneticKey,
            ],
          );
        }
      });
    }
  }

  /**
   * Inserts or replaces a single media item in the FTS5 index.
   *
   * Used when a media item is created or updated to keep the index in sync.
   * Populates all searchable columns including denormalized genres and cast names.
   *
   * @param mediaId - The media item ID to index.
   */
  async addToIndex(mediaId: number) {
    const db = await getDatabase();
    const media = (await db.get(
      `SELECT media_id, title, original_title, overview, created_at, type
       FROM media_items WHERE media_id = ?`,
      [mediaId],
    )) as Record<string, unknown> | undefined;
    if (!media) return;

    // Skip seasons and episodes (consistent with the auto-insert trigger).
    if (media["type"] === "season" || media["type"] === "episode") return;

    const genres = (await db.get(
      "SELECT GROUP_CONCAT(genre) as genres FROM media_genres WHERE media_id = ?",
      [mediaId],
    )) as { genres: string | null } | undefined;

    const castNames = (await db.get(
      "SELECT GROUP_CONCAT(name) as names FROM media_people WHERE media_id = ?",
      [mediaId],
    )) as { names: string | null } | undefined;

    await db.run(
      `INSERT OR REPLACE INTO media_search (
         media_id, title, original_title, overview, genres, cast_names, created_at, phonetic_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        media.media_id,
        media.title,
        media.original_title,
        media.overview,
        genres?.genres ?? "",
        castNames?.names ?? "",
        media.created_at,
        getArabicPhoneticKey(
          `${media.title} ${media.original_title} ${genres?.genres ?? ""} ${castNames?.names ?? ""}`,
        ),
      ],
    );
  }

  /**
   * Removes a single media item from the FTS5 index.
   *
   * @param mediaId - The media item ID to remove from the index.
   */
  async removeFromIndex(mediaId: number) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_search WHERE media_id = ?", [mediaId]);
  }

  /**
   * Backfills FTS rows that are missing or lack a phonetic key.
   *
   * Scanner-created items reach `media_search` through the `media_items_ai`
   * INSERT trigger, which stores `phonetic_key = ''` and no denormalized
   * genres/cast. This method finds every searchable item whose FTS row is
   * missing OR has an empty phonetic key and re-inserts the row (JS-computed
   * phonetic key + denormalized genres/cast) in batched transactions.
   *
   * The scan is fetched via keyset pagination on ascending `media_id` (one
   * `INDEX_BATCH_SIZE` page at a time) instead of loading the whole candidate
   * set into memory — the correlated `GROUP_CONCAT`s against the full scanned
   * index made a single big SELECT heavy on the shared connection.
   * Re-inserted rows gain a real `phonetic_key` and therefore leave the
   * candidate set, so they are never revisited by later pages.
   *
   * Called after each completed scan so freshly scanned items become
   * phonetically searchable without a full `rebuildIndex()`.
   *
   * @returns Number of FTS rows (re)inserted.
   */
  async backfillMissing(): Promise<number> {
    const db = await getDatabase();

    let inserted = 0;
    let lastId = 0;
    let hasMore = true;
    while (hasMore) {
      const rows = (await db.all(
        `SELECT
          m.media_id,
          COALESCE(m.title, '') AS title,
          COALESCE(m.original_title, '') AS original_title,
          COALESCE(m.overview, '') AS overview,
          COALESCE(m.created_at, datetime('now')) AS created_at,
          COALESCE((
            SELECT GROUP_CONCAT(mg.genre) FROM media_genres mg WHERE mg.media_id = m.media_id
          ), '') AS genres,
          COALESCE((
            SELECT GROUP_CONCAT(mp.name) FROM media_people mp WHERE mp.media_id = m.media_id
          ), '') AS cast_names
        FROM media_items m
        LEFT JOIN media_search ms ON ms.media_id = m.media_id
        WHERE m.is_available = 1
          AND m.deleted_at IS NULL
          AND m.type NOT IN ('season', 'episode')
          AND (ms.media_id IS NULL OR ms.phonetic_key = '')
          AND m.media_id > ?
        ORDER BY m.media_id ASC
        LIMIT ?`,
        [lastId, INDEX_BATCH_SIZE],
      )) as Record<string, unknown>[];

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      // نفس ملاحظة `rebuildIndex`: لا `BEGIN` خام — تُدار الدفعة عبر
      // `withTransaction` (SAVEPOINT) حتى تتلاءم مع معاملة قائمة على الاتصال المشترك.
      await this.withTransaction(async () => {
        for (const row of rows) {
          await db.run(
            `INSERT OR REPLACE INTO media_search (
               media_id, title, original_title, overview, genres, cast_names, created_at, phonetic_key
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row["media_id"],
              row["title"],
              row["original_title"],
              row["overview"],
              row["genres"],
              row["cast_names"],
              row["created_at"],
              getArabicPhoneticKey(
                `${row["title"]} ${row["original_title"]} ${row["genres"]} ${row["cast_names"]}`,
              ),
            ],
          );
          inserted++;
        }
      });

      const cursor = rows[rows.length - 1];
      if (!cursor) {
        hasMore = false;
        break;
      }
      lastId = Number(cursor["media_id"]);
      hasMore = rows.length === INDEX_BATCH_SIZE;
    }

    return inserted;
  }

  /**
   * Returns aggregate statistics for the search module.
   *
   * @returns Object with `totalMedia` (available items) and `totalGenres` (distinct genres).
   */
  async getStats() {
    const db = await getDatabase();
    const totalMedia = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE is_available = 1",
    )) as { count: number } | undefined;
 
    const totalGenres = (await db.get(
      "SELECT COUNT(DISTINCT genre) as count FROM media_genres",
    )) as { count: number } | undefined;
    return {
      totalMedia: totalMedia?.count ?? 0,
      totalGenres: totalGenres?.count ?? 0,
    };
  }

  /**
   * Paginated FTS5 search with optional metadata filters.
   *
   * Uses FTS5 `MATCH` for full-text search (instead of SQL `LIKE`) to leverage
   * tokenization, diacritics handling, and BM25 ranking. Additional filters
   * (`type`, `libraryId`, `year`) are applied via JOIN conditions on `media_items`.
   *
   * @param params.normalizedQuery - Pre-normalized search query (FTS5 MATCH operand).
   * @param params.type - Optional media type filter.
   * @param params.libraryId - Optional library ID filter.
   * @param params.year - Optional production year filter.
   * @param params.limit - Number of results per page.
   * @param params.offset - Number of results to skip (for pagination).
   * @returns Object with `results` array and `total` count.
   */
  async searchMediaWithCount(params: {
    normalizedQuery: string;
    type?: string;
    libraryId?: number;
    year?: number;
    limit: number;
    offset: number;
  }) {
    const db = await getDatabase();
    const { normalizedQuery, type, libraryId, year, limit, offset } = params;

   // const whereParts: string[] = ["m.is_available = 1"];
   const whereParts: string[] = ["m.is_available = 1", "m.type NOT IN ('season', 'episode')"];   // وضوح النية: نتائج البحث تشمل فقط الأفلام والمسلسلات (لا مواسم ولا حلقات)
    const filterParams: unknown[] = [];

    if (type) {
      whereParts.push("m.type = ?");
      filterParams.push(type);
    }
    if (libraryId) {
      whereParts.push("m.library_id = ?");
      filterParams.push(libraryId);
    }
    if (year) {
      whereParts.push("m.year = ?");
      filterParams.push(year);
    }

    const whereClause = whereParts.length > 0 ? `AND ${whereParts.join(" AND ")}` : "";

    const resultsSql = `
      SELECT m.*, l.name as library_name, l.type as library_type
      FROM media_items m
      JOIN media_search ms ON ms.media_id = m.media_id
      LEFT JOIN libraries l ON m.library_id = l.library_id
      WHERE media_search MATCH ? ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?`;

    const countSql = `
      SELECT COUNT(*) as count
      FROM media_items m
      JOIN media_search ms ON ms.media_id = m.media_id
      WHERE media_search MATCH ? ${whereClause}`;

    const countRow = (await db.get(countSql, [normalizedQuery, ...filterParams])) as {
      count: number;
    };

    const results = (await db.all(resultsSql, [
      normalizedQuery,
      ...filterParams,
      limit,
      offset,
    ])) as Record<string, unknown>[];

    // فولباك صوتي لنفس مرشحات البحث: يُفعَّل فقط عند نتائج < 3 واستعلام ≥ 3 أحرف.
    if (results.length >= 3 || normalizedQuery.length < 3) {
      return { results, total: countRow.count };
    }

    const phoneticKey = getArabicPhoneticKey(normalizedQuery);
    if (!phoneticKey) {
      return { results, total: countRow.count };
    }

    const fallbackSql = `
      SELECT m.*, l.name as library_name, l.type as library_type
      FROM media_items m
      JOIN media_search ms ON ms.media_id = m.media_id
      LEFT JOIN libraries l ON m.library_id = l.library_id
      WHERE media_search MATCH ? ${whereClause}
      ORDER BY rank * 0.9
      LIMIT ? OFFSET ?`;

    const fallback = (await db.all(fallbackSql, [
      `phonetic_key : ${phoneticKey}*`,
      ...filterParams,
      limit,
      offset,
    ])) as Record<string, unknown>[];

    const fallbackCountRow = (await db.get(
      `SELECT COUNT(*) as count
       FROM media_items m
       JOIN media_search ms ON ms.media_id = m.media_id
       WHERE media_search MATCH ? ${whereClause}`,
      [`phonetic_key : ${phoneticKey}*`, ...filterParams],
    )) as { count: number };

    const merged = this.dedupeAppend(results, fallback, offset + limit);
    return { results: merged, total: fallbackCountRow.count };
  }

  /**
   * يدمج النتائج الأولية مع نتائج الفولباك الصوتي بعد إزالة التكرار.
   *
   * - السلوك: النتائج الأولية لها الأولوية؛ تُضاف نتائج الفولباك التي لا
   *   تحمل معرّفاً مكرراً، مع قطع القائمة عند الحد الأقصى.
   *
   * @param primary - النتائج الأولية (FTS5 مباشرة).
   * @param fallback - نتائج الفولباك الصوتي.
   * @param max - الحد الأقصى للنتائج المدمجة.
   * @returns مصفوفة مدمجة بدون تكرار مرتبة حسب الأولوية.
   */
  private dedupeAppend(
    primary: Record<string, unknown>[],
    fallback: Record<string, unknown>[],
    max: number,
  ): Record<string, unknown>[] {
    const seen = new Set<number>();
    const merged: Record<string, unknown>[] = [];
    for (const row of [...primary, ...fallback]) {
      const id = Number(row["media_id"]);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
      if (merged.length >= max) break;
    }
    return merged;
  }
}
