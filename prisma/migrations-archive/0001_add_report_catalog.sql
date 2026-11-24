-- 0001_add_report_catalog.sql
-- Shared report catalog + first tranche of finance/bank/audit report definitions.

CREATE TABLE "public"."ReportDefinition" (
  "id" text NOT NULL,
  "tenantId" text NOT NULL,
  "key" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "section" text NOT NULL,
  "isVisible" boolean NOT NULL DEFAULT true,
  "defaultParams" json,
  "isBuiltIn" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL,
  CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportDefinition_tenantId_key_key" ON "public"."ReportDefinition" USING btree ("tenantId", "key");

CREATE INDEX "ReportDefinition_tenantId_section_idx" ON "public"."ReportDefinition" USING btree ("tenantId", "section");

CREATE TABLE "public"."ReportRun" (
  "id" text NOT NULL,
  "tenantId" text NOT NULL,
  "reportId" text NOT NULL,
  "params" json NOT NULL,
  "generatedAt" timestamptz(3) NOT NULL DEFAULT now(),
  "runs" json NOT NULL DEFAULT '[]',
  "rows" bigint NOT NULL DEFAULT 0,
  "bytes" bigint NOT NULL DEFAULT 0,
  "format" text NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportRun_tenantId_reportId_idx" ON "public"."ReportRun" USING btree ("tenantId", "reportId");

CREATE INDEX "ReportRun_tenantId_generatedAt_idx" ON "public"."ReportRun" USING btree ("tenantId", "generatedAt");

COMMENT ON COLUMN "public"."ReportDefinition"."key" IS 'stable machine key for the report (e.g., profit_and_loss, balance_sheet). Used for permissions and caching.';

COMMENT ON COLUMN "public"."ReportDefinition"."category" IS 'one of finance | bank | maintenance | sales | stock | payroll | asset | etims. Used for routing and entitlement checks.';

COMMENT ON COLUMN "public"."ReportDefinition"."section" IS 'human label matching the gap-analysis section (e.g., Finance Reports, Cash / Bank / Cashier Reports, Maintenance Reports).';

COMMENT ON COLUMN "public"."ReportRun"."runs" IS 'JSON representation of report rows used for CSV/print rendering. Kept small on purpose.';

COMMENT ON COLUMN "public"."ReportRun"."bytes" IS 'approximate output size in bytes for the rendered file.';

ALTER TABLE "public"."ReportDefinition" ADD CONSTRAINT "ReportDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReportRun" ADD CONSTRAINT "ReportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReportRun" ADD CONSTRAINT "ReportRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
