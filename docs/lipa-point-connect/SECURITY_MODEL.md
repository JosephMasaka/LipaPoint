# LipaPoint Connect — Security Model

Status: Phase 0 design. Controls marked **exists** are already in the repository (file cited);
controls marked **planned** are part of Milestone 1/2 and are not yet implemented.

## 1. Trust boundaries

```
browser ──session cookie──▶ Next.js route handler ──getCurrentUser()──▶ service ──▶ Prisma
                                                    │
external provider ◀──HTTPS outbound (SSRF-guarded)──┘
external provider ──HMAC-signed webhook──▶ /api/connect/webhooks/[connectionId]
scheduler ──CRON_SECRET header──▶ /api/connect/cron/tick
```

Three things are never trusted: the tenant id in a URL or body, the contents of a webhook
before its signature is verified, and any URL a tenant types in.

## 2. Tenant isolation

| Control | Where | State |
|---|---|---|
| Session-derived tenant | `getCurrentUser()` returns `user.tenantId`; no route reads a tenant id from input | exists |
| Guarded routes | `requireUserWithFeature("connect")` on every tenant route | exists (guard) / planned (key) |
| Scoped queries | Every repository call filters `tenantId`; `findUnique({ where: { id } })` on a Connect table is allowed only after a tenant check | planned |
| Cross-tenant object access | Looking up a job/connection by id must include `tenantId` in the `where`, so a guessed id returns 404, not another tenant's row | planned |
| Cascade delete | `onDelete: Cascade` from `Tenant`, matching existing models | planned |
| Isolation tests | A DB test creating two tenants, connecting both, and asserting every service call returns only the caller's rows — modelled on `tests/ai/tenant-isolation.db.test.ts` | planned |

Note the existing gap recorded in the audit: `src/middleware.ts` treats everything under
`/api` as public, so a route that forgets its guard is fully open. Connect routes are covered by
a route-inventory test that fails if a handler under `src/app/api/connect` does not call a guard
(exempting the two documented public endpoints: webhook and cron tick).

## 3. Authentication and authorisation

- Users: existing session (JWT + `Session` row), `httpOnly` cookie — **exists**.
- Machine callers: `CRON_SECRET` header on the tick route, same pattern as
  `api/notifications/check` — **exists as a pattern**, applied to Connect.
- External providers: HMAC signature per connection (§6).
- Roles: read `OWNER/ADMIN/MANAGER`, write `OWNER/ADMIN`. Deliberately **not** `isAdminUser()`,
  which returns true for demo tenants (`src/lib/permissions.ts`); credential changes and
  deletes must not be governed by the demo bypass.
- Impersonation: writes record `isImpersonating()` in the audit entry so a super-admin action
  is distinguishable from the customer's own — **exists** (`src/lib/auth.ts`), applied to
  Connect audit rows.

## 4. Credential storage and handling

- **At rest:** AES-256-GCM via `src/lib/crypto.ts` (`encryptJSON`), the same path used for
  `TenantPaymentGateway.credentialsEnc` — **exists**. Connect adds `credentialKeyVersion` so a
  future rotation can decrypt old rows with the old key and re-encrypt (`ENCRYPTION_KEY` today
  is single-valued; losing it destroys stored credentials — the runbook must say so).
- **In transit:** TLS only; secrets travel in a request body over HTTPS, never in a query
  string, never in a URL path.
- **In memory:** decrypted inside `ConnectorContext` for the duration of one call, then
  discarded. Not cached, not attached to the job row.
- **To the client:** never. The detail endpoint returns `hasCredentials` plus a non-secret
  `maskedHint`. There is no "reveal" endpoint; a forgotten key is replaced, not read back.
- **In logs:** the redactor strips `authorization`, `token`, `secret`, `password`, `apiKey` and
  any value equal to one of the connection's own credential values before writing
  `IntegrationJob.errorDetail`.
- **Deletion:** disconnect nulls `credentialsEnc` and `webhookSecretEnc` in the same
  transaction that marks the row `DISCONNECTED` — **planned**.
- **Never in AI:** no prompt, tool argument or model context includes credentials; the AI tools
  in Milestone 6 expose counts and timestamps only.

## 5. SSRF protection for tenant-supplied endpoints

