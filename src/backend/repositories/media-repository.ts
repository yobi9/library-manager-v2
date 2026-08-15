import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .replace(/^(the|a|an)\s+/i, "")
    .normalize("NFKD");
}

/**
 * Root media types eligible for duplicate merging across folders.
 *
 * Only hierarchical root types are merged: a series (or music/singer) root
 * folder that already has an item with the same normalized title reuses the
 * existing item instead of creating a duplicate — its seasons/albums attach
 * to the existing series. Flat and single-file types (movie, theater, main,
 * same-folder libraries, ...) are intentionally excluded.
 *
 * @remarks Mirrors the `HIERARCHICAL` set from `hierarchy-rules.ts`. This
 * value set is the source of truth for scan-time merging (media-sync) and
 * display-time merging (media-service).
 */
export const MERGABLE_ROOT_TYPES = new Set([
  "series",
  "series_anime",
  "series_sports",
  "series_deen",
  "series_ramadan",
  "series_tv",
  "series_learn",
  "series_kids",
  "series_doc",
  "audio_deen",
  "music",
  "singer",
]);

export { normalizeTitle };

/**
 * استعلام فرعي يرافق عمود `media_id` ويعيد تصنيفات العنصر (`media_genres`)
 * بصيغة JSON array نصية (مثل `["Action","Drama"]`) عبر `json_group_array`.
 *
 * @remarks يُحقن في استعلامات قوائم الوسائط حتى تصل كل بطاقة بحقل `genres`
 *          جاهزاً للتحليل بـ `extractGenres` في الواجهة (التي تنفّذ
 *          `JSON.parse` على القيم النصية). يتبع نفس نمط `search-repository`
 *          في دمج التصنيفات لكن مع مخرجات JSON صالحة. عند غياب التصنيفات
 *          يعود `[]` بدلاً من `NULL` لتوحيد شكل الـ API.
 */
const GENRES_SUBQUERY = `COALESCE((
  SELECT json_group_array(mg.genre)
  FROM media_genres mg
  WHERE mg.media_id = m.media_id
), '[]') AS genres`;

export class MediaRepository extends BaseRepository {
  constructor() {
    super("media_items");
  }

  async findDuplicate(data: {
    library_id: number;
    type: string;
    normalized_title: string;
    parent_media_id?: number | null;
  }) {
    const db = await getDatabase();
    const { library_id, type, normalized_title, parent_media_id } = data;
    if (!normalized_title) return null;

    let sql = `SELECT media_id FROM media_items WHERE library_id = ? AND type = ? AND normalized_title = ?`;
    const params: unknown[] = [library_id, type, normalized_title];
    if (parent_media_id != null) {
      sql += ` AND parent_media_id = ?`;
      params.push(parent_media_id);
    } else {
      sql += ` AND parent_media_id IS NULL`;
    }
    sql += ` LIMIT 1`;
    return ((await db.get(sql, params)) as { media_id: number } | undefined) ?? null;
  }

  async createMedia(data: Record<string, unknown>) {
    if (!data["type"]) throw new Error("type is required");
    if (!data["title"]) throw new Error("title is required");
    if (!data["library_id"]) throw new Error("library_id is required");

    const mediaData = { ...data };
    if (mediaData["directory_path"]) {
      mediaData["directory_path"] = this.normalizePath(mediaData["directory_path"] as string);
    }
    if (mediaData["title"]) {
      mediaData["normalized_title"] = normalizeTitle(mediaData["title"] as string);
    }
    mediaData["created_at"] = mediaData["created_at"] ?? new Date().toISOString();
    mediaData["updated_at"] = mediaData["updated_at"] ?? new Date().toISOString();

    return this.create(mediaData);
  }

  async getMediaFiles(mediaId: number) {
    const db = await getDatabase();
    return db.all("SELECT * FROM media_files WHERE media_id = ? ORDER BY file_path", [mediaId]);
  }

