CREATE TABLE "ReportDefinition" (
CREATE TABLE "ReportRun" (
CREATE INDEX "ReportDefinition_module_idx" ON "ReportDefinition"("module");
CREATE INDEX "ReportDefinition_category_idx" ON "ReportDefinition"("category");
CREATE INDEX "ReportRun_tenantId_definitionKey_idx" ON "ReportRun"("tenantId", "definitionKey");
CREATE INDEX "ReportRun_tenantId_startedAt_idx" ON "ReportRun"("tenantId", "startedAt");
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;