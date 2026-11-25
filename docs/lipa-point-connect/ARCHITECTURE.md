# LipaPoint Connect — Architecture

Status: Phase 0 design proposal. Nothing here is implemented yet; this document is what
Milestone 1 would build. It is grounded in the repository audit (`REPOSITORY_AUDIT.md`) and
reuses the seams that already exist.

## 1. Constraints that shaped the design

| Constraint (verified) | Consequence |
|---|---|
| One Next.js app, one Postgres database, no worker process | The engine must run inside the app: a DB-backed job table plus a `CRON_SECRET`-guarded tick route, exactly like `api/notifications/check` today |
| No Redis/BullMQ | No in-memory queue as a source of truth; jobs survive restarts because they are rows |
| Credentials already encrypted with AES-256-GCM (`src/lib/crypto.ts`) | Reuse it; add a key-version column so rotation is possible later |
| Every tenant-owned model carries `tenantId` | Connect tables follow the same shape and index pattern |
| Middleware exempts `/api` | Every Connect route calls a guard; only the webhook route is signature-authenticated instead |
| Service logic lives in `src/lib/*`, routes are thin | `src/lib/connect/*` holds the engine; `src/app/api/connect/*` is glue |
| Existing adapters (`payment-gateways/registry.ts`, `etims/provider.ts`) already define a seam | Connect generalises that seam instead of inventing a second one |

## 2. Layers and responsibilities

The eleven responsibilities in the brief map to eleven modules, all under `src/lib/connect/`:

```
src/lib/connect/
  registry.ts        provider catalogue: ids, categories, capabilities, auth kind, config schema
  types.ts           Connector, ConnectorContext, SyncOutcome, MappingRule, typed results
  connectors/
    mock.ts          deterministic connector for end-to-end tests and demos
    http.ts          generic REST connector (API key / bearer / basic), SSRF-guarded
    file.ts          CSV/Excel import (xlsx) — no network at all
    index.ts         CONNECTORS: Record<providerId, ConnectorFactory>
  connections.ts     create/update/pause/resume/disconnect, credential read/write, health check
  credentials.ts     encrypt/decrypt wrappers, masking, key version, "never leaves the server"
  mapping.ts         field mapping validation, coercion, per-entity field catalog
  sync.ts            orchestration: plan → fetch → map → validate → upsert → report
  jobs.ts            enqueue, claim (atomic), retry/backoff, dead-letter, stats
  webhooks.ts        inbound verification, dedupe, enqueue; outbound signing + delivery
  health.ts          connection health, last-success, consecutive failures
  reconcile.ts       count/hash comparison between external and local (Milestone 4)
  audit.ts           CONNECT.* action names + redaction helpers
  ssrf.ts            URL validation and guarded fetch
```

Above those, thin layers:

- `src/app/api/connect/**` — route handlers, 20–60 lines each, using `requireUserWithFeature`.
- `src/app/(dashboard)/[tenant]/connect/**` — server components that read services directly
  (same pattern as `assets`, `approvals`), client components only for forms and filters.

## 3. The connector interface

Generalises `EtimsProvider` (typed outcome union) and `PaymentGatewayAdapter` (per-tenant
credentials, resolved by a registry). One interface, four capabilities, so a provider
implements only what it supports and the engine can say so honestly:

