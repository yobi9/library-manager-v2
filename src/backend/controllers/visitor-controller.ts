import { BaseController, type RequestContext } from "./base-controller";
import type { VisitorService } from "../services/visitor-service";

export class VisitorController extends BaseController {
  constructor(private visitorService: VisitorService) {
    super();
  }

  async getVisitorRequests() {
    try {
      const requests = await this.visitorService.getVisitorRequests();
      return this.ok(requests);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async addVisitorRequest(userId: string, message: string, ctx: RequestContext) {
    if (!userId || !message?.trim()) {
      return this.error("userId and message are required", 400);
    }
    try {
      await this.visitorService.addVisitorRequest(userId, message.trim(), ctx.ip, ctx.userAgent);
      return this.ok(null, "Request submitted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async addReplyToRequest(requestId: string, reply: string) {
    try {
      const id = this.parseId(requestId);
      await this.visitorService.addReplyToRequest(id, reply);
      return this.ok(null, "Reply sent");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteRequest(requestId: string) {
    try {
      const id = this.parseId(requestId);
      await this.visitorService.deleteRequest(id);
      return this.ok(null, "Request deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteAllRequests() {
    try {
      await this.visitorService.deleteAllRequests();
      return this.ok(null, "All requests deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getVisitors(limitStr?: string, offsetStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const logs = await this.visitorService.getVisitorLogs(limit, offset);
      return this.ok(logs);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
