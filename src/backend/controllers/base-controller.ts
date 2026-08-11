import { logger } from "../observability/logger";

export interface RequestContext {
  userId?: number;
  isAdmin?: boolean;
  ip: string;
  userAgent: string;
}

export interface ControllerResult {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  message?: string;
}

export class BaseController {
  protected ok(data: unknown, message?: string): ControllerResult {
    return { success: true, status: 200, data, message };
  }

  protected created(data: unknown, message?: string): ControllerResult {
    return { success: true, status: 201, data, message };
  }

  protected error(message: string, status = 400): ControllerResult {
    return { success: false, status, error: message };
  }

  protected notFound(message = "Not found"): ControllerResult {
    return { success: false, status: 404, error: message };
  }

  protected unauthorized(message = "Unauthorized"): ControllerResult {
    return { success: false, status: 401, error: message };
  }

  protected forbidden(message = "Forbidden"): ControllerResult {
    return { success: false, status: 403, error: message };
  }

  protected parseId(value: string | undefined): number {
    if (!value) throw new Error("INVALID_ID");
    const id = Number(value);
    if (isNaN(id) || id <= 0) throw new Error("INVALID_ID");
    return id;
  }

  protected parsePage(value: string | undefined, fallback = 1): number {
    if (!value) return fallback;
    const n = Number(value);
    return isNaN(n) || n < 1 ? fallback : n;
  }

  protected parseLimit(value: string | undefined, fallback = 20): number {
    if (!value) return fallback;
    const n = Number(value);
    return isNaN(n) || n < 1 ? fallback : Math.min(n, 100);
  }

  protected handleError(err: unknown): ControllerResult {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message === "INVALID_ID") return this.error("Invalid ID parameter", 400);
    if (message === "AUTH_REQUIRED") return this.unauthorized();
    if (message === "ADMIN_REQUIRED") return this.forbidden();
    if (message.includes("not found") || message.includes("Not found"))
      return this.notFound(message);
    logger.error("controller.unhandled_error", {
      message,
      name: err instanceof Error ? err.name : undefined,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return this.error(message, 500);
  }
}