```ts
// src/lib/connect/types.ts
export type ConnectEntity =
  | "product" | "customer" | "supplier" | "invoice" | "payment" | "inventory" | "purchase_order";

export type SyncDirection = "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";

/** Mirrors EtimsSubmitOutcome: retryability is data, not a guess. */
export type ConnectorResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "retryable"; error: string }      // timeout, 429, 5xx — safe to retry
  | { ok: false; kind: "permanent"; error: string }      // 400/401/403/422 — needs a human
  | { ok: false; kind: "auth_expired"; error: string };  // 401 with token — needs reconnect

export interface ConnectorContext {
  tenantId: string;
  connectionId: string;
  /** Decrypted in memory only, for the duration of one call. Never logged, never returned. */
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  /** Guarded fetch: HTTPS-only, no redirects, timeout, size cap. */
  http: (input: { url: string; method: string; body?: unknown }) => Promise<Response>;
}

export interface Connector {
  readonly providerId: string;
  testConnection(ctx: ConnectorContext): Promise<ConnectorResult<{ accountName?: string }>>;
  /** Optional per capability: absence means "not supported" and the UI says so. */
  listRecords?<T>(ctx: ConnectorContext, entity: ConnectEntity, cursor?: string):
    Promise<ConnectorResult<{ records: T[]; nextCursor?: string }>>;
  pushRecord?<T>(ctx: ConnectorContext, entity: ConnectEntity, record: T):
    Promise<ConnectorResult<{ externalId: string }>>;
  /** Webhook event → canonical external record(s). Used by inbound webhooks. */
  parseWebhook?(ctx: ConnectorContext, headers: Headers, rawBody: string):
    Promise<ConnectorResult<{ entity: ConnectEntity; records: unknown[]; eventId?: string }>>;
}

export type ConnectorFactory = (ctx: ConnectorContext) => Connector;
```

Pagination is **cursor-based** (`nextCursor`) because every provider that supports incremental
sync offers one; the engine stores the cursor on the sync config so a failed run resumes rather
than restarting.

## 4. Provider registry (`registry.ts`)

A **code** registry, not a database table, for the same reason `MODULE_REGISTRY` and
`FEATURE_REGISTRY` are code: the catalogue is a property of the deployed version, and an
unknown provider id must be impossible, not merely unselected.

```ts
export interface ProviderDefinition {
  id: string;                      // "mock" | "http" | "file" | "shopify" | ...
  name: string;
  category: "accounting" | "pos" | "erp" | "inventory" | "ecommerce" | "crm" | "payments" | "custom";
  authKind: "none" | "api_key" | "bearer" | "basic" | "oauth2";
  capabilities: ConnectEntity[];   // what it can actually do — drives the catalogue UI
  directions: SyncDirection[];
  status: "available" | "beta" | "planned";  // "planned" is shown, never connectable
  setup: string[];                 // ordered, human steps shown in the UI
  configSchema: Record<string, { label: string; type: "text" | "url" | "secret"; required: boolean }>;
}
export const PROVIDERS: Record<string, ProviderDefinition>;
```

Rules: `IntegrationConnection.providerId` is a `String` validated against `PROVIDERS` (the
audit explains why a DB enum is a trap here); `status: "planned"` entries exist so the
catalogue can be honest about QuickBooks/Shopify without pretending they work, and
`CONNECTORS[providerId]` missing while `status !== "planned"` is a startup-time test failure.

## 5. Connection lifecycle and credential management

`IntegrationConnection.status`: `PENDING → ACTIVE → PAUSED → ERROR → DISCONNECTED`.

- **PENDING** — created, credentials not yet verified. `testConnection` is the only action.
- **ACTIVE** — credentials verified; syncs may run.
- **PAUSED** — user stopped it; scheduled ticks skip it, manual *run once* still allowed.
- **ERROR** — `auth_expired` or N consecutive failures; syncs stop until *Reconnect* succeeds.
- **DISCONNECTED** — credentials wiped (ciphertext nulled, not just flagged), history kept.

Credentials (`credentials.ts`):

- Write: `encryptJSON(creds)` → `credentialsEnc`, plus `credentialKeyVersion` (starts at 1).
- Read: only through `readConnectionCredentials(connectionId, tenantId)`, which returns
  plaintext to a `ConnectorContext` and nothing else. No API route returns `credentialsEnc`;
  the detail endpoint returns `{ hasCredentials, maskedHint }` where `maskedHint` is derived
  (e.g. last 4 characters of a non-secret identifier field, never of a secret).
- Disconnect nulls `credentialsEnc` inside the same transaction that sets `DISCONNECTED`.
- The audit entry records *that* credentials changed, never their content.

`credentials.ts` deliberately does **not** reimplement AES; it imports `encrypt`, `decrypt`,
`encryptJSON`, `decryptJSON` from `src/lib/crypto.ts`, so there is exactly one crypto path.

