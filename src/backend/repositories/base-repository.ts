import { getDatabase, withExclusiveTransaction } from "../db/db";
import type { Database } from "sqlite";

const PRIMARY_KEY_MAP: Record<string, string> = {
  libraries: "library_id",
  media_items: "media_id",
  users: "user_id",
  user_sessions: "id",
  media_files: "file_id",
  media_genres: "media_id",
  media_people: "id",
  library_snapshots: "snapshot_id",
  settings: "key",
  settings_audit_log: "log_id",
  translation_cache: "id",
  activities: "id",
  security_events: "event_id",
  pending_enrichment_approvals: "id",
  user_progress: "progress_id",
  media_reports: "report_id",
  visitors: "id",
  visitor_events: "id",
  news: "id",
  messages: "id",

};

const ALLOWED_ORDER_COLUMNS: Record<string, string[]> = {
  default: ["created_at", "updated_at", "title", "name", "id"],
  libraries: ["library_id", "name", "type", "created_at", "updated_at", "media_count"],
  media_items: [
    "media_id",
    "title",
    "type",
    "year",
    "imdb_rating",
    "created_at",
    "updated_at",
    "sort_order",
  ],
};

const CAMEL_TO_SNAKE: Record<string, string> = {
  tmdbId: "tmdb_id",
  imdbId: "imdb_id",
  tvdbId: "tvdb_id",
  defaultLanguage: "language",
  apiUrl: "api_url",
  imageUrl: "image",
  posterPath: "poster_path",
  backdropPath: "backdrop_path",
  parentMediaId: "parent_media_id",
  libraryId: "library_id",
  mediaId: "media_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  lastScanId: "last_scan_id",
  isAvailable: "is_available",
  isPinned: "is_pinned",
  isLeaf: "is_leaf",
  isFile: "is_file",
  hasChildren: "has_children",
  hasNfoFile: "has_nfo_file",
  filePath: "file_path",
  fileSize: "file_size",
  mimeType: "mime_type",
  seasonsCount: "seasons_count",
  episodesCount: "episodes_count",
  parentId: "parent_id",
  hideSection: "hide_section",
  isContainer: "is_container",
  linkedLibraryId: "linked_library_id",
  isWatched: "is_watched",
  sortOrder: "sort_order",
  hierarchicalLevel: "hierarchical_level",
  clearartUrl: "clearart_url",
  thumbUrl: "thumb_url",

  artworkSavedToFolder: "artwork_saved_to_folder",
  lastAccessed: "last_accessed",
  accessCount: "access_count",
  unavailableSince: "unavailable_since",
  unavailableReason: "unavailable_reason",
  lastSeenPath: "last_seen_path",
  imagesLastChecked: "images_last_checked",
  metadataStatus: "metadata_status",
  metadataSource: "metadata_source",
  metadataVersion: "metadata_version",
  lastMetadataSync: "last_metadata_sync",
  imdbrating: "imdb_rating",
  ageRating: "certification",
  contentRating: "certification",
  releaseDate: "release_date",
  directoryPath: "directory_path",
  originalTitle: "original_title",
  productionCompanies: "production_companies",
};

/**
 * Normalizes a filesystem path to the canonical storage form persisted in
 * `media_items.directory_path` and `media_files.file_path`.
 *
 * Purpose: single source of truth for how paths are stored — Windows-style
 * backslashes, ASCII-lowercase, no trailing separator, collapsed separator
 * runs, and `\\`-prefixed (UNC/relative) shapes re-rooted as `\\...`.
 *
 * Source of truth: this function, plus `PathValidationService.normalizeForDb`
 * (forward-slash form used only for in-scanner lookups). The deletion
 * detector must convert roots through this function so prefix `LIKE` matches
 * run against the raw indexed column.
 *
 * Scope: all path writes in `MediaRepository` (createMedia/createFile/update)
 * route through here. Limitations: no drive-letter canonicalization, no
 * case-folding beyond ASCII lowercase, no symlink resolution.
 *
 * @param filePath - Raw path as produced by the scanner, upload or config layer.
 * @returns The storage-normalized path (empty string for empty/whitespace input).
 */
