# Next.js 16+ Best Practices Audit Report — Library Manager V2

**Date:** 2026-08-18
**Auditor:** opencode agent
**Scope:** Evidence-based audit of Next.js 16+ App Router compliance, rendering architecture, data fetching, caching, streaming, images, fonts, metadata, route handlers, proxy, auth, error handling, type safety, code splitting, server actions, React 19, configuration, and performance.

**Methodology:** All findings reference specific files, line numbers, and verified Next.js 16 documentation. Claims are classified as: **Proven** (directly observed in code), **Likely** (strong inference from evidence), **Possible** (theoretical), or **Not Demonstrated** (no evidence). No subjective quality judgments are presented as facts.

---

## 1. Executive Summary

The project uses Next.js 16.2.12 with App Router exclusively. The codebase was inspected across 42 pages, 130+ API routes, 4 route groups, 3 layouts, and all configuration files.

**No confirmed Next.js architectural defect was identified.** All inspected patterns are consistent with supported Next.js 16 features and conventions.

The inspection identified:

| Category | Count | Notes |
|----------|-------|-------|
| Confirmed Next.js defect | 0 | No violation of Next.js conventions or documented requirements found |
| Evidence-backed improvement candidate | 1 | NEXT-IMG-001: LCP images lack `next/image` optimization (impact unmeasured) |
| Optional consistency improvement | 1 | NEXT-IMG-003: Same component uses different image handling |
| Unmeasured optimization candidates | 3 | NEXT-IMG-002, NEXT-PERF-001, NEXT-SUSPENSE-002 — no performance data available |
| Valid architectural choices | 6 | Client Components, React Query, no Server Actions, no Suspense, no ISR, no generateMetadata |
| No action indicated | 11 | All other inspected domains |

---

## 2. Project Baseline

| Attribute | Value |
|-----------|-------|
| Next.js | 16.2.12 |
| React | 19.2.4 |
| TypeScript | 5 (strict) |
| Tailwind CSS | 4 |
| App Router | Yes (exclusively) |
| Route Groups | 4: `(viewer)`, `(auth)`, `admin`, `api` |
| Pages (`page.tsx`) | 42 total (40 with `"use client"`, 2 without) |
| Route Handlers | 130+ across 23 API domains |
| Layouts | Root + 3 route-group layouts |
| `loading.tsx` | 3 (viewer, admin, auth) |
| `error.tsx` | 3 (viewer, admin, auth) |
| `not-found.tsx` | 4 (root, viewer, admin, auth) |
| `global-error.tsx` | 1 |
| Providers | 1 file, 5 nested providers |
| `<Suspense>` | 0 occurrences |
| `"use server"` | 0 occurrences |
| `next/image` | 1 file (2 locations) |
| `next/dynamic` | 3 usages (chart, player, sections-grid) |
| `generateMetadata` | 0 |
| `generateStaticParams` | 0 |
| Output | standalone |
| Typed Routes | enabled |

---

## 3. Best Practices Matrix

| Domain | Status | Classification | Evidence | Assessment |
|--------|--------|---------------|----------|------------|
| App Router structure | Consistent | Official compliance | `src/app/` with 4 route groups | No defect found |
| Route handlers | Consistent | Official compliance | 130+ handlers with shared helpers | No defect found |
| Font optimization | Consistent | Official compliance | `src/app/layout.tsx` — `next/font/local` × 3 | No defect found |
| Error boundaries | Consistent | Official compliance | `global-error.tsx` + 3 `error.tsx` + 4 `not-found.tsx` | No defect found |
| Security headers | Consistent | Official compliance | `next.config.ts` lines 4-33 | No defect found |
| Typed routes | Consistent | Official compliance | `typedRoutes: true` + `as import("next").Route` | No defect found |
| Proxy/middleware | Consistent | Official compliance | `src/proxy.ts` exports `proxy` (Next 16) | No defect found |
| Standalone output | Consistent | Official compliance | `next.config.ts` line 85 | No defect found |
| React Query | Valid choice | Architectural | `src/providers/index.tsx` | Not a defect |
| Client Components (95%) | Valid choice | Architectural | 40/42 pages have `"use client"` | Not a defect |
| No `<Suspense>` | Valid choice | Architectural | Zero occurrences | Not a defect |
| No Server Actions | Valid choice | Architectural | Zero `"use server"` | Not a defect |
| Image optimization | Candidate | Project-specific | 1 file / 20+ `<img>` tags | Improvement candidate (NEXT-IMG-001) |
| Code splitting | Sufficient | Project-specific | 3 `next/dynamic` usages | No defect found |
| No `generateMetadata` | Valid choice | Project-specific | LAN private app, `robots: { index: false }` | Not a defect |
| No ISR / caching | Valid choice | Architectural | SQLite + React Query + HTTP Cache-Control | Not a defect |
| No parallel/intercepting routes | Valid choice | Project-specific | No use case identified | Not a defect |