## 6. Data mapping

Mapping is a per-connection, per-entity document with an explicit external→local field map:

```ts
export interface FieldMapping {
  external: string;          // "variants.0.sku" (dot path, arrays by index)
  local: string;             // "sku"
  required?: boolean;
  transform?: "trim" | "upper" | "lower" | "number" | "date" | "e164" | "boolean" | "strip_html";
}
export interface EntityMapping { entity: ConnectEntity; fields: FieldMapping[]; }
```

`mapping.ts` validates a mapping against the local field catalogue (a small allowlist per
entity, e.g. `product: sku, name, price, categoryName, stockQty, barcode, unit`), coerces
values, and returns a `{ ok, record, errors }` per row rather than throwing on the first bad
row — a 5,000-row import must report the 12 bad rows, not fail wholesale.

**Identity and dedupe (the part that decides correctness).** Every applied record writes an
`IntegrationExternalRecord` row: `@@unique([connectionId, entity, externalId])` and
`@@unique([connectionId, entity, localId])`. Lookup order when an inbound record arrives:

1. `IntegrationExternalRecord` for `(connectionId, entity, externalId)` → update that local row.
2. If absent, natural key per entity: product `[tenantId, sku]`, customer `[tenantId, phone]`
   **only when the mapped phone is present and normalised to E.164** — never on NULL.
3. If still absent, create, then record the mapping.

Suppliers have no natural unique key (`@@index([name])` only), so supplier sync relies on step
1 and refuses to guess on name. Records that cannot be resolved are **rejected with a reason**,
never merged blindly.

## 7. Synchronisation model

`IntegrationSyncConfig` is one row per connection per entity:

| Field | Meaning |
|---|---|
| `entity` | `product` / `customer` / … |
| `direction` | `INBOUND` / `OUTBOUND` / `BIDIRECTIONAL` (validated against provider capabilities) |
| `sourceOfTruth` | `EXTERNAL` / `LIPAPOINT` / `NEWEST_WINS` — explicit, never inferred |
| `frequency` | `MANUAL` / `HOURLY` / `DAILY` / `WEEKLY` |
| `conflictPolicy` | `KEEP_LOCAL` / `KEEP_EXTERNAL` / `NEWEST_WINS` / `REQUIRE_REVIEW` |
| `onError` | `STOP` / `CONTINUE` (per-record vs whole-run failure) |
| `cursor` | opaque resume token from the connector |
| `fieldMapping` | `Json` validated by `mapping.ts` |
| `enabled` | boolean, independent of connection status for multi-entity connections |

`BIDIRECTIONAL` is only offered where the provider supports `pushRecord` **and** the entity has
a safe conflict story. Milestone 1 offers inbound only; the column exists so the schema does not
need to change for Milestone 4, and the API rejects a direction the provider registry does not
advertise.

Outbound writes are the consequential direction, so they are gated twice: the sync config must
say `direction` includes `OUTBOUND`, **and** the connection must have
`allowOutboundWrites = true` set by an OWNER. Milestone 5 turns that flag into per-run human
approval for orders/invoices.

## 8. Job runner (no queue, no new service)

`IntegrationJob` is the durable unit of work:

```
id, tenantId, connectionId, syncConfigId, entity, direction,
status: QUEUED | RUNNING | SUCCEEDED | PARTIAL | FAILED | DEAD | CANCELLED,
attempt, maxAttempts (default 5), runAfter (next attempt at), startedAt, finishedAt,
recordsSeen, recordsApplied, recordsRejected,
cursorBefore, cursorAfter, errorCode, errorMessage (user-safe), errorDetail (truncated, redacted),
trigger: MANUAL | SCHEDULE | WEBHOOK | RETRY, requestedById, createdAt
```

Claiming is atomic without `SKIP LOCKED` gymnastics in Prisma:

```ts
const claimed = await db.integrationJob.updateMany({
  where: { id: job.id, status: "QUEUED", runAfter: { lte: new Date() } },
  data: { status: "RUNNING", startedAt: new Date(), attempt: { increment: 1 } },
});
if (claimed.count !== 1) return; // someone else took it
```

