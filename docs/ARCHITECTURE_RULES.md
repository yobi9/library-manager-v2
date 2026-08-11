# ARCHITECTURE RULES — Library Manager V2

## Senior Engineer Mindset (Mandatory)

You are **not** a code copier, code translator, or code generator.

You must work as a **Senior Software Engineer** responsible for rebuilding a production system.

Before writing any code:

1. Fully understand the feature and its purpose.
2. Locate the equivalent implementation in the **new backend/frontend first** (source of truth).
3. Consult the **old project** (`library-manager77`) only as a behavior reference (last resort) when the new code does not define the behavior.
4. Identify all related files, dependencies, utilities, services, hooks, business rules, and side effects.
5. Understand **why** the existing implementation was designed that way.
6. Evaluate whether it should be: reused, adapted, simplified, or redesigned because of the new architecture.

Never make assumptions based on a single file. Always analyze the surrounding architecture.

### Think Before You Code

- Analyze. Investigate. Trace dependencies. Understand the complete execution flow. Identify risks. Consider edge cases. Then implement.

### Every Change Must Be Intentional

Every modification must have a clear engineering reason.

- Do not change code simply because it can be written differently.
- Do not introduce new abstractions unless they provide a measurable architectural benefit.
- Do not rewrite stable code without justification.

### Preserve Proven Logic

If the old implementation is correct, stable, and compatible with the new architecture: reuse it. Refactor only when necessary. Preserve business behavior. Do not rewrite mature code just to make it look newer.

### Zero-Assumption Rule

If you are unsure: investigate, search, compare, verify — before writing any implementation. Never guess.

---

## Golden Rule

**Functional Compatibility NOT Code Compatibility.**

The old project (`library-manager77`) is the **functional specification**, NOT the **architectural specification**.

- Same result. Same screen. Same buttons. Same permissions. Same user flow.
- NOT same code. NOT same files. NOT same architecture. NOT same bugs.

---

## What to Transfer from the Old Project

| Transfer (Behavior)                            | Do NOT Transfer (Bugs)                           |
| ---------------------------------------------- | ------------------------------------------------ |
| UI/UX — screens as-is                          | `use client` everywhere — redesign per page      |
| Page names                                     | `force-dynamic` everywhere — use proper caching  |
| Route paths                                    | Bad folder structure — follow Clean Architecture |
| Navigation flow                                | Anti-patterns — redesign correctly               |
| User roles & permissions                       | Over-engineered DI container                     |
| Business logic (rules)                         | Redundant React Query calls                      |
| API contracts (endpoints + shapes)             | Code duplication                                 |
| Database schema (contract, not implementation) | Components doing business logic                  |
| Feature set                                    | Services mixed with controllers                  |

---

## Decision Rule

When you find something in the old project, ask:

> Does the **user see this** or **need this** behavior?

- **Yes** → Transfer it, but rebuild correctly.
- **No** → Design it the right way from scratch.

---

## Code is the Only Source of Truth

All documentation (README, TASKS, PROGRESS, ARCHITECTURE) is treated as potentially inaccurate.
The actual source code is the only reference.

## Documentation Roles

| File                       | Role                                                         |
| -------------------------- | ------------------------------------------------------------ |
| `AGENTS.md`                | Agent operational rules — how the agent behaves in this repo |
| `ARCHITECTURE_RULES.md`    | Architecture constitution — this file                        |
| `PROJECT_MAP.md`          | Structural map of the codebase (facts only, no rules)        |
| `docs/migration-ledger.md` | Migration gaps tracker (living document)                     |
| `docs/*` (analysis/review) | Historical snapshots — current truth is the code             |

Documentation may lag the code. When documentation contradicts the code, the code wins.

---

## No Placeholder or Mock Data Policy (Mandatory)

**Do NOT create placeholder implementations, mock data, fake arrays, hardcoded objects, demo content, or temporary business logic unless explicitly instructed.**

### Before writing any data

You MUST first inspect the current codebase and determine:

- Which API route handler provides this data?
- Which controller exposes it?
- Which service generates it?
- Which repository retrieves it?
- Which DTO or mapper transforms it?
- Which utilities and helpers are involved?

If the data flow already exists in the new codebase, reuse it.
Only if the behavior is undefined in the new codebase, consult the old project (`library-manager77`) as a behavior reference to understand the data flow.

