# LipaPoint Connect — Repository Audit (Phase 0)

Status: **reconnaissance complete, no application code changed** (one stray file moved, §7).
Audited commit: `613ab4b` on `main`. Every fact below was read from the repository at that
commit; commands used are named where the number matters. Anything I could not verify is
marked **unverified** rather than assumed.

## 1. Method

Read directly: `package.json`, `prisma/schema.prisma` (1,939 lines), `prisma/migrations/`,
`src/middleware.ts`, `src/lib/{auth,permissions,api-guards,crypto,idempotency,audit,cache-store,plans,modules,module-registry,features,apps}.ts`,
`src/lib/payment-gateways/*`, `src/lib/etims/*`, `src/lib/ai/*` (24 files, interfaces and
exports), `src/components/sidebar.tsx`, `src/app/(dashboard)/[tenant]/layout.tsx`, the API
routes for webhooks and a representative resource route, `tests/`, `README.md`, `.env.example`,
`docs/`.

Counted with `grep`/`find`: 73 Prisma models, 13 enums, 132 `route.ts` files, 33 module
folders under `src/app/(dashboard)/[tenant]/`, 15 test files (all under `tests/ai`).

## 2. Stack and versions (verified in `package.json`)

| Area | Actual |
|---|---|
| Framework | Next.js `^15.3.3`, App Router, React `^19.0.0` |
| Language | TypeScript `^5`, path alias `@/*` → `src/*` |
| Database | PostgreSQL (Neon, pooled), Prisma `^6.8.0` + `@prisma/client ^6.8.0` |
| Auth | `jose` (JWT) + `bcryptjs`, opaque session rows in DB |
| UI | Tailwind CSS v4 + shadcn-style primitives in `src/components/ui` |
| State | `zustand`; charts `recharts` |
| AI | `@google/genai`, `@google/generative-ai`, `groq-sdk` |
| Other | `nodemailer` (email), `lucide-react`, radix primitives |
| Dev/test | `tsx`, `node --test` (node:test), `next lint`, `xlsx`, `puppeteer-core` |

The assignment expected "Next.js, TypeScript and package versions" to be verified — the
platform is **Next 15, not 16**, and there is **no Redis/BullMQ package** (see §7).

## 3. Project structure

```
src/app/
  (marketing)/        public site, /demo, /pricing, /industries, /demo-request
  (auth)/             login, register, onboard, reset
  (dashboard)/[tenant]/   33 module folders (pos, inventory, finance, payroll, assets,
                          etims, customers, analytics, intelligence, approvals, settings …)
  (admin)/            platform super-admin (tenants, resellers, coupons, impersonation)
  (reseller)/         reseller portal
  api/                132 route.ts handlers
  offline/, print/    PWA fallback, receipt printing
src/lib/              46 modules: domain services, guards, crypto, audit, integration seams
src/components/       ui/ primitives, sidebar, dashboards, pos, reports
prisma/               schema.prisma, seed.ts, seed-erp-samples.ts, migrations/
tests/ai/             15 test files (unit + DB-gated integration)
```

Service-layer convention: business logic lives in `src/lib/<domain>.ts` (`payroll.ts`,
`journal.ts`, `procurement.ts`, `assets.ts`…), routes are thin, and domain errors carry a
numeric `status` that `routeError()` in `src/lib/api-guards.ts` maps to a response. Connect
must follow this shape rather than put logic in routes.

## 4. Database

`prisma/schema.prisma` — 73 models, 13 enums. Core: `Tenant`, `User`, `Session`, `Location`,
`Product` (+ `Stock`, `StockBatch`, `StockMovement`, `StockRecord`), `Order`/`OrderItem`,
`Customer`, `Supplier`, `PurchaseOrder`/`GoodsReceivedNote`/`SupplierInvoice`, `ChartOfAccount`/
`JournalEntry`/`JournalLine`, `BankAccount`/`BankTransaction`, `Employee`/`PayrollRun`/`Payslip`/
`StatutoryRateTable`, `Asset*`, `Expense`, `EtimsInvoice`, `ActivityLog`, `ReportDefinition`/
`ReportRun`, `TenantModule`/`TenantFeature`, `RolePermission`, `SyncReceipt`, AI tables
(`AiUsageRecord`, `AiToolInvocation`, `AiApprovalRequest`, `AiAgentRun`, `AiRecommendation`).

