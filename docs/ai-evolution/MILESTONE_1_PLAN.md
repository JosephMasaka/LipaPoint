# Milestone 1 — Grounded Intelligence: Implementation Plan

Status: **Proposed — awaiting product-owner approval.** No application code has been changed.

Phase 0 deliverables: `REPOSITORY_AUDIT.md`, `2027_ROADMAP.md`, `SECURITY_AND_TENANT_BOUNDARIES.md`, this file.

---

## 1. Goal

Make every AI answer in LipaPoint:

1. **Grounded** — generated from typed tool results over that tenant's data, with citations to the tool + date range that produced each figure.
2. **Bounded** — a question can only read the caller's tenant; scope (tenant, location, date range) is resolved server-side, never taken from the client.
3. **Metered** — every model call is recorded with provider, tokens, estimated cost, latency, outcome and user, and enforced against a monthly quota.
4. **Debuggable** — failures are visible (structured logs + persisted invocation rows) instead of only `console.error`.

Explicitly **not** in M1: agents, write actions, scheduled/automated tasks, forecasting, conversation history UI, embeddings/RAG, new AI providers.

## 2. What is reused (no rebuild)

| Existing | Role in M1 |
| --- | --- |
| `src/lib/ai/intelligence.ts` | Stays the deterministic source of truth. Extended additively with `dateRange` + `locationId`; default call behaviour unchanged. |
| `src/lib/ai/intelligence-cache.ts` | Key extended to `tenantId:from:to:location`; TTL and force-cooldown kept. |
| `src/lib/ai/prompt.ts` / `business-context.ts` | Kept as the compact baseline context so simple questions need zero tool calls. |
| `src/lib/ai/orchestrator.ts` | Kept as the provider fallback chain (Gemini 2.5 Flash → Groq `llama-3.3-70b-versatile`). Gains timeout, retry, and a usage callback. |
| `src/lib/ai/gemini.ts`, `groq.ts` | Extended with provider-native tool/function declarations; same `AiProvider` interface. |
| `src/app/api/ai/chat/route.ts`, `insights/route.ts` | Upgraded in place (not replaced) to use guards, scope resolution, tools, metering. |
| `src/components/ai-assistant.tsx`, `ai-insights.tsx` | Promoted into the Intelligence Centre; citation and usage UI added. |
| `src/lib/audit.ts` (`ActivityLog`) | Used for user-visible AI events (`AI.QUERY`, `AI.QUOTA_EXCEEDED`); high-volume telemetry goes to the new tables instead. |
| `src/lib/features.ts` / `module-registry.ts` | Single entitlement entry point (`requireUserWithFeature`) so add-on and manual `TenantFeature` grants work (fixes S-3). |
| `src/lib/api-guards.ts`, `src/lib/auth.ts` | Reused unchanged for session + tenant resolution. |
| `src/lib/reports/queries/*` | Used by tools where an authoritative report already exists (sales summary, product performance) rather than writing new SQL. |

## 3. Architecture in one diagram

```
Client (Intelligence Centre)
  POST /api/ai/chat { message, from?, to?, locationId? }   // no raw context/system prompt
        │
        ├─ requireUserWithFeature("ai-assistant")      // plan + add-on + manual grant
        ├─ resolveAiScope(user)                        // tenantId from session; locationId validated against tenant
        ├─ quota.check(tenantId, month)                // DB-backed, authoritative
        ├─ burst rate limit (in-memory, per user)      // keep existing map, key by userId
        │
        ├─ buildBusinessContext(scope)                 // compact deterministic snapshot (baseline evidence)
        ├─ tool loop (max 2 rounds, max 5 calls):
        │     model requests tool → server validates args (zod) → tenant-scoped query → ToolResult
        ├─ generateAiReply(...)                        // provider fallback, 20s timeout, 1 retry
        ├─ usage.record(AiUsageRecord + AiToolInvocation rows)
        └─ response { reply, citations[], usage, scope }
```

Scope is always derived server-side. `locationId` is accepted from the client but validated with the same ownership pattern already used by `POST /api/orders` (`location.tenantId === user.tenantId`), and any tool receiving a scope object re-asserts `tenantId`.

## 4. Data model additions

Two new models. Both are append-only from the application; no existing table is altered in M1 (no backfill, no risky migration).

