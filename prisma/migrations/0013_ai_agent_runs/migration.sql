-- Milestone 3: agent runs with a visible lifecycle, plus the link from an
-- approval back to the run that proposed it. Additive and safe to re-run.
-- No foreign key from AiApprovalRequest.runId on purpose: run rows are
-- telemetry and may be pruned without orphaning an approval decision.

ALTER TABLE "AiApprovalRequest" ADD COLUMN IF NOT EXISTS "runId" TEXT;
CREATE INDEX IF NOT EXISTS "AiApprovalRequest_tenantId_runId_idx"
    ON "AiApprovalRequest"("tenantId", "runId");

CREATE TABLE IF NOT EXISTS "AiAgentRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "runId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "agentVersion" INTEGER NOT NULL DEFAULT 1,
    "surface" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "errorCode" TEXT,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "approvalCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAgentRun_runId_key" ON "AiAgentRun"("runId");
CREATE INDEX IF NOT EXISTS "AiAgentRun_tenantId_createdAt_idx" ON "AiAgentRun"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAgentRun_tenantId_status_createdAt_idx" ON "AiAgentRun"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAgentRun_tenantId_agent_createdAt_idx" ON "AiAgentRun"("tenantId", "agent", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiAgentRun_tenantId_fkey'
    ) THEN
        ALTER TABLE "AiAgentRun"
            ADD CONSTRAINT "AiAgentRun_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiAgentRun_userId_fkey'
    ) THEN
        ALTER TABLE "AiAgentRun"
            ADD CONSTRAINT "AiAgentRun_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
