# AGENTS.md — Library Manager V2

A full-stack **Next.js 16.2 / React 19.2** monolith — Arabic media library manager (RTL, `lang="ar"`). Migrated from `library-manager77`.

## Quick start

```bash
npm install
npm run dev        # Turbopack on :4000
npm run build      # Prod build
npm run lint       # ESLint 9 flat config
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests (also: npm run test:watch)
npm run format:check   # prettier --check . (also: npm run format --write)
```
# AGENTS.md — library-manager-v3

Library/media manager: Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript 5 strict, Tailwind 4, native SQLite, LAN deployment, Windows installer.

## Hard Rules

* **Read before writing.** Before modifying any file, read the relevant existing implementation and its surrounding context.
* **Do not guess.** Never invent APIs, file paths, types, database relationships, configuration values, or project conventions. Verify them in the actual codebase first.
* **Do not assume.** If the required behavior, architecture, ownership, or intended outcome is unclear, stop and ask before making a change.
* **Follow the existing implementation.** Prefer established project patterns over introducing a new abstraction, convention, dependency, or architecture.
* **Trace before changing.** For bugs or behavior changes, trace the relevant flow end-to-end before editing: route/page → API → controller → service → repository → database, as applicable.
* **Check all consumers.** Before changing a shared function, type, API contract, repository method, service, hook, or component, inspect its callers and consumers.
* **Preserve business logic.** Do not silently change behavior while refactoring, reorganizing, deduplicating, or improving code.
* **No speculative fixes.** Do not make changes merely because something looks unusual, duplicated, unused, or inconsistent. First establish whether it is actually incorrect and why.
* **No broad rewrites.** Make the smallest justified change that solves the verified problem. Do not rewrite unrelated code.
* **Use the project's existing abstractions.** Do not bypass controllers, services, repositories, DI, API helpers, cache infrastructure, or other established boundaries without verifying that the existing abstraction is insufficient.
* **Verify before declaring success.** After a change, run the narrowest relevant validation first, then broader checks when appropriate. Do not claim a fix is complete without evidence.
* **Document modified functions.** Every function created or modified must have complete TSDoc according to the project's documentation standard. Documentation must be placed above the function, not only in a separate documentation file.
* **Do not hide uncertainty.** If evidence is incomplete or conflicting, explicitly report what is known, what is unknown, and what needs to be checked. Do not present an assumption as a fact.
* **Do not perform destructive operations without explicit approval.** This includes destructive SQL, deleting production data, removing migrations, mass file deletion, or irreversible project-wide transformations.

## Commands

* `npm run dev` — dev server on port **4000**
* `npm run dev:lan` / `npm run start:lan` — LAN bind via `scripts/start-lan.mjs` (HOST default `0.0.0.0`, PORT default **4000**)
* `npm run build` — production build (standalone)
* `npm run typecheck` — `tsc --noEmit`
* `npm run lint` — eslint
* `npm run format` / `format:check` — prettier
* `npm run test` / `npm run test:watch` — vitest
* `npm run release` — full release build (see `release-and-installer` skill)
* `npm run fetch-tools` — download node.exe + nssm.exe into `tools/`

## Module aliases

`@/` → `src`, plus `@backend/`, `@lib/`, `@features/`, `@shared/`, `@tests/` (configured in `tsconfig.json` and `vitest.config.ts`).

## Testing requirements

* Tests need the env defaults in `src/tests/setup.ts`. Never omit `JWT_SECRET` — `auth-service.ts` throws FATAL at module load without it.
* `DATABASE_URL=:memory:` is the test default. Never let tests touch the live `data/media_library.db`.
* New tests go in `src/tests/unit/` (node env, no jsdom).

## Backend invariants

* Strict layering: route handlers → controllers → services → repositories. No SQL in services, no repository calls from route handlers.
* Auth is per-handler via `src/backend/api/route-helpers.ts` (`parseAuthFromRequest`/`requireAuth`/`requireAdmin`). `src/backend/middleware/` is empty; don't assume a global guard.
* DI via lazy singletons: `getServices()` (`src/backend/services/index.ts`) and `getControllers()` (`src/backend/controllers/index.ts`).
* Comments in this codebase are written in Arabic — keep new comments consistent.

## Database

* Native sqlite3; WAL mode. Path from `DATABASE_URL`/`DB_PATH`, else win32 `%PROGRAMDATA%\LibraryManager\media_library.db`, else `./data/media_library.db`.
* Writer context: scanner/background writes must use `runInWriterContext`. During an active scan, background jobs skip to avoid `SQLITE_BUSY`.
* Migrations: numbered SQL files `src/backend/db/migrations/NNN_*.sql`. Never edit an applied migration; the standalone build does NOT include them — `scripts/build-release.mjs` copies them.