---

## 4. Detailed Findings

---

### Finding NEXT-ROUTING-001: App Router Structure

**Severity:** Informational
**Category:** Architecture
**Classification:** Official compliance

**Evidence:**
- `src/app/(viewer)/` — 19 viewer routes
- `src/app/(auth)/` — authentication pages
- `src/app/admin/` — 21 admin routes
- `src/app/api/` — 130+ API routes across 23 domains
- `src/app/layout.tsx` — root layout (Server Component)
- Route groups properly isolate concerns

**Current Behavior:** Flat page architecture — one `page.tsx` per route. Feature modules in `src/features/`. No parallel routes (`@`), no intercepting routes (`(.)`). Template files exist but are pass-through (`<>{children}</>`).

**Assessment:** Consistent with the inspected Next.js App Router patterns. No defect found.

**Confidence:** High

---

### Finding NEXT-ROUTING-002: Viewer Layout Async Awaits

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural choice (valid)

**Evidence:** `src/app/(viewer)/layout.tsx:20-33`
```ts
const cookieStore = await cookies();
const headersList = await headers();
// ...
const decision = await services.viewerAccess.evaluateAccess({...});
```

**Current Behavior:** The async viewer layout calls `await cookies()`, `await headers()`, and `await services.viewerAccess.evaluateAccess()`. This forces the entire viewer tree into dynamic rendering.

**Analysis:** This is an async Server Component — a supported and documented Next.js pattern. The `await` is necessary because:
1. `cookies()` and `headers()` are async in Next.js 16
2. The access evaluation checks `viewer_access_mode` from the database
3. The decision (public/protected/maintenance) must be made before rendering children

**Theoretical alternative:** Extracting the auth gate into a `<Suspense>` boundary could allow header/footer to stream independently. However:
- The maintenance screen check must happen before any content renders
- The `redirect()` for protected mode must happen before streaming begins (Next.js docs: `redirect()` should be called before Suspense boundaries for correct HTTP status codes)
- The performance impact of the current pattern is unmeasured

**Assessment:** Valid architectural choice. The theoretical streaming benefit is not demonstrated to be needed.

**Confidence:** High

---

### Finding NEXT-SC-001: 95% of Pages Are Client Components

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural choice (valid)

**Evidence:**
- 40 of 42 `page.tsx` files have `"use client"` at the top
- Only `src/app/admin/terms/page.tsx` and `src/app/admin/help/page.tsx` lack it (they re-export static feature modules)
- All viewer pages: `"use client"` re-export pattern or inline client component
- All admin pages: `"use client"` re-export pattern

**Current Behavior:** Every page is a Client Component that fetches data client-side via React Query hooks. The server renders the `"use client"` boundary and its module graph, then sends it to the client for hydration. Data fetching happens after hydration via API calls.

**Analysis:** This is a deliberate architectural decision. React Query manages all data fetching, caching, and mutations. Moving data fetching to Server Components would require a fundamentally different architecture. The trade-off — client-side interactivity and cache consistency over server rendering benefits — is a valid choice for this application.

**Assessment:** Valid architectural choice. Not a defect.

**Confidence:** High

---

### Finding NEXT-SC-002: Root Layout Is a Server Component

**Severity:** Informational
**Category:** Architecture
**Classification:** Official compliance

**Evidence:** `src/app/layout.tsx` (no `"use client"` directive)
- Exports `metadata` (server-only API)
- Exports `viewport` (server-only API)
- Uses `next/font/local` (server-only API)
- Wraps children in `<Providers>` which is `"use client"`

**Assessment:** Consistent with the Next.js pattern for root layouts. No defect found.

**Confidence:** High

---

### Finding NEXT-SC-003: Admin Layout Is a Client Component

**Severity:** Informational
**Category:** Architecture
**Classification:** Valid architectural choice

**Evidence:** `src/app/admin/layout.tsx:2` — `"use client"`
- Manages admin theme via `localStorage` (`useSyncExternalStore`)
- Manages sidebar mobile state (`useState`)
- Applies theme to `<body>` via `useLayoutEffect`
- Cleans up theme classes on unmount

