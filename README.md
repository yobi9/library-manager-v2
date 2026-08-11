# Library Manager V2 — Estra7ahyobi (استراحة)

Full-stack **Next.js 16 / React 19** monolith — an Arabic (RTL, `lang="ar"`) media library manager
with a viewer front end, an admin dashboard, and a backend scanner/enrichment pipeline.

مدير مكتبة وسائط كامل بواجهة عربية RTL: واجهة مشاهد، لوحة إدارة، ونظام فحص وإثراء للوسائط.

---

## المزايا / Features

- **Viewer (الواجهة العامة)** — home with hero + pinned/favorites sliders + type-section grids, item details,
  player, sections, genres, years, people, live stream, watch-later.
- **Admin (لوحة الإدارة)** — dashboard with stats/activity, items control + batch enrichment + pending approvals,
  libraries management, settings, users/team, ads, store, messages, news, reports, database tools.
- **Backend pipeline** — library scanner (folder watcher, hierarchy validation, metadata sync),
  TMDB enrichment, translation provider, view/visitor tracking, rate limiting, maintenance mode.
- **Security** — JWT (HttpOnly cookie) sessions, admin route protection via Edge middleware,
  viewer protection controlled by `viewer_access_mode` setting, Zod validation on every API route.

---

## Tech Stack / التقنيات

| Layer         | Technology                                             |
| ------------- | ------------------------------------------------------ |
| Framework     | Next.js 16.2 (App Router, Turbopack)                   |
| React         | 19.2                                                   |
| Language      | TypeScript (strict)                                    |
| Styling       | Tailwind CSS 4 + next-themes (dark/light, client-only) |
| Data fetching | React Query 5                                          |
| State         | Zustand 5                                              |
| Validation    | Zod 4                                                  |
| Database      | SQLite (WAL mode, busy retry)                          |
| Auth          | jsonwebtoken + bcryptjs                                |
| Scanner       | chokidar + ws                                          |
| Enrichment    | TMDB                                                   |
| Translation   | google-translate-api-x                                 |
| UI primitives | CVA + Radix + Lucide, Sonner toasts                    |

---

## Quick Start / التشغيل

```bash
npm install
npm run dev        # development (Turbopack on :4000)
npm run build      # production build
npm run lint       # ESLint 9 (flat config)
```

No `format`/`typecheck` scripts are defined — run manually:

```bash
npx tsc --noEmit
npx prettier --check .
```

**Important**: `npm` is the only supported package manager (no yarn/pnpm/bun).

---

## Environment / المتغيرات البيئية

- All env access goes through `getEnv()` (Zod-validated at startup) in `src/lib/config/env.ts`.
- `.env.example` — template; `.env.local` — local overrides (git-ignored);
  `.env.development` / `.env.production` — defaults.
- Database: `DATABASE_URL=./data/media_library.db` — SQLite with WAL mode.

---

## Structure / البنية

```
src/
├── app/          # Routes: (viewer)/, admin/, (auth)/, api/ (~109 route handlers)
├── backend/      # Clean Architecture: controllers → services → repositories → db (+ scanner, middleware)
├── features/     # Feature modules owned by features, not routes
├── shared/       # Neutral primitives (ui/, layout/, constants/, utils/)
├── lib/          # config (env), frontend helpers, backend helpers
└── providers/    # QueryClient + Theme + Auth + Favorites + Toaster
```

---

## Documentation / الوثائق

| File                                             | Role                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                         | Agent operational rules (source of truth order, theme rules, conventions) |
| [`ARCHITECTURE_RULES.md`](ARCHITECTURE_RULES.md) | Architecture constitution                                                 |
| [`PROJECT_MAP.md`](PROJECT_MAP.md)             | Structural map of the codebase                                            |
| `docs/migration-ledger.md`                       | Migration gaps tracker (living document)                                  |
| `docs/`                                          | Historical migration analysis/review snapshots                            |
