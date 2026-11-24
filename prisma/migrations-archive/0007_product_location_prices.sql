-- Per-branch selling prices (prisma model ProductLocationPrice).
--
-- One catalogue, many tills: a branch that needs its own price for an item
-- gets a row here instead of a duplicate product. No row means the product
-- sells at its base price. Read by /api/products (for the editor) and by
-- /api/orders through the resolved location.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "ProductLocationPrice" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductLocationPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductLocationPrice_productId_locationId_key"
  ON "ProductLocationPrice" ("productId", "locationId");

CREATE INDEX IF NOT EXISTS "ProductLocationPrice_locationId_idx"
  ON "ProductLocationPrice" ("locationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLocationPrice_productId_fkey'
  ) THEN
    ALTER TABLE "ProductLocationPrice"
      ADD CONSTRAINT "ProductLocationPrice_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLocationPrice_locationId_fkey'
  ) THEN
    ALTER TABLE "ProductLocationPrice"
      ADD CONSTRAINT "ProductLocationPrice_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
