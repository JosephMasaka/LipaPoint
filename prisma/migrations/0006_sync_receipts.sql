-- Exactly-once replay for Offline Mode (src/lib/idempotency.ts).
--
-- A queued offline write is retried until it succeeds. When a request landed
-- but its reply was lost, the retry must return the original response instead
-- of applying the change twice (a second sale, expense or stock movement).
-- The sync client sends a stable x-idempotency-key and the route stores its
-- successful response here.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "SyncReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "body" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyncReceipt_tenantId_key_key"
  ON "SyncReceipt" ("tenantId", "key");

CREATE INDEX IF NOT EXISTS "SyncReceipt_tenantId_createdAt_idx"
  ON "SyncReceipt" ("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SyncReceipt_tenantId_fkey'
  ) THEN
    ALTER TABLE "SyncReceipt"
      ADD CONSTRAINT "SyncReceipt_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