## Gotchas

* Never run destructive SQL against the live `data/media_library.db` (use a copy or `:memory:`).
* `.env.production` in the repo is a template; the installer generates real per-machine values. Don't commit real secrets.
* `JWT_SECRET` mismatch note: `auth-service.ts` hardcodes 2h token expiry; env files say `JWT_EXPIRES_IN=7d` — don't "fix" one side without checking both.
* `sql.js` and `@types/better-sqlite3` in package.json are unused; don't add imports of them.

## Skills available in this project

Load on demand (`.opencode/skills/`): `project-architecture`, `backend-api-patterns`, `database-and-migrations`, `testing-conventions`, `release-and-installer`.
Establish scope first. Before making changes, identify the relevant files, dependencies, callers, routes, and data flow. Do not modify files outside the verified scope.            

Reuse before creating. Before creating a new component, hook, utility, service, repository, controller, type, or helper, search the codebase for an existing implementation that can be reused or extended.                     

No unnecessary duplication. Do not introduce duplicate business logic, API logic, validation, data-fetching logic, UI patterns, or utilities when an existing shared implementation is appropriate.                    

No unnecessary duplication. Do not introduce duplicate business logic, API logic, validation, data-fetching logic, UI patterns, or utilities when an existing shared implementation is appropriate.            

Reuse before creating. Before creating a new component, hook, utility, service, repository, controller, type, or helper, search the codebase for an existing implementation that can be reused or extended.      

Establish scope first. Before making changes, identify the relevant files, dependencies, callers, routes, and data flow. Do not modify files outside the verified scope.            

Unused does not mean incorrect. Do not delete or replace code solely because it appears unused. Verify its intended role, dynamic usage, future integration, or architectural purpose first.         

Protect contracts. Before changing an API response, request shape, route, database schema, shared type, or public function signature, identify and inspect all known consumers and update them deliberately.            

Protect contracts. Before changing an API response, request shape, route, database schema, shared type, or public function signature, identify and inspect all known consumers and update them deliberately.            

No architectural bypasses. Do not bypass established layers or infrastructure merely to make a task work faster. If the existing architecture prevents the required behavior, explain the conflict before introducing an exception.       

Evidence over claims. Never claim that a file, route, API, database table, dependency, configuration, test, or behavior was verified unless it was actually inspected or tested.           

Code is the authority. When documentation, comments, filenames, assumptions, or previous reports conflict with the current implementation, inspect the implementation and treat verified current code as the source of truth.           

No scope creep. Do not perform unrelated cleanup, refactoring, renaming, dependency upgrades, formatting changes, or architectural improvements unless they are required for the requested task or explicitly approved.        

Validate impact. After modifying code, check affected imports, callers, types, routes, tests, and relevant build/lint/typecheck results before considering the task complete.         

TSDoc is part of the code. Every newly created or modified function must have complete TSDoc directly above the function. Do not treat external documentation files as a substitute for function-level TSDoc.









## Key conventions

- **TypeScript strict** — `noUncheckedIndexedAccess`, `noImplicitOverride`, no `any`, no `require()`
- **Path aliases**: `@/*` → `src/*`, `@backend/*`, `@lib/*`, `@shared/*`, `@features/*`, `@tests/*`
- **Files**: `kebab-case.ts` / `kebab-case.tsx`; **Components**: `PascalCase`; **Constants**: `UPPER_SNAKE_CASE`
- **Import order**: React/Next → 3rd-party → `@/*` absolute → `./` relative → type imports
- **Package manager**: npm only
- **Prettier**: `semi`, `trailingComma: "all"`, `printWidth: 100`, `prettier-plugin-tailwindcss`
- **Server Components by default** — `"use client"` only for interactivity
- **Architecture layers**: UI → Application → Domain → Infrastructure (no upward imports)

## Single Source of Truth (SSOT) rules

Every domain value has ONE authoritative definition. Never duplicate it inline. These are the mandated sources:

