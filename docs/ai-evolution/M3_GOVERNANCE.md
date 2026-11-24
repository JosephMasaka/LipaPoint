# M3 AI governance — responsibilities, budgets, expiry and shutdown

**Applies to:** Milestone 3 governed agents (propose-only write tools, approvals,
agent runs, kill switch, shared cache).
**Status:** Policy for the shipped M3 code. Every rule below names the code that
enforces it; anything marked _policy_ is an operating convention the software
does not decide for you.

> The design rule for M3: **the model can propose, only a human can authorise,
> and the authorisation is bound to one exact payload.** Nothing in this document
> relies on the prompt behaving — all of it is enforced in backend code.

---

## 1. What is enforced today

| Control | Where |
|---|---|
| Global kill switch (`AI_DISABLED`) | `src/lib/ai/kill-switch.ts`, checked in `/api/ai/chat` and `/api/ai/insights` |
| Per-tenant kill switch (`Tenant.aiEnabled`) | Settings → General → Intelligence; checked by `assertAiEnabled()` |
| Per-agent disable (`AI_AGENTS_DISABLED=a,b`) | `src/lib/ai/agents.ts` (`isAgentEnabled`) |
| Agent tool grants | `src/lib/ai/agents.ts`; the chat route advertises only the agent's tools and rejects fabricated calls (`TOOL_NOT_PERMITTED`) |
| Propose-only write tools | `src/lib/ai/actions.ts` — `validate()` writes an approval, never business data |
| Payload binding | SHA-256 of canonical JSON, `payloadHash` on `AiApprovalRequest` |
| Role-gated decisions | `APPROVER_ROLES = OWNER, ADMIN, MANAGER` (`decideApproval`) |
| Execute requires owner/admin | `POST /api/ai/approvals/[id]/execute` |
| Single use | `consumeApproval()` sets `consumedAt`; a second call is `ALREADY_CONSUMED` |
| Expiry | `expiresAt` on every request, checked on decide and on consume |
| Tenant-wide monthly quota | `src/lib/ai/quota.ts` (300 Professional / 2,000 Enterprise) |
| Per-agent monthly run ceiling | `src/lib/ai/runs.ts` (100 Professional / 600 Enterprise) |
| Burst limit | 15 requests / 60 s per user, via the shared cache store |
| Audit trail | `AiAgentRun`, `AiUsageRecord`, `AiToolInvocation`, `AiApprovalRequest` |

No prompt text or model reply is stored in the run tables; they record identity,
status, counts, timing and error codes only.

---

## 2. Approval responsibilities

| Duty | Role | Rule |
|---|---|---|
| Ask for an action | Any user with the AI assistant on their plan | Proposing changes nothing; it queues a request |
| Decide (approve / reject) | OWNER, ADMIN, MANAGER | Enforced in `decideApproval`; anything else is `FORBIDDEN` |
| Execute an approved action | OWNER, ADMIN | Enforced in the execute route; managers approve but do not run |
| Run payroll / file statutory returns | Tenant owner | Outside AI; M3 cannot pay anyone |

**Separation of duties.** A manager may approve but not execute; execution is a
second, owner/admin step. An owner who both proposes and approves the same
request is permitted by the code — _policy:_ where staff are available, the
approver should not be the requester, and an owner should treat a request they
raised themselves as needing a second pair of eyes before executing.

**Decision notes.** Rejections should always carry a note (`decisionNote`, max
500 chars). Rejections cancel the run that proposed the action; approvals leave
the run waiting until execution closes it.

**What an approval does NOT mean.** Approving does not run anything and does not
reserve stock, money or prices. Between approval and execution the world can
move: a price change for `update_product_price` is refused (`PAYLOAD_MISMATCH`)
if the price moved after approval, and the request must be raised again.

---

## 3. AI budgets

Budgets are layered so one noisy surface cannot starve the rest.

