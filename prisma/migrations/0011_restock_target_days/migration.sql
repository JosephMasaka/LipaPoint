-- Per-tenant restock target: days of cover a restock suggestion aims for.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "restockTargetDays" INTEGER NOT NULL DEFAULT 14;
