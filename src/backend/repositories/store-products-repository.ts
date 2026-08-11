import { BaseRepository } from "./base-repository";

export class StoreProductsRepository extends BaseRepository {
  constructor() {
    super("store_products");
  }

  async list(filters: { category?: string; activeOnly?: boolean } = {}, limit = 50, offset = 0) {
    let query = "SELECT * FROM store_products WHERE 1=1";
    const params: unknown[] = [];
    if (filters.category) { query += " AND category = ?"; params.push(filters.category); }
    if (filters.activeOnly) { query += " AND is_active = 1"; }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return this.query(query, params);
  }

  async getCategories() {
    return this.query(
      "SELECT DISTINCT category FROM store_products WHERE category IS NOT NULL AND category != '' ORDER BY category",
    );
  }

  override async create(data: Record<string, unknown>) {
    const db = await this.getDb();
    const result = await db.run(
      `INSERT INTO store_products (name, description, price, image_url, category, stock, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.name ?? "",
        data.description ?? null,
        data.price ?? 0,
        data.image_url ?? null,
        data.category ?? null,
        data.stock ?? 0,
        data.is_active ? 1 : 0,
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
      `UPDATE store_products SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
    return this.getById(id);
  }

  async remove(id: number) {
    await this.execute("DELETE FROM store_products WHERE id = ?", [id]);
    return true;
  }
}
