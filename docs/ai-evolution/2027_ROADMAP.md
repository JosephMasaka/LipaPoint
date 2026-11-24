# LipaPoint 2027 — Roadmap and Proposed Architecture

**Date:** 16 November 2026
**Status:** M1 largely shipped, M2 partly shipped, M3–M5 still proposals (see §7).
**Basis:** `docs/ai-evolution/REPOSITORY_AUDIT.md` — every claim there is
verified against the current repository.

---

## 1. Product direction on the current codebase

**LipaPoint Core + Intelligence + Autopilot + Connect**, delivered as an
evolution of this monolith, not a rewrite.

```
┌──────────────────────────────────────────────────────────────────────┐
│ LIPAPOINT CORE (exists)                                              │
│ POS/checkout · orders · inventory · customers · finance · banking    │
│ procurement · payroll · assets · eTIMS · multi-location · reporting  │
│ — system of record, authoritative invariants, audit log              │
└───────────────────────────▲──────────────────────────────────────────┘
                            │ typed read tools (M1) + draft tools (M3)
┌───────────────────────────┴──────────────────────────────────────────┐
│ INTELLIGENCE (partly exists)                                         │
│ buildIntelligence() metrics · area cohorts · narrative · forecasts    │
│ recommendation lifecycle · metering · grounded Q&A                   │
└───────────────────────────▲──────────────────────────────────────────┘
                            │ agent runtime, approval gates, audit
┌───────────────────────────┴──────────────────────────────────────────┐
│ AUTOPILOT (new)                                                      │
│ agent registry · run lifecycle · deterministic triggers · approvals   │
│ kill switch · idempotent execution                                   │
└───────────────────────────▲──────────────────────────────────────────┘
                            │ governed connectors
┌───────────────────────────┴──────────────────────────────────────────┐
│ CONNECT (partly exists: Paystack, PalPluss, Daraja, eTIMS, SMTP)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Architectural stance**

- Stay a modular monolith. Services live in `src/lib/<domain>.ts`; routes are
  thin guards + validation + delegation.
- All AI data access goes through a **tool layer** that calls domain
  services/queries with an explicit `TenantContext` — never raw SQL, never
  arbitrary Prisma from a prompt.
- Deterministic numbers stay in TypeScript/SQL. Models interpret, explain and
  draft; they do not calculate or mutate.
- Entitlements extend the existing three systems (plan feature, module,
  sub-feature). No parallel entitlement engine.
- Every new capability ships behind a flag/entitlement and degrades safely when
  a provider is unavailable.

**New `src/lib` modules proposed (names, not yet created)**

```
src/lib/ai/
  context.ts        TenantContext + actor/permission resolution
  tools/            typed read tools (sales, inventory, customers, finance)
  usage.ts          quota check, usage recording, cost estimate
  runtime.ts        M1: guarded single-turn run; M3: agent run lifecycle
  providers/        existing gemini/groq, kept behind AiProvider