Multi-tenancy is **shared schema, `tenantId` column** — not schema-per-tenant. Every
tenant-owned model carries `tenantId` plus `onDelete: Cascade` to `Tenant`, and composite
indexes `@@index([tenantId, …])`. Two patterns matter for Connect:

- `SyncReceipt` — `@@unique([tenantId, key])`, used by `src/lib/idempotency.ts` to replay
  offline-sync responses.
- `TenantPaymentGateway` — one row per `[tenantId, provider]`, credentials stored as
  `credentialsEnc` / `apiKeyEnc` ciphertext via `src/lib/crypto.ts`.

Migrations: `0000_init` (full schema baseline) plus `0011`–`0014`, `migration_lock.toml`. The
ten loose `0001`–`0010` `.sql` files live in `prisma/migrations-archive/` and are no longer
applied. A CI workflow (`.github/workflows/migrations.yml`) now proves `migrate deploy` on an
empty database and fails on drift, so Connect's migration must keep both green.

## 5. Authentication and session management

`src/lib/auth.ts`:

- `signToken` / `verifyToken` — JWT (`jose`) signed with `JWT_SECRET`; payload carries
  `userId`, `tenantId`, `tenantSlug`, `role`.
- `createSession` writes a `Session` row (the JWT is also the session token), and
  `getCurrentUser` verifies **both** the JWT and the DB row and its `expiresAt` before
  returning the user with `tenant` (`id, name, slug, type, tier, currency, taxRate, logo,
  isActive, demoMode`).
- Cookie `lipapoint-session`, `httpOnly: true`, `secure` in production, `sameSite: "lax"`.
- `hashPassword`/`comparePassword` (bcryptjs).
- Super-admin impersonation (`startImpersonation`, `exitImpersonation`, backup cookie).
- Separate reseller session path (`createResellerSession`).

`getCurrentUser()` is the only trusted source of `tenantId` in the codebase; no route reads a
tenant id from the request body or query.

## 6. Tenant identification and isolation

Three layers, and one gap that Connect must respect:

1. **`src/middleware.ts`** — rejects unauthenticated navigation for `/<slug>/*`, applies
   `ROUTE_PERMISSIONS` (first path segment → allowed roles), redirects authenticated users
   away from `/login`.
2. **Route handlers** — `requireUserWithModule`, `requireUserWithFeature`,
   `requireUserWithPlanFeature` in `src/lib/api-guards.ts` return `{ user }` or a 401/403
   response.
3. **Service layer** — every Prisma query is scoped by `user.tenantId`; the tenant slug in the
   URL is used for routing and cosmetics only.

**Gap:** `isPublicPath()` in the middleware returns `true` for anything starting `/api`, so API
routes are not protected by middleware at all — each one must authenticate itself. Existing
routes do; a Connect route that forgets `requireUser…` would be fully open. Webhook endpoints
are deliberately outside that guard and must authenticate by signature instead.

## 7. Roles, permissions, plans, entitlements

- `UserRole` enum: `SUPER_ADMIN, OWNER, ADMIN, MANAGER, CASHIER, STOCK_KEEPER, KITCHEN,
  RESELLER`. `src/lib/permissions.ts` maps roles to levels (100/90/80/60/20/20/10/0) and
  exposes `can(role, permission)` for three permissions only, `isAdminRole`, and
  `isAdminUser`, which **returns true for any tenant with `demoMode = true`**.
- `RolePermission` model exists but is **not consulted** — `permissions.ts` says so explicitly.
- Plans: `src/lib/plans.ts` — `VERTICAL_PLANS[businessCategory][STARTER|PROFESSIONAL|ENTERPRISE]`
  with `limits { products, locations, staff, features[] }`; `canAccessFeature(tier, feature,
  tenantType)`, `getPlanLimits`, `checkUsage`.
- Modules: `src/lib/module-registry.ts` — `MODULE_KEYS` (`pos, inventory, finance, payroll,
  assets, procurement, crm, etims`) and `FEATURE_KEYS` (sub-features such as
  `core-till`, `general-ledger`, `payroll`, `asset-register`), with `FEATURE_REGISTRY`
  metadata. `TenantModule`/`TenantFeature` rows record grants; `src/lib/modules.ts` and
  `src/lib/features.ts` enforce them.
