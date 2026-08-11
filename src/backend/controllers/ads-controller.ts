import { BaseController } from "./base-controller";
import type { AdsService } from "../services/ads-service";

export class AdsController extends BaseController {
  constructor(private adsService: AdsService) {
    super();
  }

  async getActive(position?: string) {
    try {
      const items = await this.adsService.getActive(position);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAll(limitStr?: string, offsetStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const items = await this.adsService.getAll(limit, offset);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const adId = this.parseId(id);
      const item = await this.adsService.getById(adId);
      return this.ok(item);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>) {
    try {
      const item = await this.adsService.create(data);
      return this.created(item, "Ad created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async update(id: string, data: Record<string, unknown>) {
    try {
      const adId = this.parseId(id);
      const item = await this.adsService.update(adId, data);
      return this.ok(item, "Ad updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async recordClick(id: string) {
    try {
      const adId = this.parseId(id);
      await this.adsService.recordClick(adId);
      return this.ok(null, "Click recorded");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async recordImpression(id: string) {
    try {
      const adId = this.parseId(id);
      await this.adsService.recordImpression(adId);
      return this.ok(null, "Impression recorded");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string) {
    try {
      const adId = this.parseId(id);
      await this.adsService.delete(adId);
      return this.ok(null, "Ad deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