src/lib/automation/ M4: trigger/condition/action engine (no new queue yet)
```

---

## 2. Milestones, sequenced

Ordering is deliberate: no automation before approvals and audit exist; no
agents before tool contracts and metering exist.

### Milestone 1 — Intelligence foundation (next)

**Goal:** a reliable, grounded, metered business-intelligence assistant with a
real home in the product.

Scope (detail in `MILESTONE_1_PLAN.md`):

- Intelligence Centre page at `/[tenant]/intelligence` (promote `AIInsights`,
  add nav entry under the existing `insights` app section).
- Parameterised intelligence: `from`/`to`/`locationId` (and presets
  today/7d/30d/90d), defaulting to today's 30-day behaviour.
- Typed, read-only tools with schemas, authorization, tenant scope, structured
  results and audit:
  `get_sales_summary`, `get_product_performance`, `get_inventory_status`,
  `get_customer_insights`, `get_pricing_signals`. Expense and cash-position
  tools follow in M2 once those data sources are verified.
- Evidence-backed answers: date range, branch scope, metric definition and data
  coverage returned with the response and displayed in the UI.
- `AiUsageRecord` metering + per-tenant monthly token/request quota +
  per-user rate limit, enforced in `src/lib/ai/quota.ts` from the route
  handlers (not in `api-guards.ts`, which stays subscription-focused).
- Provider hardening: timeout, retry with backoff, model from config,
  structured-output validation, cost estimate.
- AI audit events and a tenant-visible "AI activity & usage" surface.
- Tenant-isolation and numeric-accuracy tests.
  *Covered by* `tests/ai/tenant-isolation.test.ts` (branch lookup is filtered by
  session tenant; a foreign branch id is a 404) and the numeric suites. It now
  also has a database-backed counterpart, `tests/ai/tenant-isolation.db.test.ts`,
  which seeds two tenants and proves one cannot read the other's snapshot. It is
  opt-in (`RUN_DB_TESTS=1 npm test`) because it writes and then removes its rows.

**Exit criteria:** a tenant can ask "how did sales do last week at Branch A and
why?" and get an answer that (a) is computed from their data only, (b) quotes
the exact period and branch, (c) refuses when data is missing, (d) is metered
and audited, and (e) has a test proving tenant B cannot influence or read it.

### Milestone 2 — Recommendations and forecasts

**Status: started.** Shipped so far — persisted `AiRecommendation` (tenant,
fingerprint, period/branch scope, JSON evidence, confidence, status), restock
generation that reuses the existing `restock` computation rather than forking
it, `GET/POST/PATCH /api/ai/recommendations`, accept/dismiss UI in the
Intelligence Centre, and unit tests for fingerprints and evidence. Also
shipped: a 28-day cash-flow projection with labelled assumptions and coverage
warnings (`/api/ai/forecast`, assumption on trailing 28-day sales/expense
averages plus committed supplier invoices), and deterministic anomaly flags
for expense spikes (Z-score vs trailing distribution) and sales drops (recent
day vs same-weekday baseline). Unit tests cover the date/forecast arithmetic.
Forecast accuracy tracking has since shipped too: `backtestWeeks()` in
`src/lib/ai/forecast-math.ts` replays the projection over completed weeks and
`/api/ai/forecast` now returns `{ forecast, accuracy, scope }`, rendered as a
forecast-vs-actual table with signed and mean error in `forecast-panel.tsx`.
The restock target is now per tenant (`Tenant.restockTargetDays`, 1–120,
editable in Settings → General → Intelligence) instead of a fixed 14 days.
Still missing for M2 exit: recommendation types beyond restock and feedback
capture in the UI beyond accept/dismiss.
the UI beyond accept/dismiss.

- Persisted `AiRecommendation` with type, period, branch scope, evidence
  references, confidence, status (`new`/`accepted`/`dismissed`/`done`) and
  feedback.
- Reorder recommendations using velocity + lead time + configurable target
  cover (extend the existing `restock` logic; do not fork it).
- Cash-flow projection from recorded inflows/outflows with labelled
  assumptions and coverage warnings.
- Anomaly flags with deterministic, explainable thresholds first
  (e.g. expense Z-score vs trailing 12 weeks, sales drop vs weekday baseline).
- Recommendation history UI; no automatic execution.

**Dependency:** M1 metering and tool layer. **Exit:** every recommendation can be
traced to the rows and formula that produced it.

### Milestone 3 — Governed specialist agents

Start with **Inventory Agent** and **Finance Agent** only. Shared runtime, not
five autonomous systems.

- `AiAgent` registry (tenant availability, type, version, config, status).
- `AiAgentRun` lifecycle: `queued → running → awaiting_approval → completed |
  failed | cancelled`, retry-safe, with a per-tenant kill switch.
- `AiToolInvocation` timeline with inputs summary, result status, duration,
  authorization decision.
- `AiApprovalRequest` bound to a payload hash, requester, approver role, expiry,
  one-time use. Enforced in backend code, logged on approve/reject/expire.
- Draft-only tools first: `create_purchase_order_draft`,
  `create_follow_up_draft`; no execution.
- Per-agent entitlement and usage limits on the existing feature system.
- Replay/duplicate-event/expired-approval/unauthorized-action tests.

**Blocker:** enforceable staff permissions (finding S-4 in the security doc).
An agent must inherit a *real* permission set, not a role label.

### Milestone 4 — Automation engine

- `AutomationWorkflow` (trigger, validated condition/action definition,
  version, status, per-tenant enablement) + `AutomationExecution`
  (idempotency key, trace, status).
- Deterministic triggers first: low stock, daily close, overdue supplier
  invoice, unusual expense, sales threshold. AI used only for summarisation or
  language where it adds value.
- Execution path: **request-scoped or cron-triggered batch**, using
  `SyncReceipt`-style idempotency. No BullMQ/Redis unless the deployment model
  requires a real worker — that decision is a product-owner choice, not an
  assumption.
- Pause/resume, failure inspection, dead-letter equivalent in the DB,
  human-approval nodes reusing M3.
- Audit for every execution; automation cannot exceed the enabling user's
  permissions.

**Dependency:** M3 approvals + audit. **Exit:** a disabled workflow cannot fire,
and a duplicate event cannot double-execute.

### Milestone 5 — Connect and ecosystem

- Webhook signature verification and event idempotency for existing providers
  (Daraja, PalPluss, Paystack, eTIMS) — audit first, then harden.
- Connector health/sync status, scoped API credentials with revocation,
  integration-level permissions and audit.
- WhatsApp Business / e-commerce / accounting connectors only after the internal
  tool contract is stable and verified against provider docs.
- No public agent marketplace in this horizon.

---

## 3. Sequencing and dependencies

```
M1 Intelligence ──► M2 Recommendations ──► M3 Agents ──► M4 Automation ──► M5 Connect
        │                  │                   │
        ├─ metering        ├─ evidence refs    ├─ permissions resolver
        ├─ tool layer      ├─ status/feedback  ├─ approvals + audit
        └─ audit           └─ config thresholds└─ kill switch