- Apps: `src/lib/apps.ts` layers customer-facing "Apps" over modules; this is what pricing and
  onboarding sell.
- A stray `prisma/migrations/0010_ai_recommendations.sql` (superseded by `0000_init`, not
  referenced anywhere) was left behind when the baseline was repaired; I moved it to
  `prisma/migrations-archive/` during this audit. No database change.

## 8. Existing domain modules

| Module | Routes / UI | Service layer |
|---|---|---|
| POS, tabs, kitchen, tables, menu, delivery, online ordering | `api/orders`, `api/pos/payments/*`, `api/kitchen`, `api/tables`, `api/menu/*`, `api/delivery-zones` | `src/lib/payroll.ts`-style domain modules; order completion in `src/lib/payment-gateways/order-completion.ts` |
| Inventory | `api/products`, `api/stock`, `api/stock/take`, `api/stock/transfer`, `api/units` | stock helpers in `src/lib/` (products/stock), `restock-target.ts` |
| Finance | `api/finance/accounts`, `api/finance/journal`, `api/bank-accounts`, `api/credit-notes`, `api/debit-notes` | `src/lib/coa.ts`, `journal.ts`, `bank.ts`, `credit-debit-notes.ts` |
| Procurement | `api/suppliers`, `api/purchase-orders`, `api/supplier-invoices` | `src/lib/procurement.ts` |
| Payroll / HR | `api/hr/*`, `api/payroll/*`, `api/payroll/p9` | `src/lib/payroll.ts`, `hr.ts` |
| Assets | `api/assets/*`, depreciation, maintenance, disposal | `src/lib/assets.ts` |
| eTIMS (KRA) | `api/etims/*`, `api/etims/callback` | `src/lib/etims/*` |
| Customers / CRM | `api/customers`, `api/discounts`, `api/coupons` | `src/lib/coupons.ts` |
| Reports / analytics | `api/reports`, `api/reports/[key]`, `api/analytics`, `api/daily-summary` | `src/lib/report-catalog.ts`, `src/lib/reports/` |
| Customers' own data interchange | offline sync (`src/lib/offline-sync.ts`), CSV/Excel export in payroll | idempotency in `src/lib/idempotency.ts` |

## 9. API and service-layer patterns

- One `route.ts` per resource/action; `GET/POST/PATCH/DELETE` exported directly.
- Guard first, then parse, then delegate: `const { user, response } = await
  requireUserWithModule("procurement"); if (response) return response;`
- `routeError(label, error)` converts domain errors carrying numeric `status` into responses;
  everything else becomes a 500 with the label in the server log.
- `parseBody<T>()`, `pagination(page, limit, total)` helpers keep envelopes consistent.
- Status codes in use: 400 validation, 401 unauthenticated, 403 entitlement/role, 404, 409
  conflict, 500 unexpected.

## 10. Background processing — **no queue exists**

Verified: no `bullmq`, `ioredis` or `@upstash/redis` dependency or import anywhere in `src/` or
`prisma/`. What does exist:

- `src/lib/cache-store.ts` — `CacheStore` interface with an Upstash **REST** backend (chosen
  when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set) and a 2,000-entry in-process `MemoryStore`
  fallback; `get/increment/deleteByPrefix`.
- `src/app/api/notifications/check/route.ts` — the only scheduled-style endpoint, authenticated
  with a `CRON_SECRET` header (external scheduler required; no scheduler config in the repo).
- Long tasks run **inline in the request**: eTIMS submission, payroll run approval, AI agents.
- Every route is on a Node runtime (default); `next.config.ts` sets no custom runtime
  configuration.

The assignment's "use the existing Redis/BullMQ infrastructure if it is already suitable" has
no referent. Connect therefore needs a durable, DB-backed job runner (§ ARCHITECTURE §6), not
a new service.

## 11. Existing integrations and connector precedent

This is the most reusable part of the repository — Connect should extend these seams, not
compete with them.

