import { BaseController, type RequestContext } from "./base-controller";
import type { AuthService } from "../services/auth-service";

export class AuthController extends BaseController {
  constructor(private authService: AuthService) {
    super();
  }

  async login(username: string, password: string, ctx: RequestContext) {
    if (!username || !password) return this.error("Username and password are required");
    try {
      const result = await this.authService.login(username, password, ctx.ip, ctx.userAgent);
      return this.ok(result, "Login successful");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.startsWith("Account locked")) return this.error(msg, 423);
      if (msg === "Invalid credentials") return this.error(msg, 401);
      return this.error(msg, 500);
    }
  }

  async getMe(userId: number) {
    try {
      const user = await this.authService.getCurrentUser(userId);
      return this.ok(user);
    } catch {
      return this.notFound("User not found");
    }
  }

  async logout(userId: number, ctx: RequestContext) {
    try {
      await this.authService.logout(userId, ctx.ip, ctx.userAgent);
      return this.ok(null, "Logged out");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ) {
    try {
      await this.authService.changePassword(
        userId,
        currentPassword,
        newPassword,
        ctx.ip,
        ctx.userAgent,
      );
      return this.ok(null, "Password changed");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async register(userData: Record<string, unknown>, ctx: RequestContext) {
    try {
      const result = await this.authService.register(
        userData as { username: string; password: string; email?: string; display_name?: string },
        ctx.ip,
        ctx.userAgent,
      );
      return this.created(result, "User registered");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async hasActiveSession(userId: number) {
    const active = await this.authService.hasActiveSession(userId);
    return this.ok({ active });
  }

  async getTotalUsers() {
    const total = await this.authService.getTotalUsers();
    return this.ok({ total });
  }
}
