# LipaPoint Connect — Runbook (Milestone 1)

What is deployed: the integration engine (`src/lib/connect`), the API surface under
`/api/connect`, and the tenant UI under `/[tenant]/connect`. Four connectors ship usable —
**Custom API** (read-only REST), **CSV/Excel file**, **eTIMS (KRA)** (a read-only mirror of the
tenant's own submitted invoices; no credentials, configured under Settings > eTIMS) — plus a
clearly-labelled **sandbox** provider for demos. Named providers that are not built are listed
in the catalogue as `planned` and cannot be connected; the registry test enforces that every
`available` provider has an implementation and no `planned` one does.

## 1. Pre-deploy checklist

| Item | Why |
|---|---|
| `ENCRYPTION_KEY` set (32-byte base64) | `src/lib/crypto.ts` throws without it; every stored credential depends on it |
| `CRON_SECRET` set | The scheduler tick returns 503 until it is |
| `npx prisma generate` run in the build | The six Connect models are new |
| `prisma migrate deploy` | Applies `0015_connect_foundation` (additive, no existing table touched) |
| `.env.example` reviewed | `CONNECT_LIMIT_*`, `CONNECT_CRON_BATCH`, `CONNECT_ALLOW_INSECURE_LOCAL` are documented there |

Optional: `UPSTASH_REDIS_REST_URL` / `_TOKEN` are **not** used by Connect in this milestone; webhook
rate limiting counts rows, so it is correct across instances without a shared cache.

## 2. Deploy

```bash
npx prisma migrate deploy      # 0015 only — additive
npx tsx prisma/backfill-modules.ts   # existing tenants: module + feature rows (Connect nav)
npm run build && npm start
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/api/health
```

Then enable in this order: internal/demo tenant → Professional → Starter (the `connect` module is
entitled on all three tiers; the per-tier connection limit is what differs).

## 3. Scheduler

Connect has no worker process. Point the existing external cron at the tick route, every minute:

```bash
curl -s -X POST https://<host>/api/connect/cron/tick \
  -H "x-cron-secret: $CRON_SECRET"
```

Each call: re-queues jobs whose process died (>15 min in RUNNING), purges history older than
`CONNECT_RETENTION_DAYS` (default 90) from `IntegrationJobRecord` and `IntegrationWebhookEvent`,
enqueues due hourly syncs, claims up to `CONNECT_CRON_BATCH` jobs (default 5, max 25) and runs
them. It logs one line:

```
[connect-cron] recovered=0 purgedRecords=0 purgedEvents=0 due=2 enqueued=2 ran=2
```

Alert if the response is non-200 for two consecutive minutes, or if `ran` stays 0 while
`due` is consistently non-zero (claims are failing).

## 4. Verify a deployment

1. Open `/[tenant]/connect/catalogue` — Custom API and CSV/Excel show **Available**, named
   providers show **Coming soon** and cannot be clicked.
2. Add the sandbox provider, test it, run a sync: the job ends `SUCCEEDED` with applied counts.
3. Re-run the same sync: counts stay the same and no duplicate products appear (idempotency).
4. Run the tick with a wrong secret: 401; without `CRON_SECRET` configured: 503.
5. Check `ActivityLog` for `CONNECT.*` rows.

## 5. Rollback

| Situation | Action |
|---|---|
| Bad release | Revert the deployment. Nothing else reads the Connect tables, so leaving them is safe |
| Need the tables gone | Run the `DROP TABLE` statements in the header comment of `0015_connect_foundation/migration.sql` (reverse order) |
| Stop one tenant immediately | Set its connections to `PAUSED`, or disconnect them (`DELETE /api/connect/connections/[id]`) which also wipes credentials |
| Stop everyone | Turn the `connect` module off for the affected tenants (`TenantModule`), or set every connection `PAUSED` |

## 6. Incidents

- **Provider revoked the credentials** — the next sync fails with `CONNECT_HTTP_401/403` and the
  connection flips to `ERROR`. Re-enter credentials in the connection screen (write-only); the old
  ciphertext is replaced, not appended.
- **Sync stuck in RUNNING** — the next tick re-queues it after 15 minutes. If it repeats, check the
  connector's timeout and the provider's response time.
- **`ENCRYPTION_KEY` lost** — stored credentials cannot be decrypted. Re-enter them on each
  connection; there is no recovery path, which is why the key belongs in the secrets manager.
- **Webhook flood** — 120 events/minute per connection is the cap; beyond that the route answers
  429. Duplicate deliveries are recorded once and answered 200.

## 7. Known limitations in this milestone

- Inbound only. Connect never writes to the external system.
- Two entities (products, customers). Orders/invoices arrive with the conflict-resolution work.
- Mapping is a JSON document edited in the connection screen; there is no point-and-click field
  mapper, no source-of-truth setting, no conflict policy beyond the stored `conflictPolicy`, no
  reconciliation report and no manual review queue. Those are M4 in `IMPLEMENTATION_ROADMAP.md`.
- Outbound webhooks are not built. Inbound only: the provider calls us, we never call it on an
  event.
- A connector receives both `connectionId` and `tenantId`. Anything reading LipaPoint's own
  tables must scope by `tenantId`; using the connection id matches nothing and produces a
  sync that "succeeds" with zero records. `tests/connect/context.test.ts` guards this.
- Custom API endpoints must be public HTTPS on the default port; private networks, IP literals and
  redirects are refused (SSRF guard).
- Excel import reads the first worksheet, up to 5,000 rows / 5 MB, and refuses ZIP64 workbooks.
- Duplicate-job prevention is an application check plus a unique constraint on natural keys, not a
  partial unique index (Prisma cannot declare one without creating migration drift).
