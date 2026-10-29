-- New business types for the pricing verticals that can now sign up
-- (Human Resource, Asset Management, Finance, Procurement & Wholesale,
-- Healthcare, Education, Logistics, Professional Services).
-- Idempotent (IF NOT EXISTS), matching the style of 0002/0003.
-- Equivalent to `npx prisma db push` for this change.

ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'HUMAN_RESOURCE';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'ASSET_MANAGEMENT';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'PROCUREMENT_WHOLESALE';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'HEALTHCARE';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'EDUCATION';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'LOGISTICS';
ALTER TYPE "TenantType" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_SERVICES';
