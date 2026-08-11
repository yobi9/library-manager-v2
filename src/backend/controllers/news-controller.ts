import { BaseController } from "./base-controller";
import type { NewsService } from "../services/news-service";

export class NewsController extends BaseController {
  constructor(private newsService: NewsService) {
    super();
  }

  async getAllPublished() {
    try {
      const items = await this.newsService.getAllPublished();
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAll(limitStr?: string, offsetStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const items = await this.newsService.getAll(limit, offset);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const newsId = this.parseId(id);
      const item = await this.newsService.getById(newsId);
      return this.ok(item);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>) {
    try {
      const item = await this.newsService.create(data);
      return this.created(item, "News created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async update(id: string, data: Record<string, unknown>) {
    try {
      const newsId = this.parseId(id);
      const item = await this.newsService.update(newsId, data);
      return this.ok(item, "News updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string) {
    try {
      const newsId = this.parseId(id);
      await this.newsService.delete(newsId);
      return this.ok(null, "News deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
