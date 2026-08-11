import { BaseController, type RequestContext } from "./base-controller";
import type { UserService } from "../services/user-service";

export class UserController extends BaseController {
  constructor(private userService: UserService) {
    super();
  }

  async getAll(limitStr?: string, offsetStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const result = await this.userService.getAllUsers(limit, offset);
      return this.ok(result);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getById(id: string) {
    try {
      const userId = this.parseId(id);
      const user = await this.userService.getUserById(userId);
      return this.ok(user);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async create(data: Record<string, unknown>, ctx: RequestContext) {
    try {
      const user = await this.userService.createUser(data, ctx.userId!, ctx.isAdmin!);
      return this.created(user, "User created");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async update(id: string, data: Record<string, unknown>, ctx: RequestContext) {
    try {
      const userId = this.parseId(id);
      const user = await this.userService.updateUser(userId, data, ctx.userId!, ctx.isAdmin!);
      return this.ok(user, "User updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(id: string, ctx: RequestContext) {
    try {
      const userId = this.parseId(id);
      await this.userService.deleteUser(userId, ctx.userId!, ctx.isAdmin!);
      return this.ok(null, "User deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getStats(id: string) {
    try {
      const userId = this.parseId(id);
      const stats = await this.userService.getUserStats(userId);
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async uploadAvatar(id: string, form: FormData, ctx: RequestContext) {
    try {
      const userId = this.parseId(id);
      const file = form.get("avatar");
      if (!(file instanceof File)) {
        return this.error("avatar file is required", 400);
      }
      const avatar = await this.userService.uploadAvatar(userId, file, ctx.userId!);
      return this.ok({ avatar }, "Avatar updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getActivity(id: string, limitStr?: string) {
    try {
      const userId = this.parseId(id);
      const limit = this.parseLimit(limitStr, 50);
      const activities = await this.userService.getUserActivity(userId, limit);
      return this.ok(activities);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSessions(id: string) {
    try {
      const userId = this.parseId(id);
      const sessions = await this.userService.getUserSessions(userId);
      return this.ok(sessions);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async changeAdminStatus(id: string, makeAdmin: boolean, ctx: RequestContext) {
    try {
      const userId = this.parseId(id);
      await this.userService.changeAdminStatus(userId, makeAdmin, ctx.userId!, ctx.isAdmin!);
      return this.ok(null, "Admin status updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async block(id: string, block: boolean, ctx: RequestContext) {
    try {
      const userId = this.parseId(id);
      await this.userService.blockUser(userId, block, ctx.userId!, ctx.isAdmin!);
      return this.ok(null, "User block status updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async search(query: string) {
    try {
      const users = await this.userService.searchUsers(query);
      return this.ok(users);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getVisitorLogs(limitStr?: string, offsetStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 50);
      const offset = this.parsePage(offsetStr, 0);
      const logs = await this.userService.getVisitors(limit, offset);
      return this.ok(logs);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSystemStats() {
    try {
      const stats = await this.userService.getSystemStats();
      return this.ok(stats);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getRecentActivities(limitStr?: string) {
    try {
      const limit = this.parseLimit(limitStr, 30);
      const activities = await this.userService.getRecentActivities(limit);
      return this.ok(activities);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
