import { NewsRepository } from "../repositories/news-repository";
import { ActivityRepository } from "../repositories/activity-repository";

export class NewsService {
  constructor(
    private newsRepo: NewsRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  async getAllPublished() {
    return this.newsRepo.getAllPublished();
  }

  async getAll(limit = 50, offset = 0) {
    return this.newsRepo.list(limit, offset);
  }

  async getById(id: number) {
    const item = await this.newsRepo.getById(id);
    if (!item) throw new Error("News not found");
    return item;
  }

  async create(data: Record<string, unknown>) {
    const result = await this.newsRepo.create(data);
    this._logSystemEvent("news_created", { title: (data.title as string) ?? null });
    return result;
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.getById(id);
    const result = await this.newsRepo.update(id, data);
    this._logSystemEvent("news_updated", { id, title: (data.title as string) ?? null });
    return result;
  }

  async delete(id: number) {
    const item = (await this.getById(id)) as Record<string, unknown> | undefined;
    const result = await this.newsRepo.remove(id);
    this._logSystemEvent("news_deleted", { id, title: (item?.["title"] as string) ?? null });
    return result;
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`news_created` | `news_updated` | `news_deleted`).
   * @param details - تفاصيل العملية (معرّف الخبر وعنوانه).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "news",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[NewsService] Failed to log ${action}:`, err.message);
      });
  }
}
