import { StoreProductsRepository } from "../repositories/store-products-repository";
import { ActivityRepository } from "../repositories/activity-repository";

export class StoreProductsService {
  constructor(
    private storeProductsRepo: StoreProductsRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  async getAll(filters: { category?: string; activeOnly?: boolean } = {}, limit = 50, offset = 0) {
    return this.storeProductsRepo.list(filters, limit, offset);
  }

  async getCategories() {
    return this.storeProductsRepo.getCategories();
  }

  async getById(id: number) {
    const item = await this.storeProductsRepo.getById(id);
    if (!item) throw new Error("Product not found");
    return item;
  }

  async create(data: Record<string, unknown>) {
    const result = await this.storeProductsRepo.create(data);
    this._logSystemEvent("product_created", { name: (data.name as string) ?? null });
    return result;
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.getById(id);
    const result = await this.storeProductsRepo.update(id, data);
    this._logSystemEvent("product_updated", { id, name: (data.name as string) ?? null });
    return result;
  }

  async delete(id: number) {
    const item = (await this.getById(id)) as Record<string, unknown> | undefined;
    const result = await this.storeProductsRepo.remove(id);
    this._logSystemEvent("product_deleted", { id, name: (item?.["name"] as string) ?? null });
    return result;
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`product_created` | `product_updated` | `product_deleted`).
   * @param details - تفاصيل العملية (معرّف المنتج واسمه).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "store",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[StoreProductsService] Failed to log ${action}:`, err.message);
      });
  }
}
