# LipaPoint — Repository Audit (Phase 0)

**Date:** 16 November 2026
**Repository root:** `C:\xampp\htdocs\LipaPoint`
**Branch:** `main` (working tree clean apart from untracked planning documents and screenshots)
**Auditor:** Codebuff (Phase 0 reconnaissance, no application code changed)

Everything below was verified by reading the checked-out repository. Where a
detail could not be confirmed from code, it is listed under **Unknowns**
instead of being assumed.

---

## 1. Executive summary

LipaPoint is a mature, single-deployment Next.js 15 app-router monolith with
Prisma 6 + PostgreSQL, a custom JWT/session authentication system, a
sophisticated deterministic business-intelligence engine, and an existing
two-provider LLM layer (Gemini + Groq) surfaced as a floating chat assistant
and an embedded "LipaPoint Intelligence" dashboard card.

The good news for the 2027 evolution: **far more of the Intelligence pillar
already exists than the historical product description suggests.** The
`src/lib/ai/intelligence.ts` engine already computes sales growth, product
velocity, days of cover, restock quantities, customer churn heuristics,
anonymised area benchmarks, pricing signals, risks, opportunities and a ranked
action plan — deterministically, from tenant-scoped queries. Milestone 1 is
therefore an *upgrade and hardening* task, not a build-from-zero task.

The AI layer itself is thin: one-shot prompt with the entire 30-day
intelligence JSON, no tool calling, no conversation persistence, no usage
metering, no audit trail, no date-range or branch filters, and a process-local
rate limiter and cache. That is the real Milestone 1 gap.

Two areas need attention before Autopilot is attempted:

1. **Authorization granularity.** There is a `RolePermission` model, a
   `/api/roles` API and a permissions editor in the UI, but no server-side code
   consults it. Role checks exist only in middleware for a subset of *page*
   paths and in a handful of API routes. Agents cannot safely inherit "the
   initiating user's permissions" until this is real.
2. **No queue infrastructure.** `package.json` contains no Redis or BullMQ.
   Automation milestones must use the existing request/DB patterns or
   introduce a queue deliberately, not assume one exists.

---

## 2. Confirmed stack and versions

