# LipaPoint Connect — Milestone 1 Plan (Integration Foundation)

Status: plan only, awaiting approval. Nothing in this document has been implemented.

## 1. Objective

Ship the integration engine and the surfaces around it, with two connectors that need no vendor
approval (`mock`, `file`/CSV), so that a tenant can: connect a system, prove the credentials
work, configure an inbound sync, run it, watch what happened record by record, retry failures,
and receive a verified webhook that enqueues work. Every layer that a real provider needs later
exists at the end of this milestone.

## 2. In scope / out of scope

**In:** provider registry; connector interface; connection CRUD + lifecycle; encrypted
credentials with key version; connection test; health; DB-backed job runner with the
`CRON_SECRET` tick; sync config (inbound only, manual + hourly); mapping document + validator;
mock connector; CSV connector; job history + per-record outcomes; retry; monitoring UI
(overview, catalogue, detail, history); `connect` entitlement key + limits; audit namespace;
`CRON_SECRET`/`ENCRYPTION_KEY` docs; tests; runbook.

**Out:** real providers, OAuth flows, outbound writes, outbound webhooks, bidirectional sync,
conflict resolution UI, reconciliation, CSV export, AI read tools, approvals. (Roadmap §4–8.)

## 3. Deliverables, file by file

### 3.1 Schema and data

- `prisma/schema.prisma` — add the models from `ARCHITECTURE.md` §13:
  `IntegrationConnection`, `IntegrationSyncConfig`, `IntegrationJob`, `IntegrationJobRecord`,
  `IntegrationExternalRecord`, `IntegrationWebhookEvent`. Relation fields on `Tenant`
  (`integrationConnections`) and on `User` for `createdById`/`requestedById` if it is related.
- `prisma/migrations/0015_connect_foundation/migration.sql` — additive: six `CREATE TABLE`s,
  unique constraints, composite indexes, `ON DELETE CASCADE` FKs. Rollback statement in the
  file header (`DROP TABLE` in reverse order) as with `0012`/`0013`.
- No existing table is altered. `npx prisma migrate diff --from-migrations … --exit-code` and
  the `Migrations` CI workflow must both stay green.

### 3.2 Engine (`src/lib/connect/`)

| File | Contents |
|---|---|
| `types.ts` | `ConnectEntity`, `SyncDirection`, `ConnectorResult`, `ConnectorContext`, `Connector`, `ConnectorFactory` |
| `registry.ts` | `PROVIDERS` with `mock`, `file`, and `status: "planned"` entries for `http`, `shopify`, `woocommerce`, `quickbooks`, `xero`, `odoo`, `erpnext`, `zoho`, `hubspot` |
| `connectors/mock.ts` | deterministic dataset generator (N products/customers), `testConnection` always ok, configurable failure modes for tests |
| `connectors/file.ts` | CSV parser plus a minimal ZIP + SpreadsheetML reader using `node:zlib` (no network, per-row validation). `xlsx` stays a devDependency: the only npm build is 0.18.5, whose CVE-2023-30533 / CVE-2024-22363 fixes are not published to npm, so it is used only by tests to generate a fixture workbook |
| `connectors/index.ts` | `CONNECTORS` map, with a test asserting registry/catalogue agreement |
| `credentials.ts` | `setCredentials`, `readConnectionCredentials`, `maskCredentials`, uses `src/lib/crypto.ts` only |
| `connections.ts` | create/update/pause/resume/disconnect/test, entitlement limit check, status transitions |
| `mapping.ts` | field catalogue per entity, `validateMapping`, `applyMapping` returning per-row errors |
| `sync.ts` | `planSync`, `runSyncJob` (fetch → map → validate → upsert → record), cursor handling |
| `jobs.ts` | `enqueue`, `claimNext`, `complete`, `fail` (backoff), `retry`, `stuckRecovery`, `stats` |
| `webhooks.ts` | `verifyInboundSignature`, `recordInboundEvent` (dedupe), `enqueueFromEvent` |
| `health.ts` | `connectionHealth(connection)` → `HEALTHY / DEGRADED / ERROR` + reasons |
| `ssrf.ts` | `assertSafeUrl`, `safeFetch` (HTTPS-only, no redirects, timeout, size cap) |
| `audit.ts` | `CONNECT.*` action constants + `redact` helper |
| `errors.ts` | `ConnectError` with `status`, `code`, user-safe `message` |

`sync.ts` upserts products through the existing unique key `[tenantId, sku]` and customers
through the external map (phone only when present and normalised), never by name, and writes
`IntegrationExternalRecord` in the same transaction as the local write.

### 3.3 API routes (`src/app/api/connect/`)

Exactly the table in `ARCHITECTURE.md` §14. Every handler:

1. `const { user, response } = await requireUserWithFeature("connect")`; return `response` if set.
2. Role check for writes (`OWNER`/`ADMIN`, or `MANAGER` for `/sync`), using `user.role`
   directly — not `isAdminUser()`.
3. Validate the body against an allowlist; reject unknown keys.
4. Delegate to `src/lib/connect/*`; map errors through `routeError`.
5. Write an audit entry for state changes.

