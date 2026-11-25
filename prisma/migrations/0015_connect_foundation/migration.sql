-- LipaPoint Connect — Milestone 1 foundation.
-- Additive only: six new tables, no existing table altered.
--
-- Rollback (run in this order; all six tables are Connect-owned):
--   DROP TABLE "IntegrationWebhookEvent";
--   DROP TABLE "IntegrationJobRecord";
--   DROP TABLE "IntegrationExternalRecord";
--   DROP TABLE "IntegrationSyncConfig";
--   DROP TABLE "IntegrationJob";
--   DROP TABLE "IntegrationConnection";

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "authType" TEXT NOT NULL DEFAULT 'NONE',
    "baseUrl" TEXT,
    "config" JSONB,
    "credentialsEnc" TEXT,
    "credentialKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "maskedHint" TEXT,
    "webhookSecretEnc" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdById" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationSyncConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'MANUAL',
    "mapping" JSONB,
    "conflictPolicy" TEXT NOT NULL DEFAULT 'KEEP_EXTERNAL',
    "onError" TEXT NOT NULL DEFAULT 'CONTINUE',
    "sourceFileName" TEXT,
    "sourceFormat" TEXT,
    "sourceContent" TEXT,
    "cursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSyncConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "syncConfigId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "entity" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationJobRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" TEXT,
    "localId" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationJobRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationExternalRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationExternalRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "jobId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_tenantId_providerId_name_key" ON "IntegrationConnection"("tenantId", "providerId", "name");
CREATE INDEX "IntegrationConnection_tenantId_status_idx" ON "IntegrationConnection"("tenantId", "status");
CREATE INDEX "IntegrationConnection_tenantId_providerId_idx" ON "IntegrationConnection"("tenantId", "providerId");

CREATE UNIQUE INDEX "IntegrationSyncConfig_connectionId_entity_key" ON "IntegrationSyncConfig"("connectionId", "entity");
CREATE INDEX "IntegrationSyncConfig_tenantId_idx" ON "IntegrationSyncConfig"("tenantId");
CREATE INDEX "IntegrationSyncConfig_enabled_nextRunAt_idx" ON "IntegrationSyncConfig"("enabled", "nextRunAt");

CREATE INDEX "IntegrationJob_tenantId_createdAt_idx" ON "IntegrationJob"("tenantId", "createdAt");
CREATE INDEX "IntegrationJob_connectionId_createdAt_idx" ON "IntegrationJob"("connectionId", "createdAt");
CREATE INDEX "IntegrationJob_status_runAfter_idx" ON "IntegrationJob"("status", "runAfter");

CREATE INDEX "IntegrationJobRecord_jobId_status_idx" ON "IntegrationJobRecord"("jobId", "status");
CREATE INDEX "IntegrationJobRecord_tenantId_createdAt_idx" ON "IntegrationJobRecord"("tenantId", "createdAt");

CREATE UNIQUE INDEX "IntegrationExternalRecord_connectionId_entity_externalId_key" ON "IntegrationExternalRecord"("connectionId", "entity", "externalId");
CREATE INDEX "IntegrationExternalRecord_tenantId_entity_idx" ON "IntegrationExternalRecord"("tenantId", "entity");

CREATE UNIQUE INDEX "IntegrationWebhookEvent_connectionId_externalEventId_key" ON "IntegrationWebhookEvent"("connectionId", "externalEventId");
CREATE INDEX "IntegrationWebhookEvent_tenantId_receivedAt_idx" ON "IntegrationWebhookEvent"("tenantId", "receivedAt");

ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncConfig" ADD CONSTRAINT "IntegrationSyncConfig_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationJobRecord" ADD CONSTRAINT "IntegrationJobRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationExternalRecord" ADD CONSTRAINT "IntegrationExternalRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Duplicate prevention is enforced in src/lib/connect/jobs.ts (findFirst on
-- QUEUED/RUNNING before insert). A partial unique index would express it in
-- the database, but Prisma cannot declare one in schema.prisma, so it would
-- show up as drift in the CI drift gate.
