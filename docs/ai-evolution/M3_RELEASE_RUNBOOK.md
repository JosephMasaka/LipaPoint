# M3 release runbook — staging, infrastructure, live verification

**Scope:** M3 (governed agents, approvals, agent runs, kill switch, shared cache).
**Audience:** whoever operates the deployment.
**Companions:** `M3_GOVERNANCE.md` (policy), `2027_ROADMAP.md` §7 (status).

Everything below that needs a credential is marked **BLOCKED** with exactly what
to obtain. Nothing in this repository was deployed or provisioned by the agent
that wrote this runbook; it records what was verified locally and what remains.

---

## 0. What was verified without credentials

| Check | Command | Result |
|---|---|---|
| TypeScript compiles | `npx tsc --noEmit` | clean |
| Prisma schema valid | `npx prisma validate` | valid |
| Tests (unit + DB) | `RUN_DB_TESTS=1 npm test` | 78 passed, 0 failed, 0 skipped |
| Migrations recognised | `npx prisma migrate status` | 5 migrations found, schema up to date |
| Deploy from an empty database | `DATABASE_URL=<empty-db> npx prisma migrate deploy` | all 5 applied (verified on a local PostgreSQL 18 cluster) |
| Migration ↔ schema drift | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <url> --exit-code` | `No difference detected` |
| Migrations 0011–0014 applied on the dev database | same as above | applied, additive, idempotent (`IF NOT EXISTS`, guarded FKs) |
| Seed (assets, HR, payroll) | `npm run db:seed` | see §5 |

`RUN_DB_TESTS=1` writes isolated `it-*` tenants and deletes them in `after()`;
it is the only suite that touches the database.

---

## 1. Staging — Neon branch + `prisma migrate deploy`

### 1.1 Create the branch — BLOCKED (needs a Neon account/API key)

Dashboard: project → **Branches → New branch**, name `staging`, parent `main`.

CLI (install once: `npm i -g neonctl`):

```bash
neonctl auth
neonctl projects list
neonctl branches create --project-id <project-id> --name staging --parent main
neonctl connection-string staging --project-id <project-id>
```

A branch created **from `main`** is copy-on-write: it already contains the
schema and data, and is the safest first staging environment.

### 1.2 Migration baseline

`prisma/migrations` is now a self-contained history and needs no manual psql:
`0000_init` (generated from the schema as it stood before M3) creates every
table, and `0011`–`0014` add on top. The ten loose `.sql` files (`0001`–`0010`)
moved to `prisma/migrations-archive/` for reference and are no longer applied.

**A brand-new empty database works out of the box:**

```bash
DATABASE_URL="<empty-db-url>" npx prisma migrate deploy
DATABASE_URL="<empty-db-url>" npx prisma migrate status   # "Database schema is up to date!"
```

Verified on a throwaway local PostgreSQL 18 cluster: all five migrations
applied, and
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <url> --exit-code`
printed `No difference detected`, so the history reproduces the datamodel.

**A database that already has the tables** (the demo database, or a
copy-on-write branch) has no `0000_init` row yet. Mark the baseline applied
**once, before deploying**:

```bash
DATABASE_URL="<existing-db-url>" npx prisma migrate resolve --applied 0000_init
DATABASE_URL="<existing-db-url>" npx prisma migrate deploy
```

Skipping the resolve makes `migrate deploy` try to run `0000_init` and fail with
`type "SubscriptionTier" already exists`. Prisma records the attempt as failed
and blocks further deploys until you clear it:

```bash
npx prisma migrate resolve --rolled-back 0000_init
npx prisma migrate resolve --applied 0000_init
```

### 1.3 Staging environment variables

Set on the staging deployment (never commit them):

```
DATABASE_URL=<staging branch connection string, pooled, sslmode=require>
JWT_SECRET=<32+ random chars, different from production>
NEXT_PUBLIC_APP_URL=https://staging.lipapoint.co.ke
NODE_ENV=production
CRON_SECRET=<generated, see §2.3>
GEMINI_API_KEY=<staging key>        # or GROQ_API_KEY
UPSTASH_REDIS_REST_URL=<see §2.1>
UPSTASH_REDIS_REST_TOKEN=<see §2.1>
```

Keep AI quotas at their defaults on staging, not production's values, so quota
behaviour can be observed.

---

## 2. Infrastructure

### 2.1 Upstash — BLOCKED (needs an Upstash account)

1. Create a Redis database (free tier is enough for staging), pick the region
   nearest the app.
2. Copy the **REST URL** and **REST token** from the database's REST API section.
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Without both, `src/lib/cache-store.ts` silently uses in-process memory. That is
correct for exactly one instance and wrong for anything else.

Verify the backend is actually Redis:

```ts
// scripts/cache-backend.check.ts (temporary)
import { getCacheStore } from "../src/lib/cache-store";
const store = getCacheStore();
console.log("backend:", store.backend);
await store.set("staging:probe", { ok: true }, 30);
console.log("readback:", await store.get("staging:probe"));
await store.delete("staging:probe");
```

