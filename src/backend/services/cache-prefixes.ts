/**
 * Central registry of CacheService key prefixes (D12).
 *
 * Purpose
 * ----
 * Cache invalidation depends on `deleteByPrefix` matching keys by a stable prefix
 * (`${prefix}:${hash}`). If every layer hard-coded its own string, a single typo
 * would silently break invalidation. This module is the single source of truth for
 * those prefixes so producers (services that `set`) and consumers (the
 * `CacheInvalidator`) always agree.
 *
 * Source of truth
 * ----
 * Decision D12 of `docs/plans/cache-system-implementation-plan.md`. The prefix values
 * themselves are opaque strings — never parse or interpret them outside this file.
 *
 * Scope
 * ----
 * Covers every cache domain planned across implementation phases 2–6 (settings,
 * dashboard, media detail, media lists, recommendations, catalog/taxonomies,
 * search, database counters, and users). Phases that have not been implemented yet
 * simply hold no keys under their prefix.
 *
 * Limitations
 * ----
 * - Prefixes MUST NOT contain `:` — `CacheService.generateKey` builds keys as
 *   `${prefix}:${hash}`, and `deleteByPrefix` splits on `:`.
 * - This registry is compile-time only: there is no runtime validation that a service
 *   used the exact constant. A typo would still fail to match, but using these
 *   constants (never string literals) makes such a mismatch a compile error or an
 *   obviously unreachable value instead of a silent bug.
 *
 * Completeness
 * ----
 * Complete for the current plan. Add new prefixes here — never inline — when a new
 * cache domain is introduced.
 */
export const CachePrefixes = {
  /** Settings rows + the viewer access mode flag read on every viewer request. */
  settings: "settings",
  /** Aggregated admin dashboard counters and activity summaries. */
  dashboard: "dashboard",
  /** Paginated media list/filter responses (viewer + admin items-control). */
  media: "media",
  /** Single-item detail payloads (media detail, player, watch-later seeds). */
  mediaDetail: "media-detail",
  /** Home-page recommendations and pinned/favorites slider payloads. */
  recommendations: "recommendations",
  /** Taxonomies: genres, years, certifications, ratings (+ catalog sections). */
  catalog: "catalog",
  /** Full-text search (FTS5) result pages. */
  search: "search",
  /** Whole-database counts/totals (also invalidated on every scan). */
  database: "database",
  /** Admin user management rows. */
  users: "users",
} as const;

/**
 * Discriminated union of every registered cache prefix.
 *
 * @remarks
 * Derived from `CachePrefixes` so the set can never drift from the registry above.
 */
export type CachePrefix = (typeof CachePrefixes)[keyof typeof CachePrefixes];
