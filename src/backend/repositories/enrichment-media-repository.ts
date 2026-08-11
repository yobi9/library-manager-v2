import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class EnrichmentMediaRepository extends BaseRepository {
  constructor() {
    super("media_items");
  }

  _buildEnrichmentFilters(
    filters: { libraryId?: string; type?: string; onlyEmpty?: boolean } = {},
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.libraryId && filters.libraryId !== "all" && filters.libraryId !== "undefined") {
      conditions.push("library_id = ?");
      params.push(filters.libraryId);
    }
    if (filters.type && filters.type !== "all" && filters.type !== "undefined") {
      conditions.push("type = ?");
      params.push(filters.type);
    }
    const excludedTypes = ["season", "episode", "series_sports", "series_deen"];
    conditions.push(`type NOT IN (${excludedTypes.map(() => "?").join(",")})`);
    params.push(...excludedTypes);
    if (filters.onlyEmpty === true) {
      conditions.push("(overview IS NULL OR overview = '' OR enriched = 0)");
    }
    conditions.push("is_available = 1");

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, params };
  }

  async getAllIdsForEnrichment(
    filters: { libraryId?: string; type?: string; onlyEmpty?: boolean } = {},
  ) {
    const { whereClause, params } = this._buildEnrichmentFilters(filters);
    const db = await getDatabase();
    const rows = await db.all(
      `SELECT media_id FROM media_items ${whereClause} ORDER BY media_id`,
      params,
    );
    return rows.map((row: { media_id: number }) => row.media_id);
  }

  async getIdsForEnrichmentPaginated(
    filters: { libraryId?: string; type?: string; onlyEmpty?: boolean } = {},
    page = 1,
    pageSize = 500,
  ) {
    const { whereClause, params } = this._buildEnrichmentFilters(filters);
    const db = await getDatabase();
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM media_items ${whereClause}`,
      params,
    );
    const total = (countResult as { total: number })?.total || 0;

    const offset = (page - 1) * pageSize;
    const rows = await db.all(
      `SELECT media_id FROM media_items ${whereClause} ORDER BY media_id LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    const ids = rows.map((row: { media_id: number }) => row.media_id);
    const hasMore = offset + ids.length < total;

    return { ids, total, hasMore };
  }

  async saveGenres(mediaId: number, genreNames: string[]) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_genres WHERE media_id = ?", [mediaId]);
    if (!genreNames?.length) return;
    const validGenres = genreNames.filter((g) => g && typeof g === "string").map((g) => g.trim());
    if (validGenres.length === 0) return;
    const placeholders = validGenres.map(() => "(?, ?)").join(", ");
    const params: unknown[] = [];
    for (const genre of validGenres) {
      params.push(mediaId, genre);
    }
    await db.run(
      `INSERT OR IGNORE INTO media_genres (media_id, genre) VALUES ${placeholders}`,
      params,
    );
  }

  async savePeople(
    mediaId: number,
    people: Array<{
      person_id: number | null;
      name: string;
      role: string;
      character: string | null;
      department: string | null;
      profile_path: string | null;
      importance_order: number;
    }>,
  ) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_people WHERE media_id = ?", [mediaId]);
    if (!people?.length) return;
    const validPeople = people.filter((p) => p.name && p.role);
    if (validPeople.length === 0) return;
    const cols =
      "media_id, person_id, name, role, character, department, profile_path, importance_order";
    const placeholders = validPeople.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params: unknown[] = [];
    for (const p of validPeople) {
      params.push(
        mediaId,
        p.person_id || null,
        p.name,
        p.role,
        p.character || null,
        p.department || null,
        p.profile_path || null,
        p.importance_order ?? 0,
      );
    }
    await db.run(`INSERT OR IGNORE INTO media_people (${cols}) VALUES ${placeholders}`, params);
  }

  async getPersonIdsByNames(names: string[]): Promise<Record<string, number>> {
    if (!names?.length) return {};
    const db = await getDatabase();
    const placeholders = names.map(() => "?").join(",");
    const rows = await db.all(
      `SELECT name, person_id FROM media_people WHERE name IN (${placeholders}) AND person_id IS NOT NULL GROUP BY name`,
      names,
    );
    const map: Record<string, number> = {};
    for (const row of rows as Array<{ name: string; person_id: number }>) {
      if (!map[row.name]) map[row.name] = row.person_id;
    }
    return map;
  }

  async saveProductionCompanies(
    mediaId: number,
    companies: Array<{ name?: string; company_name?: string }>,
  ) {
    if (!companies?.length) return;
    const companyNames = companies.map((c) => c.name || c.company_name).filter(Boolean);
    const text = companyNames.join(", ");
    await this.update(mediaId, { production_companies: text });
  }

  async updateCreditsSyncTime(mediaId: number) {
    const db = await getDatabase();
    await db.run(
      "UPDATE media_items SET credits_last_sync = CURRENT_TIMESTAMP WHERE media_id = ?",
      [mediaId],
    );
  }

  async resetEnrichment(mediaId: number) {
    const db = await getDatabase();
    await db.run("DELETE FROM media_genres WHERE media_id = ?", [mediaId]);
    await db.run("DELETE FROM media_people WHERE media_id = ?", [mediaId]);
    await db.run("DELETE FROM media_search WHERE media_id = ?", [mediaId]);
    await db.run(
      `UPDATE media_items SET tmdb_id = NULL, tvdb_id = NULL, imdb_id = NULL,
       original_title = NULL, overview = NULL, tagline = NULL, imdb_rating = NULL, imdb_votes = NULL,
       certification = NULL, country = NULL, runtime = NULL, year = NULL,
       release_date = NULL, production_companies = NULL, production_countries = NULL,
       metadata_status = 'pending', metadata_source = NULL, enriched = 0,
       last_metadata_sync = NULL, credits_last_sync = NULL,
       poster_path = NULL, backdrop_path = NULL, enriched_poster = NULL, enriched_backdrop = NULL,
       trailer_url = NULL, logo_url = NULL WHERE media_id = ?`,
      [mediaId],
    );
  }

  async getValidColumnNames(): Promise<Set<string>> {
    const db = await getDatabase();
    const rows = await db.all("PRAGMA table_info(media_items)");
    return new Set((rows as Array<{ name: string }>).map((r) => r.name));
  }
}