  async createFile(fileData: Record<string, unknown>) {
    const db = await getDatabase();
    const validColumns = [
      "media_id",
      "library_id",
      "file_path",
      "file_size",
      "mime_type",
      "duration",
      "last_accessed",
      "access_count",
      "is_available",
      "unavailable_since",
      "unavailable_reason",
      "last_seen_path",
      "created_at",
      "updated_at",
    ];
    const cleanData: Record<string, unknown> = {};
    for (const key of validColumns) {
      if (fileData[key] !== undefined) cleanData[key] = fileData[key];
    }
    if (cleanData["file_path"]) {
      cleanData["file_path"] = this.normalizePath(cleanData["file_path"] as string);
    }
    if (!cleanData["created_at"]) cleanData["created_at"] = new Date().toISOString();
    if (!cleanData["updated_at"]) cleanData["updated_at"] = new Date().toISOString();

    const keys = Object.keys(cleanData);
    const values = Object.values(cleanData);
    const placeholders = keys.map(() => "?").join(",");
    const sql = `INSERT OR IGNORE INTO media_files (${keys.join(",")}) VALUES (${placeholders})`;
    const result = await db.run(sql, values);

    if (result.lastID) {
      const created = await this.getFileById(result.lastID);
      if (created) return created;
    }
    const existing = await this.getFileByPath(
      cleanData["file_path"] as string,
      cleanData["library_id"] as number,
    );
    if (existing) return existing;
    throw new Error("Failed to create or retrieve file record");
  }

  async getFileById(fileId: number) {
    const db = await getDatabase();
    return db.get("SELECT * FROM media_files WHERE file_id = ?", [fileId]);
  }

  async getFileByPath(filePath: string, libraryId: number) {
    const db = await getDatabase();
    const normalized = this.normalizePath(filePath);
    return db.get("SELECT * FROM media_files WHERE library_id = ? AND file_path = ? LIMIT 1", [
      libraryId,
      normalized,
    ]);
  }

  async updateFile(fileId: number, data: Record<string, unknown>) {
    const db = await getDatabase();
    data["updated_at"] = new Date().toISOString();
    if (data["file_path"]) {
      data["file_path"] = this.normalizePath(data["file_path"] as string);
    }
    const keys = Object.keys(data);
    if (keys.length === 0) return this.getFileById(fileId);
    const setClause = keys.map((k) => `${k} = ?`).join(",");
    const values = [...Object.values(data), fileId];
    await db.run(`UPDATE media_files SET ${setClause} WHERE file_id = ?`, values);
    return this.getFileById(fileId);
  }