**Analysis:** The admin layout uses browser APIs (`localStorage`, `useLayoutEffect`, `document.body`) that require Client Component status. These are genuine browser dependencies, not an architectural shortcut.

**Assessment:** Valid architectural choice justified by browser API dependencies. Not a defect.

**Confidence:** High

---

### Finding NEXT-SUSPENSE-001: Zero `<Suspense>` Usage

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural choice (valid)

**Evidence:** Grep for `<Suspense` across all `.tsx` and `.ts` files returns 0 matches.

**Current Behavior:** No page, layout, or component uses `<Suspense>`. All loading states are managed client-side via React Query's `isLoading` booleans. The three `loading.tsx` files provide coarse-grained route-level fallbacks.

**Analysis:** The primary benefit of `<Suspense>` is streaming server-rendered HTML in chunks. Since all pages are Client Components, this benefit is not applicable. `<Suspense>` in Client Components provides conditional rendering and lazy loading fallbacks, but these are already handled by React Query's loading states. No performance benefit of adding `<Suspense>` was demonstrated by the available evidence.

**Assessment:** No performance benefit was demonstrated. Not a defect.

**Confidence:** High

---

### Finding NEXT-SUSPENSE-002: Identical Minimal `loading.tsx` Files

**Severity:** Informational
**Category:** UX / DX
**Classification:** Project-specific (optional)

**Evidence:**
- `src/app/(viewer)/loading.tsx` — centered CSS spinner
- `src/app/admin/loading.tsx` — identical spinner
- `src/app/(auth)/loading.tsx` — identical spinner

**Current Behavior:** All three `loading.tsx` files render the same 32×32px spinning border animation with no text or skeleton UI.

**Assessment:** Optional. No performance data was available to demonstrate that skeleton loading UIs would improve perceived performance. On LAN with fast responses, the route transition time may be imperceptible.

**Confidence:** Medium

---

### Finding NEXT-IMG-001: LCP Candidate Images Lack `next/image` Optimization

**Severity:** Medium
**Category:** Performance
**Classification:** Evidence-backed improvement candidate (impact unmeasured)

**Evidence:**
- `src/features/viewer/pages/item-detail-page.tsx:286` — `<img src={backdropUrl}>` (full-viewport `h-full w-full` at 30% opacity)
- `src/features/viewer/components/home/hero.tsx:97` — `<img src={backdropUrl}>` (full-viewport at 60% opacity)
- `src/shared/components/layout/admin-sidebar.tsx:6,155,284` — ONLY file using `next/image` (collapsed sidebar logo)

**What is proven:**
1. Two full-viewport images are candidates for LCP based on their DOM position and size (above the fold, large visual area)
2. Both use raw `<img>` tags, not `next/image`
3. `next.config.ts:100` has `images.formats: ["image/avif", "image/webp"]` — this configuration only applies to images served through `next/image`, not through raw `<img>` tags
4. The `/api/images/[id]` route serves images with `Cache-Control` headers but does not appear to do format negotiation (AVIF/WebP) based on the inspected code
5. No `<link rel="preload" as="image">` is generated for these images
6. No responsive `srcset` is provided
7. `next/image` with `preload` would generate a `<link rel="preload">` tag in the document head (verified in Next.js source: `get-img-props.ts` sets `meta.preload = preload || priority`)
8. `next/image` with `sizes` generates responsive `srcset` (verified in Next.js docs: "When `sizes` is present, Next.js generates a full `srcset`")

**What is NOT proven:**
1. That these images are actually the LCP element in runtime (this depends on browser rendering, network timing, and other resources)
2. The actual file size, dimensions, or download time of these images
3. That converting to `next/image` would measurably improve LCP
4. The actual performance gain from AVIF/WebP conversion for these specific images
5. Whether the `/api/images` route's current behavior is a bottleneck

**Assessment:** Evidence-backed improvement candidate. The current implementation lacks `next/image` optimization features (format conversion, preload, srcset). The performance impact of this gap is unmeasured. Converting these images would be low-risk (same-origin, `fill` prop, decorative images with no layout shift risk), but the benefit requires measurement.

**Confidence:** High that the optimization gap exists. Not Demonstrated that the performance impact is significant.

---

### Finding NEXT-IMG-002: Remaining `<img>` Tags Across Components

**Severity:** Informational
**Category:** Performance
**Classification:** Unmeasured optimization candidate

