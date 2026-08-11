import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  parseAuthFromRequest,
  buildContext,
  toNextResponse,
  handleRouteError,
  parseBody,
} from "@/backend/api/route-helpers";
import { shouldUseSecureCookies } from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const auth = parseAuthFromRequest(request);
    if (!auth) {
      return toNextResponse({ success: true, status: 200, data: { authenticated: false } });
    }
    const c = getControllers();
    return toNextResponse(await c.auth.getMe(auth.userId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const { username, password } = body;
    if (!username || !password) {
      return toNextResponse({
        success: false,
        status: 400,
        error: "Username and password are required",
      });
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const ctx = { ip, userAgent };
    const c = getControllers();
    const result = await c.auth.login(username as string, password as string, ctx);
    const response = toNextResponse(result);
    if (
      result.success &&
      result.data &&
      typeof result.data === "object" &&
      "token" in result.data
    ) {
      response.cookies.set("session_token", (result.data as { token: string }).token, {
        httpOnly: true,
        // Derived from NEXT_PUBLIC_APP_URL: https → Secure cookie, plain
        // internal HTTP (LAN) → normal cookie so login works without TLS.
        secure: shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 2 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = parseAuthFromRequest(request);
    if (!auth) {
      return toNextResponse({ success: false, status: 401, error: "Not authenticated" });
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const ctx = buildContext(request, auth);
    const c = getControllers();
    const result = await c.auth.logout(auth.userId, ctx);
    const response = toNextResponse(result);
    response.cookies.delete("session_token");
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