A stuck job (process died mid-run) is recovered by the tick: `RUNNING` with
`startedAt < now - 15 min` is reset to `QUEUED`. Retries use exponential backoff with jitter
(`runAfter = now + min(2^attempt * 30s, 1h)`), capped at `maxAttempts`, then `DEAD` (visible in
the UI with a manual *Retry* that resets `attempt = 0`).

Execution surfaces:

1. `POST /api/connect/cron/tick` — `CRON_SECRET` header, claims up to N jobs, processes each
   for a bounded time, returns counts. Called by the scheduler every minute.
2. `POST /api/connect/connections/[id]/sync` — enqueues, then *attempts one job inline* with a
   short budget (~20 s) so the UI shows movement immediately; if the budget is exhausted the
   job stays `QUEUED` for the tick. This is the only inline execution path.
3. Inbound webhooks enqueue only; they never do work in the request.

Bounded concurrency per tenant (default 1) prevents one customer's backfill from starving the
shared tick.

## 9. Webhooks

**Inbound.** `POST /api/connect/webhooks/[connectionId]` with a per-connection URL token and
an HMAC-SHA256 signature header (`x-lipapoint-signature`) over the raw body, compared with
`crypto.timingSafeEqual`. The connection row stores `webhookSecretEnc` (encrypted like the API
credentials) so a leaked URL alone is useless. Order of operations:

1. Rate limit by connection (`cache-store.increment`, per-minute window).
2. Load connection by id **without trusting the body**; reject if not `ACTIVE` or if its tenant
   is inactive.
3. Verify signature over `await request.text()` (raw bytes, before parsing).
4. Dedupe: insert `IntegrationWebhookEvent` with `@@unique([connectionId, externalEventId])`
   (falls back to a SHA-256 of the body when the provider sends no id). A duplicate returns
   `200` and does nothing — providers must never see an error for a replay.
5. Enqueue one `IntegrationJob` (`trigger: WEBHOOK`) and return `202`.
6. Record the event (status, received/processed timestamps, error) for the monitoring UI.

**Outbound.** `IntegrationOutboundWebhook` (endpoint URL, secret, subscribed events, active)
plus `IntegrationOutboundDelivery` (payload hash, status, attempts, response snippet). Signed
with the same HMAC scheme, retried with the same backoff as jobs, URL validated by the SSRF
guard (see `SECURITY_MODEL.md`). Outbound webhooks are Milestone 2; the tables land in 0015 so
the schema is stable.

## 10. Monitoring and health

Everything the brief asks for is derived, not separately maintained:

| UI need | Source |
|---|---|
| Successful / failed syncs | `IntegrationJob` by status, per connection |
| Pending jobs | `IntegrationJob` where `status IN (QUEUED, RUNNING)` |
| Last successful sync | `max(finishedAt)` where `status IN (SUCCEEDED, PARTIAL)` |
| Connection status | `IntegrationConnection.status` + health check result |
| Error messages | `errorMessage` (user-safe, written by the engine) — `errorDetail` is admin-only |
| Records processed / rejected | `recordsApplied` / `recordsRejected` |
| Retry | `POST /api/connect/jobs/[id]/retry` |

`health.ts` computes a three-state label: `HEALTHY` (last run succeeded and a scheduled run is
not overdue), `DEGRADED` (PARTIAL, or one failure with a retry pending), `ERROR` (3 consecutive
failures or `auth_expired`). The overview page shows the same computation the API returns, so
the two cannot disagree.

Error text policy: `errorMessage` is generated from a fixed vocabulary (`"Provider rejected the
credentials"`, `"Provider API returned 429 (rate limited)"`, `"3 of 250 records were rejected —
open the run for details"`). Raw provider responses go to `errorDetail`, truncated to 2 KB and
passed through a redactor that strips `authorization`, `token`, `secret`, `password` and
anything matching the connection's own credential values.

## 11. Reconciliation (Milestone 4)