```prisma
model AiUsageRecord {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String?
  runId         String   @unique          // correlates chat reply + tool rows + logs
  surface       String                    // "chat" | "insights"
  provider      String                    // "gemini" | "groq"
  model         String?
  promptTokens  Int      @default(0)
  outputTokens  Int      @default(0)
  totalTokens   Int      @default(0)
  estimatedCostUsd Float @default(0)      // from static price table; labelled estimate
  latencyMs     Int      @default(0)
  status        String                    // "SUCCESS" | "ERROR" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "TIMEOUT"
  errorCode     String?
  toolCallCount Int      @default(0)
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([tenantId, status, createdAt])
}

model AiToolInvocation {
  id         String   @id @default(cuid())
  tenantId   String
  runId      String
  toolName   String
  argsJson   String                       // redacted, truncated to 2 KB
  ok         Boolean
  errorCode  String?
  resultRows Int      @default(0)
  latencyMs  Int      @default(0)
  createdAt  DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([runId])
}
```

Notes and deliberate omissions:

- `AiConversation` / `AiMessage` are **deferred to M2**; M1 is stateless single-turn. `runId` is a UUID generated per request, so audit correlation does not require conversation persistence.
- `AiUsageRecord.tenantId` has a real FK (unlike `Subscription.tenantId`, see audit finding).
- No raw prompt or reply text is stored in M1 (privacy/DPA). Error codes and metadata only. A `redactedPromptHash` field is intentionally *not* added; if support needs prompt text, that is an M2 decision with retention rules.
- Migration `prisma/migrations/0009_ai_usage_and_tool_invocations/migration.sql` is hand-written, idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), with a matching rollback comment block at the bottom (`DROP TABLE`). Compatible with the repo's existing `prisma db push` workflow and `prisma migrate deploy`.

## 5. Tools (M1 set — read-only, 5 tools)

Defined once in `src/lib/ai/tools/registry.ts` with zod schemas; each tool receives an already-resolved `AiScope` (`tenantId`, `from`, `to`, `locationId`, `currency`) and returns a `ToolResult` with `data`, `evidence` (source + range + row count) and `truncated`.

| Tool | Answers | Data source |
| --- | --- | --- |
| `get_sales_summary` | Revenue, transactions, AOV, comparison with previous equal period | `Order` (COMPLETED) / `reports/queries` sales summary |
| `get_product_performance` | Top/bottom products, units, margin, days of cover | `OrderItem`, `Product`, `Stock` |
| `get_inventory_status` | Low/out-of-stock, overstock, restock suggestions | `Stock`, `Product.lowStockAlert`, `intelligence` restock logic |
| `get_customer_insights` | New vs returning, churn risk, top customers (aggregate only) | `Customer`, `Order` |
| `get_pricing_signals` | Margin bands, candidate price tests, area benchmark when available | `Product`, `intelligence` pricing signals, `area-intelligence` |

Hard rules enforced in code, not prompt text:

- Every query includes `tenantId` from `scope`; a tool cannot be called without a scope object.
- Date range is clamped to max 366 days and cannot be in the future.
- Location is re-validated inside the tool layer.
- Row/size caps (e.g. 50 products, 20 customers) and `truncated: true` in the result.
- Any tool that would need a write action is out of scope; the registry has no mutating entry points, and the tool loop rejects unknown names.

## 6. Files to create / modify

New:

- `src/lib/ai/tools/registry.ts` — tool definitions + dispatch + arg validation.
- `src/lib/ai/tools/types.ts` — `AiScope`, `ToolResult`, `ToolEvidence`, `Citation`.
- `src/lib/ai/scope.ts` — `resolveAiScope(user, input)`; tenant/location/date validation + clamping.
- `src/lib/ai/quota.ts` — monthly quota config lookup, `checkQuota`, `recordUsage`, `getUsageSummary`; wraps inserts in try/catch so metering can never break a reply.
- `src/lib/ai/usage.ts` — provider price table + `estimateCost`, `startRun()`.
- `src/lib/ai/citations.ts` — build `Citation[]` from tool results and the baseline snapshot.
- `src/lib/validations/ai.ts` — zod schemas for chat body, insights query params, usage query.
- `src/app/api/ai/usage/route.ts` — `GET` month-to-date usage + quota + last 20 invocations (OWNER/ADMIN only).
- `src/app/(dashboard)/[tenant]/intelligence/page.tsx` — Intelligence Centre page (server component; entitlement + role gated).
- `src/components/intelligence/ai-usage-panel.tsx` — quota bar, cost estimate, recent failures (OWNER/ADMIN).
- `src/components/intelligence/citations.tsx` — "Based on" chips (tool name, range, rows).
- `tests/ai/scope.test.ts`, `tests/ai/tools.test.ts` (pure: validation, clamping, registry rejection), `tests/ai/quota.test.ts` (pure config/math).
- `tests/ai/tenant-isolation.test.ts` — DB-backed; **requires a disposable test database** (see blockers).

