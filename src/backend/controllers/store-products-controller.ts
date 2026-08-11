import { BaseController } from "./base-controller";
import type { StoreProductsService } from "../services/store-products-service";

export class StoreProductsController extends BaseController {
  constructor(private storeProductsService: StoreProductsService) {
    super();
  }

  async getAll(limitStr?: string, offsetStr?: string, category?: string, activeOnly?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const items = await this.storeProductsService.getAll(
        { category, activeOnly: activeOnly === "true" },
        limit,
        offset,
      );
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getCategories() {
    try {
      const categories = await this.storeProductsService.getCategories();
      return this.ok(categories);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const productId = this.parseId(id);
      const item = await this.storeProductsService.getById(productId);
      return this.ok(item);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>) {
    try {
      const item = await this.storeProductsService.create(data);
      return this.created(item, "Product created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async update(id: string, data: Record<string, unknown>) {
    try {
      const productId = this.parseId(id);
      const item = await this.storeProductsService.update(productId, data);
      return this.ok(item, "Product updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string) {
    try {
      const productId = this.parseId(id);
      await this.storeProductsService.delete(productId);
      return this.ok(null, "Product deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