| Concern | Confirmed | Notes |
|---|---|---|
| Framework | `next ^15.3.3`, App Router | `src/app/**`, route handlers under `src/app/api/**` |
| UI runtime | `react ^19.0.0`, `react-dom ^19.0.0` | Client components mixed with server components |
| Language | TypeScript `^5`, `strict: true` | `npx tsc --noEmit` exits **0** (clean) |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` | Design tokens in CSS (`text-text-primary`, `bg-gold`, `border-border`, `bg-surface`) |
| ORM | `prisma ^6.8.0`, `@prisma/client ^6.8.0` | `prisma/schema.prisma`, 1,773 lines |
| Database | PostgreSQL | `DATABASE_URL`; `.env.example` documents Neon |
| Session auth | `jose ^6.0.8` (HS256 JWT) + `bcryptjs ^2.4.3` | Custom, not NextAuth |
| AI SDKs | `@google/genai ^2.27.0`, `groq-sdk ^1.6.0` | `@google/generative-ai ^0.21.0` is also still installed but unused by the current provider |
| Models | `gemini-2.5-flash`, `llama-3.3-70b-versatile` | Hardcoded in `src/lib/ai/gemini.ts` / `groq.ts` |
| Charts | `recharts ^2.15.0` | Analtyics screens |
| State | `zustand ^5.0.3` | POS/client stores |
| Email | `nodemailer ^9.0.5` | `src/lib/email.ts`; SMTP via `MAIL_*` |
| Payments | Paystack, PalPluss, Daraja (M-Pesa) | `src/lib/paystack.ts`, `palpluss.ts`, `payment-gateways/*` |
| Compliance | eTIMS provider abstraction (`mock` / `oscu` / `vscu`) | `src/lib/etims/*` |
| Offline | IndexedDB (`src/lib/offline-db.ts`) + `SyncReceipt` idempotency | `src/lib/offline-sync.ts`, `src/lib/idempotency.ts` |
| Queue | **None** | No Redis/BullMQ dependency, no worker process |
| Tests | **No framework** | 4 standalone `*.check.ts` scripts at repo root, run manually with `tsx` |

`next.config.ts` sets `typescript.ignoreBuildErrors: true` and
`eslint.ignoreDuringBuilds: true`, so `next build` does **not** type-check.
Type safety currently depends on running `tsc` separately.

---

## 3. Repository shape

- 302 files under `src/`.
- **122** route handler files under `src/app/api/**`.
- **31** dashboard pages under `src/app/(dashboard)/[tenant]/**`.
- Public route groups: `(marketing)`, `(auth)`, `(admin)`, `(reseller)`, and
  `/print/*`, `/offline`, `/api/health`.

Dashboard feature areas (each a folder under `[tenant]`): dashboard, pos,
orders, tabs, transactions, inventory, customers, discounts, suppliers,
purchase-orders, finance, banking, reports, analytics, assets, payroll, hr,
etims, locations, settings, users, admin, menu, kitchen, tables, delivery,
online-ordering, services, appointments, queue, scheduling, dashboard/modules.

Conventions worth preserving:

- Route handlers: `requireUserWithFeature(key)` / `requireUserWithModule(key)`
  from `src/lib/api-guards.ts`, returning `{ user }` or `{ response }`;
  `routeError(label, error)` for consistent error envelopes.
- Domain logic lives in `src/lib/*.ts` services, not inline in routes
  (`orders` route does contain substantial checkout logic itself).
- Client data fetching is `fetch` in `useEffect` with a `useCallback`.
- Nav is a data array in `src/components/sidebar.tsx` with per-item `roles`,
  `feature`, `featureKey`, `module` gates and an Odoo-style app-section model.

Note: `src/app/(dashboard)/[tenant` and `src/app/(dashboard)/[tenant/]` exist
as empty stray directories — harmless, but they should be removed eventually.

---

## 4. Data model and migrations

### 4.1 Shape

55 models in `prisma/schema.prisma`. Roots and ownership:

- `Tenant` is the tenant root. Almost every business table carries `tenantId`
  with an `onDelete: Cascade` relation to `Tenant`. Notable exceptions:
  `Subscription` has a `tenantId` **without a Prisma relation** (no FK).
- `User` belongs to one tenant (`tenantId`, `role: UserRole`). Roles are the
  enum `SUPER_ADMIN | RESELLER | OWNER | ADMIN | MANAGER | CASHIER |
  STOCK_KEEPER | KITCHEN` — no per-user custom roles.
- `Location` is the branch dimension. `Order`, `Stock`, `StockMovement`,
  `DailySummary`, `PurchaseOrder`, `JournalEntry`, `Asset`, `Employee`,
  `ProductLocationPrice` all carry `locationId`.
- Money is `Float` throughout (not `Decimal`).
- IDs are `cuid()`. Timestamps are `createdAt`/`updatedAt`. **No soft deletes**;
  archival is `isActive` booleans on Tenant/User/Product/Location.
- Tenant-scoped lookups are generally indexed (`@@index([tenantId])`),
  sometimes with a second dimension (`[tenantId, expiryDate]`).

Core domains present in schema: POS/orders/items/payments, products, categories,
units + conversions + per-location and per-UoM pricing, stock + batches +
movements + stock takes (`StockRecord`), customers, discounts, tabs, tables,
menu, delivery zones, services, appointments, queues, staff schedules,
suppliers, purchase orders, GRNs, supplier invoices/payments, credit/debit
notes, chart of accounts, journal entries/lines, bank accounts/transactions,
expenses, assets + depreciation + maintenance, employees/leave/loans, payroll
runs/payslips/statutory rates, eTIMS invoices, report definitions/runs,
activity log, tenant modules, tenant features, sync receipts, daily summaries,
subscriptions, coupons/redemptions, resellers, demo requests, pending signups.

### 4.2 What does **not** exist

No table for: AI agents, agent runs, tool invocations, conversations/messages,
recommendations, approvals, automations/workflows, execution history, AI usage
or cost, webhook events, outbox/inbox, embeddings/documents. All of these are
new schema surface.

### 4.3 Migrations

`prisma/migrations/` contains hand-written SQL (`0001` … `0008`), with four
competing `0001_*` variants and no `migration_lock.toml`. `package.json` uses
`prisma db push` (`db:push`), not `prisma migrate deploy`. **This is not a
managed migration history** — production drift cannot be reconstructed from it.

Consequence: new AI tables must ship as an explicit, idempotent SQL file plus a
schema update, and must be additive. Do not attempt to retrofit the whole
history as part of this work.

---

## 5. Authentication

File: `src/lib/auth.ts`, cookies in `src/lib/cookies.ts`, `src/middleware.ts`.

Flow:

1. `POST /api/auth/login` verifies email + bcrypt password, checks user and
   tenant are active, then `createSession` signs an HS256 JWT
   (`userId`, `tenantId`, `tenantSlug`, `role`) with a 7-day expiry, writes a
   `Session` row keyed by the token, and sets the `lipapoint-session` cookie
   (`httpOnly`, `secure` in production, `sameSite: lax`).
2. `getCurrentUser()` reads the cookie, verifies the JWT, **then** looks up the
   `Session` row (existence + expiry), then the `User` with `tenant` included,
   and rejects if user or tenant is inactive. This is the authoritative
   server-side identity.
3. `middleware.ts` verifies the JWT for page navigation (role-based redirects,
   login redirects) but does **not** compare the URL's tenant slug to the
   token's `tenantSlug`.
4. The dashboard layout (`src/app/(dashboard)/[tenant]/layout.tsx`) **does**
   compare `user.tenant.slug !== tenantSlug` and redirects. So cross-tenant
   *page* access is blocked at the layout, one layer below middleware.

Impersonation: a super-admin parks their own session in
`lipapoint-session-backup`, then a normal tenant session is created for the
target user (`startImpersonation`). `AUDIT_ACTIONS.AUTH.IMPERSONATION_START`
is defined but the impersonate route writes **no** audit row.

Reseller portal sessions use a separate payload (`resellerId`, role
`RESELLER`) and `getCurrentReseller()`.

Operational note: `getCurrentUser()` contains several `console.log` calls that
print user ID, tenant ID, slug and role on every request. Useful while
debugging, noisy and privacy-relevant in production.

---

## 6. Authorization and entitlements (three separate systems)

### 6.1 Role — partially enforced

- **Middleware** enforces `ROUTE_PERMISSIONS` for a fixed map of page segments
  (`pos`, `orders`, `tabs`, `inventory`, `analytics`, `users`, `settings`, …).
  Anything not in the map is allowed for any signed-in role.
- **Some API routes** check `user.role` inline (admin routes, `POST /api/users`,
  `appointments/[id]`, a few others).
- **Most API routes** check only authentication + feature/module entitlement,
  not role. Example: `GET /api/users` (staff names, emails, phones) is gated by
  authentication only, while `POST /api/users` correctly requires
  OWNER/ADMIN/MANAGER.
- **`RolePermission` is not used for decisions anywhere.** It is read and
  written by `/api/roles` and the Staff page's permission editor, but no guard
  consults it. The permissions UI therefore does not change access.

Implication for agents: "apply the initiating user's permissions" cannot be
implemented on top of role checks alone today; it needs a real permission
resolver (role → permission strings, or a new explicit permission model).

### 6.2 Feature entitlements — real and layered

- **Plan tier features**: `src/lib/plans.ts` — `VERTICAL_PLANS[category][tier]`
  with `limits.features`, `products`, `locations`, `staff`; helpers
  `canAccessFeature`, `getPlanLimits`, `checkUsage`, `entitledModulesFor`.
  Three tiers only: `STARTER`, `PROFESSIONAL`, `ENTERPRISE`. Eleven business
  categories map from `TenantType`.
- **Modules**: `src/lib/modules.ts` + `module-registry.ts` — eight module keys
  (`pos`, `inventory`, `finance`, `payroll`, `assets`, `procurement`, `crm`,
  `etims`) persisted as `TenantModule` rows; `requireModule` throws a 403.
- **Sub-features**: `src/lib/features.ts` + `FEATURE_REGISTRY` — ~102 feature
  keys persisted as `TenantFeature` rows with `source` (`core` / `tier` /
  `addon` / `manual`); `requireFeature` throws a 403. Transitional fallback to
  module entitlement when no rows exist.

API guard adoption: **70** routes use `requireUserWithFeature`, **2** use
`requireUserWithModule`, **33** use `getCurrentUser` directly (often plus
`canAccessFeature`), and 15 routes are intentionally unauthenticated
(auth endpoints, webhooks, health, public forms, eTIMS callback).

### 6.3 AI gating today

Both AI routes gate on `canAccessFeature(tier, "ai-assistant", tenantType)`,
i.e. a flat plan feature present on PROFESSIONAL and ENTERPRISE in every
vertical. There is no AI-specific module, sub-feature, quota or add-on.

---

## 7. Existing AI capabilities

### 7.1 Provider layer (reusable)

- `src/lib/ai/types.ts` — `AiProvider` interface with
  `generate(systemPrompt, message)`, `AiRateLimitError`, `AiProviderError`,
  typed result with `tokensUsed` and `provider`.
- `gemini.ts` / `groq.ts` — one provider each, model name hardcoded, no
  timeout, no retry, no structured-output mode, no streaming, no cost data.
- `orchestrator.ts` — tries providers **in order** (Gemini then Groq), falls
  through on any error, and only raises `AiRateLimitError` if every provider was
  rate limited. No circuit breaker, no per-provider health memory, no logging
  of model name.

### 7.2 Intelligence engine (substantial, reusable)

`src/lib/ai/intelligence.ts` → `buildIntelligence(tenantId)`.

Deterministic calculations (no LLM arithmetic), all tenant-scoped:

- Fixed **30-day** window compared with the preceding 30 days.
- Sales: revenue, orders, AOV, growth percentages; gross profit and margin only
  when ≥30% of revenue is costed (`marginReliable`), otherwise `null`.
- Products: units in base UoM, revenue, velocity/day, days of cover, demand
  score, status, margin (null when cost not recorded — cost `0` is treated as
  "not recorded").
- Inventory: tracked count, low/critical/stockout-risk/dead-stock counts,
  stock value at cost. **Stock is summed across all locations.**
- Restock: suggested quantity to reach 14 days of cover, urgency tiers.
- Customers: repeat/new/returning/at-risk/churned, visit intervals (median),
  retention score, segments, coverage confidence.
- Area intelligence (`area-intelligence.ts`): anonymised cohort benchmarks from
  other tenants (≥5 peers in county, else national), product/category demand
  gaps, price indices, area retention; documented privacy model.
- Demographics (`demographics-data.ts`): static census-derived figures plus a
  clearly labelled **modelled** buying-potential estimate.
- Insights/risks/opportunities/actions derived from thresholds, plus a
  `dataQuality` block that explains missing cost/customer/location data.

Cache: `intelligence-cache.ts`, in-memory `Map` keyed by `tenantId`, 15-minute
TTL, 60-second force-refresh cooldown, in-flight dedupe. Per-process only.

### 7.3 Chat

`POST /api/ai/chat` (`src/app/api/ai/chat/route.ts`):

- Auth via `getCurrentUser` + plan feature check + provider-configured check.
- App-level rate limit: in-memory `Map<tenantId, {count, resetAt}>`,
  15 requests / 60 s, per process, no persistence, no per-user dimension.
- Builds the full intelligence payload (`buildPromptPayload`) — every top
  product, restock item, pricing signal, market product, demographics and risk —
  and injects it into the system prompt on every message.
- Accepts a free-text `context` field from the client and appends it to the
  **system prompt** (`Additional context from the app: ${context}`).
- Single-turn: no history sent to the model, no conversation stored. History
  lives only in client React state (`src/components/ai-assistant.tsx`).
- No tools, no retrieval, no citations, no tenant/branch filter, no model
  choice, no token budget, no usage persistence, no audit row.
- Returns `{ reply, usage: { tokensUsed, provider } }`.

### 7.4 Insights narrative

`GET /api/ai/insights`:

- Same auth/plan gate; no rate limit of its own.
- Returns the full `BusinessIntelligence` JSON.
- Optionally generates a JSON narrative (summary + 3–4 priorities) with a
  strict system prompt, validates and length-clamps the parsed object, caches
  it per tenant tied to `intel.generatedAt` (in-memory), and degrades
  gracefully to rule-based insights if the provider fails.
- `?refresh=1` forces a rebuild at most once per 60 s.

### 7.5 UI

- `src/components/ai-assistant.tsx` — floating bubble + chat panel, mounted in
  the dashboard layout only when the tier grants `ai-assistant`. Hardcoded
  quick actions. Shows a `Pro` badge. No citations, no "last updated", no
  feedback controls, no error taxonomy beyond 403/429/generic.
- `src/components/ai-insights.tsx` — 1,000+ line client component with sections
  Overview / Products & Stock / Customers / Area Intelligence / Action Plan,
  rendered **inside** `/[tenant]/dashboard` (not a nav item). Shows provenance
  labels, data-quality notes, area benchmark scope, AI brief provider and
  "cached" state. This is a strong base for an Intelligence Centre.
- No AI entry in the sidebar (`SIDEBAR_SECTIONS.insights` holds Analytics and
  Reports only).

### 7.6 AI gaps relative to the 2027 target

| Capability | Status |
|---|---|
| Deterministic metrics | **Exists** (fixed 30 days, no branch filter) |
| Grounded narrative | Exists (single JSON blob, no citations to data period) |
| Typed tool interface / function calling | Missing |
| Date-range and location filters | Missing |
| Usage/cost metering and quotas | Missing (rate limit only, in-memory) |
| AI audit trail | Missing |
| Conversation history/persistence | Missing (client-only, lost on reload) |
| Structured output validation | Partial (insights narrative only, regex-extracted JSON) |
| Timeouts/retries/circuit breaking | Missing |
| Prompt-injection defence | Missing (client `context` lands in the system prompt) |
| Tenant-boundary negative tests | Missing |
| Feedback / recommendation lifecycle | Missing |
| Provider/model configurability | Missing (hardcoded models, env-driven keys only) |

---

## 8. Core workflows traced

- **Checkout**: `POST /api/orders` (483 lines) — `requireUserWithFeature("core-till")`,
  idempotent replay, trial/expiry check, price-override policy (tenant flag AND
  `price-override` feature), validates `locationId` belongs to the tenant and is
  active, then creates order + items, deducts `Stock` per location, writes
  `StockMovement`, may create `Transaction`, eTIMS submission, customer update,
  audit. This is the invariant to protect; AI must not write here directly.
- **Offline replay**: IndexedDB queue → `x-idempotency-key` → `SyncReceipt`
  lookup/replay (`src/lib/idempotency.ts`). 7-day TTL.
- **Payments**: `payment-gateways/*` registry (Daraja, PalPluss), Paystack for
  subscriptions and upgrades, `/api/webhooks/*` and `/api/etims/callback` are
  unauthenticated by design (signature/secret handling needs review).
- **Purchasing**: `src/lib/procurement.ts` — create PO, set status, receive
  goods (writes stock, batches, GRN, journal), supplier invoices and payments.
- **Finance**: `src/lib/journal.ts`, `coa.ts`, `bank.ts`, credit/debit notes.
- **Payroll**: `src/lib/payroll.ts` (30k) — statutory rates, runs, payslips, P9.
- **Reports**: generic engine — `ReportDefinition` rows per tenant, query
  registry in `src/lib/reports/queries/*.ts` (6 modules, ~2,460 lines), shared
  renderer and export. `ReportParams` supports `from`/`to`/`search`/`limit`.
  **Reusable source of truth for financial figures.**
- **Audit**: `src/lib/audit.ts` — `ActivityLog` with `before/after` JSON,
  namespaced `AUDIT_ACTIONS` registry, `writeAuditLog` /
  `writeAuditLogs`, transaction-aware. This is the correct substrate for AI
  audit events (or the model for a dedicated AI audit table).

---

## 9. Events, jobs, webhooks, logging

- **No queue, no scheduler, no worker.** `GET /api/notifications/check`
  performs low-stock and trial-expiry emails by iterating **all active tenants**
  and is reachable **without authentication** (see security doc, finding S-1).
  Nothing in the repo calls it; presumably an external cron hits it.
- Webhooks exist for Daraja, PalPluss, Paystack and eTIMS. No idempotency store
  for webhook events, no signature verification helper visible in the standard
  routes (needs per-route confirmation before Connect work).
- Logging: `console.*` only. No structured logger, no correlation IDs, no
  request-scoped tracing, no error reporting integration.
- Observability for AI today: provider failures are `console.error`; nothing is
  persisted or surfaced to the tenant beyond a generic message.

---

## 10. Subscription, plans and usage

- `SubscriptionTier` enum: `STARTER`, `PROFESSIONAL`, `ENTERPRISE` (vertical
  pricing in `VERTICAL_PLANS`, KES, monthly/annual).
- Limits enforced: products, locations, staff (e.g. `POST /api/users` blocks at
  `staff` limit). Module and feature entitlements persisted per tenant and
  synced from tier by `syncTierFeatures` / `grantModule`.
- `Subscription` table tracks Paystack codes, amount, status, period end.
- **No usage metering of any kind** — no AI tokens, no request counts, no
  per-feature usage records. `checkUsage` is a snapshot count helper only.
- Plan identifiers are referenced in many places (plans, features, module
  registry, UI); renaming them is out of scope and would be a breaking change.

---

## 11. Build and test baseline

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass**, exit 0, no diagnostics |
| Build | `next build` | Not run in Phase 0 (would need a live DB for generate/static work; `ignoreBuildErrors` means it validates nothing about types anyway) |
| Lint | `next lint` | Not run (ESLint is ignored during builds) |
| Tests | — | **No test framework installed**; no test files |
| Manual check scripts | `tsx *.check.ts` | `branch-pricing.check.ts`, `branch-pricing-api.check.ts`, `feature-registry.check.ts`, `offline-mode.check.ts`, `price-override.check.ts` exist at repo root; they are assertion scripts, not a suite, and were not executed in Phase 0 (they need the local DB/environment) |

Pre-existing issues: none detected by `tsc`. The absence of an automated test
suite is itself the largest verification risk for this programme.

---

## 12. Reuse inventory — build on this, do not rebuild

**High value, directly reusable for Milestone 1**

| Existing asset | How to reuse |
|---|---|
| `buildIntelligence(tenantId)` | Canonical metric computation. Add parameters (`from`, `to`, `locationId`) rather than a second engine. |
| `intelligence-cache.ts` | Cache key must become composite `tenant + range + location`; replace with a shared store only if we add Redis. |
| `buildPromptPayload` | Keep as the single prompt-shaping function; add token budgeting and per-tool slices. |
| `AiProvider` interface + orchestrator | Add timeout/retry/model config behind the same interface; do not introduce a second provider abstraction. |
| `ApiRateLimitError` / `AiProviderError` types | Extend rather than duplicate error taxonomy. |
| `AIInsights` component | Promote into the Intelligence Centre page; keep its provenance chips and data-quality block. |
| `AIAssistant` chat panel | Keep as the global entry point; add citations, tool disclosures and usage state. |
| `src/lib/api-guards.ts` | Add `requireAiFeature` / `requireAiQuota` here so every AI route shares one guard. |
| `src/lib/audit.ts` + `ActivityLog` | Reuse the registry/transaction pattern for `AI.*` action strings, or mirror it for a dedicated AI audit table. |
| `src/lib/reports/queries/*` | Authoritative figures for finance/margin/stock reports. AI tools should agree with these numbers, not re-derive them differently. |
| `src/lib/idempotency.ts` (pattern) | Model idempotency keys for future automations and agent runs on the same shape. |
| `Location` / `locationId` everywhere | Branch scoping (M1 filter) is a query change, not a schema change. |
| `RolePermission` UI + API | Substrate for a real permission resolver, if the product owner wants configurable staff permissions. |
| `canAccessFeature` / `requireFeature` | Gate any new AI capability; do **not** invent a parallel entitlement system. |
| `module-registry.ts` | Add an `ai` sub-feature set (`intelligence`, `ai-agents`, …) if AI needs granular add-on selling. |

**Do not reuse / replace**

- In-memory rate limiter and caches: acceptable now, not for paid quotas.
- Hardcoded model names: move to configuration.
- Hand-rolled migration SQL as-is: additive new files only.

---

## 13. Risks and unknowns

### Risks

1. **Deployment topology unknown.** If production is serverless (Neon suggests
   it might be), in-memory cache and rate limits are per-instance and quotas
   cannot be enforced. Multi-instance behaviour must be decided before metering.
2. **No managed migration history.** A new AI schema needs careful, idempotent,
   additive SQL plus a rollback note; `db push` against production is unsafe.
3. **Role permissions are decorative.** Agent approval and "run as the user"
   semantics need a real permission resolver first.
4. **Money as `Float`.** AI reporting must round consistently with existing
   report helpers (`round2`, `asNum`) and never present derived figures as
   audited accounts.
5. **Build ignores type errors**, so CI trust must come from an explicit `tsc`
   step.
6. **No automated tests**, so tenant-isolation claims are currently unverifiable
   by machine.
7. **Prompt costs will scale with the payload.** The current chat sends the
   entire intelligence JSON on every message; metering is a prerequisite for
   open-ended usage.
8. **Area benchmarks rely on other tenants' data.** The privacy thresholds are
   good, but there is no tenant opt-out and no DPA documentation in-repo.
9. **Unauthenticated notification sweep** (see security doc).
10. **Untracked planning docs and demo credentials** (`LipaPoint-Demo-Accounts.docx/.xlsx`,
    `sample-reciept.jpeg`, screenshots) sit in the working tree uncommitted.
    Do not commit credentials; keep them out of `public/`.

### Unknowns needing product-owner input

- Deployment target and instance model (single VPS vs Vercel/serverless);
  decides whether Redis is required for quotas.
- Whether AI is to remain a plan-tier feature or become a purchasable add-on
  with per-tenant quotas.
- Whether staff permissions should become truly enforceable (recommended before
  agents).
- Retention policy for AI conversations and usage records; Kenya DPA posture.
- Budget envelope per tenant/month for model spend (drives quota defaults).
- Which integrations are live in production today (PalPluss vs Daraja vs
  Paystack; eTIMS mock vs device).
- Whether branch-level AI answers are required at launch (data supports it, but
  it changes prompt scope and permission semantics).

---

## 14. Recommended first milestone

**Milestone 1 — Intelligence foundation** exactly as scoped in the skill, with
one addition made explicit because the repo demands it: a **permission and
usage spine** (`AiUsageRecord` + server-enforced AI entitlement/quota + a
read-only tool service with typed inputs). Without metering, Milestone 3 cannot
exist; without a tool service, the chat cannot be grounded per question.

Detailed plan: `docs/ai-evolution/MILESTONE_1_PLAN.md`.
Security baseline: `docs/ai-evolution/SECURITY_AND_TENANT_BOUNDARIES.md`.
Sequencing: `docs/ai-evolution/2027_ROADMAP.md`.