The webhook and cron handlers are the only two without a session guard; they authenticate by
HMAC / `CRON_SECRET` respectively and are listed in the route-inventory test's allowlist.

### 3.4 UI (`src/app/(dashboard)/[tenant]/connect/`)

- `page.tsx` — overview: connection cards with health pill, last success, pending/failed counts,
  recent activity, *Add integration*.
- `catalogue/page.tsx` — categories, capability chips, `available` vs `planned` badges; planned
  entries have no action.
- `[id]/page.tsx` — provider, auth status, capabilities, sync table, credentials form
  (write-only), Pause / Resume / Reconnect / Disconnect / Test, link to history.
- `[id]/history/page.tsx` (or `history/page.tsx` with a connection filter) — job table with
  status, time, direction, entity, processed/rejected, error, Retry.
- Client components only where interaction requires it; server components read services
  directly, matching `assets/` and `approvals/`.
- `src/components/sidebar.tsx` — one entry: `{ label: "Connect", href: "/connect",
  roles: ["OWNER","ADMIN","MANAGER"], feature: "connect", app: "admin" }`.

### 3.5 Entitlements and config

- `src/lib/module-registry.ts` — `connect` in `FEATURE_KEYS` + `FEATURE_REGISTRY`; no new module
  key and no new App (keeps pricing pages unchanged).
- `src/lib/plans.ts` — `MAX_CONNECTIONS` per tier (proposal: STARTER 1, PROFESSIONAL 3,
  ENTERPRISE unlimited) and `connect` in the feature list of tiers that may use it.
- `.env.example` — add `ENCRYPTION_KEY`, `CONNECT_CRON_BATCH`, `CONNECT_ALLOW_INSECURE_LOCAL`.
- `src/lib/audit.ts` — `CONNECT` namespace.

## 4. Tests (added under `tests/connect/`)

`node --test` with `tsx`, mirroring `tests/ai/` conventions (unit files plus DB-gated files
behind `RUN_DB_TESTS=1` that create and delete their own `it-*` tenants).

| File | Covers |
|---|---|
| `registry.test.ts` | every non-`planned` provider has a connector and a `configSchema` entry for each credential field; planned providers have none |
| `credentials.test.ts` | encrypt/decrypt round trip; ciphertext differs per call (random IV); `maskCredentials` never returns a secret; missing `ENCRYPTION_KEY` fails loudly |
| `mapping.test.ts` | required fields, dot paths, array indexes, transforms, per-row error collection, rejection reasons |
| `ssrf.test.ts` | rejects `http:` in production, IP literals, `localhost`, `169.254.169.254`, `::1`, `.internal`, port ≠ 443, redirect responses; accepts a normal HTTPS host |
| `webhooks.test.ts` | valid signature accepted; tampered body, wrong secret, missing header, oversized body rejected; duplicate `externalEventId` is a no-op `200`; unconfigured secret → 503 |
| `jobs.test.ts` | claim is exclusive (second claim of the same job does nothing); backoff grows and caps; dead after `maxAttempts`; stuck `RUNNING` recovered |
| `sync.mock.db.test.ts` | end-to-end: connect mock → sync products → ids mapped → re-run is idempotent (no duplicates, updates in place) |
| `sync.file.db.test.ts` | CSV with good and bad rows → applied/rejected counts, rejections readable, no partial row written |
| `tenant-isolation.db.test.ts` | two tenants, both connected: job/connection/detail/external-record reads from A never return B's rows; cross-tenant id returns 404 |
| `connect-routes.test.ts` | every handler under `src/app/api/connect` calls a guard (or is in the webhook/cron allowlist) — static check over the route files |

## 5. Acceptance criteria

1. `npx tsc --noEmit` clean; `npm test` green including the new files.
2. `migrate deploy` on an empty database applies `0000_init`…`0015`; drift check reports no
   difference (the CI workflow proves it).
3. A tenant on a tier without `connect` gets `403 FEATURE_NOT_IN_PLANS` from every route and no
   sidebar entry; a tenant over its connection limit gets a 409 with a readable message.
4. The catalogue never presents a `planned` provider as connectable.
5. Creating a connection stores ciphertext only — verified by a DB assertion that no plaintext
   credential appears in the row — and no API response contains a secret.
6. Test connection returns a provider account label on success and a user-readable failure on
   bad credentials (no stack trace, no provider body).
7. Sync produces a job with counts; re-running the same data changes nothing (idempotent).
8. A bad row is rejected with a reason while good rows apply (`onError = CONTINUE`).
9. Retry resets a `DEAD` job and it succeeds; retries stop at `maxAttempts`.
10. Webhook with an invalid signature writes nothing and returns 401; a valid one enqueues.
11. Pause stops scheduled work; resume restarts it; disconnect wipes credentials but keeps
    history.
12. Every state change has an `ActivityLog` row with `module: "connect"`.

## 6. Implementation order