### Never write code like:

- hardcoded movie lists, genres, years, sections, users, statistics, settings
- fake API responses, temporary arrays, sample objects, mock implementations

unless explicitly requested.

### If something appears missing

Do not replace it with static data. Instead:

1. Search the new backend (repository → service → controller → route handler) and the new frontend.
2. Find where the data originates.
3. If the behavior is still undefined, consult the old project (behavior reference only).
4. If it truly does not exist, stop and report it instead of inventing a replacement.

---

## Follow the Complete Data Flow (Mandatory)

A property existing in an interface does **NOT** mean it is available to the frontend.

Before adding any field, feature, or UI element, trace its complete lifecycle in the **new codebase** (backend → frontend):

1. Where is it stored? (Database / External API / Generated)
2. Which Repository loads it?
3. Which Service processes it?
4. Which Controller/API returns it?
5. Which DTO or Mapper transforms it?
6. Which frontend component consumes it?

Consult the old project only when the new code does not define the behavior. Only after verifying the complete data flow should you add the field, feature, or UI element.

### Do Not Rebuild Large Features From Scratch

When adding a feature, **never start by writing a new implementation**. First:

1. Find every related file in the new codebase.
2. Build a dependency map.
3. Identify all shared components, hooks, utilities, services, API calls.
4. Understand the complete feature.
5. Only then decide what must change.

Never say: "There is no component in the new project, so I'll build one."
Instead ask: "How is this implemented in the new backend/frontend?" (and consult the old project only as a behavior reference).

---

## UI Foundation First (Mandatory)

Before building or migrating pages, you must prepare the UI foundation. Migration order:

1. Tailwind configuration
2. Global CSS
3. Theme variables
4. Fonts
5. Design tokens
6. Shared UI components
7. Layout components
8. Individual pages

---

## Layer-by-Layer Development Policy (Highest Priority)

This migration must follow a strict engineering workflow. Do not jump between unrelated areas.

Required Order:

1. Analyze the old implementation.
2. Identify all dependencies.
3. Complete the current layer.
4. Verify the layer.
5. Update documentation.
6. Only then continue.

Only one architectural layer may be under development at a time. If another issue is discovered, record it and continue the current layer unless it blocks progress.

---

## Source of Truth Order (Mandatory)

The old project (`library-manager77`) is the **Business-Behavior Reference ONLY (Last Resort)**.
It is consulted ONLY to understand business behavior that cannot be determined from the new codebase.
It is NEVER inspected for code, architecture, components, constants, types, styling, or implementation details.

Source of Truth order:

1. **New Backend** — models, DTOs, schemas, enums, validation, business rules, API contracts.
2. **New Frontend** — design system, components, hooks, utilities, constants, types, state, architecture.
3. **Old Project** — behavior description only, when 1 and 2 are insufficient.

Before making **any** modification:

1. **Locate** the equivalent implementation in the new backend/frontend.
2. **Study** it completely (files, imports, utilities, services, hooks, constants, validation, API calls, business rules).
3. **Understand why** it works the way it does.
4. **Reuse** existing implementations whenever possible.
5. **Adapt** only when required by: Next.js 16, React 19, TypeScript strict mode, the new Clean Architecture.
6. Only after confirming no suitable implementation exists may you create new code.

---

## Project Type

Full-Stack Next.js Monolith

- App Router ONLY
- Route Handlers ONLY (no Express, no NestJS)
- No separate backend process
- No custom server.js

---

## TypeScript Rules

- **Strict mode** — always enabled
- `noUncheckedIndexedAccess` — enabled
- `noImplicitOverride` — enabled
- `forceConsistentCasingInFileNames` — enabled
- **No `any`** — ever
- **No `require()`** — ES Modules only
- **No JavaScript files** — TypeScript only

---

## Path Aliases

```
@/*        → ./src/*
@backend/* → ./src/backend/*
@lib/*     → ./src/lib/*
@features/*→ ./src/features/*
@shared/*  → ./src/shared/*
@tests/*   → ./src/tests/*
```

---

## Architecture Layers (No Circular Dependencies)

```
UI (App Router)
    ↓
Application (Use Cases)
    ↓
Domain (Entities / Business Rules)
    ↓
Infrastructure (DB, Cache, External APIs)
```

