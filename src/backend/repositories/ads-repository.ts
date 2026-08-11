import { BaseRepository } from "./base-repository";

export class AdsRepository extends BaseRepository {
  constructor() {
    super("ads");
  }

  async getActive(position?: string) {
    let query = "SELECT * FROM ads WHERE is_active = 1";
    const params: unknown[] = [];
    if (position) { query += " AND position = ?"; params.push(position); }
    query += " ORDER BY created_at DESC";
    return this.query(query, params);
  }

  async list(limit = 50, offset = 0) {
    return this.query(
      "SELECT * FROM ads ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
  }

  override async create(data: Record<string, unknown>) {
    const db = await this.getDb();
    const result = await db.run(
      `INSERT INTO ads (title, image_url, link_url, position, is_active, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.title ?? "",
        data.image_url ?? "",
        data.link_url ?? null,
        data.position ?? "banner",
        data.is_active ? 1 : 0,
        data.start_date ?? null,
        data.end_date ?? null,
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
    fields.push("updated_at = datetime('now')");
    params.push(id);
    await this.execute(
      `UPDATE ads SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
    return this.getById(id);
  }

  async recordClick(id: number) {
    await this.execute("UPDATE ads SET clicks = clicks + 1 WHERE id = ?", [id]);
  }

  async recordImpression(id: number) {
    await this.execute("UPDATE ads SET impressions = impressions + 1 WHERE id = ?", [id]);
  }

  async remove(id: number) {
    await this.execute("DELETE FROM ads WHERE id = ?", [id]);
    return true;
  }
}
