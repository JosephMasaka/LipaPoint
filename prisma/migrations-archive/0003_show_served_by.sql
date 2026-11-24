-- Receipt preference: print "Served by: <cashier>" on receipts.
-- Idempotent, matching the style of 0001_full_schema.sql / 0002.
-- Equivalent to `npx prisma db push` for this change.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "showServedBy" BOOLEAN NOT NULL DEFAULT true;
