-- Milestone 2: persisted, evidence-backed recommendations.
-- Additive only. Rollback: DROP TABLE IF EXISTS "AiRecommendation";
CREATE TABLE IF NOT EXISTS "AiRecommendation" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "productId"    TEXT,
  "title"        TEXT NOT NULL,
  "summary"      TEXT NOT NULL,
  "urgency"      TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'new',
  "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "periodFrom"   TIMESTAMP(3) NOT NULL,
  "periodTo"     TIMESTAMP(3) NOT NULL,
  "locationId"   TEXT,
  "evidence"     JSONB NOT NULL,
  "fingerprint"  TEXT NOT NULL,
  "feedback"     TEXT,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiRecommendation_tenantId_fingerprint_key"
  ON "AiRecommendation"("tenantId", "fingerprint");
CREATE INDEX IF NOT EXISTS "AiRecommendation_tenantId_status_createdAt_idx"
  ON "AiRecommendation"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRecommendation_tenantId_productId_idx"
  ON "AiRecommendation"("tenantId", "productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AiRecommendation_tenantId_fkey'
  ) THEN
    ALTER TABLE "AiRecommendation"
      ADD CONSTRAINT "AiRecommendation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
