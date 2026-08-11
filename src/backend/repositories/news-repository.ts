import { BaseRepository } from "./base-repository";

export class NewsRepository extends BaseRepository {
  constructor() {
    super("news");
  }

  async getAllPublished() {
    return this.query(
      "SELECT * FROM news WHERE is_published = 1 ORDER BY published_at DESC",
    );
  }

  async list(limit = 50, offset = 0) {
    return this.query(
      "SELECT * FROM news ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
  }

  override async create(data: Record<string, unknown>) {
    const db = await this.getDb();
    const result = await db.run(
      `INSERT INTO news (title, summary, content, image_url, author, is_published, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.title ?? "",
        data.summary ?? null,
        data.content ?? "",
        data.image_url ?? null,
        data.author ?? null,
        data.is_published ? 1 : 0,
        data.is_published ? new Date().toISOString() : null,
      ],
    );
    if (result.lastID) return this.getById(result.lastID);
    return result;
  }

  override async update(id: number, data: Record<string, unknown>) {
    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === "id") continue;
      fields.push(`${key} = ?`);
      params.push(value);
    }
    if (data.is_published !== undefined) {
      fields.push("published_at = ?");
      params.push(data.is_published ? new Date().toISOString() : null);
    }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    await this.execute(
      `UPDATE news SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
    return this.getById(id);
  }

  async remove(id: number) {
    await this.execute("DELETE FROM news WHERE id = ?", [id]);
    return true;
  }
}