`reconcile.ts` compares a cheap external fingerprint (count + max updated timestamp, or a
per-entity hash of ids) against the local `IntegrationExternalRecord` set, and reports three
buckets: missing locally, missing externally, divergent. It writes a `IntegrationReconciliation`
summary and never mutates data — resolution is a human action, matching the approvals model.

## 12. Permissions and audit

- Routes: `requireUserWithFeature("connect")`, then an explicit role check — read for
  `OWNER/ADMIN/MANAGER`, **write for `OWNER/ADMIN`** (credential changes, delete, outbound
  writes). Deliberately not `isAdminUser`, which is permissive on demo tenants.
- Audit: `AUDIT_ACTIONS.CONNECT = { CONNECTION_CREATED, CONNECTION_UPDATED, CREDENTIALS_SET,
  CREDENTIALS_CLEARED, CONNECTION_PAUSED, CONNECTION_RESUMED, CONNECTION_DISCONNECTED,
  CONNECTION_TESTED, SYNC_STARTED, SYNC_COMPLETED, SYNC_FAILED, JOB_RETRIED, WEBHOOK_REJECTED,
  MAPPING_UPDATED }` through the existing `writeAuditLog`, with `isImpersonating()` recorded in
  `details`.

## 13. Data model (migration `0015_connect_foundation`)

```prisma
model IntegrationConnection {
  id                  String   @id @default(cuid())
  tenantId            String
  providerId          String                       // validated against PROVIDERS
  name                String                       // user label, e.g. "Shopify (Nairobi)"
  status              String   @default("PENDING") // PENDING|ACTIVE|PAUSED|ERROR|DISCONNECTED
  credentialsEnc      String?                      // encryptJSON(...)
  credentialKeyVersion Int     @default(1)
  credentialsUpdatedAt DateTime?
  settings            Json?
  webhookSecretEnc    String?
  allowOutboundWrites Boolean  @default(false)
  lastTestedAt        DateTime?
  lastTestError       String?
  lastSuccessAt       DateTime?
  consecutiveFailures Int      @default(0)
  createdById         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  syncConfigs         IntegrationSyncConfig[]
  jobs                IntegrationJob[]
  externalRecords     IntegrationExternalRecord[]
  webhookEvents       IntegrationWebhookEvent[]
  @@unique([tenantId, providerId, name])
  @@index([tenantId, status])
  @@index([tenantId, lastSuccessAt])
}

model IntegrationSyncConfig {
  id             String  @id @default(cuid())
  tenantId       String
  connectionId   String
  entity         String
  direction      String  @default("INBOUND")
  sourceOfTruth  String  @default("EXTERNAL")
  frequency      String  @default("MANUAL")   // MANUAL|HOURLY|DAILY|WEEKLY
  conflictPolicy String  @default("KEEP_EXTERNAL")
  onError        String  @default("CONTINUE")
  fieldMapping   Json?
  cursor         String?
  enabled        Boolean @default(true)
  lastRunAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([connectionId, entity])
  @@index([tenantId, enabled])
}

model IntegrationJob {
  id              String   @id @default(cuid())
  tenantId        String
  connectionId    String
  syncConfigId    String?
  entity          String
  direction       String
  status          String   @default("QUEUED")
  trigger         String   @default("MANUAL")   // MANUAL|SCHEDULE|WEBHOOK|RETRY
  attempt         Int      @default(0)
  maxAttempts     Int      @default(5)
  runAfter        DateTime @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?
  recordsSeen     Int      @default(0)
  recordsApplied  Int      @default(0)
  recordsRejected Int      @default(0)
  cursorBefore    String?
  cursorAfter     String?
  errorCode       String?
  errorMessage    String?
  errorDetail     String?  // truncated + redacted; admin only
  requestedById   String?
  createdAt       DateTime @default(now())
  @@index([tenantId, createdAt])
  @@index([tenantId, status, runAfter])
  @@index([connectionId, createdAt])
}
```

Supporting tables, same tenant-scoped shape: `IntegrationJobRecord` (per-record outcome:
`jobId`, `externalId`, `localId`, `action` created/updated/rejected, `reason`),
`IntegrationExternalRecord`, `IntegrationWebhookEvent`, plus the outbound webhook pair from §9.
Every one carries `tenantId` even where it is reachable through `connectionId`, because the
isolation tests (`tests/ai/tenant-isolation.db.test.ts` is the model) assert it directly.