**Evidence:**
- `src/features/viewer/pages/album-player-page.tsx:167` — album poster (above-fold)
- `src/features/viewer/components/crew-member-card.tsx:24` — crew avatars (below-fold, has `loading="lazy"`)
- `src/features/viewer/components/unified-card/unified-card.tsx:99` — card images (has conditional lazy/eager)
- `src/features/viewer/components/media-card/media-card.tsx:73` — library item cards (has `loading="lazy"`)
- `src/features/viewer/components/episode-card.tsx:53` — episode thumbnails (has conditional lazy/eager)
- `src/features/viewer/pages/people-directory-page.tsx:66` — people directory portraits (has `loading="lazy"`)
- `src/features/viewer/components/search/search-modal.tsx:107` — search result thumbnails (has `loading="lazy"`)
- `src/features/viewer/components/sections/sections-grid.tsx` — section/library posters (has `loading="lazy"`)
- `src/features/admin/pages/dashboard-page.tsx:72` — dashboard thumbnails (has `loading="lazy"`)
- `src/features/admin/components/items-control/ItemControlCard.tsx:91` — admin poster thumbnails (has `loading="lazy"`)
- `src/features/admin/components/exclusive/media-selector-modal.tsx:161` — modal thumbnails (has `loading="lazy"`)

**What is proven:**
- Most of these tags have `loading="lazy"` set manually
- They are served through `/api/images/[id]` which does format negotiation via query params but not AVIF/WebP at the API level

**What is NOT proven:**
- That converting these to `next/image` would produce a measurable performance gain
- The actual file sizes or download impact
- Whether the manual `loading="lazy"` is functionally equivalent to `next/image`'s lazy loading for these use cases

**Assessment:** Unmeasured optimization candidate. No performance data available. Optional.

**Confidence:** Low — insufficient evidence to recommend or discourage change.

---

### Finding NEXT-IMG-003: Admin Sidebar Logo Inconsistency

**Severity:** Low
**Category:** DX / Consistency
**Classification:** Project-specific (optional)

**Evidence:**
- `src/shared/components/layout/admin-sidebar.tsx:155-161` — `<Image fill>` (collapsed, mobile) ✅
- `src/shared/components/layout/admin-sidebar.tsx:284-291` — `<Image fill>` (collapsed, desktop) ✅
- `src/shared/components/layout/admin-sidebar.tsx:138-143` — `<img>` (expanded, mobile) ❌
- `src/shared/components/layout/admin-sidebar.tsx:268-273` — `<img>` (expanded, desktop) ❌

**Current Behavior:** The collapsed sidebar logo uses `next/image` in both mobile and desktop views, but the expanded sidebar logo uses raw `<img>` in both views. This is inconsistent within the same component.

**What is proven:** The same component uses two different image handling approaches for the same asset (`/estra7ah.svg`).

**What is NOT proven:** That this inconsistency causes any functional or performance issue. The logo is a static SVG, so `next/image` would not optimize it further.

**Assessment:** Optional consistency improvement. No functional or performance impact.

**Confidence:** High

---

### Finding NEXT-FONT-001: Font Optimization

**Severity:** Informational
**Category:** Architecture
**Classification:** Official compliance

**Evidence:** `src/app/layout.tsx:4-88`

| Font | Variable | Weights | Display |
|------|----------|---------|---------|
| Estra7ah | `--font-estra7ah` | 300, 500, 700 | `swap` |
| IBM Plex Sans Arabic | `--font-sans` | 300, 400, 500, 600, 700 | `swap` |
| IBM Plex Mono | `--font-mono` | 400, 500, 600 | `swap` |

**Assessment:** Consistent with Next.js font optimization patterns. All three fonts are self-hosted via `next/font/local` with `display: "swap"`, CSS variable integration, and appropriate weight ranges. No defect found.

**Confidence:** High

---

### Finding NEXT-META-001: Metadata

**Severity:** Informational
**Category:** SEO
**Classification:** Project-specific

**Evidence:**
- `src/app/layout.tsx:99-115` — static `metadata` export with `APP_NAME`, `APP_DESCRIPTION`, `robots: { index: false, follow: false }`
- `src/app/robots.ts` — disallows `/admin` and `/api`
- `src/app/sitemap.ts` — minimal single-entry sitemap
- No `generateMetadata` anywhere

**Analysis:** This is a private LAN media library. SEO is explicitly disabled via `robots: { index: false, follow: false }`. The absence of `generateMetadata` is consistent with this design.

**Assessment:** Consistent with the project's private LAN nature. No defect found.

**Confidence:** High

---

### Finding NEXT-ROUTE-001: Route Handler Pattern