| Budget | Default | Override | Behaviour at the ceiling |
|---|---|---|---|
| Requests per tenant per month | 300 (Professional), 2,000 (Enterprise) | `AI_MONTHLY_QUOTA_PROFESSIONAL`, `AI_MONTHLY_QUOTA_ENTERPRISE` | HTTP 429 `QUOTA_EXCEEDED` before the model is called |
| Runs per agent per month | 100 (Professional), 600 (Enterprise) | `AI_AGENT_MONTHLY_LIMIT_<AGENT>`, `AI_AGENT_MONTHLY_LIMIT_<TIER>` | HTTP 429 `AGENT_QUOTA_EXCEEDED`, with `quota.used/limit/resetsAt` in the body |
| Burst per user | 15 requests / 60 s | `RATE_LIMIT` constant | HTTP 429 `RATE_LIMITED` |
| Cost visibility | — | `AiUsageRecord.estimatedCostUsd` per call | Reported on the usage surface; no automatic spend cutoff |

**Precedence:** a per-agent key wins over a tier key, which wins over the
built-in default. A quota of `0` or garbage in an env var is ignored rather than
locking a tenant out (the parser requires a positive integer).

**Deciding a budget.** _Policy:_ set `AI_MONTHLY_QUOTA_*` from the monthly price
of the AI entitlement, not from projected usage. Track
`estimatedCostUsd` per tenant weekly; if a tenant's AI cost exceeds roughly 20%
of what they pay, reduce the tier quota rather than absorbing the loss.

**Behaviour at the ceiling is a hard stop, not a degrade.** The assistant
returns 429 and stops. Everything deterministic — Intelligence Centre,
recommendations, reports, forecasts — keeps working, because it is computed from
the database and never calls a provider. That is the intended boundary: an AI
budget problem must never take the business's panels down.

---

## 4. Expiry windows

| Window | Value | Notes |
|---|---|---|
| Approval request lifetime | 30 minutes (default) | `DEFAULT_APPROVAL_TTL_MINUTES` |
| Allowed range | 1 minute – 24 hours | Clamped in `createApprovalRequest` |
| Per-request override | `ttlMinutes` on `POST /api/ai/approvals` | Same clamp |
| Forced-refresh cooldown | 60 seconds | Intelligence rebuild per cache key |
| Intelligence cache TTL | 15 minutes | Shared store when Upstash is configured |
| Burst window | 60 seconds | Per user |
| Quota reset | Calendar month, UTC | `monthWindow()` |

**Expiry is enforced twice** — when a human decides and again when the action is
consumed — so a request approved at minute 29 cannot be executed at minute 45.
An expired request is marked `EXPIRED` and cannot be revived; a fresh request
with the same payload creates a new one because the old fingerprint is no longer
`PENDING`.

**Why 30 minutes.** Long enough for an owner to see the notification and check
the numbers, short enough that a stale price or cost cannot be executed against
a changed business. _Policy:_ do not raise the default above 24 hours, and never
reuse an approval across a different payload — the hash check refuses it anyway.

---

## 5. Alert thresholds

The software does not ship an alert channel beyond the notification sweep
(`GET /api/notifications/check`, protected by `CRON_SECRET`). These are the
recommended thresholds to wire to whatever alerting the deployment has; each is
observable from the tables listed.

| Signal | Source | Warn | Act |
|---|---|---|---|
| Tenant hitting monthly quota | `AiUsageRecord` count / limit | 80% | Contact the tenant; confirm the tier |
| Agent hitting its run ceiling | `AiAgentRun` count / `monthlyRunLimitFor` | 80% | Check for a loop or an over-eager workflow |
| Provider failures | `AiUsageRecord.status = ERROR` | >5% of calls in 1 h | Check provider status; consider `AI_AGENTS_DISABLED` |
| Timeouts | `errorCode = TIMEOUT` | >3% in 1 h | Raise `AI_REQUEST_TIMEOUT_MS` or shed load |
| Approval backlog | `AiApprovalRequest.status = PENDING` older than 15 min | any | Nudge the approver; expired requests are a governance smell |
| Expiry rate | `status = EXPIRED` vs decided | >20% | TTL too short for the tenant, or nobody is watching the inbox |
| Cache backend | `getCacheStore().backend` | `memory` in a multi-instance deployment | Configure Upstash (see §6) |
| Unauthorised attempts | `FORBIDDEN` / `NOT_FOUND` on approvals | any burst | Treat as an incident; check tenant boundaries |