| Integration | Files | Auth | Notable |
|---|---|---|---|
| Paystack (cards) | `src/lib/paystack.ts`, `api/paystack/{verify,subscribe,webhook}` | secret key header + HMAC-SHA512 webhook signature | compare uses `!==` (not timing-safe) |
| M-Pesa Daraja | `src/lib/payment-gateways/daraja.ts`, `api/webhooks/daraja` | OAuth bearer + callback | adapter implements `PaymentGatewayAdapter` |
| PalPluss (SMS / mobile money) | `src/lib/payment-gateways/palpluss-adapter.ts`, `api/webhooks/palpluss` | API key | **inbound webhook signature verification is a TODO** (`route.ts` line ~63) |
| eTIMS / KRA | `src/lib/etims/{provider,submission,callback}.ts`, `api/etims/*` | shared secret header, env-selected provider | best precedent: typed provider interface, `MockEtimsProvider`, outcome union |
| Email | `src/lib/email.ts` (`nodemailer`) | SMTP env | used for receipts and invitations |

Two abstractions to reuse verbatim in shape:

1. `src/lib/payment-gateways/registry.ts` — `getTenantGatewayAdapter(tenantId, provider)`
   loads the tenant's row, **decrypts credentials server-side**, and returns a typed adapter;
   unimplemented providers throw rather than pretending.
2. `src/lib/etims/provider.ts` — `EtimsProvider` interface; `EtimsSubmitOutcome` distinguishes
   `accepted | submitted | rejected | unreachable`, so retryability is a data property, not a
   guess; `MockEtimsProvider` for dev; env-driven provider selection that **fails loudly** on
   misconfiguration instead of silently mocking.

There is **no generic outbound webhook subscription system** and no user-configurable external
endpoint anywhere today.

## 12. Webhooks (inbound) today

`api/paystack/webhook` verifies `x-paystack-signature` (HMAC-SHA512 over the raw body) before
processing. `api/webhooks/daraja` handles the M-Pesa callback. `api/etims/callback` requires
`x-etims-callback-secret` and `verifyCallbackSecret()` returns 503 when the secret is
unconfigured — a good "fail closed" pattern. PalPluss additionally has the TODO noted above.
Nothing in the codebase uses a per-connection webhook token, replay window, or event dedupe
key, all of which Connect needs.

## 13. AI platform

`src/lib/ai/` (24 files): `orchestrator.ts` drives runs; `gemini.ts` and `groq.ts` are provider
adapters; `agents.ts` defines agents with **tool allowlists** and per-tier monthly run limits;
`tools/` holds read tools; `actions.ts` is the only write path and it does not execute
directly — it calls `proposeAction()` which creates an `AiApprovalRequest`;
`approvals.ts` enforces approver roles (`OWNER/ADMIN/MANAGER`), a TTL, a canonical payload and
`payloadHash` so an edited amount invalidates the approval; `executeApprovedAction()` runs only
after a human decision. `quota.ts` (monthly allowance by tier), `kill-switch.ts`
(`Tenant.aiEnabled`), `scope.ts` (tenant scoping), `citations.ts` (grounding),
`usage.ts` + `AiUsageRecord`.

For Connect this is the template for Milestone 5/6: **read-only intelligence first**, writes
only through approvals, every figure grounded in rows that exist.

## 14. UI, navigation, design system

- Primitives: `src/components/ui/{badge,button,card,input,loader,modal,module-badge,module-list,toast}.tsx`.
- Navigation: `src/components/sidebar.tsx` — `NAV_ITEMS` of `{ label, href, roles?, module?,
  feature?, featureKey?, app }`, grouped by `SIDEBAR_SECTIONS` (`home, pos, crm, finance,
  payroll, assets, etims, insights, admin`). Roles and entitlements are filtered client-side
  for display and re-checked server-side by the route guards.
- Tenant shell: `src/app/(dashboard)/[tenant]/layout.tsx` wires `Sidebar`, `PlanProvider`,
  `AIAssistant`, `ImpersonationBanner` after `getCurrentUser()`.
- Existing pages to imitate for Connect: `settings/` (tabbed forms), `approvals/` (list +
  decision detail), `assets/` (table + status pills + filters).
- Theme tokens used everywhere: `border`, `surface`, `surface-elevated`, `text-primary`,
  `text-muted`, `gold`, `brand-solid`. Connect must use these, not new colours.

## 15. Logging, monitoring, audit

- No structured logger, no APM/Sentry: `console.log`/`console.error` throughout, including
  per-request debug lines in `getCurrentUser()` that print `userId`, `tenantId`, `role`.