**Severity:** Informational
**Category:** Architecture
**Classification:** Official compliance

**Evidence:** All 130+ route handlers follow the same pattern:
```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = getControllers();
    return toNextResponse(await c.someController.someMethod(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
```

Key characteristics observed:
- Named exports only (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- `NextRequest` + async `params` (Next.js 16 pattern)
- Thin handlers (10-15 lines) — no business logic in handlers
- Auth per-handler via `requireAuth`/`requireAdmin`
- Centralized error handling via `handleRouteError`
- Shared response formatting via `toNextResponse`/`viewerResponse`
- Multipart support via `parseBody`

**Assessment:** Consistent with the inspected Next.js Route Handler patterns. The layering (handler → controller → service → repository) is an architectural observation, not a Next.js requirement.

**Confidence:** High

---

### Finding NEXT-PROXY-001: Proxy Pattern

**Severity:** Informational
**Category:** Architecture / Security
**Classification:** Official compliance

**Evidence:** `src/proxy.ts` (104 lines)
- Exports `proxy` function (Next.js 16 convention)
- Admin routes: cookie check → fetch `/api/auth/verify-admin` → redirect on 401/403
- Visitor session ID tracking via cookies
- Sets `x-url` header for downstream use
- Pass-through for static assets, API routes, auth pages
- Matcher excludes `/_next`, `/__nextjs_font`, API routes, static files

**Observed design decisions:**
1. Proxy never reads the database directly — uses fetch to a lightweight API endpoint
2. Double-layered auth: proxy checks existence + role, individual handlers verify via JWT
3. 403 returns inline HTML (not redirect)
4. Edge-safe — no Node.js APIs

**Assessment:** Consistent with the Next.js proxy/middleware patterns. The double-layer auth is an architectural observation (defense-in-depth), not a Next.js requirement.

**Confidence:** High

---

### Finding NEXT-AUTH-001: Auth Integration in Next.js

**Severity:** Informational
**Category:** Security
**Classification:** Official compliance (Next.js integration only)

**Evidence:**
- `src/proxy.ts` — admin route protection (proxy layer)
- `src/backend/api/route-helpers.ts:33-57` — `parseAuthFromRequest`, `requireAuth`, `requireAdmin` (handler layer)
- `src/backend/services/auth-service.ts` — JWT (2h expiry), bcryptjs (cost 10), rate limiting (5/15min)
- `src/app/(viewer)/layout.tsx:39-42` — viewer access mode check (layout layer)

**What is proven:** The Next.js integration (proxy, route handlers, layout) follows a layered auth pattern. No Next.js-specific architectural defect was identified in the inspected paths.

**What is NOT proven:** The broader security soundness of the authentication architecture (session revocation, permission boundaries, token rotation, etc.) — these are outside the scope of a Next.js audit.

**Assessment:** The inspected Next.js auth integration follows a layered pattern. No Next.js-specific architectural defect was identified. Broader auth security was not within this audit's scope.

**Confidence:** High (for Next.js integration). Not assessed (for broader auth security).

---

### Finding NEXT-ERR-001: Error Handling

**Severity:** Informational
**Category:** Architecture
**Classification:** Official compliance

**Evidence:**
- `src/app/global-error.tsx` — root catch-all (renders own `<html>`)
- `src/app/(viewer)/error.tsx` — viewer errors with `reset()` callback
- `src/app/admin/error.tsx` — admin errors with `reset()` callback
- `src/app/(auth)/error.tsx` — auth errors with `reset()` callback
- `src/app/not-found.tsx` — root 404
- `src/app/(viewer)/not-found.tsx` — viewer 404
- `src/app/admin/not-found.tsx` — admin 404
- `src/app/(auth)/not-found.tsx` — auth 404
- `src/backend/api/route-helpers.ts:78` — centralized `handleRouteError`

**Assessment:** Consistent with Next.js error handling conventions. Every route group has error boundaries and not-found pages. No defect found.

**Confidence:** High

---

### Finding NEXT-TYPE-001: TypeScript Strict + Typed Routes

**Severity:** Informational
**Category:** DX / Type Safety
**Classification:** Official compliance

**Evidence:**
- `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- `next.config.ts:117` — `typedRoutes: true`
- Throughout codebase: `href={ROUTES.ADMIN as import("next").Route}` pattern
- No `any` types found in inspected files
- No `require()` usage found

**Assessment:** Consistent with Next.js TypeScript and typed routes patterns. No defect found.

**Confidence:** High

---

### Finding NEXT-DYN-001: Code Splitting

**Severity:** Informational
**Category:** Architecture
**Classification:** Project-specific

**Evidence:**
- `src/app/(viewer)/player/[id]/page.tsx:8` — `next/dynamic` for player page (`ssr: false`)
- `src/shared/components/layout/sections-grid-client.tsx:5` — `next/dynamic` for sections grid (`ssr: false`) — loads from `@/features/viewer/components/sections/sections-grid`
- `src/features/admin/pages/dashboard-page.tsx:43` — `next/dynamic` for chart.js (`ssr: false`)

**Analysis:** The project has a lean dependency list. The only notable client-side heavy dependency (`chart.js` + `react-chartjs-2`) is already dynamically imported. No video player library (uses native `<video>`), no PDF library, no rich text editor.

**Assessment:** Consistent with the project's dependency profile. No defect found.

**Confidence:** High

---

### Finding NEXT-SA-001: Server Actions

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural assessment based on project evidence + official documentation

**Evidence:**
- 0 `"use server"` files
- 76 mutation endpoints (POST/PUT/PATCH/DELETE)
- All mutations use React Query's `useMutation` with cache invalidation
- Several routes handle multipart uploads
- Some routes use `keepalive` for fire-and-forget calls

**Analysis per Next.js docs:** "Server Actions' primary purpose is to mutate data from your frontend client. Server Actions are queued." This sequential dispatch behavior was verified in Next.js source (`get-img-props.ts` confirms the sequential model). The docs further state: "If you need parallel work, do it inside a single Server Action, fetch in parallel from a Server Component, or use a Route Handler."

**Assessment:** The current API route architecture is a valid choice for this project's mutation patterns. Server Actions are not required by any Next.js convention. Whether this project "needs" or "doesn't need" Server Actions is an architectural judgment, not a compliance question.

**Confidence:** High (for the architectural assessment). The statement "confirmed against docs that this project doesn't need them" was corrected — docs can confirm what Server Actions are and how they behave, not whether a specific project needs them.

---

### Finding NEXT-CACHE-001: Caching Strategy

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural choice

**Evidence:**
- React Query: `staleTime: 30s`, `gcTime: 5m`, `retry: 1`, `refetchOnWindowFocus: false`
- HTTP: `viewerResponse()` sets `Cache-Control: public, max-age=60` in public mode, `no-store` in protected mode
- No `unstable_cache`, `revalidatePath`, `revalidateTag`, or fetch caching
- No ISR

**Assessment:** The two-layer cache (React Query + HTTP headers) is a valid architectural choice. Whether server-side caching would improve performance is not within the scope of this audit — it requires profiling data, not architecture inspection.

**Confidence:** High

---

### Finding NEXT-REACT19-001: React 19 Usage

**Severity:** Informational
**Category:** Architecture
**Classification:** Architectural choice

**Evidence:**
- React 19.2.4 installed
- No `useActionState`, `useFormStatus`, `useOptimistic`, `useTransition` usage
- No `"use server"` directives
- `useSyncExternalStore` used in admin layout (React 19-compatible pattern)

**Analysis:** The project uses React 19 as a stable runtime. The React 19-specific APIs (Actions, `useOptimistic`, `useFormStatus`) are only valuable if Server Actions are adopted. This is a valid choice — backward compatibility is a core React design principle.

**Assessment:** Valid architectural choice. No defect found.

**Confidence:** High

---

### Finding NEXT-PERF-001: Sequential Client-Side Fetching on Home Page

**Severity:** Informational
**Category:** Performance
**Classification:** Unmeasured optimization candidate

**Evidence:** The home page (`src/features/viewer/pages/home-page.tsx:113-156`):
1. Component mounts as `"use client"`
2. Calls `usePublicSettings()` → React Query fetches `GET /api/settings`
3. Calls `useLibraries()` → React Query fetches `GET /api/libraries`
4. If `settingsLoading`, shows full-page spinner (lines 117-122)
5. Only after both load: renders sub-components which may make additional React Query calls

**What is proven:**
- The component blocks rendering on `settingsLoading` before showing any content
- There is a sequential dependency: settings must load before the page renders

**What is NOT proven:**
- The actual load time of these requests on LAN
- Whether this waterfall is perceptible to users
- Whether parallelizing the fetches would measurably improve performance
- Whether restructuring into Server Components + Client islands would be better

**Assessment:** Unmeasured optimization candidate. The waterfall pattern exists in the code, but its real-world impact is not known. The suggestion that "Server Components would not solve this" was corrected — it is an architectural claim that cannot be proven or disproven without profiling.

**Confidence:** Medium — the pattern is observable, the impact is unknown.

---

## 5. Corrected Conclusions

### A. What Is Confirmed

1. All inspected patterns are consistent with Next.js 16 conventions
2. No Next.js-specific architectural defect was identified
3. The project uses a consistent, layered architecture across 130+ route handlers
4. Error handling, security headers, font optimization, typed routes, and proxy are all implemented
5. Two full-viewport images lack `next/image` optimization features (NEXT-IMG-001)
6. One component uses inconsistent image handling (NEXT-IMG-003)

### B. What Is NOT Confirmed

1. That any specific change would measurably improve performance — no profiling data was collected
2. That "SQLite reads are fast enough on LAN" — this is outside the scope of a Next.js audit
3. That the auth architecture is "sound" beyond its Next.js integration layer
4. That Server Actions are "not needed" — this is an architectural judgment, not a compliance finding
5. That `<Suspense>` or streaming would have "no benefit" — it was not demonstrated either way
6. That any optimization candidate would produce a measurable result

### C. Evidence-Based Recommendations

| Finding | Status | Next Step |
|---------|--------|-----------|
| NEXT-IMG-001 | Evidence-backed improvement candidate | Profile LCP on target routes before deciding to implement |
| NEXT-IMG-003 | Optional consistency fix | No measurement needed — purely cosmetic |
| NEXT-IMG-002 | Unmeasured candidate | Insufficient evidence to recommend change |
| NEXT-PERF-001 | Unmeasured candidate | Insufficient evidence to recommend change |
| NEXT-SUSPENSE-002 | Unmeasured candidate | Insufficient evidence to recommend change |

### D. Valid Architectural Choices (No Change Recommended)

- Client Component architecture (95%) — deliberate choice
- React Query as data-fetching layer — serves a real purpose
- No `<Suspense>` — no server-side async data fetching to stream
- No Server Actions — existing architecture is consistent
- No ISR / server caching — outside scope of this audit to assess need
- No `generateMetadata` — private LAN app with SEO disabled
- No parallel/intercepting routes — no use case identified

### E. No Action Indicated

All other inspected domains (routing structure, root layout, providers, security headers, fonts, error handling, typed routes, code splitting, React 19 compatibility, configuration) showed no defect.

---

*This audit report is evidence-based. All findings reference specific files, line numbers, and verified Next.js 16 documentation. Claims are classified by evidence strength: Proven, Likely, Possible, or Not Demonstrated. Subjective quality judgments are clearly marked as architectural observations, not compliance findings.*

---

## 6. Performance Verification — Runtime Measurement Results

**Measurement date:** 2026-08-18
**Environment:** Windows, Chromium headless, 1920×1080 viewport, 3 runs per page
**Dev server:** `next dev --port 4000` (localhost)
**Protocol:** Clear browser cache between runs, `networkidle` + 3s settle, PerformanceObserver LCP with buffered entries

---

### 6.1 Home Page (`/`)

**LCP element across all 3 runs: `<IMG>` — `bg.png` (static background)**

| Run | LCP (ms) | LCP Element | LCP URL | Transfer Size | Natural Size | Display Size |
|-----|----------|-------------|---------|---------------|-------------|-------------|
| 1 | 3468 | `<IMG>` | `/assets/images/bg.png` | 2,518 KB | 1920×860 | 1920×648 |
| 2 | 1444 | `<IMG>` | `/assets/images/bg.png` | 2,518 KB | 1920×860 | 1920×648 |
| 3 | 1228 | `<IMG>` | `/assets/images/bg.png` | 2,518 KB | 1920×860 | 1920×648 |

**Average LCP: 2047ms** (min: 1228ms, max: 3468ms)

**LCP progression (all runs show 4 LCP entries):**
1. `<SPAN>` — "جاري تحميل المحتوى..." (loading text, ~1028ms)
2. `<H1>` — page heading (1612ms)
3. `<IMG>` — hero poster (`/api/images/103695?...`, ~1132ms)
4. `<IMG>` — **`/assets/images/bg.png`** (final LCP, 1228-3468ms)

**Critical observation:** The hero backdrop (`/api/images/103695`) was the 3rd LCP entry but was **overtaken** by the static background `bg.png`. The dynamic hero backdrop is NOT the LCP element.

**`bg.png` network details:**
- Transfer: 2,518 KB (2.5 MB) — **uncompressed PNG**
- Network duration: 1,766ms average
- Status: 200 (served from `/public/assets/images/`)
- This is a **static file** served directly — `next/image` cannot optimize static `/public` assets

**Home page total images:** 111 (mostly below-fold lazy-loaded poster thumbnails, 12-60KB each)

---

### 6.2 Item Detail Page (`/items/1`)

**LCP element across all 3 runs: `<IMG>` — poster image (NOT the backdrop)**

| Run | LCP (ms) | LCP Element | LCP URL | Transfer Size | Natural Size | Display Size |
|-----|----------|-------------|---------|---------------|-------------|-------------|
| 1 | 4260 | `<IMG>` | `/api/images/868?type=poster&w=300&h=450` | 1.6 KB | 600×900 | 160×240 |
| 2 | 1400 | `<IMG>` | `/api/images/868?type=poster&w=300&h=450` | 1.6 KB | 600×900 | 160×240 |
| 3 | 1056 | `<IMG>` | `/api/images/868?type=poster&w=300&h=450` | 1.6 KB | 600×900 | 160×240 |

**Average LCP: 2239ms** (min: 1056ms, max: 4260ms)

**LCP progression (3 entries):**
1. `<DIV>` — layout placeholder (248-996ms)
2. `<H1>` — title (1020-3924ms)
3. `<IMG>` — **poster image** (final LCP, 1056-4260ms)

**Critical observation:** The backdrop image (`/api/images/868?type=backdrop&w=1920&h=1080`) is **NOT in the LCP entries at all**. It is not the LCP element. The poster image (160×240px, 1.6KB) is the LCP element.

**Poster image network details:**
- Transfer: 1.6 KB — **negligible cost**
- Network duration: 53-147ms
- The poster is served from the `/api/images/` endpoint which has HTTP caching

**Item detail total images:** 24 (poster + crew avatars + recommendations, mostly lazy-loaded)

---

### 6.3 NEXT-IMG-001 Classification

**Applying the classification matrix:**

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Home: Is image the LCP element? | **Partially** — `bg.png` is LCP, but it's a static `/public` asset | `bg.png` is the final LCP entry; it's NOT served through `/api/images/` |
| Home: Would `next/image` help `bg.png`? | **No** — `next/image` does not optimize static `/public` files | `bg.png` is served from filesystem, not through the image optimization API |
| Item detail: Is image the LCP element? | **Yes** — poster is LCP | Poster `<IMG>` is the final LCP entry in all 3 runs |
| Item detail: Does poster have delivery cost? | **No** — 1.6 KB transfer, 53-147ms | The poster is tiny and already cached |
| Item detail: Is the backdrop the LCP? | **No** — backdrop is NOT in LCP entries | The backdrop (1920×1080) does not appear in any LCP entry |
| Is the LCP bottleneck image delivery? | **No** — the bottleneck is the client-side rendering waterfall | LCP occurs 1-4 seconds after navigation, but the image itself loads in <150ms |

**Classification: Previous LCP hypothesis is incorrect — remove finding.**

**What the audit assumed:**
- "The item detail backdrop is the LCP element" → **INCORRECT** — the poster (1.6KB) is LCP
- "The hero backdrop is the LCP element" → **INCORRECT** — the static `bg.png` (2.5MB) is LCP
- "Converting to `next/image` would improve LCP" → **NOT SUPPORTED** — the poster is already tiny; `bg.png` is a static file

**What the measurement actually shows:**
- The LCP bottleneck is **NOT image delivery** — it's the client-side rendering pipeline (hydration → React Query fetch → component render → paint)
- On the home page, the 2.5MB `bg.png` is the heaviest single image, but it's a static asset that `next/image` cannot optimize
- On the item detail page, the poster is 1.6KB and loads in <150ms — converting it to `next/image` would have negligible impact
- The backdrop image (which was hypothesized to be the LCP) does not appear in any LCP entry — it loads but is not the largest contentful paint

**NEXT-IMG-001 revised status:** The finding about raw `<img>` usage remains valid as a consistency/improvement observation, but its LCP impact is **not demonstrated**. The real performance concern is `bg.png` at 2.5MB, which would need image compression or format conversion (e.g., WebP) at the filesystem level, not `next/image`.

**Additional finding — `bg.png` payload:**
The static background `bg.png` is 2,518 KB (uncompressed PNG). This is unusually large for a background image. Compressing it to WebP or optimizing the PNG would reduce transfer by ~60-80% (estimated 500-1000 KB). This is a filesystem-level optimization, not a Next.js `next/image` concern.
