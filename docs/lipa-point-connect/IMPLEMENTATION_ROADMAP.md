# LipaPoint Connect — Implementation Roadmap

Status: Phase 0 proposal. Sequencing follows the assignment, but each milestone's scope is set
by what the repository can support today (`REPOSITORY_AUDIT.md`) and by what can be shipped
without new infrastructure.

## 1. Sequencing principles

1. **Engine before providers.** M1 builds the seam and the monitoring around it with a mock and
   a file connector; real providers in M3 then only add an adapter, a registry entry and tests.
2. **Inbound before outbound.** Reading an external system cannot corrupt LipaPoint; writing to
   one can. Outbound writes arrive with approvals (M4/M5), never before.
3. **Every milestone is a vertical slice.** Migration + service + API + UI + tests + runbook in
   one release, no half-wired pages.
4. **No new infrastructure.** DB-backed jobs and the existing `CRON_SECRET` route pattern,
   until volume proves otherwise (then Redis is an additive change behind `cache-store`/`jobs`).
5. **Entitlement from day one.** A `connect` feature key plus connection limits, so the feature
   can be sold and turned off without code changes.

## 2. Milestone summary

| # | Milestone | Scope | Depends on | Est. |
|---|---|---|---|---|
| 1 | Integration foundation | Registry, connector interface, connections, encrypted credentials, health, job runner, sync history, monitoring UI, mock + CSV connector, tests | — | 3–4 weeks |
| 2 | Custom integrations | Generic REST connector with mapping UI, inbound + outbound webhooks, CSV/Excel export, scheduled sync, retries/backoff, idempotency hardening | 1 | 3 weeks |
| 3 | Real providers | Two connectors chosen by demand (candidates: Shopify products/orders, QuickBooks or Xero invoices, WooCommerce) | 1–2 | 2–3 weeks each |
| 4 | Advanced synchronisation | Field mapping interface, source-of-truth config, conflict resolution, reconciliation, manual review queue | 2 | 4 weeks |
| 5 | Automation | Controlled cross-system workflows with approvals and audit trails | 4 | 4 weeks |
| 6 | Connected intelligence | Read-only AI tools + cross-system reports grounded in stored data | 1–5 | 3 weeks |

## 3. Milestone 1 — integration foundation

Detailed in `MILESTONE_1_PLAN.md`. Exit: a tenant can connect a mock or CSV provider, see health,
run a sync, watch jobs and per-record outcomes, retry a failed job, and receive a
signature-verified webhook that enqueues work — all tenant-scoped, all audited, all tested.

## 4. Milestone 2 — custom integrations

- **Generic REST connector** (`connectors/http.ts`): tenant-supplied base URL (SSRF-guarded),
  auth by API key / bearer / basic, configurable list endpoint per entity, cursor pagination,
  JSON path extraction, and a mapping editor so the tenant names their fields.
- **Inbound webhooks** hardened beyond M1: subscription management UI, delivery log, replay of a
  stored event.
- **Outbound webhooks**: `IntegrationOutboundWebhook` + delivery table, HMAC signing, retries,
  and a "send test event" action — the first feature that pushes data out of LipaPoint.
- **CSV/Excel**: import via the existing `xlsx` dependency (must move from `devDependencies` to
  `dependencies`), export for products/customers/suppliers, dry-run preview showing the first
  rows and validation errors before anything is written.
- **Scheduling**: `frequency` honoured by the tick, next-run computation, catch-up policy
  (run once, not N times, after downtime).
- **Retry/idempotency**: per-record records, dedupe keys, `Retry-After` respect, dead-letter UI.

## 5. Milestone 3 — real provider connectors

Selection criteria, in order: existing customer demand (support tickets/named accounts), API
quality and documentation, auth model (API key or client-credentials before OAuth redirects),
and whether the provider is common in the Kenyan SMB market this product serves.

Recommended shortlist (all are catalogue entries with `status: "planned"` until built):

1. **Shopify** — products, inventory levels, orders inbound; needs an OAuth app and a public
   callback URL. Highest commercial pull for retail, so likely first.
