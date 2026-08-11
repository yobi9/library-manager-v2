/**
 * HTTP cache policy for PUBLIC viewer GET data endpoints (Phase 7).
 *
 * Purpose
 * ----
 * Public viewer content (taxonomy, lists, search, channels) is safe to cache in
 * the browser for 60s — matching the server-side `CacheService` TTLs — so
 * repeated navigation avoids round-trips. In `protected` access mode the data
 * was fetched by an authenticated session and MUST NOT leak into a shared
 * browser/proxy cache, so those responses are marked `no-store`. Error
 * responses (status ≥ 400) are never cached.
 *
 * Source of truth
 * ----
 * Phase 7 of `docs/plans/cache-system-implementation-plan.md` (D8). The header
 * value is derived from the `viewer_access_mode` setting and the response
 * status. This module is deliberately free of backend imports so the decision
 * stays a pure, side-effect-free unit (used by `route-helpers.viewerResponse`
 * and covered by a throwaway verification script).
 *
 * Scope
 * ----
 * Viewer-facing routes only. Admin/auth routes MUST keep using
 * `toNextResponse` and never route through this policy.
 *
 * Limitations
 * ----
 * - `s-maxage` targets shared proxies/CDNs; in self-hosted LAN deployments it
 *   is a no-op but harmless.
 * - The 60s window is a safety net only — server-side invalidation
 *   (`CacheInvalidator`) keeps freshness within the app.
 */
export const VIEWER_CACHE_PUBLIC_HEADER = "public, max-age=60, s-maxage=60";

/** Header applied to viewer responses that must not be stored (protected mode / errors). */
export const VIEWER_CACHE_NO_STORE_HEADER = "no-store";

/**
 * Resolves the `Cache-Control` value for a viewer response.
 *
 * @param mode - The `viewer_access_mode` setting value (`"public"` or otherwise).
 * @param status - The HTTP status code of the response being produced.
 * @returns `VIEWER_CACHE_PUBLIC_HEADER` only when mode is `"public"` AND the
 *          status is a success (2xx/3xx); `VIEWER_CACHE_NO_STORE_HEADER` in
 *          every other case (protected mode, unknown mode, or error status).
 */
export function resolveViewerCacheControl(mode: unknown, status: number): string {
  if (mode === "public" && status < 400) {
    return VIEWER_CACHE_PUBLIC_HEADER;
  }
  return VIEWER_CACHE_NO_STORE_HEADER;
}