- **Never** import upward (Infrastructure → Domain is forbidden)
- **Never** create circular dependencies
- **Never** put business logic in UI components
- **Never** access database directly from UI

---

## Folder Structure

```
src/
├── app/              ← Routes, layouts, pages (UI layer)
│   ├── (viewer)/     ← Viewer routes (home, items, itemView, player, sections, genre, years, ...)
│   ├── admin/        ← Admin pages (dashboard, items-control, libraries, settings, users, ...)
│   ├── (auth)/       ← Login
│   └── api/          ← ~109 Route Handlers (grouped by module)
├── backend/          ← Server-side business logic (Clean Architecture)
│   ├── api/          ← route-helpers.ts (buildContext, toNextResponse, requireAuth)
│   ├── controllers/  ← 21 controllers (singletons via getControllers())
│   ├── services/     ← 31 services (singletons via getServices())
│   ├── repositories/ ← 24 repositories (data access)
│   ├── db/           ← db.ts, index.ts, migrate.ts, schema.ts, migrations/
│   ├── middleware/   ← rate-limiter, maintenance, visitor-tracking
│   └── scanner/      ← ScanOrchestrator, LibraryMonitor, etc. (13 files)
├── features/         ← Feature modules (viewer, admin, auth) — owned by features, not routes
├── shared/           ← Neutral shared code
│   ├── components/   ← ui/ (shadcn-style primitives) + layout/
│   ├── constants/    ← Constants and enums
│   ├── utils/        ← Utility functions
│   ├── hooks/        ← (empty)
│   └── types/        ← (empty)
├── lib/              ← Library helpers
│   ├── config/       ← env.ts (getEnv(), Zod-validated)
│   ├── frontend/     ← Frontend-only helpers (api, queries, media-constants, contexts)
│   └── backend/      ← Backend-only helpers (response.ts)
├── providers/        ← React providers
├── public/           ← Uploaded images (src/public/assets/...)
└── tests/            ← unit/ + integration/ (empty)
```

---

## Server Components vs Client Components

- **Server Components** — default for all components
- **Client Components** — only when interactivity is needed (`"use client"`)
- **Mutations** — via Route Handlers + controllers (see Controller Patterns); no direct DB access from the UI
- **`"server-only"` and `"client-only"` imports** — use to enforce boundaries

---

## Data Flow

```
Database
  → Repository
    → Service
      → Controller
        → API Route Handler
          → Frontend (React Query / Hooks)
            → Component
              → UI
```

Every feature must be traced through this complete flow.

---

## Package Manager

**npm** — single policy, no exceptions.

---

## Environment Variables

- Never read `process.env` directly — always go through `getEnv()`
- Validate with Zod at startup
- `.env.example` — template
- `.env.local` — local development (git-ignored)
- `.env.development` — development defaults
- `.env.production` — production (MUST be validated before deploy)

---

## Security

- JWT authentication with HttpOnly cookies
- Middleware-level auth checks
- Security headers via next.config.ts
- CORS restriction
- CSP headers
- Input validation with Zod on every API route
- No secrets in client-side code

---

## Quality

- ESLint — zero errors
- Prettier — consistent formatting
- TypeScript — zero errors
- Build — must pass before any commit

---

## Naming Conventions

- Files: `kebab-case.tsx`, `kebab-case.ts`
- Components: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`
- CSS: Tailwind utility classes

---

## Import Order

1. React / Next.js
2. Third-party libraries
3. Absolute imports (@/*)
4. Relative imports (./)
5. Type imports

---

## Controller Patterns (Phase 5+)

### Controller Base Class

All controllers extend `BaseController`:

```typescript
import { BaseController, ControllerResult } from "./base-controller";

export class MediaController extends BaseController {
  async getItem(id: string): Promise<ControllerResult> {
    const media = await this.services.media.getMedia(id);
    return this.ok(media);
  }
}
```

### Controller Singleton Pattern

Controllers are instantiated once per request via `getControllers()`:

```typescript
import { getControllers } from "@/backend/controllers";