2. **WooCommerce** — products/orders inbound with API key + secret over HTTPS, no OAuth app
   review; lower friction than Shopify and a good bridge while Shopify's app review runs.
3. **QuickBooks / Xero** — invoices and payments outbound, accounting-side consolidation; OAuth
   with refresh tokens, so it also exercises token rotation (a gap M1 must leave room for).
4. **Odoo / ERPNext** — self-hosted ERP; JSON-RPC/REST, no vendor approval, but a large entity
   surface — only on named demand.

Each connector ships with: adapter, registry entry (`status: "available"`), mapping defaults,
fixture-based unit tests, a recorded-HTTP integration test against a fake server, setup guide in
the catalogue, and an entry in the runbook.

## 6. Milestone 4 — advanced synchronisation

Field mapping UI (already modelled in M1 as a JSON document; M4 gives it an editor with
validation and preview), explicit source-of-truth per entity, conflict policies (`KEEP_LOCAL`,
`KEEP_EXTERNAL`, `NEWEST_WINS`, `REQUIRE_REVIEW`), a manual review queue for `REQUIRE_REVIEW`
conflicts, and reconciliation summaries (`reconcile.ts`) that compare external fingerprints
against `IntegrationExternalRecord` without mutating anything. Bidirectional sync becomes
available only for entities whose mapping is complete and whose provider advertises `pushRecord`.

## 7. Milestone 5 — automation

Cross-system workflows built on the existing approval machinery, not a new engine: a workflow
proposal is an `ActionProposal`-shaped record with a hashed payload, TTL and approver role
(see `src/lib/ai/approvals.ts` for the mechanics). Examples: "when a Shopify order is fulfilled,
raise a LipaPoint invoice and post it"; "when a supplier invoice is paid, push the payment to
the accounting system". Every step is permission-checked, audited, and idempotent; a rejected
approval writes nothing.

## 8. Milestone 6 — connected intelligence

Read-only tools in `src/lib/ai/tools/` (`listConnections`, `getExternalRecordSummary`,
`compareTotals`), cross-system report definitions in `src/lib/report-catalog.ts`, and answers
that cite stored rows. Explicitly out of scope: AI pushing data to any external system.

## 9. Cross-cutting work required by every milestone

| Item | Detail |
|---|---|
| Entitlement | `connect` in `FEATURE_KEYS`/`FEATURE_REGISTRY`; per-tier connection limits enforced server-side; catalogue shows the tier requirement |
| Env documentation | `ENCRYPTION_KEY` (missing today), `CONNECT_*`, `CRON_SECRET`, optional Upstash vars in `.env.example` and the runbook |
| Retention | purge `IntegrationJobRecord`/`IntegrationWebhookEvent` older than 90 days via the same tick |
| Runbook | a `docs/lipa-point-connect/RUNBOOK.md` covering deploy, scheduler setup, rollback (below), and what to do when a provider revokes credentials |
| Tests | unit tests per module, DB tests per isolation guarantee, one end-to-end mock-connector test per milestone |
| Pricing | a Connect add-on (or feature inclusion per tier) decided with sales before M1 ships; the code only needs the limits |

## 10. Rollout and rollback

- **Rollout:** migration `0015` is additive (new tables only). Ship with the `connect` feature
  key disabled for all tiers, enable for internal/demo tenants, then per tier.
- **Rollback (code):** revert the release; unused Connect tables are inert because nothing else
  references them. No existing table is altered by M1.
- **Rollback (data):** disable sync configs, pause connections, then either keep history or
  delete rows for the tenant (`Tenant` cascade cleans them up).
- **Emergency stop:** pause every connection for a tenant (`UPDATE … SET status = 'PAUSED'`),
  or set the feature flag off; both are documented in the runbook with exact statements.

## 11. Smallest practical first release (the recommendation)

M1 as scoped, but narrowed to **one** entity in the UI if time is tight: products inbound from
the mock connector and CSV, with the full job/monitoring surface behind it. That is enough to
demonstrate cross-system consolidation to a customer, exercises every layer of the engine, and
leaves customers and suppliers for the first M2 sprint.
