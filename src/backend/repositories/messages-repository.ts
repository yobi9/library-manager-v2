import { BaseRepository } from "./base-repository";

export class MessagesRepository extends BaseRepository {
  constructor() {
    super("messages");
  }

  async list(filters: { type?: string; status?: string; userId?: number } = {}, limit = 50, offset = 0) {
    let query = "SELECT * FROM messages WHERE 1=1";
    const params: unknown[] = [];
    if (filters.type) { query += " AND type = ?"; params.push(filters.type); }
    if (filters.status) { query += " AND status = ?"; params.push(filters.status); }
    if (filters.userId) { query += " AND user_id = ?"; params.push(filters.userId); }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    return this.query(query, params);
  }

  override async create(data: Record<string, unknown>) {
    const db = await this.getDb();
    const rows = (await db.all(
      `INSERT INTO messages (user_id, title, body, type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now')) RETURNING *`,
      [
        data.user_id ?? null,
        data.title ?? "",
        data.body ?? "",
        data.type ?? "support",
      ],
    )) as Record<string, unknown>[];
    return rows[0] ?? null;
  }

  async updateStatus(id: number, status: string) {
    await this.execute(
      "UPDATE messages SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id],
    );
    return this.getById(id);
  }

  async remove(id: number) {
    await this.execute("DELETE FROM messages WHERE id = ?", [id]);
    return true;
  }
}
