-- Per-tenant KRA eTIMS device configuration.
--
-- Settings > eTIMS rendered these fields but Tenant had no columns to hold
-- them, so saving silently discarded everything and the tab reloaded blank.
-- The two secrets (CSID, callback secret) are stored AES-256-GCM encrypted by
-- the application, never in plaintext.
ALTER TABLE "Tenant"
  ADD COLUMN "etimsProvider" TEXT,
  ADD COLUMN "etimsDeviceType" TEXT,
  ADD COLUMN "etimsSellerTin" TEXT,
  ADD COLUMN "etimsSellerBranch" TEXT,
  ADD COLUMN "etimsSellerName" TEXT,
  ADD COLUMN "etimsCsidEnc" TEXT,
  ADD COLUMN "etimsCallbackSecretEnc" TEXT;