1. Schema + migration + `npm run db:push` equivalent on a scratch database (no app changes yet).
2. `types.ts`, `registry.ts`, `ssrf.ts`, `credentials.ts` + their unit tests.
3. `jobs.ts` + `connections.ts` + DB tests (claiming, backoff, isolation).
4. `mapping.ts`, `connectors/mock.ts`, `sync.ts` + end-to-end DB test.
5. Routes, then the sidebar entry, then pages (overview → catalogue → detail → history).
6. `connectors/file.ts` and CSV import (needs `xlsx` in `dependencies`).
7. Entitlement wiring, `.env.example`, audit namespace, runbook, README section.
8. Full verification pass; milestone report.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Inline sync attempt makes a slow provider look like a broken page | 20 s budget, then hand off to the tick; the UI shows "queued" |
| Tick overlap causing double processing | atomic `updateMany` claim (`count === 1`), plus stuck-job recovery |
| External SKU collisions create duplicate products | `IntegrationExternalRecord` unique keys; ambiguous rows rejected, never merged |
| `ENCRYPTION_KEY` absent in an environment | fail loudly at first use, and document it in `.env.example` + runbook before M1 ships |
| Tenant-scoped table missed in a query | isolation DB test per service entry point; all reads take `tenantId` as an argument |
| Scheduler not configured in production | health shows `DEGRADED` (overdue), and the runbook lists the exact cron entry |

## 8. Deployment and rollback

- Deploy the migration first (`prisma migrate deploy`), then the app, then enable the
  `connect` feature for internal tenants, then per tier.
- Configure the scheduler to call `POST /api/connect/cron/tick` every minute with
  `x-cron-secret: $CRON_SECRET`.
- Rollback: disable the feature key (immediate, no deploy), then revert the app. The six tables
  can stay — nothing else reads them — or be dropped with the rollback statements in `0015`.
- Emergency stop for one tenant: set its connections to `PAUSED` and clear credentials for the
  affected provider.

## 9. Reporting at the end of the milestone

The milestone report will list: what was implemented, files created/modified, migration details,
APIs and services, security measures, tests executed with actual results, known limitations,
deployment requirements, rollback instructions, and the recommended next milestone — as the
assignment requires. No test result will be reported unless the command was run.

## 10. Architectural blockers and migration risks (recorded before the build)

These are the constraints that shaped Milestone 1. Each is a decision plus its
residual risk, so a reviewer can disagree with the decision instead of discovering it in production.

| # | Blocker / risk | Decision taken | Residual risk / follow-up |
|---|---|---|---|
| 1 | The application has no queue service (no Redis, no BullMQ) | Sync work is an `IntegrationJob` table row claimed by the cron tick and by the request that enqueued it | Up to one tick of latency for scheduled syncs; no priority lanes. Add Redis behind the same `jobs.ts` seam only when volume demands it |
| 2 | Prisma cannot declare a partial unique index | Duplicate prevention is `findFirst` on QUEUED/RUNNING plus a `P2002` catch | Two inserts in the same millisecond can queue a second job; jobs still run one at a time, so the data stays idempotent |
| 3 | The only `xlsx` build on npm (0.18.5) lacks the fixes for CVE-2023-30533 and CVE-2024-22363 | Excel is read by an in-house ZIP + SpreadsheetML reader on `node:zlib`; `xlsx` stays a devDependency used only to build a fixture | First worksheet only, no ZIP64, no encrypted workbooks, 5,000-row cap |
| 4 | `src/middleware.ts` exempts every `/api` path, so a route that forgets its guard is public | Every Connect route calls `requireConnectAccess()`; only the HMAC webhook and `CRON_SECRET` tick are exempt, and both fail closed | The planned route-inventory test (asserting each handler under `/api/connect` calls a guard) is **not implemented yet** |
| 5 | `ENCRYPTION_KEY` is required but `.env.example` is matched by `.gitignore` (`.env*`), so no env template is tracked | The variables are documented in `RUNBOOK.md` §1 and §6 | Deployments must set the key manually; losing it makes stored credentials permanently unreadable |
| 6 | Existing tenants have no `TenantModule` / `TenantFeature` rows for the new `connect` module, so the sidebar entry is hidden until provisioning runs | `prisma/backfill-modules.ts` now provisions features as well as modules | Deployments **must** run the backfill (or trigger a tier change) or Connect stays invisible to existing tenants |
| 7 | `isAdminUser()` returns true for demo tenants, bypassing role checks | Connect writes use `isAdminRole()` instead, so demo mode cannot rotate credentials or disconnect a system | Any future Connect write route must keep using `isAdminRole()` |
| 8 | Migration `0015_connect_foundation` is the first Connect migration | Additive only — six new tables, no existing table altered. Columns, indexes and foreign keys were compared against `prisma migrate diff` output | Not executed against a live Postgres in this environment; the CI `migrate deploy` + drift gate is the first real execution |
| 9 | `feature-registry.check.ts` encodes the spec's 46 features and counts | `connect` is declared a post-spec feature (excluded from the spec key-set comparison, counted separately) and made the core feature of its module | When the spec is next revised, move `connect` into the spec tables and delete the exception |
