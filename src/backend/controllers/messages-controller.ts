import { BaseController } from "./base-controller";
import type { MessagesService } from "../services/messages-service";

export class MessagesController extends BaseController {
  constructor(private messagesService: MessagesService) {
    super();
  }

  async getAll(limitStr?: string, offsetStr?: string, type?: string, status?: string, userIdStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const items = await this.messagesService.getAll(
        { type, status, userId: userIdStr ? this.parseId(userIdStr) : undefined },
        limit,
        offset,
      );
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const msgId = this.parseId(id);
      const item = await this.messagesService.getById(msgId);
      return this.ok(item);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>) {
    try {
      const item = await this.messagesService.create(data);
      return this.created(item, "Message sent");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateStatus(id: string, status: string) {
    try {
      const msgId = this.parseId(id);
      const item = await this.messagesService.updateStatus(msgId, status);
      return this.ok(item, "Status updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string) {
    try {
      const msgId = this.parseId(id);
      await this.messagesService.delete(msgId);
      return this.ok(null, "Message deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
