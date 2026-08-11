import { BaseController } from "./base-controller";
import type { SearchService } from "../services/search-service";

export class SearchController extends BaseController {
  constructor(private searchService: SearchService) {
    super();
  }

  async search(params: Record<string, string>) {
    try {
      const result = await this.searchService.searchMedia({
        q: params["q"],
        type: params["type"],
        libraryId: params["libraryId"] ? Number(params["libraryId"]) : undefined,
        year: params["year"] ? Number(params["year"]) : undefined,
        page: this.parsePage(params["page"], 1),
        limit: this.parseLimit(params["limit"], 20),
      });
      return this.ok(result);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async liveSearch(q: string, limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 8);
      const results = await this.searchService.liveSearch(q, limit);
      return this.ok(results);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async rebuildIndex() {
    try {
      await this.searchService.rebuildIndex();
      return this.ok(null, "Index rebuilt");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getStats() {
    try {
      const stats = await this.searchService.getStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