- **App name & tagline** → `APP_NAME`, `APP_DESCRIPTION` in `src/shared/constants/index.ts`. Never hardcode "استراحة" or the old project name (`Estra7ahyobi`, `Library Manager`, `library-manager77`) in UI strings. All UI surfaces fall back to `APP_NAME` (e.g. `settings.site_title ?? APP_NAME`).
- **Routes** → `ROUTES` in `src/shared/constants/index.ts` (home, viewer + admin nav, link hrefs, redirects). Never write raw `/admin/...`, `/items`, `/itemView/...` strings in components.
- **Audio types & audio routing** → `AUDIO_TYPES`, `isAudioType` in `src/features/viewer/components/audio-player/types.ts` (declared SSOT), plus `buildMediaUrl` in `src/lib/frontend/media-helpers.ts` (album → `/itemView/singer/{id}` Album Player, song/track → `/player/{id}`, audio roots → `/itemView/{type}/{id}`). Never maintain a parallel audio-type array or audio-URL builder.
- **Media type translations** → `translateMediaType` (+ `formatDuration`, `formatViews`) in `src/lib/frontend/translate.ts` — the ONLY `translate.ts` in the repo. Do not create copies under `shared/utils` or `shared/types`.
- **Crew roles** → `crew-roles` constants (`ESSENTIAL_CREW_ROLES`, `CREW_ROLE_PRIORITY`, `CREW_ROLE_AR_LABELS`) and `getUniqueCrewByRole` in `src/shared/utils/crew-helpers.ts`.
- **UI primitives** → `src/shared/components/ui/*` (shadcn) — the only allowed shared components.

Hard rules:

- **No dead code** — do not leave commented-out blocks (old implementations, alternative designs). Delete them.
- **No placeholder text/emoji** — welcome/settings/empty states use real data + real labels, no `👋`/`⚙️` decorations, no `// افترض حسب مشروعك` notes.
- **No broken Arabic** — UI copy must be spelled correctly (e.g. «نسخة احتياطية» not «نسخه احتياطيه»). When in doubt, match `lib/frontend/translate.ts` or existing admin UI labels.
- **One verb per action** — a button row must not contain two controls that do the same thing (e.g. duplicate "عرض"/"رد" buttons).

### Inline TSDoc requirement (Audit & Fixes) — Non-negotiable

