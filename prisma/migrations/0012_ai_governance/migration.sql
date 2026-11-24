-- Milestone 3 foundation: tenant kill switch plus approvals bound to an
-- exact action payload. Additive and safe to re-run.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AiApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT,
    "agent" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiApprovalRequest_tenantId_fingerprint_key"
    ON "AiApprovalRequest"("tenantId", "fingerprint");
CREATE INDEX IF NOT EXISTS "AiApprovalRequest_tenantId_status_createdAt_idx"
    ON "AiApprovalRequest"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AiApprovalRequest_tenantId_consumedAt_idx"
    ON "AiApprovalRequest"("tenantId", "consumedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiApprovalRequest_tenantId_fkey'
    ) THEN
        ALTER TABLE "AiApprovalRequest"
            ADD CONSTRAINT "AiApprovalRequest_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiApprovalRequest_requestedById_fkey'
    ) THEN
        ALTER TABLE "AiApprovalRequest"
            ADD CONSTRAINT "AiApprovalRequest_requestedById_fkey"
            FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiApprovalRequest_decidedById_fkey'
    ) THEN
        ALTER TABLE "AiApprovalRequest"
            ADD CONSTRAINT "AiApprovalRequest_decidedById_fkey"
            FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
