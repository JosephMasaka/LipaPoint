---
description: Evolve the existing LipaPoint SaaS into an AI-native
  business operating platform by incrementally adding business
  intelligence, specialised AI agents, governed automation, and
  integrations while preserving existing functionality. Use when
  inspecting, planning, implementing, testing, or extending the
  LipaPoint codebase.
name: lipapoint-2027-evolution
---

# LipaPoint 2027 Evolution --- Engineering Skill

## Mission

Evolve the existing **LipaPoint** SaaS product
(https://lipapoint.tunzaassets.co.ke/) into an intelligent business
operating platform.

The product direction is:

**LipaPoint Core + LipaPoint Intelligence + LipaPoint Autopilot**

-   **Core:** Existing POS, sales, inventory, customers, suppliers,
    payments, finance, payroll, multi-location and industry workflows,
    to the extent they are actually present in the repository.
-   **Intelligence:** Tenant-aware business Q&A, analytics,
    explanations, forecasting, anomaly detection and recommendations.
-   **Autopilot:** Specialised AI agents and event-driven workflows that
    can prepare and, where explicitly permitted, execute business
    actions with appropriate approvals and audit trails.
-   **Connect:** Governed integrations and APIs that connect business
    systems.

This is an evolution of the existing product, not a greenfield rewrite
and not a separate product. Retain the LipaPoint brand unless the
product owner explicitly changes that decision.

## Operating principles --- non-negotiable

1.  **Inspect before changing.** Read the repository, package manifests,
    Prisma schema, migrations, API routes, authentication/session
    implementation, permissions, feature gating, existing AI
    implementation, tests and deployment configuration before proposing
    code changes.
2.  **Never assume.** Treat all historical product descriptions as
    hypotheses. Confirm every feature, provider, model, schema, route
    and integration in the current repository.
3.  **Preserve working behaviour.** Do not break POS checkout, stock
    movements, payment processing, tenant isolation, authentication,
    existing plans, reporting or existing integrations.
4.  **No unnecessary rewrite.** Extend existing patterns and
    abstractions. Do not migrate frameworks, replace Prisma, change
    hosting, or introduce microservices without a demonstrated need and
    explicit approval.
5.  **Incremental delivery.** Work in small, reviewable, testable
    stages. Do not implement every proposed pillar in one uncontrolled
    change.
6.  **Production quality.** Include validation, authorization, error
    handling, observability, tests, migration safety and documentation.
7.  **Cost-aware AI.** Track provider/model usage, token consumption,
    latency, failures and estimated cost. Avoid sending unnecessary data
    to models.
8.  **Human control.** AI recommendations are not business facts.
    High-impact actions must be reviewed and approved by an authorized
    human.
9.  **Tenant isolation is mandatory.** Every query, tool, job, memory
    record, event, approval and integration must be scoped to the
    authenticated tenant and authorized user.
10. **Explain changes.** At the end of each implementation stage, report
    files changed, migrations, tests, risks, configuration and manual
    verification steps.

## Product context and likely existing stack

Historical project context suggests LipaPoint has used:

-   Next.js 15 / TypeScript.
-   Prisma 6.
-   PostgreSQL / Neon.
-   Redis and BullMQ.
-   Existing session-based authentication and tenant context.
-   Existing Starter, Professional/Growth and Enterprise-style plan
    gating.
-   AI integrations involving Gemini and Groq.
-   Kenyan business workflows, including KES pricing and M-Pesa-related
    integrations.

**These are discovery clues, not permission to assume the current
state.** Confirm actual versions, naming, architecture and provider
integrations from the checked-out repository. Do not silently rename
existing plan identifiers or database models.

The developer works primarily in a Windows/XAMPP environment. Give
Windows-compatible commands where relevant, while keeping scripts
cross-platform where practical.

## Phase 0 --- Repository reconnaissance (mandatory)

Before writing or editing application code:

1.  Identify the repository root, active branch, working-tree status and
    package manager.
2.  Read `package.json`, lockfile, TypeScript configuration, Next.js
    configuration and environment-variable examples.
3.  Map the app structure, route handlers, server actions, API
    conventions and frontend component patterns.
4.  Inspect the complete Prisma schema and migration history. Identify
    tenant ownership fields and relations.
5.  Trace authentication from login/session creation to server-side
    request handling.
6.  Identify the authoritative tenant-resolution mechanism. Never accept
    a tenant ID supplied by an untrusted client as proof of access.
7.  Trace role/permission enforcement and plan/feature entitlement
    checks.
8.  Locate current AI chat, insights, prompt construction, provider
    clients, rate limits and error handling.
9.  Trace core workflows: checkout, sale creation, stock deduction,
    refunds/voids, payments, expenses, purchases, customer records and
    branch/location scope where present.
10. Inspect queue workers, scheduled jobs, webhooks, logging and
    deployment constraints.
11. Run existing tests and baseline checks if safe. Record pre-existing
    failures separately.
12. Identify sensitive data and existing retention policies.

Produce `docs/ai-evolution/REPOSITORY_AUDIT.md` containing:

-   Confirmed stack and versions.
-   Existing modules and routes.
-   Existing AI capabilities and gaps.
-   Authentication, tenant isolation and permissions design.
-   Relevant Prisma models and relations.
-   Existing event/queue patterns.
-   Existing feature gating and subscription plans.
-   Test/build status.
-   Risks, unknowns and recommended first milestone.

Do not make broad architectural changes during reconnaissance. If a
critical detail is unclear, ask the product owner rather than inventing
it.

## Target product architecture

Use a modular architecture consistent with the existing application. A
modular monolith is the default until real scaling requirements justify
extracting services.

### A. LipaPoint Core

Keep the existing business modules as the system of record. AI must use
validated application services and domain APIs, not bypass business
rules by writing directly to tables.

### B. LipaPoint Intelligence

Provide a tenant-aware intelligence layer that can:

-   Answer business questions using authorized, current data.
-   Explain trends and changes.
-   Summarise daily/weekly/monthly performance.
-   Identify unusual sales, expenses, stock movements and operational
    patterns.
-   Produce cash-flow and inventory forecasts where sufficient data
    exists.
-   Make recommendations with evidence, assumptions,
    confidence/uncertainty and a clear time range.

### C. LipaPoint Agents

Implement narrowly scoped specialist agents, initially:

-   **Inventory Agent:** stock risk, sales velocity, reorder
    recommendations, slow-moving stock and draft purchase orders.
-   **Finance Agent:** revenue/expense summaries, receivables, cash-flow
    analysis and reconciliation assistance.
-   **Sales Agent:** sales trends, customer segments, follow-up
    suggestions and campaign drafts.
-   **Customer Agent:** customer history summaries and approved
    follow-up preparation.
-   **Operations Agent:** exception monitoring, task preparation and
    operational summaries.

Do not create five independent autonomous systems immediately. Start
with a shared, controlled agent runtime and a small number of useful
read-only or draft-producing capabilities.

### D. LipaPoint Automation

Add event-triggered and scheduled workflows such as:

-   Low-stock event → analyse demand → prepare reorder recommendation.
-   Daily close → generate sales summary.
-   Overdue invoice → prepare a reminder for review.
-   Unusual expense → notify an authorized manager.
-   Sales threshold → create a review task.

Start with deterministic triggers and actions. Use AI only where
language understanding, summarisation or judgement adds measurable
value.

### E. LipaPoint Connect

Provide a controlled integration layer for existing and future
integrations such as M-Pesa/payment providers, WhatsApp Business, email,
ecommerce, delivery and accounting systems. Verify actual provider APIs,
credentials, webhook signatures, pricing and production status before
implementation.

### F. Marketplace (later)

Do not build a public agent marketplace in the initial milestones. First
establish stable internal tools, permission contracts, auditability,
metering and customer demand.

## Security and governance requirements

AI must never be treated as an administrator.

### Tenant and user context

-   Resolve tenant identity from the authenticated server-side session
    and established application context.
-   Enforce tenant scope in every database query and every domain
    service.
-   Apply the initiating user's permissions to agent actions.
-   Never trust tenant IDs, role names, branch IDs, user IDs or
    permission claims supplied only by the model or client.
-   Ensure background jobs carry a verified tenant and initiating actor
    context.
-   Prevent cross-tenant retrieval, caching, embeddings, conversation
    history and event delivery.
-   Include negative tests proving tenant A cannot read or mutate tenant
    B data.

### Tool design

Expose narrow, typed tools, for example:

-   `get_sales_summary(period, branch_scope)`
-   `get_inventory_risks(location_scope)`
-   `get_customer_summary(customer_id)`
-   `create_purchase_order_draft(items, supplier_id)`
-   `create_follow_up_draft(customer_id, message)`
-   `request_action_approval(action_id)`

The server must derive tenant and actor identity; the model must not
choose or override them.

Avoid generic tools such as arbitrary SQL execution, unrestricted HTTP
requests, shell commands, arbitrary code execution or unrestricted
database writes.

Every tool must have:

-   Input schema and validation.
-   Server-side authorization.
-   Tenant and resource scope checks.
-   Explicit read/write classification.
-   Rate and quantity limits where relevant.
-   Structured result and error format.
-   Audit event.
-   Tests for allowed and denied access.

### Action risk levels

Use a documented policy registry. Suggested initial classification:

-   **Read-only:** permitted when user access allows it.
-   **Draft:** may create a draft or recommendation, not execute it.
-   **Low-risk reversible action:** require explicit feature policy and
    user permission.
-   **High-impact action:** require an authorized human approval before
    execution.
-   **Prohibited by default:** delete financial history, alter
    permissions, bypass payment controls, export bulk sensitive data,
    execute financial transfers or make irreversible changes.

Approval must be enforced by backend code, not by a prompt instruction.
Verify approver identity, role, tenant, action payload, expiry and
one-time use. Bind approval to the exact action payload so it cannot be
changed after approval. Log approved, rejected, expired and cancelled
requests.

### Auditability

For every agent run and tool call, record as appropriate:

-   Tenant ID.
-   Initiating user ID.
-   Agent identifier and version.
-   Conversation/run/correlation ID.
-   Tool name and action category.
-   Resource type and resource identifier.
-   Authorization decision.
-   Approval ID and approver, if applicable.
-   Timestamp, status, duration and error category.
-   Provider/model and token/cost metadata where available.

Do not log secrets, access tokens, payment credentials, full card data
or unnecessary personal data. Do not rely on chat transcripts as the
audit trail. Provide a way to disable an agent or automation quickly.

These requirements follow least-privilege, scoped tool access, approval
and end-to-end audit principles. See the references at the end of this
skill.

## AI provider and orchestration design

1.  Inspect the existing provider abstraction before adding another one.
2.  Keep provider-specific code behind a small interface so models can
    be changed without rewriting domain logic.
3.  Support configured providers only; do not hardcode API keys or model
    names in source.
4.  Add request timeouts, retry limits, exponential backoff where
    appropriate, circuit breaking or graceful fallback, and clear
    user-facing errors.
5.  Validate structured model output against schemas before use.
6.  Treat model output, retrieved documents, customer messages and
    external content as untrusted input.
7.  Protect against prompt injection: retrieved content cannot grant
    permissions or redefine system policy.
8.  Keep deterministic business calculations in application code or SQL,
    not in model arithmetic.
9.  Cite the data period and sources used for material business claims.
    Clearly label estimates and forecasts.
10. Do not claim a forecast is certain. Show data coverage and
    uncertainty.
11. Minimise prompt context; retrieve only the fields required for the
    task.
12. Do not send passwords, API keys, payment secrets or unnecessary
    personally identifiable information to an LLM.
13. Add evaluation cases for correctness, grounding, tenant isolation,
    tool selection and refusal of unauthorized actions.

## Suggested implementation milestones

Milestones are ordered priorities, not permission to skip repository
discovery or release safeguards.

### Milestone 1 --- Intelligence foundation

Goal: Upgrade the existing AI assistant into a reliable, grounded
business intelligence assistant.

Deliver:

-   A dedicated Intelligence Centre or an extension of the existing AI
    area, following current navigation/UI conventions.
-   Tenant-aware read-only data tools for key business metrics that
    actually exist.
-   Date range and branch/location filters where supported.
-   Sales, margin/profit (only where cost data supports it), expenses,
    stock and customer summaries.
-   Daily/weekly/monthly summary generation.
-   Evidence-backed answers with date range and relevant metric
    definitions.
-   AI usage metering, rate limits and error visibility.
-   Tests for tenant isolation and numeric accuracy.

Do not invent missing metrics. If cost, tax, refund or stock valuation
data is incomplete, explain the limitation rather than returning a
fabricated profit figure.

### Milestone 2 --- Recommendations and forecasts

Deliver:

-   Inventory reorder recommendations using sales velocity, lead time
    and configured thresholds.
-   Cash-flow estimates using actual recorded inflows/outflows and
    clearly stated assumptions.
-   Anomaly flags based on deterministic thresholds or explainable
    statistical methods before adding complex models.
-   Recommendation history, status and feedback.
-   Confidence/uncertainty and supporting evidence.
-   User-configurable thresholds where appropriate.

Forecasts must be labelled estimates, not guarantees. Avoid making
financial, tax or compliance claims without validated rules and
appropriate review.

### Milestone 3 --- Governed specialist agents

Start with Inventory Agent and Finance Agent, then add others based on
measured demand.

Deliver:

-   Agent registry and versioned definitions.
-   Shared runtime and typed tool registry.
-   Run lifecycle: queued, running, awaiting approval, completed,
    failed, cancelled.
-   Run history and visible tool/action timeline.
-   Per-agent feature entitlements and usage limits.
-   Scoped permissions and human approval workflow.
-   Kill switch and retry-safe execution.
-   Tests for replay, duplicate events, expired approval and
    unauthorized action.

### Milestone 4 --- Automation engine

Deliver:

-   Event definitions and validated event publishing.
-   Trigger/condition/action workflow model.
-   Scheduled and event-driven jobs using existing queue infrastructure.
-   Idempotency keys and duplicate-delivery protection.
-   Retry, dead-letter and failure inspection.
-   Workflow pause/resume and per-tenant enablement.
-   Human approval nodes.
-   Execution history and audit records.

Do not introduce a new queue system if the existing BullMQ setup is
suitable.

### Milestone 5 --- Connect and ecosystem

Only after core product adoption:

-   Improve webhooks and integration configuration.
-   Add connector health and sync status.
-   Add scoped API credentials and revocation.
-   Add integration-specific permissions and audit trails.
-   Consider third-party agent extensions only after the internal tool
    contract is stable.

## Data model guidance

Do not blindly copy these names into Prisma. Inspect current models and
conventions first, then design the smallest compatible schema change.

Potential concepts:

-   `AiAgent`: tenant availability, type, status, version/configuration
    reference.
-   `AiAgentRun`: actor, tenant, status, timestamps, usage and
    correlation.
-   `AiToolInvocation`: run, tool, validated input summary, result
    status and duration.
-   `AiRecommendation`: tenant, type, evidence references, period,
    status, feedback.
-   `AiApprovalRequest`: exact action payload hash, requester, approver,
    status, expiry and decision.
-   `AutomationWorkflow`: tenant, trigger, validated definition, status
    and version.
-   `AutomationExecution`: workflow, event/idempotency key, status and
    execution trace.
-   `AiUsageRecord`: tenant, user, provider, model, token counts,
    estimated cost and timestamp.

Requirements:

-   Follow existing ID types, naming, timestamps and soft-delete
    conventions.
-   Add indexes for tenant-scoped lookups and operational queues.
-   Add appropriate uniqueness constraints, including idempotency
    constraints.
-   Avoid storing raw secrets or full prompts by default.
-   Keep migrations backward-compatible where practical.
-   Never run destructive production migrations without explicit
    approval and a recovery plan.
-   Include migration and rollback notes.

## UX and product design

Follow the existing LipaPoint design system. Inspect actual components,
typography, spacing, theme and navigation before making visual changes.

Design goals:

-   Premium, clear, responsive business software.
-   Consistent with the existing LipaPoint brand.
-   Useful on desktop, tablet and mobile.
-   Avoid adding a second dashboard that duplicates existing analytics.
-   Explain what an AI recommendation means and why it appeared.
-   Clearly distinguish AI-generated drafts, pending approvals and
    completed actions.
-   Show data freshness and relevant date ranges.
-   Provide loading, empty, error, permission-denied and
    degraded-provider states.
-   Make agent activity inspectable and understandable.
-   Do not use decorative AI status indicators that imply an agent is
    active when it is not.

Suggested navigation, subject to existing IA:

-   Overview
-   Sales / POS
-   Inventory
-   Customers
-   Finance
-   Intelligence
-   AI Agents
-   Automations
-   Integrations
-   Settings / AI usage

Only add navigation entries for features that are implemented and
enabled for that tenant.

## Subscription and usage model

Inspect the real plan identifiers and existing feature entitlement
implementation before changing pricing or access.

-   Preserve current plan behaviour.
-   Gate new capabilities through the existing entitlement system.
-   Prefer feature flags for staged rollout.
-   Meter model usage per tenant and, where useful, per user/agent.
-   Set configurable quotas, concurrency limits and maximum task sizes.
-   Prevent an AI feature from silently generating unbounded provider
    costs.
-   Make quota exhaustion and upgrade paths clear.
-   Do not change published prices without explicit product-owner
    approval.

## Engineering workflow for every task

For each requested task:

1.  State the goal and acceptance criteria.
2.  Inspect relevant existing code and identify the current source of
    truth.
3.  Describe the implementation plan and files likely to change.
4.  Identify data, security, compatibility and cost risks.
5.  Implement the smallest coherent change.
6.  Add or update unit, integration and end-to-end tests as appropriate.
7.  Run formatting, lint, type checking, tests and build using the
    repository's actual scripts.
8.  Inspect the diff for accidental changes, secrets, unrelated
    formatting or destructive behaviour.
9.  Update relevant documentation and environment-variable examples.
10. Report what changed, commands run, test results, migration steps and
    any remaining limitations.

Do not claim a test passed unless it was actually run and its result
observed. If a command cannot run, report why.

## Definition of done

A feature is not complete until:

-   It works with the existing authentication and tenant context.
-   Server-side authorization is enforced on every relevant request and
    tool.
-   Existing workflows remain functional.
-   Loading, empty, error and permission states are handled.
-   Input and output are validated.
-   Relevant tests pass, including tenant-boundary tests.
-   Logs and audit events are appropriate.
-   AI usage/cost is bounded and observable.
-   Migrations and rollback considerations are documented.
-   No secrets are committed.
-   The feature is disabled or safely degraded when its
    provider/integration is unavailable.
-   Documentation reflects actual implementation, not intended future
    behaviour.

## First task when this skill is loaded

Do not immediately start implementing all features.

First perform **Phase 0 --- Repository reconnaissance** and produce:

1.  `docs/ai-evolution/REPOSITORY_AUDIT.md`
2.  `docs/ai-evolution/2027_ROADMAP.md`
3.  `docs/ai-evolution/SECURITY_AND_TENANT_BOUNDARIES.md`
4.  A proposed Milestone 1 implementation plan with exact
    files/models/routes likely to change.
5.  A list of blockers and questions that require product-owner
    decisions.

Then stop and present the findings for review before making broad schema
or architecture changes. If the user explicitly authorizes
implementation in the same task, implement only the agreed first
milestone, not the entire roadmap.

## References

Use these as engineering guidance; verify current documentation and
adapt it to the repository:

-   Microsoft Learn --- Least privilege for AI agents:
    https://learn.microsoft.com/en-us/security/zero-trust/sfi/least-privilege-for-ai-agents
-   Microsoft Learn --- Enterprise readiness for AI agent identity:
    https://learn.microsoft.com/en-us/startups/build/identity-management/enterprise-readiness-ai-agent-identity
-   Microsoft Security Blog --- Least privilege for AI agents:
    https://www.microsoft.com/en-us/security/blog/2026/07/16/least-privilege-for-ai-agents-identity-access-and-tool-binding/

The application's existing code, tests, product-owner decisions and
verified provider documentation take precedence over generic examples in
this skill.
