-- AI usage metering and tool-call audit (Milestone 1).
--
-- Append-only telemetry for the Intelligence Centre: one AiUsageRecord per
-- model run, correlated with its tool calls by runId. No prompt or reply text
-- is stored (see docs/ai-evolution/MILESTONE_1_PLAN.md §4).
--
-- Additive only — no existing table or column is altered. Safe to re-run.
--
-- Rollback:
--   DROP TABLE IF EXISTS "AiToolInvocation";
--   DROP TABLE IF EXISTS "AiUsageRecord";

CREATE TABLE IF NOT EXISTS "AiUsageRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "runId" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "errorCode" TEXT,
  "toolCallCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageRecord_runId_key"
  ON "AiUsageRecord" ("runId");

CREATE INDEX IF NOT EXISTS "AiUsageRecord_tenantId_createdAt_idx"
  ON "AiUsageRecord" ("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageRecord_tenantId_status_createdAt_idx"
  ON "AiUsageRecord" ("tenantId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiUsageRecord_tenantId_fkey'
  ) THEN
    ALTER TABLE "AiUsageRecord"
      ADD CONSTRAINT "AiUsageRecord_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiUsageRecord_userId_fkey'
  ) THEN
    ALTER TABLE "AiUsageRecord"
      ADD CONSTRAINT "AiUsageRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AiToolInvocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "argsJson" TEXT NOT NULL DEFAULT '{}',
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "errorCode" TEXT,
  "resultRows" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiToolInvocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiToolInvocation_tenantId_createdAt_idx"
  ON "AiToolInvocation" ("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiToolInvocation_runId_idx"
  ON "AiToolInvocation" ("runId");