Modified:

- `prisma/schema.prisma` — add the two models + `Tenant`/`User` back-relations.
- `prisma/migrations/0009_ai_usage_and_tool_invocations/migration.sql` — new migration.
- `src/lib/ai/intelligence.ts` — signature `buildIntelligence(tenantId, opts?: { from?: Date; to?: Date; locationId?: string })`; defaults preserve today's 30-day behaviour. All queries gain `locationId` when present. `generatedAt` and range echoed in output.
- `src/lib/ai/intelligence-cache.ts` — composite cache key; `invalidateIntelligence(tenantId)` still clears every key for that tenant.
- `src/lib/ai/types.ts` — add optional `citations`, `scope`, `runId` to response types; new `AiToolCall` types.
- `src/lib/ai/gemini.ts`, `src/lib/ai/groq.ts` — tool declarations + parsing of function calls; map token usage into `AiGenerateResult` (already partially present).
- `src/lib/ai/orchestrator.ts` — `generateAiReply` gains an options object (`tools?`, `timeoutMs = 20000`, `retries = 1`, `onUsage?`); default call signature kept so `insights` route is unaffected.
- `src/app/api/ai/chat/route.ts` — replace `getCurrentUser` + `canAccessFeature` with `requireUserWithFeature`, remove client `context` from the system prompt, add scope/quota/tools/metering/citations, structured error codes.
- `src/app/api/ai/insights/route.ts` — `requireUserWithFeature`, accept `from`/`to`/`locationId`, composite narrative cache key, meter the call.
- `src/lib/ai/business-context.ts` — accept `AiScope` (optional param; existing call site updated).
- `src/app/(dashboard)/[tenant]/layout.tsx` (or nav config) — add Intelligence Centre nav entry, gated by `ai-assistant`, roles OWNER/ADMIN/MANAGER.
- `src/components/ai-assistant.tsx` — render citations, scope chips, quota-reached state, and a "data as of" line; drop free-text `context` from the request body.
- `src/components/ai-insights.tsx` — point refresh at the new range params with today/7d/30d/90d presets; surface provider/usage in a footnote.
- `package.json` — add `"test": "node --import tsx --test \"tests/**/*.test.ts\""` (no new dependency; `tsx` is already used by `db:seed`).
- `.env.example` — add `GEMINI_API_KEY`, `GROQ_API_KEY`, `AI_MONTHLY_QUOTA_PROFESSIONAL`, `AI_MONTHLY_QUOTA_ENTERPRISE`, `AI_REQUEST_TIMEOUT_MS` (placeholders only).

## 7. Route contract changes

`POST /api/ai/chat`

```jsonc
// request
{ "message": "string (1..2000)", "from": "ISO date?", "to": "ISO date?", "locationId": "string?" }
// response
{
  "reply": "string",
  "citations": [{ "tool": "get_sales_summary", "from": "2026-10-17", "to": "2026-11-16", "rows": 1 }],
  "scope": { "from": "...", "to": "...", "locationId": null, "currency": "KES" },
  "usage": { "tokensUsed": 1234, "provider": "gemini", "runId": "..." }
}
```

Status codes: `400` invalid body, `401` no session, `403` no entitlement, `404` location not in tenant, `429` burst limit or monthly quota (body distinguishes `RATE_LIMITED` vs `QUOTA_EXCEEDED`), `504` provider timeout, `500` provider failure. Every error body is `{ error, code, runId }`.

`GET /api/ai/insights?from&to&locationId` — same shape as today plus `scope` and `usage`.

`GET /api/ai/usage?month=YYYY-MM` — `{ month, requests, tokens, estimatedCostUsd, quota: { limit, used, remaining, resetsAt }, recent: [...] }`.