```

Cross-cutting work that must land inside M1, not later:

- Permission resolver (can be role→permission mapping to start).
- Structured logging with tenant/actor correlation for AI paths.
- Migration discipline for new tables (versioned, additive, documented).
- A test harness (currently absent) — see blockers.

---

## 4. What we explicitly will not do

- Rewrite the app, replace Prisma, migrate frameworks or extract microservices.
- Rename plan identifiers or change published prices.
- Let models execute financial or destructive actions directly.
- Send full tenant datasets to a model by default.
- Build five independent autonomous agents or a marketplace in early milestones.
- Add a second AI provider abstraction, a second auth system or a parallel
  entitlement system.
- Run destructive production migrations.

---

## 5. Success measures (proposed, to be confirmed)

| Milestone | Measure |
|---|---|
| M1 | % of AI answers with a valid period+scope citation (target 100%); p95 latency; provider failure rate; tokens & KES cost per tenant per week; zero cross-tenant test failures |
| M2 | Recommendation acceptance rate; % of recommendations with complete evidence; forecast error vs realised cash flow |
| M3 | Agent runs completing without human correction; approval cycle time; zero unauthorised executions |
| M4 | Automation fire success rate; duplicate-execution count (target 0); MTTR on failed runs |
| M5 | Connector uptime; webhook signature rejection rate; credential rotation coverage |

---

## 6. Decisions required before coding beyond M1

1. Deployment topology (single VM vs serverless) → determines whether quotas and
   caches need a shared store.
2. AI commercial model: included in PROFESSIONAL/ENTERPRISE, or a paid add-on
   with quotas?
3. Staff permissions: enforce `RolePermission` server-side (recommended) or
   define a narrower agent permission model?
4. Conversation retention window and DPA/consent wording for AI processing and
   area benchmarks.
5. Monthly AI budget ceiling per tenant, and behaviour at the ceiling
   (hard stop vs degrade to rule-based only).
6. Test framework approval (see M1 plan §9).


---

## 7. Status check — 18 November 2026

Verified against the running code, not against intent.

| Area | State |
|---|---|
| M1 | Delivered: Intelligence Centre, 5 read-only tools, scope guards, metering, quota, burst limit, usage panel. |
| M2 | Restock recommendations with a per-tenant target cover, cash-flow projection, anomalies and forecast accuracy delivered. Further recommendation types and feedback capture outstanding. |
| M3 | Started (foundation). Kill switch is live: global `AI_DISABLED` and per-tenant `Tenant.aiEnabled`, enforced in `/api/ai/chat` and the insights brief, with a Settings toggle. `AiApprovalRequest` exists with payload-hash binding, role-gated decisions, expiry and one-time consumption (`src/lib/ai/approvals.ts`, `GET/POST /api/ai/approvals`, decision route). The governed action loop is wired too: `create_purchase_order` and `update_product_price` are exposed to the chat model as propose-only tools (`src/lib/ai/actions.ts`) that queue an approval and never write; `POST /api/ai/approvals/[id]/execute` re-validates the payload, then consumes the approval and runs the action once, refusing stale payloads and malformed requests without spending the approval (the API also validates action payloads at creation, so a bad request never reaches an approver). The approvals inbox (`/[tenant]/approvals`, linked from the sidebar and from chat replies that queue something) lists, decides and runs them. On top of that foundation the agent runtime is now in place: a versioned registry (`src/lib/ai/agents.ts`) declares six agents (assistant, inventory, finance, sales, customer, operations), each with its own read/action tool grant, an enable/disable switch (`AI_AGENTS_DISABLED`) and a per-agent monthly run ceiling (`AI_AGENT_MONTHLY_LIMIT_*`, defaults 100/600 by tier). The chat route advertises only the resolved agent's tools and refuses fabricated out-of-grant tool calls, and every run is recorded in `AiAgentRun` with the lifecycle RUNNING → AWAITING_APPROVAL → COMPLETED/FAILED/CANCELLED; proposals link back to their run, so approving, rejecting or executing closes it. `GET /api/ai/agents` shows grants and usage, `GET /api/ai/runs` and `/api/ai/runs/[runId]` return run history and the tool/approval timeline, and the approvals page renders a “Recent agent runs” panel. Still outstanding: more agents and actions (only two write actions exist), and the scheduled/agent-initiated flows, which belong to M4. |
| M4 | Not started. No workflow or execution model. |
| M5 | Not started. Existing providers only; no connector health or scoped credentials. |

Open defects found during the audit:

- **Fixed:** the narrative cache key included `scope.to`, which defaulted to
  `new Date()` when the client sent no dates, so the default view missed the
  cache and called the model on every load (measured: 12–26 s and one metered
  request per load vs 3.4 s and zero after the fix). Scope defaults are now
  snapped to UTC day boundaries in `src/lib/ai/scope.ts`.
- **Fixed:** `invalidateIntelligence()` was only called from `/api/settings`,
  so a new sale could take up to 15 minutes to appear. It is now called from
  the sale, stock, product, expense and procurement write paths.
- **Fixed (configurable):** the intelligence and rate-limit caches lived in
  process memory, so on multiple instances a sale could leave one instance's
  panels stale and let the burst limit be exceeded per instance. Both now go
  through `src/lib/cache-store.ts`: a Redis REST backend (Upstash) when
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise the
  previous in-memory behaviour. Single-instance deployments need no change; the
  Redis path has unit coverage against a fake transport but has not been run
  against a live Upstash database yet.
