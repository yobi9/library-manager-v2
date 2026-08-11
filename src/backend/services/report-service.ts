import { ReportRepository } from "../repositories/report-repository";
import { ActivityRepository } from "../repositories/activity-repository";

export class ReportService {
  constructor(
    private reportRepo: ReportRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  async getFiltered(filters: {
    reportType?: string;
    status?: string;
    libraryId?: number;
    limit?: number;
    offset?: number;
  }) {
    return this.reportRepo.getFiltered(filters);
  }

  async getByMediaId(mediaId: number) {
    return this.reportRepo.getByMediaId(mediaId);
  }

  async getStats() {
    return this.reportRepo.getStats();
  }

  async updateStatus(id: number, status: "pending" | "resolved" | "dismissed") {
    const result = await this.reportRepo.updateStatus(id, status);
    if (status === "resolved" || status === "dismissed") {
      this._logSystemEvent(status === "resolved" ? "report_resolved" : "report_dismissed", { id });
    }
    return result;
  }

  async createReport(data: {
    mediaId: number;
    reportType?: string;
    description?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.reportRepo.createReport(data);
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`report_resolved` | `report_dismissed`).
   * @param details - تفاصيل العملية (معرّف التقرير).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "reports",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[ReportService] Failed to log ${action}:`, err.message);
      });
  }
}