export async function GET(req: NextRequest, { params }: RouteContext<"id">) {
  const ctx = await buildContext(req);
  if ("error" in ctx) return toNextResponse(ctx);
  const { mediaController } = getControllers();
  const result = await mediaController.getItem(params.id);
  return toNextResponse(result);
}
```

### Route Handler Pattern

Every route handler follows this exact pattern (10-15 lines max):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { buildContext, toNextResponse, requireAuth } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

export async function GET(req: NextRequest, { params }: RouteContext<"id">) {
  const ctx = await buildContext(req);
  if ("error" in ctx) return toNextResponse(ctx);
  const { controller } = getControllers();
  const result = await controller.getAction(ctx, params);
  return toNextResponse(result);
}
```

### Authentication Patterns

```typescript
// Public route (no auth required)
const ctx = await buildContext(req);

// Authenticated route
const ctx = await buildContext(req);
if ("error" in ctx) return toNextResponse(ctx); // 401 if not authenticated
const authCtx = requireAuth(ctx);

// Admin-only route
const authCtx = requireAuth(ctx, { requireAdmin: true });
```

### Error Handling

```typescript
// Controller returns error
return this.fail("Invalid input", 400);

// Route helper handles errors automatically
const result = await controller.getAction(ctx, params);
return toNextResponse(result); // Automatically converts errors to proper HTTP responses
```

### Data Flow

```
Frontend → API Route → Controller → Service → Repository → Database
              ↓
         buildContext() → auth parsing, body parsing
         toNextResponse() → HTTP response formatting
```

---

## Phase 5 Migration Order (Historical — Completed)

> This section is a historical migration plan. The features below now exist in the codebase
> (EventBus → `services/event-bus.ts`, CacheService, RetryManager, ErrorHandler, Rate Limiting,
> Maintenance Mode, Visitor Tracking, Enrichment System, Translation System, WebSocket/`ws`,
> View Tracking, Database Operations). Keep it for provenance; the code is the current source of truth.

1. **EventBus** — Foundation for all decoupled communication
2. **CacheService** — Performance layer
3. **RetryManager** — Resilience
4. **ErrorHandler** — Centralized error management
5. **Rate Limiting** — Security
6. **Maintenance Mode** — System management
7. **Visitor Tracking** — Analytics
8. **Enrichment System** — Highest business value
9. **Translation System** — High business value
10. **WebSocket Service** — Real-time updates     
11. **View Tracking** — Analytics
12. **License & Admin Content** — System management
13. **DTO Transformations** — Data normalization
14. **Database Operations** — Admin tools

---

# Agent Engineering Constitution (العربية)

> الجزء الدستوري للمهندس — يكمّل الأقسام الإنجليزية أعلاه. هذه قواعد هندسية معمّمة؛ لا تتعارض مع
> `AGENTS.md`. عند أي تعارض، `AGENTS.md` (قواعد التشغيل) هو المرجع الأسبق ثم الكود الفعلي.

1. Mission
   هدف الوكيل داخل المشروع.
   الحفاظ على جودة النظام واستقراره.
   احترام المعمارية الحالية وعدم تغييرها دون مبرر.
2. Core Principles
   Code as a Contract.
   Architecture First.
   Evidence Before Change.
   Zero Assumption Policy.
   Preserve Existing Behavior.
   Simplicity Over Cleverness.
3. Decision Rules

قواعد اتخاذ القرار قبل أي تعديل.

مثل:

افحص التنفيذ الحالي أولًا.
تتبع تدفق البيانات.
لا تخمن.
لا تقترح تغييرًا معماريًا دون دليل.
إذا كان هناك أكثر من حل، اختر الأقل تأثيرًا. 4. Investigation Rules

قبل كتابة الكود يجب على الوكيل:

تحديد جميع Call Sites.
تحديد Interfaces.
تحديد Types.
تحديد DTOs.
تحديد API Contracts.
تحديد Database Schema.
تحديد Cache.
تحديد WebSocket Events.
تحديد Dependencies.
تحديد Tests.
تحديد Documentation. 5. Architecture Rules
اتجاه الطبقات.
الطبقات المسموح بالاستيراد بينها.
مسؤولية كل طبقة.
منع نقل المنطق بين الطبقات بدون مبرر. 6. Implementation Rules
TypeScript Strict.
ممنوع any.
ممنوع require.
استخدام Path Aliases.
ترتيب الاستيرادات.
Server Components افتراضيًا.
Client Components عند الحاجة فقط. 7. Documentation Standard