export function normalizeStoragePath(filePath: string): string {
  if (!filePath) return "";
  let normalized = filePath
    .replace(/\//g, "\\")
    .replace(/\\\\+/g, "\\")
    .replace(/\\$/, "")
    .toLowerCase();
  if (normalized.startsWith("\\") && !normalized.startsWith("\\\\")) {
    normalized = "\\" + normalized;
  }
  return normalized;
}

export class BaseRepository {
  readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  getPrimaryKey(): string {
    return PRIMARY_KEY_MAP[this.tableName] ?? `${this.tableName.replace(/s$/, "")}_id`;
  }

  convertToDbFormat(data: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== "object") return data;
    const dbData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (CAMEL_TO_SNAKE[key]) {
        dbData[CAMEL_TO_SNAKE[key]] = value;
      } else {
        const snakeKey = key
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
          .replace(/([a-z])([A-Z])/g, "$1_$2")
          .toLowerCase();
        dbData[snakeKey] = value;
      }
    }
    return dbData;
  }

  normalizeData<T>(data: T): T {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.mapFields(item)) as T;
    }
    return this.mapFields(data) as T;
  }

  private mapFields<T>(item: T): T {
    if (!item || typeof item !== "object") return item;
    const result = { ...item } as Record<string, unknown>;
    const id = result["library_id"] ?? result["media_id"] ?? result["id"];
    if (id && !result["id"]) result["id"] = id;
    if (this.tableName === "libraries" && result["library_id"]) {
      result["imageUrl"] = `/api/images/${result["library_id"]}?type=library`;
    }
    if (result["image"] && !result["imageUrl"]) {
      result["imageUrl"] = result["image"];
    }
    if (result["created_at"] && !result["createdAt"]) {
      result["createdAt"] = result["created_at"];
    }
    if (result["updated_at"] && !result["updatedAt"]) {
      result["updatedAt"] = result["updated_at"];
    }
    return result as T;
  }

  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const db = await getDatabase();
    const savepoint = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    // Serialized via `withExclusiveTransaction` so this SAVEPOINT can never
    // interleave with another savepoint transaction on the shared connection
    // (scan walk items / orphan cleanup) — interleaving corrupts the savepoint
    // stack and RELEASE fails with "no such savepoint".
    return withExclusiveTransaction(async () => {
      try {
        await db.run(`SAVEPOINT ${savepoint}`);
        const result = await callback();
        await db.run(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        try {
          await db.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        } catch {
          // savepoint may already be broken
        }
        try {
          await db.run(`RELEASE SAVEPOINT ${savepoint}`);
        } catch {
          // ignore
        }
        throw error;
      }
    });
  }

  async getDb(): Promise<Database> {
    return getDatabase();
  }

  async getAll(limit = 1000) {
    const db = await getDatabase();
    return db.all(`SELECT * FROM ${this.tableName} LIMIT ?`, [limit]);
  }

  async getById(id: number | string) {
    const db = await getDatabase();
    return db.get(`SELECT * FROM ${this.tableName} WHERE ${this.getPrimaryKey()} = ?`, [id]);
  }

  async getByIds(ids: (number | string)[]) {
    if (!ids.length) return [];
    const db = await getDatabase();
    const placeholders = ids.map(() => "?").join(",");
    return db.all(
      `SELECT * FROM ${this.tableName} WHERE ${this.getPrimaryKey()} IN (${placeholders})`,
      ids,
    );
  }

  async getByField(field: string, value: unknown) {
    const db = await getDatabase();
    return db.get(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`, [value]);
  }

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = (await db.get(`SELECT COUNT(*) as count FROM ${this.tableName}`)) as
      { count: number } | undefined;
    return row?.count ?? 0;
  }

  async create(data: Record<string, unknown>) {
    const db = await getDatabase();
    const dbData = this.convertToDbFormat(data);
    const keys = Object.keys(dbData);
    const values = Object.values(dbData);
    const placeholders = keys.map(() => "?").join(", ");
    const sql = `INSERT INTO ${this.tableName} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const rows = (await db.all(sql, values)) as Record<string, unknown>[];
    return rows[0] ?? null;
  }

  async update(id: number | string, data: Record<string, unknown>) {
    const db = await getDatabase();
    const dbData = this.convertToDbFormat(data);
    const keys = Object.keys(dbData);
    if (keys.length === 0) throw new Error("No data to update");
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(dbData), id];
    const pk = this.getPrimaryKey();
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${pk} = ? RETURNING *`;
    const rows = (await db.all(sql, values)) as Record<string, unknown>[];
    return rows[0] ?? null;
  }

  async delete(id: number | string) {
    const db = await getDatabase();
    await db.run(`DELETE FROM ${this.tableName} WHERE ${this.getPrimaryKey()} = ?`, [id]);
    return true;
  }

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes("ORDER BY")) {
      const match = sql.match(/ORDER BY\s+([\w.]+)/i);
      if (match?.[1]) {
        const raw = match[1];
        const qualified = raw.includes(".");
        const column = qualified ? raw.split(".").pop()! : raw;
        const allowed = ALLOWED_ORDER_COLUMNS[this.tableName] ?? ALLOWED_ORDER_COLUMNS["default"]!;
        const sanitized = allowed.includes(column) ? column : "created_at";
        const replacement = qualified ? raw.replace(/\.\w+$/, `.${sanitized}`) : sanitized;
        sql = sql.replace(/ORDER BY\s+[\w.]+/i, `ORDER BY ${replacement}`);
      }
    }
    const db = await getDatabase();
    return db.all(sql, params);
  }

  async queryOne(sql: string, params: unknown[] = []) {
    const db = await getDatabase();
    return db.get(sql, params);
  }

  async execute(sql: string, params: unknown[] = []) {
    const db = await getDatabase();
    return db.run(sql, params);
  }

  normalizePath(filePath: string): string {
    return normalizeStoragePath(filePath);
  }
}