## 8. Security work bundled into M1

M1 carries the P0/P1 items that the intelligence surfaces depend on (full detail in `SECURITY_AND_TENANT_BOUNDARIES.md`):

- **S-1** unauthenticated notification sweep that emails every tenant (P0) → require a shared secret (`CRON_SECRET`) header; documented in `.env.example`.
- **S-2** client-supplied `context` appended to the system prompt (P1) → removed; only server-built evidence reaches the model.
- **S-3** AI gate bypasses `TenantFeature` (P1) → use `requireUserWithFeature("ai-assistant")`.
- **S-4** `RolePermission` never consulted (P1) → introduce `src/lib/permissions.ts` with `can(user, action, resource)` and use it for the chat route, usage route and `/api/users` read (scope-limited; full RBAC rollout is M2).
- **S-8** impersonation not audited (P2) → write `AUTH.IMPERSONATION_START`/`END` via `ActivityLog` (small, isolated change).
- **S-14** no AI audit or usage trail (P1) → the two new tables plus `ActivityLog` events for user-visible AI actions.
- **Tenant contract** — no new route may read `tenantId` from the body. Chat/insights/usage derive it from the session (see section 3.2 of the security doc).

Deferred (documented, not in M1): `Subscription.tenantId` FK, `Float` → `Decimal` money migration, middleware-level tenant enforcement (S-5), Redis-backed shared rate limiting (S-6), build type-checking (S-7), webhook hardening (S-9).

## 9. Implementation sequence

1. **Schema + metering plumbing** — models, migration, `usage.ts`, `quota.ts`, `validations/ai.ts`. No behaviour change; existing routes untouched. Verify `prisma generate` + `tsc --noEmit`.
2. **Scope + tools (pure)** — `scope.ts`, `tools/*`, `citations.ts` with unit tests. Still not wired.
3. **Engine extension** — optional range/location in `buildIntelligence`, composite cache key, `business-context` scope param. Verify existing dashboard output is byte-identical for default arguments (compare JSON before/after on one seeded tenant).
4. **Providers + orchestrator** — tool declarations, timeout/retry, usage callback. Feature-flag with `AI_TOOLS_ENABLED` (default off) so it can be disabled without a redeploy.
5. **Routes + UI** — chat, insights, usage, Intelligence Centre, nav, citations, quota states. Then wire metering on and enable the flag in staging.
6. **Hardening** — permissions helper, impersonation audit, cron secret, `.env.example`, structured logs.

Each step leaves `main` shippable; steps 1–3 are safe to deploy dark.

## 10. Test plan

Framework: Node's built-in test runner via `tsx` (already a dev dependency), invoked as `node --import tsx --test`. No Jest/Vitest added — this is the smallest change consistent with the repo, and it is a **new** convention, so it needs approval (see blockers).

| Test | Type | Asserts |
| --- | --- | --- |
| `scope.test.ts` | unit | Tenant always from session; `locationId` rejected when not owned; range clamped to 366 days; future dates rejected; defaults = last 30 days. |
| `tools.test.ts` | unit (mocked db) | Unknown tool rejected; every tool called without scope throws; args schema rejects extra fields; row caps set `truncated`. |
| `quota.test.ts` | unit | Limit lookup per tier; used/remaining math; month boundary in Africa/Nairobi; quota check is fail-open only on metering errors, never on limit checks. |
| `tenant-isolation.test.ts` | integration (DB) | Tenant A tool calls never return Tenant B rows for all 5 tools; usage rows are written with the caller's tenant. Requires `TEST_DATABASE_URL`. |
| `intelligence-parity.test.ts` | integration (DB) | Default-argument `buildIntelligence` output equals the pre-change baseline fixture. |
| Manual | smoke | Chat with each tool intent; quota exhaustion → 429 with `QUOTA_EXCEEDED`; provider outage (bad key) → 504/500 with `runId`, no 200 with fabricated data; insights page and usage panel render for OWNER, hidden for STAFF. |

Not doing in M1: E2E browser suite, load testing, LLM output-quality scoring (deferred to M2 with a golden-question set).

## 11. Rollout and rollback

Rollout: migration (additive) → deploy dark (flag off, metering on) → verify usage rows in staging → enable `AI_TOOLS_ENABLED` for internal tenant → enable for Professional/Enterprise.

