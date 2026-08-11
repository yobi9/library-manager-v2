import { BaseRepository } from "./base-repository";

/**
 * Normalized media report row delivered to the admin Reports page.
 *
 * The DTO is intentionally flat: `id` mirrors `report_id` (the table PK),
 * `reason` maps `description`, and `reported_by` falls back to
 * `device_id` / `user_agent` for display. Values mirror the
 * `media_reports` schema (CHECK constraints `broken|abuse` / `pending|resolved|dismissed`).
 */
export interface MediaReportRow {
  id: number;
  report_id: number;
  report_type: "broken" | "abuse";
  media_id: number;
  media_title: string | null;
  library_id: number | null;
  library_name: string | null;
  stream_url: string | null;
  violation_type: string | null;
  reason: string | null;
  reported_by: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolved_at: string | null;
  created_at: string;
}

/** Allowed `report_type` values (mirrors the schema CHECK constraint). */
const REPORT_TYPES = new Set(["broken", "abuse"]);

export class ReportRepository extends BaseRepository {
  constructor() {
    super("media_reports");
  }

  /**
   * Inserts a viewer-submitted media report using the real `media_reports`
   * columns (`description`, `device_id`, `ip_address`, `user_agent`).
   *
   * @param data - Report payload (media id + type + optional context fields).
   * @returns `{ success: true }`.
   * @throws When `reportType` is not one of the schema-allowed values.
   */
  async createReport(data: {
    mediaId: number;
    reportType?: string;
    description?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const type = data.reportType ?? "broken";
    if (!REPORT_TYPES.has(type)) throw new Error("Invalid report type");
    const db = await this.getDb();
    await db.run(
      `INSERT INTO media_reports (media_id, report_type, description, device_id, ip_address, user_agent, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      [
        data.mediaId,
        type,
        data.description ?? "",
        data.deviceId ?? null,
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ],
    );
    return { success: true };
  }

  /**
   * Lists reports filtered by type/status/library, newest first, as a
   * paginated `{ rows, total }` envelope with `id` = `report_id`.
   *
   * @param filters - Optional type/status/libraryId filters plus limit/offset.
   * @returns Rows mapped to {@link MediaReportRow} and the total count.
   */
  async getFiltered(filters: {
    reportType?: string;
    status?: string;
    libraryId?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: MediaReportRow[]; total: number }> {
    const db = await this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.reportType) {
      conditions.push("report_type = ?");
      params.push(filters.reportType);
    }
    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.libraryId) {
      conditions.push("library_id = ?");
      params.push(filters.libraryId);
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const raw = (await db.all(
      `SELECT report_id, report_type, media_id, media_title, library_id, library_name,
              stream_url, violation_type, description, device_id, ip_address,
              user_agent, status, resolved_at, created_at
       FROM media_reports ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.limit ?? 50, filters.offset ?? 0],
    )) as Array<Record<string, unknown>>;

    const totalRow = (await db.get(
      `SELECT COUNT(*) AS count FROM media_reports ${whereSql}`,
      params,
    )) as { count: number } | undefined;

    const rows = raw.map((r) => ({
      id: r.report_id as number,
      report_id: r.report_id as number,
      report_type: r.report_type as MediaReportRow["report_type"],
      media_id: r.media_id as number,
      media_title: (r.media_title as string | null) ?? null,
      library_id: (r.library_id as number | null) ?? null,
      library_name: (r.library_name as string | null) ?? null,
      stream_url: (r.stream_url as string | null) ?? null,
      violation_type: (r.violation_type as string | null) ?? null,
      reason: (r.description as string | null) ?? null,
      reported_by: (r.device_id as string | null) ?? (r.user_agent as string | null) ?? "مجهول",
      device_id: (r.device_id as string | null) ?? null,
      ip_address: (r.ip_address as string | null) ?? null,
      user_agent: (r.user_agent as string | null) ?? null,
      status: r.status as MediaReportRow["status"],
      resolved_at: (r.resolved_at as string | null) ?? null,
      created_at: r.created_at as string,
    })) satisfies MediaReportRow[];

    return { rows, total: totalRow?.count ?? 0 };
  }

  async getByMediaId(mediaId: number) {
    return this.query("SELECT * FROM media_reports WHERE media_id = ? ORDER BY created_at DESC", [
      mediaId,
    ]);
  }

  async getStats() {
    return this.query(
      `SELECT report_type, status, COUNT(*) as count
       FROM media_reports
       GROUP BY report_type, status`,
    );
  }

  async updateStatus(id: number, status: "pending" | "resolved" | "dismissed") {
    const resolvedAt =
      status === "resolved" || status === "dismissed" ? new Date().toISOString() : null;
    await this.execute("UPDATE media_reports SET status = ?, resolved_at = ? WHERE report_id = ?", [
      status,
      resolvedAt,
      id,
    ]);
  }
}
