-- On-the-go pricing (price override) tenant settings.
-- Idempotent: safe to run more than once, matching the IF NOT EXISTS style
-- of 0001_full_schema.sql. Equivalent to `npx prisma db push` for this change.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "priceOverrideEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "priceFloorMode" TEXT NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "priceFloorValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
