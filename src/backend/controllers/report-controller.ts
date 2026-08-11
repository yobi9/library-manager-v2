import { BaseController } from "./base-controller";
import type { ReportService } from "../services/report-service";

export class ReportController extends BaseController {
  constructor(private reportService: ReportService) {
    super();
  }

  async getFiltered(params: Record<string, string>) {
    try {
      const result = await this.reportService.getFiltered({
        reportType: params["reportType"] || undefined,
        status: params["status"] || undefined,
        libraryId: params["libraryId"] ? Number(params["libraryId"]) : undefined,
        limit: this.parseLimit(params["limit"] ?? "50", 50),
        offset: Math.max(0, Number(params["offset"] ?? 0) || 0),
      });
      return this.ok(result);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getByMediaId(mediaId: string) {
    try {
      const id = this.parseId(mediaId);
      const reports = await this.reportService.getByMediaId(id);
      return this.ok(reports);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getStats() {
    try {
      const stats = await this.reportService.getStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>, context?: { ip?: string; userAgent?: string }) {
    try {
      await this.reportService.createReport({
        mediaId: data["mediaId"] as number,
        reportType: data["reportType"] as string,
        description: (data["description"] as string) ?? (data["message"] as string),
        deviceId: (data["deviceId"] as string) ?? (data["reporter_device_id"] as string),
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
      return this.ok(null, "Report submitted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateStatus(id: string, status: string) {
    try {
      const reportId = this.parseId(id);
      await this.reportService.updateStatus(
        reportId,
        status as "pending" | "resolved" | "dismissed",
      );
      return this.ok(null, "Status updated");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