**Pass condition:** `backend: upstash` and a matching readback. Run it twice from
two different processes — the second read must still return the value, which is
the property a per-process Map cannot provide.

### 2.2 AI provider — BLOCKED (needs a Gemini or Groq key)

`GEMINI_API_KEY` or `GROQ_API_KEY`. Without one, `/api/ai/chat` returns
`AI_NOT_CONFIGURED` 503 before any quota logic runs — so quota behaviour cannot
be exercised until this is set.

### 2.3 `CRON_SECRET` and the scheduler — BLOCKED (hosting provider undecided)

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The sweep `GET /api/notifications/check` fails closed: 503 with no secret
configured, 401 with the wrong one. It accepts `x-cron-secret: <value>` or
`Authorization: Bearer <value>`.

Vercel (if that is the host) — `vercel.json`:

```json
{
  "crons": [{ "path": "/api/notifications/check", "schedule": "*/15 * * * *" }]
}
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once the env var
exists on the project. Any other host: schedule a request with the same header,
every 15 minutes.

**This repository has no hosting provider declared** (no `vercel.json`, no
`.github/workflows`), so no scheduler config was added. Tell the agent which host
runs production and it can add the file.

---

## 3. Live verification

Run on staging, in this order. Each step names its pass condition.

### 3.1 Shared caching

1. `GET /api/ai/insights?from=…&to=…` twice; the second response must be
   materially faster and must not add an `AiUsageRecord` row.
2. From a second app instance (or after a restart), read the same panel. With
   Upstash configured the cache is shared; with memory it is not. This is the
   only meaningful difference — check `backend` rather than trusting timing.
3. Change data (a sale or a product price), then reload the panel: it must
   reflect the change (invalidation is now awaited — see §4).

**Pass:** `backend === "upstash"`, a cross-instance hit, and a post-write refresh
that shows the new numbers.

### 3.2 Purchase-order creation through governance

1. In chat, ask "order 24 bottles of <product> from <supplier>" against the
   **inventory** or **assistant** agent.
2. **Pass:** the reply says it is waiting for approval; `GET /api/ai/approvals`
   shows a `PENDING` request; no `PurchaseOrder` row exists yet.
3. Approve as owner/admin, then `POST /api/ai/approvals/<id>/execute`.
4. **Pass:** exactly one PO exists, `AiAgentRun` moved
   `AWAITING_APPROVAL → COMPLETED`, and re-running execute returns 409
   `ALREADY_CONSUMED`.
5. Change the quantity in the database, then execute again → 409
   `PAYLOAD_MISMATCH`.
6. As a manager, try to execute → 403. Approve as a cashier → 403.

### 3.3 Quota 429 responses

1. Temporarily set `AI_AGENT_MONTHLY_LIMIT_INVENTORY=1` on staging.
2. Run two chat requests as the inventory agent.
3. **Pass:** second call returns **429** with `code: "AGENT_QUOTA_EXCEEDED"` and
   a `quota` object (`used`, `limit`, `resetsAt`); an `AiUsageRecord` row exists
   with `status = QUOTA_EXCEEDED`; no model call was made.
4. Repeat for the tenant-wide quota by setting `AI_MONTHLY_QUOTA_PROFESSIONAL=1`
   → 429 `QUOTA_EXCEEDED`.
5. Restore the env values. Confirm the Intelligence Centre still loads (the
   quota stop must not affect deterministic panels).

### 3.4 Kill switch

1. Settings → General → Intelligence off, then chat → 503 `AI_DISABLED`.
2. `AI_DISABLED=true` on one instance → same, and `AI_AGENTS_DISABLED=inventory`
   → inventory rejected with 400 `UNKNOWN_AGENT`.
3. **Pass:** Intelligence Centre, reports and recommendations still render in
   every case.

---

## 4. Regression gate before production

```bash
npx tsc --noEmit
RUN_DB_TESTS=1 npm test          # expect 78 passed, 0 failed
npm run build
DATABASE_URL="<production>" npx prisma migrate status
```

Then, in this order: backup/branch production → `prisma migrate deploy` →
smoke test login, POS sale, one approval, one report → watch error logs for 15
minutes.

**Rollback:** the M3 migrations are additive only (new columns with defaults, new
tables, guarded FKs, no data rewritten), so a code rollback is safe without a
schema rollback. Dropping the new tables is a last resort and loses the audit
trail — do not do it to "clean up".

---

## 5. Seed notes

`npm run db:seed` **truncates every public table** and rebuilds the demo
dataset. It now also seeds, for Club Chairman:

- 6 employees (permanent, contract and casual) with KRA/NSSF/SHA numbers,
- 3 leave requests (approved + pending), 1 active staff loan,
- 2 payroll runs: last month **approved** (payslips computed by the real
  statutory engine), current month **draft**,
- 7 assets (one disposed, one under maintenance) with monthly depreciation
  schedules and 3 maintenance records.

Runtime against the remote Neon database is long (tens of minutes) because it
issues thousands of individual inserts. Prefer a local database for iterating on
seed changes. Never point it at production.
