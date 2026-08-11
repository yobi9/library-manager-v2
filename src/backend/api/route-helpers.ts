import { NextRequest, NextResponse } from "next/server";
import { getServices } from "../services";
import { type RequestContext, type ControllerResult } from "../controllers/base-controller";
import { resolveViewerCacheControl } from "./viewer-cache-control";
import { logger } from "../observability/logger";

export interface AuthContext {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export function getServices_() {
  return getServices();
}

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function successResponse(data: unknown, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
  });
}

export function parseAuthFromRequest(request: NextRequest): AuthContext | null {
  const cookieToken = request.cookies.get("session_token")?.value;
  const authHeader = request.headers.get("authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || headerToken;
  if (!token) return null;

  const services = getServices();
  const payload = services.auth.verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload["userId"] as number,
    username: payload["username"] as string,
    isAdmin: payload["is_admin"] as boolean,
  };
}

export function requireAuth(request: NextRequest): AuthContext {
  const auth = parseAuthFromRequest(request);
  if (!auth) throw new Error("AUTH_REQUIRED");
  return auth;
}

export function requireAdmin(request: NextRequest): AuthContext {
  const auth = requireAuth(request);
  if (!auth.isAdmin) throw new Error("ADMIN_REQUIRED");
  return auth;
}

export function getQueryParam(request: NextRequest, key: string): string | undefined {
  return request.nextUrl.searchParams.get(key) ?? undefined;
}

export function getQueryNumber(
  request: NextRequest,
  key: string,
  fallback?: number,
): number | undefined {
  const val = request.nextUrl.searchParams.get(key);
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

export async function handleRouteError(error: unknown): Promise<NextResponse> {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "AUTH_REQUIRED") {
    return errorResponse("Authentication required", 401);
  }
  if (message === "ADMIN_REQUIRED") {
    return errorResponse("Admin access required", 403);
  }
  console.error("[API Error]", error);
  logger.error("api.route_error", {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return errorResponse(message, 500);
}

export async function parseBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const result: Record<string, unknown> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          result[key] = value;
        } else if (key === "image" || key === "imageFile") {
          // ملف صورة (File) يُمرَّر في مفتاح موحّد للخدمة.
          result["imageFile"] = value;
        } else {
          result[key] = value;
        }
      }
      return result;
    } catch {
      return {};
    }
  }
  return {};
}

export function buildContext(request: NextRequest, auth?: AuthContext): RequestContext {
  return {
    userId: auth?.userId,
    isAdmin: auth?.isAdmin,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1",
    userAgent: request.headers.get("user-agent") || "",
  };
}

export function toNextResponse(result: ControllerResult): NextResponse {
  if (result.data instanceof Response) {
    return new NextResponse(result.data.body, {
      status: result.data.status,
      statusText: result.data.statusText,
      headers: result.data.headers,
    });
  }
  const body: Record<string, unknown> = {
    success: result.success,
    ...(result.data !== undefined ? { data: result.data } : {}),
    ...(result.message ? { message: result.message } : {}),
    ...(result.error ? { error: result.error } : {}),
  };
  return NextResponse.json(body, { status: result.status });
}

/**
 * Converts a controller result into a `NextResponse` for PUBLIC viewer GET data
 * endpoints, applying a conservative browser/CDN `Cache-Control` header (Phase 7).
 *
 * @remarks
 * Purpose: public viewer content (taxonomy, lists, search, channels) is safe to
 * cache in the browser for 60s — matching the server-side `CacheService` TTLs —
 * so repeated navigation avoids round-trips. The header is applied ONLY when
 * `viewer_access_mode === "public"`; in `protected` mode the response is marked
 * `no-store` so an authenticated session's data never leaks into a shared
 * browser/proxy cache. Error responses (status ≥ 400) are never cached.
 *
 * Admin and auth routes MUST keep using {@link toNextResponse} — this helper is
 * only for the viewer-facing routes listed in the plan's Phase 7.
 *
 * @param result - The controller result to serialize.
 * @returns The serialized `NextResponse` with a `Cache-Control` header set.
 */
export async function viewerResponse(result: ControllerResult): Promise<NextResponse> {
  const services = getServices();
  const settings = await services.settings.getAllSettings();
  const response = toNextResponse(result);
  response.headers.set(
    "Cache-Control",
    resolveViewerCacheControl(settings["viewer_access_mode"] ?? "public", response.status),
  );
  return response;
}