Rollback: flip `AI_TOOLS_ENABLED` off (routes fall back to the current single-turn path). If needed, revert the two route files to the previous commit. The tables are additive and can remain in place; `0009` rollback drops them. No data is lost because no existing table or column is modified.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Tool loop latency/cost (up to 2 rounds) | 20s timeout, max 5 calls, 2 rounds, compact baseline context means most questions use 0–1 calls. |
| Gemini and Groq tool-call formats differ | Provider adapters normalise to one internal `ToolCall` shape; contract test per adapter. |
| Metering writes fail and block replies | `recordUsage` is fire-and-forget with its own try/catch; quota check reads are inside the request path but fail open on DB error and log loudly. |
| Narrative cache collisions after adding range | Composite key `tenantId:from:to:location:generatedAt`. |
| Quota numbers are a commercial decision | Env-configurable limits with safe defaults; no pricing change shipped in M1. |
| Real answer quality regressions | Keep the deterministic JSON in the prompt; citations make unsupported claims visible; golden-question review in M2. |

## 13. Definition of done

- `tsc --noEmit` clean, `npm run test` green (unit tests at minimum; integration green if a test DB is provided).
- Chat answers include citations matching the tool calls recorded for that `runId`.
- Cross-tenant negative tests pass for all 5 tools.
- Quota exhaustion returns `429 QUOTA_EXCEEDED` and writes a usage row with that status.
- `/api/ai/usage` shows month-to-date tokens and estimated cost; no prompt/reply text is persisted.
- Existing Insights dashboard and AI Assistant produce equivalent answers for default scope.
- `.env.example` documents every new variable; impersonation and cron-secret findings fixed.

## 14. Open decisions (blocking approval)

1. **Quota numbers** per tier (requests/month and token ceiling) — needed before `quota.ts` defaults are final.
2. **AI remains a Professional/Enterprise feature, or becomes a paid add-on?** Affects whether `TenantFeature` grants are the primary gate.
3. **Permission enforcement scope**: is the `permissions.ts` resolver acceptable as the M1 start of RBAC, with full `RolePermission` UI wiring in M2?
4. **Test database** for the isolation suite: disposable Neon branch, local Postgres, or unit-only for M1?
5. **Retention**: how long to keep `AiUsageRecord`/`AiToolInvocation` rows, and does the DPA require prompt/reply storage at all?
6. **Deployment target** (serverless vs long-running) — drives whether M1 keeps in-memory rate limiting or moves to Redis immediately.

---

## 15. Implementation notes (as built)

These differ from the plan above and supersede it where they conflict.

- **No new dependency.** The repo has no `zod`, so request and tool-argument validation uses small hand-written validators in `src/lib/ai/scope.ts` and `src/lib/ai/tools/registry.ts`.
- **Migration is a flat file**, matching the existing hand-written migrations: `prisma/migrations/0009_ai_usage_and_tool_invocations.sql` (not a folder). It has been applied to the development database with `npm run db:push`; the SQL file remains the record for environments that use migrations.
- **`ai-assistant` is not a `FeatureKey`.** It is only a plan-feature string in `src/lib/plans.ts`, so `requireUserWithFeature` cannot gate it. A separate `requireUserWithPlanFeature` guard in `src/lib/api-guards.ts` enforces the chosen plan-tier model. Add-on/manual grants remain impossible until AI is added to `FEATURE_REGISTRY`.
- **Tools are on by default** (`AI_TOOLS_ENABLED !== "false"`), with the flag as a kill switch.
- **The Insights page keeps its existing plan gate** and sends explicit `from`/`to` only for 7d/90d; explicit dates are snapped to UTC day boundaries so cache keys stay stable.
- **Provider tool calls are single-shot per round:** the model may request tools once, the server executes up to 5, then makes one final no-tools call. Gemini and Groq declarations are normalised from one internal JSON-schema shape.
- **Tests added:** `tests/ai/usage.test.ts` and `tests/ai/tools.test.ts` (10 assertions) via `npm test` (`node --import tsx --test`). The DB-backed tenant-isolation suite is not written yet — it needs `TEST_DATABASE_URL`.
- **Not done in this pass:** `RolePermission` table wiring (only the `src/lib/permissions.ts` resolver and its use by the usage route and `/api/users`), Redis rate limiting, `Decimal` money, webhook hardening.
