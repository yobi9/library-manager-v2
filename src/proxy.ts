import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const adminPaths = ["/admin"];
const authPaths = ["/login", "/register", "/forgot-password"];
const passThroughPaths = [
  "/_next",
  "/api",
  "/favicon.ico",
  "/assets",
  "/images",
  "/robots.txt",
  "/sitemap.xml",
];

function isMatch(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Resolve a stable visitor session id (existing cookie or a fresh UUID).
  const existingVisitorId = request.cookies.get("visitor_session_id")?.value;
  const visitorId = existingVisitorId ?? crypto.randomUUID();

  // Forward the resolved id to the request itself so the viewer layout can
  // record the very first visit (the cookie is only visible from the NEXT
  // request). Edge proxy never touches the DB.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-visitor-session-id", visitorId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-url", request.nextUrl.pathname + request.nextUrl.search);

  if (!existingVisitorId) {
    response.cookies.set("visitor_session_id", visitorId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Pass through static assets, API routes, etc.
  if (isMatch(pathname, passThroughPaths)) {
    return response;
  }

  // Auth routes (login, register, forgot-password) — always allow
  if (isMatch(pathname, authPaths)) {
    return response;
  }

  // Admin routes — always protected (auth + admin role)
  if (isMatch(pathname, adminPaths)) {
    const token = request.cookies.get("session_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const verifyUrl = new URL("/api/auth/verify-admin", request.url);
      const verifyRes = await fetch(verifyUrl, {
        headers: { cookie: `session_token=${token}` },
      });

      if (verifyRes.status === 401) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      if (verifyRes.status === 403) {
        return new NextResponse(
          `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>غير مصرح</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fafafa}div{text-align:center}h1{font-size:3rem;margin:0;color:#ef4444}p{font-size:1.125rem;color:#a1a1aa}a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><div><h1>403</h1><p>ليس لديك صلاحية الوصول إلى لوحة التحكم</p><a href="/">العودة إلى الصفحة الرئيسية</a></div></body></html>`,
          { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }

      if (!verifyRes.ok) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Viewer routes — pass through (protection handled by viewer layout)
  response.headers.set("x-url", request.nextUrl.pathname + request.nextUrl.search);
  return response;
}

export const config = {
  matcher: ["/((?!_next|__nextjs_font|favicon.ico|assets|images|robots.txt|sitemap.xml).*)"],
};
