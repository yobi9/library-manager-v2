import { AdsRepository } from "../repositories/ads-repository";
import { ActivityRepository } from "../repositories/activity-repository";

export class AdsService {
  constructor(
    private adsRepo: AdsRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  async getActive(position?: string) {
    return this.adsRepo.getActive(position);
  }

  async getAll(limit = 50, offset = 0) {
    return this.adsRepo.list(limit, offset);
  }

  async getById(id: number) {
    const item = await this.adsRepo.getById(id);
    if (!item) throw new Error("Ad not found");
    return item;
  }

  async create(data: Record<string, unknown>) {
    const result = await this.adsRepo.create(data);
    this._logSystemEvent("ad_created", { title: (data.title as string) ?? null });
    return result;
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.getById(id);
    const result = await this.adsRepo.update(id, data);
    this._logSystemEvent("ad_updated", { id, title: (data.title as string) ?? null });
    return result;
  }

  async recordClick(id: number) {
    return this.adsRepo.recordClick(id);
  }

  async recordImpression(id: number) {
    return this.adsRepo.recordImpression(id);
  }

  async delete(id: number) {
    const item = (await this.getById(id)) as Record<string, unknown> | undefined;
    const result = await this.adsRepo.remove(id);
    this._logSystemEvent("ad_deleted", { id, title: (item?.["title"] as string) ?? null });
    return result;
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`ad_created` | `ad_updated` | `ad_deleted`).
   * @param details - تفاصيل العملية (معرّف الإعلان وعنوانه).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "ads",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[AdsService] Failed to log ${action}:`, err.message);
      });
  }
}
