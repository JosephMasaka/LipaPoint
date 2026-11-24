-- Per-branch prices for individual selling units (crate, pack, etc.).
--
-- productUomId NULL means the product's base unit; a value targets one of its
-- ProductUoM rows. Postgres treats NULLs as distinct in a plain unique index,
-- so two partial indexes enforce one row per product/branch/unit while still
-- allowing a base row and several unit rows for the same branch.
--
-- Safe to re-run.

ALTER TABLE "ProductLocationPrice"
  ADD COLUMN IF NOT EXISTS "productUomId" TEXT;

DROP INDEX IF EXISTS "ProductLocationPrice_productId_locationId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductLocationPrice_base_key"
  ON "ProductLocationPrice" ("productId", "locationId")
  WHERE "productUomId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductLocationPrice_uom_key"
  ON "ProductLocationPrice" ("productId", "locationId", "productUomId")
  WHERE "productUomId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ProductLocationPrice_productId_locationId_idx"
  ON "ProductLocationPrice" ("productId", "locationId");

CREATE INDEX IF NOT EXISTS "ProductLocationPrice_productUomId_idx"
  ON "ProductLocationPrice" ("productUomId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLocationPrice_productUomId_fkey'
  ) THEN
    ALTER TABLE "ProductLocationPrice"
      ADD CONSTRAINT "ProductLocationPrice_productUomId_fkey"
      FOREIGN KEY ("productUomId") REFERENCES "ProductUoM"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