**Zero-tolerance measure (M3 exit criterion):** unauthorised executions must be
0. Any execution that ran without a matching approved, unexpired, unconsumed
approval is a defect of the highest severity.

---

## 6. Emergency shutdown

Three switches, in increasing blast radius. All are backend flags — no deploy
needed for the first two if the platform allows env changes.

1. **Tenant-level (normal case).** Settings → General → Intelligence → off, or
   `UPDATE "Tenant" SET "aiEnabled" = false WHERE id = '<tenant>';`
   That tenant's model calls stop with 503 `AI_DISABLED`. Panels keep working.
2. **Per-agent.** `AI_AGENTS_DISABLED=finance,customer` disables those agents
   while leaving the rest. The chat route rejects an explicitly requested
   disabled agent (400 `UNKNOWN_AGENT`) instead of silently downgrading.
3. **Global.** `AI_DISABLED=true` — every tenant, every agent, every model call
   stops immediately. Use when a provider is misbehaving, a prompt-injection
   pattern is suspected, or spend is out of control.

**Shutdown runbook**

1. Decide the blast radius: one tenant, one agent, or everything.
2. Apply the matching switch; for env flags, redeploy or restart the affected
   instances **and verify** — check that `/api/ai/chat` returns 503
   `AI_DISABLED` for a tenant you know has AI on.
3. Confirm deterministic surfaces still serve: Intelligence Centre, reports and
   recommendations must be unaffected.
4. Record the incident: which switch, at what time, by whom, and what the
   symptom was. `AiUsageRecord` and `AiAgentRun` give the timeline.
5. Do **not** delete approvals or runs to "clean up" — they are the audit trail.
   Cancel pending ones by rejecting them (which also closes their runs).

**Recovery:** re-enable in the reverse order (global, then per-agent, then
tenant). Watch the failure rate for 15 minutes before considering the incident
closed. Any action that was pending across the shutdown is still valid only
until its `expiresAt` — do not extend it.

**What shutdown does not do.** It does not stop human-executed business actions,
scheduled accountant tasks, or any POS/finance/payroll function. It only stops
model calls and therefore the ability to *propose* new AI actions.

---

## 7. Shared state prerequisite

The burst limiter and the intelligence cache are only correct across multiple
instances when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
(`src/lib/cache-store.ts`). Without them both live in process memory: the limiter
can be bypassed per instance and one instance's panel can stay stale after
another writes.

**Rule:** a multi-instance deployment without Upstash is an incident waiting to
happen, not a configuration choice. Verify the backend (`backend === "upstash"`)
before scaling out, and treat a silent fallback to `memory` as an alert (§5).

---

## 8. Change control

- **New agent:** add a definition with a new `id`, grant the minimum tools, bump
  `version` if the grant changes, and record the decision here or in the roadmap.
- **New write action:** it must implement `validate()` (tenant-scoped, refuses
  impossible values) and an idempotent-safe `execute()`; it must be reachable
  only through `executeApprovedAction`.
- **Changing an agent's grant:** publish a new `version`. Old runs keep the
  version they ran under (`AiAgentRun.agentVersion`).
- **Changing statutory or financial outcomes:** never via AI. Finance and
  payroll calculations are deterministic code and are not an agent capability.
- **Review cadence:** monthly — quota consumption, expiry rate, failure rate,
  approval backlog, and whether any approval was executed by its requester.

---

## 9. Open items (not governed yet)

- No automatic spend ceiling; cost is reported, not capped.
- No outbound alert channel wired to §5 thresholds.
- Only two write actions exist (`create_purchase_order`, `update_product_price`);
  each new action needs its own impact review.
- Scheduled/agent-initiated runs (M4) are not implemented, so there is no
  autonomous path to shut down yet. When they land, §6 must be re-tested against
  a scheduler that is mid-flight.