  async deleteFile(fileId: number) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_files WHERE file_id = ?", [fileId]);
    return true;
  }

  async updateParentChildrenCount(parentMediaId: number) {
    const db = await getDatabase();
    const row = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE parent_media_id = ? AND is_available = 1",
      [parentMediaId],
    )) as { count: number } | undefined;
    await this.update(parentMediaId, {
      has_children: (row?.count ?? 0) > 0 ? 1 : 0,
      seasons_count: row?.count ?? 0,
    });
  }

  async getGenresForMedia(mediaId: number) {
    const db = await getDatabase();
    return db.all("SELECT genre FROM media_genres WHERE media_id = ?", [mediaId]);
  }

  async setGenresForMedia(mediaId: number, genres: string[]) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_genres WHERE media_id = ?", [mediaId]);
    for (const genre of genres) {
      await db.run("INSERT OR IGNORE INTO media_genres (media_id, genre) VALUES (?, ?)", [
        mediaId,
        genre,
      ]);
    }
  }

  async getAllGenres() {
    const db = await getDatabase();
    return db.all(`
      SELECT genre as name, COUNT(*) as count
      FROM media_genres
      GROUP BY genre
      ORDER BY count DESC
    `);
  }

  /**
   * Returns every distinct certification rating currently present in the library
   * with the number of root media items carrying it.
   *
   * @remarks
   * Feeds the viewer "choose certification" taxonomy page (`/certification`).
   * Counts only root-level items (`parent_media_id IS NULL`) so each number
   * matches the result total of the filtered detail route (`rootOnly: true`).
   * Values are returned verbatim from the database — aliases such as `16+`/`+16`
   * or `R`/`R 18+`/`R18+` are intentionally NOT merged.
   *
   * @returns Array of `{ name, count }` sorted by count descending.
   */
  async getAllCertifications() {
    const db = await getDatabase();
    return db.all(`
      SELECT certification as name, COUNT(*) as count
      FROM media_items
      WHERE is_available = 1
        AND certification IS NOT NULL
        AND certification != ''
        AND parent_media_id IS NULL
      GROUP BY certification
      ORDER BY count DESC
    `);
  }

  /**
   * Computes the available IMDb rating buckets for the viewer "choose rating"
   * taxonomy page (`/rating`), based on the actual data present.
   *
   * @remarks
   * Each bucket `value` corresponds to a `minRating` threshold (`imdb_rating >= value`).
   * `count` is the CUMULATIVE number of root-level items satisfying that threshold,
   * so it always matches the total the detail route would return. Buckets are
   * ordered descending so `10+` renders first.
   *
   * @returns Array of `{ value, count }` for every floor bucket that has content.
   */
  async getRatingBuckets() {
    const db = await getDatabase();
    const rows = (await db.all(`
      SELECT CAST(imdb_rating AS INTEGER) as value, COUNT(*) as bucketCount
      FROM media_items
      WHERE is_available = 1
        AND imdb_rating IS NOT NULL
        AND imdb_rating > 0
        AND parent_media_id IS NULL
      GROUP BY value
      ORDER BY value ASC
    `)) as { value: number; bucketCount: number }[];

    let running = 0;
    const cumulative: { value: number; count: number }[] = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row) continue;
      running += row.bucketCount;
      cumulative.push({ value: row.value, count: running });
    }
    return cumulative;
  }

  /**
   * Retrieves all distinct genres associated with a given library.
   *
   * @param libraryId - The ID of the library to fetch genres for.
   * @returns A sorted array of genre name strings.
   */
  async getGenresForLibrary(libraryId: number) {
    const db = await getDatabase();
    const rows = await db.all<{ name: string }[]>(
      `SELECT DISTINCT mg.genre as name
       FROM media_genres mg
       JOIN media_items m ON mg.media_id = m.media_id
       WHERE m.library_id = ? AND m.is_available = 1
       ORDER BY mg.genre`,
      [libraryId],
    );
    return rows.map((r) => r.name);
  }

  async searchMedia(query: string, libraryId?: number) {
    const db = await getDatabase();
    if (libraryId) {
      return db.all(
        `SELECT m.* FROM media_items m
         WHERE m.library_id = ? AND m.title LIKE ? AND m.is_available = 1
         ORDER BY m.title LIMIT 50`,
        [libraryId, `%${query}%`],
      );
    }
    return db.all(
      `SELECT m.* FROM media_items m
       WHERE m.title LIKE ? AND m.is_available = 1
       ORDER BY m.title LIMIT 50`,
      [`%${query}%`],
    );
  }

  async getAvailableYears(libraryId?: number) {
    const db = await getDatabase();
    let sql = `SELECT DISTINCT year FROM media_items
               WHERE year IS NOT NULL AND is_available = 1 AND parent_media_id IS NULL`;
    const params: unknown[] = [];
    if (libraryId) {
      sql += ` AND library_id = ?`;
      params.push(libraryId);
    }
    sql += ` ORDER BY year DESC`;
    const rows = (await db.all(sql, params)) as { year: number }[];
    return rows.map((r) => r.year);
  }

  async getPinnedItems() {
    const db = await getDatabase();
    return db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m
       WHERE m.is_pinned = 1 AND m.is_available = 1 AND m.parent_media_id IS NULL
       ORDER BY m.sort_order, m.title`,
    );
  }

  async getLatestMedia(type?: string, limit = 24) {
    const db = await getDatabase();
    if (type) {
      return db.all(
        `SELECT m.*, ${GENRES_SUBQUERY}
         FROM media_items m
         WHERE m.type = ? AND m.is_available = 1 AND m.parent_media_id IS NULL
         ORDER BY m.created_at DESC LIMIT ?`,
        [type, limit],
      );
    }
    return db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m
       WHERE m.is_available = 1 AND m.parent_media_id IS NULL
       ORDER BY m.created_at DESC LIMIT ?`,
      [limit],
    );
  }

  async getMediaTypes() {
    const db = await getDatabase();
    return db.all(
      `SELECT DISTINCT type FROM media_items WHERE is_available = 1 AND type IS NOT NULL ORDER BY type`,
    );
  }

  async incrementViewCount(mediaId: number) {
    const db = await getDatabase();
    await db.run(
      `UPDATE media_items SET views = views + 1, last_accessed = datetime('now')
       WHERE media_id = ?`,
      [mediaId],
    );
  }

  async togglePin(mediaId: number) {
    const db = await getDatabase();
    const row = (await db.get("SELECT is_pinned FROM media_items WHERE media_id = ?", [
      mediaId,
    ])) as { is_pinned: number } | undefined;
    if (!row) throw new Error("Media not found");
    const newVal = row.is_pinned === 1 ? 0 : 1;
    await this.update(mediaId, { is_pinned: newVal });
    return newVal;
  }

 async getRecommendations(mediaId: number, libraryId: number, type?: string, limit = 20) {
  const db = await getDatabase();
  let sql = `SELECT m.*, ${GENRES_SUBQUERY}
             FROM media_items m
             WHERE m.library_id = ?
               AND m.media_id != ?
               AND m.is_available = 1
               AND m.parent_media_id IS NULL
               AND m.type NOT IN ('season', 'episode')`;
  const params: unknown[] = [libraryId, mediaId];
  if (type) {
    sql += ` AND m.type = ?`;
    params.push(type);
  }
  sql += ` ORDER BY m.imdb_rating DESC, m.created_at DESC LIMIT ?`;
  params.push(limit);
  return db.all(sql, params);
}

  async batchGetByIds(ids: (number | string)[]) {
    if (!ids.length) return [];
    const db = await getDatabase();
    const placeholders = ids.map(() => "?").join(",");
    return db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m
       WHERE m.media_id IN (${placeholders}) AND m.is_available = 1`,
      ids,
    );
  }

  async getAgeRatings(libraryId: number) {
    const db = await getDatabase();
    const rows = (await db.all(
      `SELECT DISTINCT certification FROM media_items
       WHERE library_id = ? AND is_available = 1 AND certification IS NOT NULL AND certification != ''
       ORDER BY certification`,
      [libraryId],
    )) as { certification: string }[];
    return rows.map((r) => r.certification);
  }

  /**
   * Fetches paginated media items filtered by library ID and optional criteria.
   * When `rootOnly` is true, only root-level items (without a parent) are returned,
   * excluding child items such as seasons and episodes.
   *
   * @param libraryId - The ID of the library to fetch items from.
   * @param options - Filtering, sorting, and pagination options.
   * @param options.rootOnly - If true, only items with `parent_media_id IS NULL` are returned.
   * @param options.year - Filter by production year.
   * @param options.genre - Filter by genre name.
   * @param options.certification - Filter by certification rating.
   * @param options.search - Full-text search on item title.
   * @param options.sortBy - Sort column ("recent" for created_at, otherwise title).
   * @param options.sortOrder - Sort direction ("ASC" or "DESC").
   * @param options.limit - Number of items per page (default: 50).
   * @param options.offset - Number of items to skip (default: 0).
   * @returns An object containing the items array and total count.
   */
  async getLibraryMediaFiltered(
    libraryId: number,
    options: {
      rootOnly?: boolean;
      year?: string;
      genre?: string;
      certification?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const db = await getDatabase();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const params: unknown[] = [libraryId];
    let where = "WHERE m.library_id = ? AND m.is_available = 1";

    if (options.rootOnly) {
      where += " AND m.parent_media_id IS NULL";
    }

    if (options.year) {
      where += " AND m.year = ?";
      params.push(Number(options.year));
    }
    if (options.genre) {
      where += " AND m.media_id IN (SELECT media_id FROM media_genres WHERE genre = ?)";
      params.push(options.genre);
    }
    if (options.certification) {
      where += " AND m.certification = ?";
      params.push(options.certification);
    }
    if (options.search) {
      where += " AND m.title LIKE ?";
      params.push(`%${options.search}%`);
    }

    const orderCol = options.sortBy === "recent" ? "created_at" : "title";
    const orderDir = options.sortOrder ?? "DESC";

    const items = await db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m ${where} ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const countRow = (await db.get(
      `SELECT COUNT(*) as count FROM media_items m ${where}`,
      params,
    )) as { count: number };

    return { items, total: countRow.count };
  }

  async getMediaChildren(parentMediaId: number) {
    const db = await getDatabase();
    return db.all(
      "SELECT * FROM media_items WHERE parent_media_id = ? AND is_available = 1 ORDER BY sort_order, title",
      [parentMediaId],
    );
  }

  /**
   * Retrieves the children of a media item merged with the children of all
   * sibling root items that share the same normalized title within the same
   * library.
   *
   * Display-time merge for historical duplicates: it does NOT modify the
   * database. When the given item is a root hierarchical item (series/music)
   * whose `normalized_title` matches other root items, the returned children
   * are the union of the direct children and the children of every same-title
   * sibling — so seasons from multiple folders of the same series appear
   * together.
   *
   * @param mediaId - The media item whose children to read.
   * @param libraryId - The library the item belongs to.
   * @param type - The item's media type (e.g. `series`).
   * @param normalizedTitle - The item's normalized title; when empty/null the
   *   method falls back to direct children only.
   * @returns Available children (any depth-1 sub-items) of the item and its
   *   same-title siblings, ordered by `sort_order, title`.
   */
  async getMergedChildren(
    mediaId: number,
    libraryId: number,
    type: string,
    normalizedTitle: string | null,
  ) {
    const db = await getDatabase();
    if (!normalizedTitle) return this.getMediaChildren(mediaId);
    return db.all(
      `SELECT * FROM media_items
       WHERE is_available = 1
         AND parent_media_id IN (
           SELECT media_id FROM media_items
           WHERE library_id = ? AND type = ? AND normalized_title = ?
             AND parent_media_id IS NULL
         )
       ORDER BY sort_order, title`,
      [libraryId, type, normalizedTitle],
    );
  }

  /**
   * Retrieves a person by its TMDB person id (`media_people.person_id`).
   *
   * The person entity is identified by `person_id` — not by the junction row
   * `id` (unique per media/role link). Rows are grouped by `person_id` and
   * `id` is aliased to `person_id` so front-end links and image lookups
   * (`/api/images/:personId?type=person`) stay consistent with
   * {@link getPersonWorks}, which also filters on `person_id`.
   *
   * @param personId - The TMDB person id.
   * @returns A single representative row, or `undefined` when not found.
   */
  async getPersonById(personId: number) {
    const db = await getDatabase();
    return db.get(
      `SELECT person_id AS id,
              person_id,
              MAX(name) AS name,
              MAX(profile_path) AS profile_path,
              MAX(role) AS role,
              MAX(character) AS character,
              MAX(department) AS department,
              MAX(importance_order) AS importance_order
       FROM media_people
       WHERE person_id = ?
       GROUP BY person_id
       LIMIT 1`,
      [personId],
    );
  }

  async getPersonWorks(personId: number) {
    const db = await getDatabase();
    return db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m
       JOIN media_people mp ON m.media_id = mp.media_id
       WHERE mp.person_id = ? AND m.is_available = 1
       GROUP BY m.media_id
       ORDER BY m.year DESC`,
      [personId],
    );
  }

  /**
   * Lists distinct people — one row per `person_id` — aggregated across all
   * `media_people` junction rows so the same person is never repeated.
   *
   * @param limit - Maximum number of people to return.
   * @param search - Optional name filter applied with `LIKE`.
   * @returns Rows keyed by `person_id` (`id` aliased to `person_id`) with
   *          `name`, `profile_path` and `media_count` (distinct works).
   */
  async getAllPeople(limit = 100, search?: string) {
    const db = await getDatabase();
    const base = `SELECT person_id AS id,
                         person_id,
                         MAX(name) AS name,
                         MAX(profile_path) AS profile_path,
                         COUNT(DISTINCT media_id) AS media_count
                  FROM media_people
                  WHERE person_id IS NOT NULL`;
    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      return db.all(`${base} AND name LIKE ? GROUP BY person_id ORDER BY name LIMIT ?`, [
        pattern,
        limit,
      ]);
    }
    return db.all(`${base} GROUP BY person_id ORDER BY name LIMIT ?`, [limit]);
  }

  async getByPath(path: string, libraryId: number) {
    const db = await getDatabase();
    const normalized = this.normalizePath(path);
    return db.get("SELECT * FROM media_items WHERE library_id = ? AND directory_path = ? LIMIT 1", [
      libraryId,
      normalized,
    ]);
  }

  async findExisting(params: {
    title: string;
    library_id: number;
    type: string;
    parent_media_id: number | null;
    directory_path: string;
  }) {
    const db = await getDatabase();
    const { title, library_id, type, parent_media_id, directory_path } = params;
    const normalized = this.normalizePath(directory_path);
    if (parent_media_id != null) {
      return db.get(
        "SELECT * FROM media_items WHERE library_id = ? AND type = ? AND parent_media_id = ? AND directory_path = ? LIMIT 1",
        [library_id, type, parent_media_id, normalized],
      );
    }
    return db.get(
      "SELECT * FROM media_items WHERE library_id = ? AND type = ? AND parent_media_id IS NULL AND directory_path = ? LIMIT 1",
      [library_id, type, normalized],
    );
  }

  async getImageFields(mediaId: number) {
    const db = await getDatabase();
    const row = (await db.get(
      "SELECT poster_path, backdrop_path FROM media_items WHERE media_id = ?",
      [mediaId],
    )) as { poster_path: string | null; backdrop_path: string | null } | undefined;
    return row ?? null;
  }

  /**
   * Retrieves a paginated list of media items with optional filtering.
   * Used by both the public filter endpoint and the admin items-control list.
   *
   * @param params - Filtering and pagination options.
   * @param params.year - Filter by production year.
   * @param params.genre - Filter by genre name.
   * @param params.certification - Filter by certification rating.
   * @param params.minRating - Minimum IMDb rating.
   * @param params.search - Text search on title or original title.
   * @param params.libraryId - Filter by library ID.
   * @param params.type - Filter by media type (movie/series/...).
   * @param params.filterBy - Status filter: "all" | "pinned" | "no-content" | "needs-review".
   * @param params.rootOnly - If true, only root items (parent_media_id IS NULL) are returned.
   * @param params.excludeTypes - Media types to exclude from results.
   * @param params.page - Page number (1-indexed).
   * @param params.limit - Items per page.
   * @returns Object with `items`, `total`, `page`, `limit` and `hasMore`.
   */
  async getMediaByFilter(params: {
    year?: number;
    genre?: string;
    certification?: string;
    minRating?: number;
    search?: string;
    libraryId?: number;
    type?: string;
    filterBy?: "all" | "pinned" | "no-content" | "needs-review";
    rootOnly?: boolean;
    excludeTypes?: string[];
    page?: number;
    limit?: number;
  }) {
    const db = await getDatabase();
    const page = params.page ?? 1;
    const limit = params.limit ?? 30;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE m.is_available = 1";
    const queryParams: unknown[] = [];

    if (params.libraryId) {
      whereClause += " AND m.library_id = ?";
      queryParams.push(params.libraryId);
    }
    if (params.type) {
      whereClause += " AND m.type = ?";
      queryParams.push(params.type);
    }
    if (params.search) {
      whereClause += " AND (m.title LIKE ? OR m.original_title LIKE ?)";
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }
    if (params.rootOnly) {
      whereClause += " AND m.parent_media_id IS NULL";
    }
    if (params.excludeTypes && params.excludeTypes.length > 0) {
      whereClause += ` AND m.type NOT IN (${params.excludeTypes.map(() => "?").join(",")})`;
      queryParams.push(...params.excludeTypes);
    }
    if (params.filterBy === "pinned") {
      whereClause += " AND m.is_pinned = 1";
    }
    if (params.filterBy === "no-content") {
      whereClause += ` AND (
        (m.overview IS NULL OR m.overview = '')
        AND (m.imdb_rating IS NULL OR m.imdb_rating = 0)
        AND (m.year IS NULL OR m.year = 0)
        AND (m.runtime IS NULL OR m.runtime = 0)
        AND (m.enriched = 0 OR m.enriched IS NULL)
      )`;
    }
    if (params.filterBy === "needs-review") {
      whereClause += ` AND (
        ((m.overview IS NOT NULL AND m.overview != '') AND (m.imdb_rating IS NULL OR m.imdb_rating = 0))
        OR ((m.overview IS NULL OR m.overview = '') AND (m.imdb_rating IS NOT NULL AND m.imdb_rating != 0))
        OR ((m.overview IS NOT NULL AND m.overview != '') AND (m.year IS NULL OR m.year = 0))
      )`;
    }
    if (params.year) {
      whereClause += " AND m.year = ?";
      queryParams.push(params.year);
    }
    if (params.certification) {
      whereClause += " AND m.certification = ?";
      queryParams.push(params.certification);
    }
    if (params.minRating) {
      whereClause += " AND m.imdb_rating >= ?";
      queryParams.push(params.minRating);
    }
    if (params.genre) {
      whereClause += ` AND m.media_id IN (
        SELECT mg.media_id FROM media_genres mg WHERE mg.genre = ?
      )`;
      queryParams.push(params.genre);
    }

    const countRow = (await db.get(
      `SELECT COUNT(*) as count FROM media_items m ${whereClause}`,
      queryParams,
    )) as { count: number };

    const items = await db.all(
      `SELECT m.*, ${GENRES_SUBQUERY}
       FROM media_items m ${whereClause}
       ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    );

    return {
      items,
      total: countRow.count,
      page,
      limit,
      hasMore: offset + items.length < countRow.count,
    };
  }

  /**
   * Computes dashboard-style statistics for the admin items-control toolbar.
   *
   * Counts are scoped to the same base filter as the admin list
   * (available, root-only, non-excluded types) so the "total" card matches
   * the list total regardless of the currently active page filters.
   *
   * @returns Object with `totalItems`, `totalLibraries`, `needsAttention`,
   *          `noContent`, and `lastSync` (ISO string or null).
   */
  async getAdminStats(): Promise<{
    totalItems: number;
    totalLibraries: number;
    needsAttention: number;
    noContent: number;
    lastSync: string | null;
  }> {
    const db = await getDatabase();

    const base =
      "WHERE m.is_available = 1 AND m.parent_media_id IS NULL AND m.type NOT IN ('season', 'episode', 'series_sports', 'series_deen')";

    const totalRow = (await db.get(`SELECT COUNT(*) as count FROM media_items m ${base}`)) as {
      count: number;
    };

    const needsAttentionRow = (await db.get(
      `SELECT COUNT(*) as count FROM media_items m ${base} AND (
        ((m.overview IS NOT NULL AND m.overview != '') AND (m.imdb_rating IS NULL OR m.imdb_rating = 0))
        OR ((m.overview IS NULL OR m.overview = '') AND (m.imdb_rating IS NOT NULL AND m.imdb_rating != 0))
        OR ((m.overview IS NOT NULL AND m.overview != '') AND (m.year IS NULL OR m.year = 0))
      )`,
    )) as { count: number };

    const noContentRow = (await db.get(
      `SELECT COUNT(*) as count FROM media_items m ${base} AND (
        (m.overview IS NULL OR m.overview = '')
        AND (m.imdb_rating IS NULL OR m.imdb_rating = 0)
        AND (m.year IS NULL OR m.year = 0)
        AND (m.runtime IS NULL OR m.runtime = 0)
        AND (m.enriched = 0 OR m.enriched IS NULL)
      )`,
    )) as { count: number };

    const librariesRow = (await db.get("SELECT COUNT(*) as count FROM libraries")) as {
      count: number;
    };

    const lastSyncRow = (await db.get(
      "SELECT MAX(last_metadata_sync) as lastSync FROM media_items WHERE last_metadata_sync IS NOT NULL AND last_metadata_sync != ''",
    )) as { lastSync: string | null };

    return {
      totalItems: totalRow.count,
      totalLibraries: librariesRow.count,
      needsAttention: needsAttentionRow.count,
      noContent: noContentRow.count,
      lastSync: lastSyncRow.lastSync ?? null,
    };
  }

  async refreshEnrichmentStatus(mediaId: number): Promise<number> {
    const db = await getDatabase();
    const current = (await db.get("SELECT * FROM media_items WHERE media_id = ?", [mediaId])) as
      Record<string, unknown> | undefined;
    if (!current) return 0;
    const hasOverview = !!(current.overview as string)?.trim();
    const hasRating = (current.imdb_rating as number) > 0;
    const hasYear = (current.year as number) > 1900;
    const hasRuntime = (current.runtime as number) > 0;
    const enriched = hasOverview && hasRating ? 1 : 0;
    if (current.enriched !== enriched) {
      await this.update(mediaId, { enriched, updated_at: new Date().toISOString() });
    }
    return enriched;
  }

  async checkDuplicateTitle(
    mediaId: number,
    title: string,
    libraryId: number,
  ): Promise<Array<Record<string, unknown>>> {
    const db = await getDatabase();
    return db.all(
      "SELECT media_id, title FROM media_items WHERE media_id != ? AND library_id = ? AND title = ?",
      [mediaId, libraryId, title],
    );
  }

  async getPeopleByMediaId(mediaId: number): Promise<
    Array<{
      id: number;
      person_id: number | null;
      name: string;
      role: string;
      character: string | null;
      department: string | null;
      profile_path: string | null;
      importance_order: number;
    }>
  > {
    const db = await getDatabase();
    return db.all(
      "SELECT id, person_id, name, role, character, department, profile_path, importance_order FROM media_people WHERE media_id = ? ORDER BY importance_order",
      [mediaId],
    );
  }

  async batchUpdatePersonNames(updates: Array<{ id: number; value: string }>): Promise<void> {
    if (!updates.length) return;
    const db = await getDatabase();
    for (const { id, value } of updates) {
      await db.run("UPDATE media_people SET name = ? WHERE id = ?", [value, id]);
    }
  }

  async batchUpdatePersonCharacters(updates: Array<{ id: number; value: string }>): Promise<void> {
    if (!updates.length) return;
    const db = await getDatabase();
    for (const { id, value } of updates) {
      await db.run("UPDATE media_people SET character = ? WHERE id = ?", [value, id]);
    }
  }
}