## 14. API surface (Milestone 1)

| Method + path | Guard | Purpose |
|---|---|---|
| `GET /api/connect/catalogue` | feature `connect` | providers with capabilities and status |
| `GET /api/connect/connections` | feature `connect` | list + health summary |
| `POST /api/connect/connections` | OWNER/ADMIN | create (PENDING) |
| `GET /api/connect/connections/[id]` | feature `connect` | detail incl. `hasCredentials`, `maskedHint` |
| `PATCH /api/connect/connections/[id]` | OWNER/ADMIN | rename, settings, credentials, pause/resume |
| `DELETE /api/connect/connections/[id]` | OWNER/ADMIN | disconnect + wipe credentials |
| `POST /api/connect/connections/[id]/test` | feature `connect` | `testConnection` |
| `POST /api/connect/connections/[id]/sync` | OWNER/ADMIN/MANAGER | enqueue (+ brief inline run) |
| `PUT /api/connect/connections/[id]/sync/[entity]` | OWNER/ADMIN | sync config + mapping |
| `GET /api/connect/jobs` | feature `connect` | history, filters, cursor pagination |
| `POST /api/connect/jobs/[id]/retry` | OWNER/ADMIN | manual retry |
| `POST /api/connect/webhooks/[connectionId]` | HMAC only | inbound events |
| `POST /api/connect/cron/tick` | `CRON_SECRET` | scheduled work |

## 15. UI surface

`connect/` under the tenant dashboard, one sidebar item (`app: "admin"`, feature `connect`,
roles OWNER/ADMIN/MANAGER):

- **Overview** — connected apps with health pills, last successful sync, pending/failed counts,
  *Add integration* button, recent activity list.
- **Catalogue** — category sections, capability chips, status badge; `planned` providers are
  shown greyed with "Coming soon" and no connect button.
- **Connection detail** — provider account, auth status, granted permissions (from
  `capabilities`), sync table (entity, direction, frequency, last run), mapping editor link,
  and Pause / Reconnect / Disconnect / Test actions.
- **History** — job table: status, time, direction, entity, processed/rejected, error, Retry.
- **Mapping** — external field ↔ local field rows, validation errors, conflict policy selector.

Components come from `src/components/ui` (Card, Button, Badge, Input, Modal, Toast); status
pills follow `assets/`; tables follow `approvals/`. No new design tokens.

## 16. AI integration (Milestone 6, read-only)

Connect data becomes a **read tool**, not a new agent: `src/lib/ai/tools/` gains
`listConnections` and `getExternalRecordSummary`, both tenant-scoped and both returning rows
with citations (`citations.ts`), so "cross-system" answers are grounded in stored job/record
data. No credential or raw provider response ever enters a model prompt; the AI sees counts,
entity names and timestamps. Writes (e.g. "push these prices to the shop") remain `actions.ts`
proposals answered through `AiApprovalRequest`.

## 17. Alternatives rejected

| Option | Why not |
|---|---|
| BullMQ + Redis now | New infrastructure and a new failure mode; the brief forbids adding infrastructure the app does not have, and integration jobs are low-volume |
| Separate integration microservice | Splits tenancy and auth away from `getCurrentUser()`, and needs its own deployment and secrets |
| A database table of providers | Provider behaviour is code; a table invites "provider row exists, connector missing" runtime errors |
| One generic REST connector in place of real adapters | Real providers need pagination, entity quirks and token refresh; the generic connector complements adapters, it does not replace them |
| Storing credentials in `TenantPaymentGateway` | Different lifecycle, revocation and permissions; one table would couple payment and integration outages |

## 18. Non-goals for Milestone 1

Bidirectional sync, conflict-resolution UI, OAuth providers, outbound webhooks, CSV export,
reconciliation summaries, AI read tools, per-entity approvals. Each has a milestone and a
schema home; none is faked in M1.
