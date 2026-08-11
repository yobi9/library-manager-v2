import { BaseRepository } from "./base-repository";
import { getDatabase } from "../db/db";

export class LibraryRepository extends BaseRepository {
  constructor() {
    super("libraries");
  }

  async getAllActive() {
    return this.query(
      'SELECT * FROM libraries WHERE status = "active" ORDER BY name',
    );
  }

  async getByParent(parentId: number) {
    return this.query(
      "SELECT * FROM libraries WHERE parent_id = ? ORDER BY name",
      [parentId],
    );
  }

  async getContainers() {
    return this.query(
      "SELECT * FROM libraries WHERE is_container = 1 OR type = 'main' ORDER BY name",
    );
  }

  async getNonContainers() {
    return this.query(
      "SELECT * FROM libraries WHERE (is_container = 0 OR is_container IS NULL) AND type != 'main' ORDER BY name",
    );
  }

  async findByType(type: string) {
    return this.query("SELECT * FROM libraries WHERE type = ? ORDER BY name", [
      type,
    ]);
  }

  async findByName(name: string) {
    return this.getByField("name", name);
  }

  async getHierarchyTree() {
    return this.query(`
      WITH RECURSIVE tree AS (
        SELECT l.*, 0 as level,
               json_array(l.library_id) as path_ids,
               json_array(l.name) as path_names
        FROM libraries l WHERE l.parent_id IS NULL
        UNION ALL
        SELECT l.*, tree.level + 1,
               json_insert(tree.path_ids, '$[' || json_array_length(tree.path_ids) || ']', l.library_id),
               json_insert(tree.path_names, '$[' || json_array_length(tree.path_names) || ']', l.name)
        FROM libraries l JOIN tree ON l.parent_id = tree.library_id
      )
      SELECT * FROM tree ORDER BY level, name
    `);
  }

  async getWithMediaCount() {
    return this.query(`
      SELECT l.*, COUNT(DISTINCT m.media_id) as media_count
      FROM libraries l
      LEFT JOIN media_items m ON l.library_id = m.library_id AND m.is_available = 1
      GROUP BY l.library_id
    `);
  }

  async getDetailedStats(libraryId: number) {
    const db = await getDatabase();
    return db.get(
      `
      SELECT
        COUNT(*) as total_media,
        COUNT(CASE WHEN m.type = 'movie' THEN 1 END) as movies_count,
        COUNT(CASE WHEN m.type = 'theater' THEN 1 END) as theaters_count,
        COUNT(CASE WHEN m.type LIKE 'series%' THEN 1 END) as series_count,
        COUNT(CASE WHEN m.type = 'season' THEN 1 END) as seasons_count,
        COUNT(CASE WHEN m.type = 'episode' THEN 1 END) as episodes_count,
        COALESCE(AVG(m.imdb_rating), 0) as avg_rating,
        MAX(m.created_at) as last_added
      FROM media_items m
      WHERE m.library_id = ? AND m.is_available = 1
      `,
      [libraryId],
    );
  }

  async updateMediaCount(libraryId: number) {
    const db = await getDatabase();
    const row = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE library_id = ? AND is_available = 1",
      [libraryId],
    )) as { count: number } | undefined;
    await this.update(libraryId, { media_count: row?.count ?? 0 });
  }
}