- `src/lib/audit.ts` — `writeAuditLog`/`writeAuditLogs` into `ActivityLog` with namespaced
  `AUDIT_ACTIONS` (`AUTH.*`, `TENANT.*`, `POS.*`, `FINANCE.*`, `ETIMS.*`, `PAYROLL.*`,
  `ASSETS.*`, `INVENTORY.*`, `PROCUREMENT.*`). This is the audit trail Connect must extend
  with a `CONNECT.*` namespace.
- `api/health` exists for liveness.

## 16. Testing and CI

- `npm test` → `node --import tsx --test "tests/**/*.test.ts"`; 78 tests pass at this commit.
- 15 files, all under `tests/ai/`; pure-unit files and DB-gated files that only run with
  `RUN_DB_TESTS=1` and clean up their own `it-*` tenants in `after()`.
- No HTTP-level connector tests, no fixture server, no factory module for tenants.
- `.github/workflows/migrations.yml` (added just before this audit) is the only workflow: it
  applies migrations to an empty Postgres and fails on status errors or schema drift.

## 17. Deployment and configuration

- `npm run build` = `prisma generate && next build`; Node server (`next start`); Neon Postgres.
- No `vercel.json`, no Dockerfile, no infra-as-code in the repo. Scheduled work assumes an
  external cron calling a `CRON_SECRET`-guarded route.
- `.env.example` documents only `DATABASE_URL, JWT_SECRET, PAYSTACK_*, NEXT_PUBLIC_APP_URL,
  NODE_ENV, ETIMS_PROVIDER, ETIMS_CALLBACK_SECRET, GEMINI_API_KEY, GROQ_API_KEY, GROQ_MODEL,
  CRON_SECRET`. **`ENCRYPTION_KEY` is missing** even though `src/lib/crypto.ts` throws without
  it, as are `UPSTASH_REDIS_REST_*`, the other `ETIMS_*` settings and payment-gateway keys.
  `docs/ai-evolution/M3_RELEASE_RUNBOOK.md` covers deployment/rollback in more detail.

## 18. What Connect can reuse instead of rebuilding

| Need | Reuse | File |
|---|---|---|
| Credential encryption | `encrypt`, `decryptJSON` (AES-256-GCM, `ENCRYPTION_KEY`) | `src/lib/crypto.ts` |
| Provider registry + adapter | `getTenantGatewayAdapter` shape; `EtimsProvider` + `Mock*` + outcome union | `src/lib/payment-gateways/registry.ts`, `src/lib/etims/provider.ts` |
| Session/auth | `getCurrentUser`, guards | `src/lib/auth.ts`, `src/lib/api-guards.ts` |
| Entitlement gates | `requireUserWithFeature`, `FEATURE_KEYS`, `canAccessFeature` | `src/lib/api-guards.ts`, `module-registry.ts`, `plans.ts` |
| Idempotent replay | `IDEMPOTENCY_HEADER`, `replaySyncResponse`, `recordSyncResponse`, `SyncReceipt` | `src/lib/idempotency.ts` |
| Audit trail | `writeAuditLog`, `AUDIT_ACTIONS` | `src/lib/audit.ts` |
| Rate limiting / cache | `getCacheStore().increment` (Upstash when configured) | `src/lib/cache-store.ts` |
| Scheduled entry point | `CRON_SECRET`-guarded route pattern | `api/notifications/check/route.ts` |
| Human approval of writes | `AiApprovalRequest` mechanics (payload hash, fingerprint, TTL) | `src/lib/ai/approvals.ts` |
| Inbound signature checks | HMAC verify over raw body; fail-closed secret check | `api/paystack/webhook`, `src/lib/etims/callback.ts` |
| Error → HTTP mapping | `routeError` | `src/lib/api-guards.ts` |
| CSV/Excel | `xlsx` (already a dependency, but **devDependency only** — must move to `dependencies` for runtime use) | `package.json` |

## 19. Required changes, in outline (detail in ARCHITECTURE.md)

- **Database:** new `IntegrationConnection`, `IntegrationSyncConfig`, `IntegrationJob`,
  `IntegrationJobRecord`, `IntegrationWebhookEvent`, `IntegrationExternalRecord` tables
  (migration `0015_connect_foundation`), all tenant-scoped with composite indexes.