Any connector configured with a URL (generic HTTP, outbound webhooks) must pass `ssrf.ts`
before each request, not only at save time (DNS rebinding is real):

1. Scheme must be `https`. `http` is refused except when `CONNECT_ALLOW_INSECURE_LOCAL=true`
   in development.
2. Host must not be an IP literal, and must resolve to a public unicast address. Resolve, then
   check every address returned: reject `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`
   (including `169.254.169.254`), `::1`, `fc00::/7`, `fe80::/10`, `::ffff:` mappings.
3. Host must not end in `.local`, `.internal`, `.localhost`, and must not be `localhost`.
4. Port restricted to 443 (and the provider's registered port for named providers).
5. Fetch with `redirect: "manual"` — a 3xx is an error, so a redirect cannot walk the request
   into a private network — plus `AbortSignal.timeout()` (10 s), a 5 MB response cap and
   `cache: "no-store"`, mirroring `src/lib/etims/provider.ts`.
6. Named providers use **hardcoded base URLs** from the registry; a tenant cannot override
   the host, only supply credentials. Only `http`/`file` connectors accept a tenant URL.

## 6. Inbound webhooks

- Per-connection endpoint (`/api/connect/webhooks/[connectionId]`) plus a per-connection HMAC
  secret, so the URL alone is not a credential.
- Signature over the **raw** body (`await request.text()` before `JSON.parse`), HMAC-SHA256,
  compared with `crypto.timingSafeEqual` on equal-length buffers. The existing files that
  compare with `!==` (`api/paystack/webhook`) predate this model and should be brought in line.
- Fail closed: if `webhookSecretEnc` is missing, respond `503` rather than accept the body —
  the pattern already used by `verifyCallbackSecret()` in `src/lib/etims/callback.ts`.
- Replay: `IntegrationWebhookEvent` unique on `(connectionId, externalEventId)`, falling back
  to a SHA-256 of the body. Duplicates return `200` with no side effect, so a provider retrying
  a delivery does not create a second job.
- Also bounded: 1 MB body cap, per-connection rate limit, and a check that the connection is
  `ACTIVE` and its tenant `isActive`.

## 7. Rate limiting, bounded retries, and blast radius

- Inbound webhook: per-connection limit (default 120/min) using
  `getCacheStore().increment()` — shared across instances when Upstash is configured, per-process
  otherwise (documented limitation in `src/lib/cache-store.ts`).
- Sync tick: per-tenant concurrency 1, global cap per tick, so one tenant's 50,000-row backfill
  cannot starve the shared scheduler.
- Retries: 5 attempts, exponential backoff with jitter, capped at 1 hour; `DEAD` afterwards.
  No infinite retry, and a retry never re-sends an operation whose previous outcome is unknown
  unless the connector declares it idempotent.
- Outbound write idempotency: every push carries `(connectionId, parallel)` in the provider's
  idempotency header when supported, and `IntegrationExternalRecord` is written in the same
  transaction as the local change, so a duplicate run updates instead of duplicating.
- Request validation: every body parsed with an explicit allowlist of fields and types — no
  `prisma.update({ data: body })` anywhere; unknown keys are rejected, not ignored.

## 8. Audit logging

All state changes write `ActivityLog` rows via `src/lib/audit.ts` with a `CONNECT.*` namespace:
connection created/updated/paused/resumed/disconnected, credentials set (rotation) and cleared
(on disconnect) — never the values, only the fact and the auth type — test performed,
sync completed/failed, job retried, webhook received/rejected, mapping updated. A sync's start
is the job row itself (`IntegrationJob.startedAt`, status `RUNNING`), not an audit entry, so a
job has one outcome row rather than a start/finish pair. Entries carry `tenantId`, `userId` (or
null for cron/webhook), and `details.impersonating`. Failed webhook authentication is logged
with the connection id and reason, never the body.

## 9. AI safety (Milestone 6)

- Read-only by construction: Connect exposes no write tool to the model.
- Grounding: figures come from stored rows (`IntegrationJob`, `IntegrationExternalRecord`),
  returned with citations through `src/lib/ai/citations.ts`; the model is never asked to
  compute totals from raw provider responses.
- Credential isolation: prompts contain no ciphertext, token or raw response body; the tool
  layer filters fields before returning.
- Consequential actions stay behind `AiApprovalRequest` (`src/lib/ai/approvals.ts`): hashed
  payload, TTL, approver role, single use.
- The per-tenant kill switch (`Tenant.aiEnabled`, `src/lib/ai/kill-switch.ts`) also disables
  Connect intelligence.

## 10. Operational requirements

| Requirement | Detail |
|---|---|
| Env vars | `ENCRYPTION_KEY` (32-byte base64, documented in `.env.example`), `CONNECT_CRON_BATCH` (default 5), `CONNECT_RETENTION_DAYS` (default 90), `CONNECT_ALLOW_INSECURE_LOCAL` (dev only, default false), plus `CRON_SECRET` and optional `UPSTASH_REDIS_REST_*` |
| Key rotation | Not implemented in M1; `credentialKeyVersion` reserves the column. Rotation = add key v2, re-encrypt on read, drop v1 |
| Backup | Connect tables live in the same database; no separate store to back up |
| Incident | Disconnect a connection (`credentialsEnc` nulled) is the immediate kill switch; pausing stops jobs but keeps credentials |
| Monitoring | `/api/health` stays green independently of Connect; the tick route returns processed counts for the scheduler's own alerting |

## 11. Residual risks (accepted, documented)

1. **Per-process rate limiting without Upstash** — a determined attacker across many instances
   gets N times the limit. Acceptable while the app runs a single instance; documented as a
   scaling prerequisite (matches the existing AI roadmap note).
2. **Provider credential scope is the customer's own** — a customer may connect a provider
   account that also holds data for other businesses; Connect cannot detect that. Setup
   instructions warn to use a dedicated integration user.
3. **Scheduler single point** — if the external cron stops, syncs stop; the health label shows
   `DEGRADED` (scheduled run overdue) rather than silently claiming success.
4. **No field-level encryption of payload snapshots** — `IntegrationJobRecord.reason` and
   `errorDetail` may contain customer business data in plaintext inside an encrypted-at-rest
   database; retention (default 90 days) bounds it.
5. **SSRF address check races DNS (TOCTOU)** — the guard resolves the host, then `fetch`
   resolves it again, so a host whose DNS flips between the two calls can still be reached.
   Bounded by HTTPS-only, default port, no redirects and a 10 s timeout; a socket pinned to the
   checked address would close it (see `src/lib/connect/ssrf.ts`).
6. **Webhook endpoint existence is enumerable** — an unauthenticated caller can tell a live
   connection (`409`) from an unknown id (`404`). Ids are cuids and no payload or tenant data
   is disclosed by the status alone.

## 12. Review log

**November 2026 — tenant isolation, credential handling, SSRF, webhook auth, audit coverage.**

Checked every `/api/connect` route: each reads `user.tenantId` from the session and passes it
into a tenant-scoped query, including the `[id]` routes, `jobs/[id]/retry` and the sync-config
`PUT`. No handler uses a path or body id as a tenant key. Public responses go through
`toPublicConnection`, which exposes `maskedHint` and `hasCredentials` only; `credentialsEnc`
and `webhookSecretEnc` never leave the server, and the webhook URL alone is useless without the
secret.

Fixed as a result:

- Credential rotation wrote no `CONNECT.CREDENTIALS_SET` row, despite §8 promising it — a token
  replacement was indistinguishable from a rename in `ActivityLog`. Rotation and disconnect
  (which wipes the ciphertext) now each write one, with no value in `details`.
- Connector reads were scoped by connection id rather than tenant id, so the eTIMS sync queried
the wrong business and reported success with zero records (fixed separately; guarded by
`tests/connect/context.test.ts`).

Open decisions for the product owner, not defects:

- `POST /connections/[id]/sync` requires read access (`requireConnectAccess()`), so a STAFF user
  can start a sync that writes products and customers. Every other mutating route requires
  OWNER/ADMIN. Tighten it to `{ write: true }` if staff should not trigger syncs.
- Plan downgrades do not stop Connect. A tenant whose tier limit becomes 0 keeps active
  connections, and the scheduler keeps running their jobs; today an operator must pause or
  disconnect them (RUNBOOK §5). Decide whether downgrade should auto-pause.
- The Connect UI renders create/disconnect controls for every role and relies on the API's 403,
  so a staff user sees buttons that cannot succeed.