Documentation files (AGENTS.md, docs/*) are **NOT a substitute** for inline TSDoc. Both are required.

- Every function, hook, or helper **created or modified** during an audit, refactor, or repair MUST carry a TSDoc block directly above it:

  ```ts
  /**
   * وصف واضح لما تقوم به الدالة.
   *
   * @param ... 
   * @returns ...
   * @throws ... (فقط عند وجود منطق قد يرمي خطأً)
   */
  function example(...) { ... }
  ```

- This applies to **existing functions whose behavior is modified**, not only new functions.
- During an audit: any modified or important function that lacks the required TSDoc MUST be recorded in the audit results, and its TSDoc added/updated **in the same edit** that changes the function.
- Updating general documentation files is never an alternative to inline TSDoc.

Rule: **Documentation files + TSDoc above the function = BOTH required, neither replaces the other.**

## Page architecture (3 patterns)

All pages are **flat** — ONE `page.tsx` per route. No `page-wrapper`/`page-client` split.

- **Pattern A** — Thin listing pages: inline Client Component with hook + list render. Used for: `genre/[slug]`, `year/[year]`.
- **Pattern B** — Player/sections pages: `"use client"` with `dynamic(ssr: false)` import in a `"use client"` page. Used for: `player/[id]`, `sections`, `sections/[id]`.
- **Pattern C** — Thick feature pages: `"use client"` re-export from `@/features/*`. Used for most viewer pages + login. `rating/[value]` and `certification/[cert]` follow this pattern via `rating-items-page` / `certification-items-page`.

Feature modules live in `src/features/` and own the page content. The `page.tsx` just re-exports the feature module as a Client Component.

```ts
// Pattern C example — src/app/(viewer)/items/[id]/page.tsx
"use client";
export { ItemDetailPage as default } from "@/features/viewer/pages/item-detail-page";
```

## Route handler pattern (10–15 lines)

```ts
export async function GET(req: NextRequest, { params }: RouteContext<"id">) {
  const ctx = await buildContext(req);
  if ("error" in ctx) return toNextResponse(ctx);
  const { controller } = getControllers();
  const result = await controller.getAction(ctx, params);
  return toNextResponse(result);
}
```

Controllers are singletons wired via `getControllers()` → `getServices()` → repositories.

## Environment

- `.env.local` (git-ignored) — local dev overrides; `.env.example` — template
- `process.env` must go through `getEnv()` (Zod-validated at startup)
- DB: `DATABASE_URL=./data/media_library.db` — SQLite with WAL mode, busy retry (up to 3×)

## Theme architecture

### Client-Only Theme Preference Rule

Theme selection is a client-side concern only.

Requirements:

- Theme changes MUST remain inside the user's browser context.
- The server MUST NOT manage, store, or synchronize theme preferences.
- The database MUST NOT contain theme preference fields.
- Theme selection MUST NOT be part of user accounts or application settings.
- One browser's theme change MUST NOT affect any other user, session, or device.

The theme system is responsible only for rendering the current client experience.

### Theme Separation Rule (Admin vs Public UI) — Target State

The administrative interface and the public UI are two separate design systems.

> Target state for the future. Today both surfaces share the single
> `src/app/globals.css` token set — keep it as-is, no refactoring required now.
> Any new development MUST respect the separation below going forward.

#### Admin Theme Rules

- The admin dashboard MUST have its own visual identity, layout rules, spacing, components, and interaction patterns.
- Admin UI components MUST NOT inherit or reuse public-facing theme styles unless explicitly required.
- Admin pages should optimize for productivity, data management, clarity, and operational workflows.

#### Public Theme Rules

- The public/open interface MUST maintain its own independent visual identity.
- Public UI components should focus on user experience, content discovery, presentation, and accessibility.
- Public theme decisions MUST NOT influence admin dashboard styling.

#### Isolation Requirements

- Do not share theme tokens, colors, layouts, or visual components between Admin and Public unless they are truly neutral primitives.
- Any shared component MUST remain theme-agnostic and receive styling through the appropriate theme layer.
- Never modify the public theme to solve an admin UI requirement.
- Never modify the admin theme to solve a public UI requirement.

#### Design Source of Truth

- Admin design decisions belong to the Admin UI system.
- Public design decisions belong to the Public UI system.
- Each theme evolves independently without creating visual coupling.

#### Sanctioned shared primitives

- The `src/shared/components/ui` shadcn primitives are the "truly neutral primitives" allowed to be shared; they remain theme-agnostic and receive styling via CSS variables.

## Security architecture

```
Proxy (Edge Runtime) — src/proxy.ts (Next 16 convention; was middleware.ts)
 └── /admin/*
       ├── Check session_token cookie exists → /login if missing
       ├── Fetch /api/auth/verify-admin (JWT verify + role check)
       │     ├── 401 → redirect /login
       │     ├── 403 → return 403 Forbidden page
       │     └── 200 → pass through
       └── Sets x-url header for downstream use

Viewer Layout (Server Component — dynamic via cookies())
 └── Read viewer_access_mode from SettingsService (SQLite, runtime)
       ├── "public"    → allow all (no auth required)
       └── "protected" → verify session_token via AuthService.verifyToken()
                          └── invalid → redirect /login?callbackUrl=<path>
```

Key rules:

- **Admin routes** are always protected via the proxy — no setting can disable this
- **Viewer routes** protection is controlled by `viewer_access_mode` setting (public/protected)
- **The proxy never reads the database** — admin protection uses fetch to a lightweight API endpoint; viewer protection is out of scope
- **Viewer Layout always calls cookies()** → forces dynamic rendering so DB changes take effect immediately without rebuild
- **No auth code is duplicated in individual pages** — decisions are centralized in proxy + layout
- `viewer_access_mode` setting does NOT affect admin routes

## Migration rules (from old project)

### Old project = Business-Behavior Reference ONLY (Last Resort)

The old project (`library-manager77`) is NOT part of the implementation process.
It is consulted ONLY to understand business behavior when that behavior cannot be
determined from the new backend or the new frontend. NEVER inspect it to obtain
code, architecture, components, constants, types, styling, or implementation details.

### Source of Truth order

1. New backend — models, DTOs, schemas, enums, validation, business rules, API contracts.
2. New frontend — design system, components, hooks, utilities, constants, types, state, architecture.
3. Old project — last resort, behavior description only.

### Reuse rule

Before consulting the old project, search the current backend and current frontend
completely. If the required type, enum, constant, validation rule, business logic,
API contract, or component already exists, reuse it. Never recreate or copy it from
the old project.

- **No placeholder/mock data** — always trace the full data flow through the new backend/frontend
- **Behavioral parity, not code parity** — same screens & flows, new architecture
- **Layer-by-layer** — only one architectural layer at a time
- `ARCHITECTURE_RULES.md` is the constitution; `docs/migration-ledger.md` tracks migration gaps

## Testing / CI quirks

- **Vitest** is the test runner — `npm test` (run once) / `npm run test:watch` (watch mode)
- Unit tests live in `src/tests/unit/*.test.ts`; config in `vitest.config.ts` mirrors `tsconfig.json` paths (aliases), `src/tests/setup.ts` seeds required env vars (`JWT_SECRET`, etc.) before module load
- Environment is `node` only (no jsdom yet); `src/tests/integration/` is reserved for future DB/route integration tests
- Build must pass (`npm run build`) before any commit
- `npm run typecheck` and `npm run format:check` are available (see Quick start)

## Strict AI Agent Execution Rules

Whenever writing, modifying, or refactoring code for this repository, you MUST strictly adhere to the following three engineering standards for every response. No exceptions.

### 1. TypeScript & Documentation Engine (TSDoc + Type Annotations)

Every function, utility, hook, or component helper must provide two layers of type definition and explanation:

- **TSDoc Block (`/** ... */`)**: Explicitly describe the function's logical purpose, parameters, and return types in clear language for human developers.
- **Strict Type Annotations**: Define strict type boundaries for all parameters, inputs, and outputs. Never use `any`.

#### Standard Blueprint:

```typescript
/**
 * [Action Verb] Description of what the function accomplishes conceptually.
 *
 * @param paramName - Detailed description of what this input represents.
 * @returns Description of the resolved value or returned data layout.
 */
function functionName(
  param1: Type, // ─── Type Annotation (Input) ───
  param2: Type, // ─── Type Annotation (Input) ───
): ReturnType {
  // ─── Type Annotation (Output) ───
  // Implementation logic
}
```

### 2. Tailwind CSS v4 Layout & Spacing Engine

You are writing code for a **Tailwind CSS v4** project. You must strictly avoid legacy Tailwind v3 syntax and arbitrary bracket layouts `-[...]` when native v4 features or design tokens are available.

- **Fluid Spacing Scales**: Do NOT use arbitrary pixels for dimensions aligning to the 4px grid. Use native v4 fractional/decimal scales:
  - `h-[450px]` ──> **`h-112.5`**
  - `w-[300px]` ──> **`w-75`**
  - `w-[200px]` ──> **`w-50`**
  - `md:w-[260px]` ──> **`md:w-65`**
  - `lg:w-[300px]` ──> **`lg:w-75`**
  - `max-w-[80px]` ──> **`max-w-20`**
- **Modern Gradients**: Replace deprecated legacy gradient directional tags with v4 linear syntax:
  - `bg-gradient-to-b` ──> **`bg-linear-to-b`**
  - `bg-gradient-to-r` ──> **`bg-linear-to-r`**
- **Clean Aspect Ratios**: Do NOT wrap fraction calculations in arbitrary brackets:
  - `aspect-[2/3]` ──> **`aspect-2/3`**
  - `aspect-[16/9]` ──> **`aspect-16/9`**

Before outputting code blocks, cross-examine all classes against Tailwind v4 specifications to eliminate arbitrary bracket configurations.

### 3. Documentation Rule for Domain Definitions

Any code representing business concepts must include JSDoc documentation.

Required for:

- TypeScript types
- Interfaces
- Enums
- Constants containing domain values
- Configuration objects
- Permission maps
- Status maps
- Taxonomies

Documentation must explain:

- **Purpose** — why this domain concept exists, not only what it holds.
- **Source of truth** — where the authoritative definition lives (e.g. backend schema/enum, API contract, config).
- **Scope** — what the definition covers.
- **Limitations** — known gaps, edge cases, or constraints.
- **Completeness** — whether the value set is complete or a subset of a larger set.

## 1. الكود كـ "عقد عمل" (Code as a Contract)

- أنت لست مجرد مطور كود، أنت "معماري أنظمة". أي دالة تكتبها يجب أن تكون مفهومة لأي مبرمج آخر سينضم للفريق غداً.
- الالتزام بـ JSDoc ليس اختيارياً؛ هو الضمان الوحيد لسلامة الكود (Code Safety) ومنع الآخرين من كسره.

## 2. معايير التوثيق الصارمة (Documentation Standards)

قبل كتابة أي منطق برمجي، يجب صياغة الـ JSDoc Header التالي:

- **الوصف (Description):** شرح "لماذا" هذه الدالة موجودة وليس فقط "ماذا" تفعل.
- **البارامترات (@param):** تحديد النوع والوظيفة بدقة (مثلاً: `id` هو UUID وليس مجرد string).
- **المخرجات (@returns):** وصف الحالة في حال النجاح وفي حال الفشل (null/error).
- **التنبيهات (@throws / @example):** إذا كانت الدالة تحتوي على منطق معقد مثل (Cascading Fallback)، يجب وضع مثال توضيحي.

## 3. التكامل مع TypeScript و Tailwind v4

- **Single Source of Truth:** عند تعريف الأنواع (Interfaces)، استخدم JSDoc لربط الوثائق بالأنواع البرمجية.
- **Tailwind v4:** عند بناء مكونات واجهة المستخدم، التزم بالمعايير الجديدة (Canonical Classes) لضمان أن المطورين الآخرين لا يضطرون لتصحيح التنسيقات القديمة.
