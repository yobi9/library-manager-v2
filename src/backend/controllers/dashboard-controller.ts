import { BaseController } from "./base-controller";
import type { DashboardService } from "../services/dashboard-service";

export class DashboardController extends BaseController {
  constructor(private dashboardService: DashboardService) {
    super();
  }

  async getStats() {
    try {
      const stats = await this.dashboardService.getDashboardStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSummary() {
    try {
      const summary = await this.dashboardService.getSummary();
      return this.ok(summary);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getLive() {
    try {
      const live = await this.dashboardService.getLiveData();
      return this.ok(live);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getDailyViews(daysStr?: string) {
    try {
      const days = this.parseLimit(daysStr, 30);
      const views = await this.dashboardService.getDailyViews(days);
      return this.ok(views);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMostWatchedLibraries(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 10);
      const items = await this.dashboardService.getMostWatchedLibraries(limit);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMostWatchedItems(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 10);
      const items = await this.dashboardService.getMostWatchedItems(limit);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getLeastWatchedLibraries(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 10);
      const items = await this.dashboardService.getLeastWatchedLibraries(limit);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getLeastWatchedItems(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 10);
      const items = await this.dashboardService.getLeastWatchedItems(limit);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOldUnwatched(daysOldStr?: string, limitStr?: string, onlyAvailableStr?: string) {
    try {
      const daysOld = this.parseLimit(daysOldStr, 30);
      const limit = this.parseLimit(limitStr, 10);
      const onlyAvailable = onlyAvailableStr !== "false";
      const items = await this.dashboardService.getOldUnwatched(daysOld, limit, onlyAvailable);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getGeneralStats() {
    try {
      const stats = await this.dashboardService.getGeneralStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getRecentActivities(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 10);
      const activities = await this.dashboardService.getRecentActivities(limit);
      return this.ok(activities);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