- **API:** `/api/connect/{connections,connections/[id],connections/[id]/test,catalogue,sync,jobs,jobs/[id]/retry}`,
  `/api/connect/webhooks/[connectionId]` (signature-authenticated), `/api/connect/cron/tick`
  (`CRON_SECRET`).
- **UI:** `src/app/(dashboard)/[tenant]/connect/{page, [id]/page, catalogue/page, history/page}`,
  one sidebar entry under `admin`.
- **Entitlements:** a `connect` feature key in `FEATURE_REGISTRY` plus per-tier connection
  limits, so the capability can be sold without adding a new App.

## 20. Compatibility problems and risks

1. **No job queue** (§10). Inline sync in a request would repeat the payroll-approval
   pattern (tens of seconds) and time out at provider scale. Requires the DB-backed runner.
2. **`xlsx` is dev-only** — import/export would fail in production until it moves to
   `dependencies`.
3. **`Customer` has `@@unique([tenantId, phone])` with nullable `phone`** — Postgres allows
   repeated NULLs, and a phone-only dedupe key collides across countries/formatting. Customer
   sync needs an external-record map, not phone matching.
4. **`Supplier` has no unique constraint at all** (`@@index([name])` only) — supplier sync
   must key on the external id.
5. **`Product` keys on `@@unique([tenantId, sku])`** — an external catalogue with duplicate or
   blank SKUs needs an explicit policy (`REJECT` vs `MAP_TO_PLACEHOLDER`), not silent overwrite.
6. **`PaymentProvider` is a database enum** — copying that pattern for integrations would need
   a migration per new provider. Use `providerId String` validated against a code registry.
7. **Middleware exempts all `/api`** (§6) — every new route needs an explicit guard; a
   webhook path must be the only unauthenticated one and must verify its own signature.
8. **`isAdminUser` is true for demo tenants** — a demo login can edit connections. Acceptable
   for the demo, but credential *reveal* and provider *delete* should check the role directly.
9. **`ENCRYPTION_KEY` is undocumented and single-valued** — losing it destroys every stored
   credential, and there is no key-version column to rotate. Connect should add
   `credentialKeyVersion` from day one.
10. **No shared rate limiter wired up** — the only limiter is a per-user in-memory burst window
    in `api/ai/chat`. Inbound webhook and sync endpoints need `cache-store.increment`, which
    is per-process unless Upstash is configured.
11. **`getCurrentUser()` logs identifiers on every call** — tolerable today, but Connect error
    paths must not log ciphertext, tokens or full provider responses.
12. **Impersonation** — an impersonating super-admin carries a tenant session; Connect writes
    must record that state in the audit entry (the machinery exists: `isImpersonating()`).

## 21. Security debt found during recon (out of scope, worth fixing)

- `api/webhooks/palpluss` **does not verify its signature** (explicit TODO) and processes the
  body regardless.
- `api/paystack/webhook` compares HMACs with `!==` rather than `timingSafeEqual`.
- `getCurrentUser()` logs `userId`/`tenantId`/`role` at `console.log` on every request.

## 22. Recommended first integration use case

**A "Custom API + file" connector for Products and Customers, inbound only, manual and hourly
scheduled.** Rationale grounded in the above: products (`sku`) and customers are the two
entities every business already holds in another system; neither needs OAuth onboarding or a
provider partnership; both exercise every layer that later providers reuse (registry,
encrypted credentials, mapping, idempotency, job runner, monitoring, SSRF guard); and inbound
writes are reversible. It also sidesteps the hardest dedupe cases (orders, invoices) until the
mapping UI exists in Milestone 4.

Alternatives considered: Shopify/WooCommerce (needs OAuth app review and public callback URLs),
QuickBooks/Xero (OAuth plus accounting semantics), Odoo/ERPNext (self-hosted, large API
surface). All are Milestone 3 candidates once the engine is proven.

## 23. Open questions for approval

1. First integration: the Custom API/file connector above, or a named provider?
2. Entitlement model: new `connect` feature key with per-tier connection limits (proposed), or
   a new App?
3. Scheduler: external cron against a `CRON_SECRET` route (proposed, matching the existing
   `notifications/check` pattern), or added scheduling infrastructure?
4. Whether Milestone 1 may include the `xlsx` dependency move and the `CONNECT.*` audit
   namespace.