لكل Function أو Class أو Hook أو Component أو API:

Purpose.
Context.
Parameters.
Returns.
Side Effects.
Design Notes.
Flow.
Examples عند الحاجة.

مع أمثلة للمقبول والمرفوض.

8. API Rules
   توثيق كل Endpoint.
   Request.
   Response.
   Authentication.
   Authorization.
   Error Cases.
   Data Flow.
9. Service Rules
   Business Logic فقط.
   لا SQL.
   لا منطق واجهة.
   لا استدعاء مباشر للـ UI.
10. Repository Rules
    Database فقط.
    لا Business Logic.
    لا Cache Decisions.
    لا Validation.
11. UI Rules
    عدم استدعاء قاعدة البيانات مباشرة.
    استخدام Hooks.
    استخدام React Query.
    عدم تكرار المنطق.
12. Cache Rules
    توثيق كل Cache.
    توثيق Invalidations.
    توثيق Manual Updates.
    منع Invalidations غير الضرورية.
13. State Management Rules
    تحديد مالك كل State.
    منع Duplicate State.
    منع Hidden State.
14. Security Rules
    Authentication.
    Authorization.
    Validation.
    Sanitization.
    SQL Injection.
    XSS.
    CSRF.
    SSRF.
    Secrets.
    Environment Variables.
15. Performance Rules
    منع N+1 Queries.
    Lazy Loading.
    Pagination.
    Debounce.
    Memoization عند الحاجة.
    منع إعادة الرسم غير الضرورية.
16. Refactoring Safety
    لا Rename بدون تتبع كامل.
    لا Delete بدون إثبات.
    لا Move بدون تحليل.
    لا Merge بدون مراجعة.
    لا تغيير Contracts دون تصريح.
17. Change Validation

قبل التعديل:

تتبع جميع الاستخدامات.
تتبع Interfaces.
تتبع DTOs.
تتبع APIs.
تتبع Cache.
تتبع Events.

بعد التعديل:

مراجعة جميع الأماكن المتأثرة.
تحديث الوثائق.
التأكد من عدم كسر أي Contract. 18. Testing Rules
متى يجب إضافة Tests.
متى يجب تعديلها.
ما الذي يجب التحقق منه.
Regression Checks. 19. Migration Rules
Behavioral Parity.
Layer by Layer.
No Placeholder Data.
No Feature Loss. 20. Tailwind CSS Rules
استخدام Utilities الحديثة.
تجنب القيم الاعتباطية عندما يوجد بديل.
الالتزام بتصميم المشروع. 21. TypeScript Rules
Strict Types.
Narrow Types.
Exhaustive Checks.
Explicit Return Types.
No Implicit Any. 22. Error Handling Rules
أخطاء واضحة.
عدم إخفاء الاستثناءات.
Logging المناسب.
رسائل مناسبة للمستخدم. 23. Logging Rules
ما الذي يُسجل.
ما الذي لا يُسجل.
عدم تسجيل البيانات الحساسة. 24. Naming Rules
Files.
Components.
Hooks.
Services.
Repositories.
Constants.
Types. 25. Output Rules

عند إنهاء المهمة يجب أن يذكر الوكيل:

الملفات المعدلة.
سبب كل تعديل.
العقود المتأثرة.
المخاطر.
ما لم يتم تغييره.
أي افتراضات (إن وجدت). 26. Acceptance Checklist

لا تعتبر المهمة مكتملة حتى يتحقق ما يلي:

الكود يلتزم بالمعمارية.
لا توجد افتراضات.
التوثيق محدث.
TypeScript سليم.
Lint سليم.
العقود سليمة.
الكاش موثق.
الـ API موثق.
الآثار الجانبية موثقة.
لا توجد تغييرات غير مقصودة. 27. Agent Prohibitions

قائمة صريحة بما يُمنع على الوكيل، مثل:

اختراع Types.
اختراع API.
اختراع Database Fields.
اختراع Settings.
اختراع Routes.
اختراع Config.
حذف الكود دون تحليل.
إعادة هيكلة المشروع دون طلب.
كسر الطبقات.
تجاوز الـ Service إلى Repository من الـ UI.
استخدام any.
تجاهل تحديث التوثيق.
