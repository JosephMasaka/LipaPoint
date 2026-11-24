-- Offline Mode is free for every tenant on every plan (2026-11-04).
--
-- The entitlement engine no longer consults a row for a free feature
-- (src/lib/features.ts short-circuits it), but the Apps screen and support
-- tooling read TenantFeature rows, so normalise them: every tenant gets an
-- enabled, non-revocable ("core") offline-mode row, whatever its tier or
-- whether it ever bought the old KES 1,200/mo add-on.
--
-- Safe to re-run.

INSERT INTO "TenantFeature" (
  "id",
  "tenantId",
  "moduleKey",
  "featureKey",
  "enabled",
  "source",
  "planTier",
  "enabledAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || t."id"),
  t."id",
  'pos',
  'offline-mode',
  true,
  'core',
  t."tier"::text,
  NOW(),
  NOW(),
  NOW()
FROM "Tenant" t
ON CONFLICT ("tenantId", "featureKey") DO UPDATE
SET
  "enabled" = true,
  "source" = 'core',
  "enabledAt" = COALESCE("TenantFeature"."enabledAt", NOW()),
  "updatedAt" = NOW();

-- A free feature can never be paid for: drop any stale "ADDON" marker so
-- support reports don't list Offline Mode as a purchased add-on.
UPDATE "TenantFeature"
SET "planTier" = NULL, "updatedAt" = NOW()
WHERE "featureKey" = 'offline-mode' AND "planTier" = 'ADDON';
