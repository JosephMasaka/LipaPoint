const fs = require("fs");
const p = "prisma/migrations/0001_full_schema.sql";
let t = fs.readFileSync(p, "utf8");

// Patch tables
const tables = [
  "PendingSignup",
  "Subscription",
  "Role",
  "RolePermission",
  "User",
  "Tenant",
  "UserTenantRole",
  "PasswordReset",
  "Session",
  "Category",
  "Product",
  "ProductUnit",
  "ProductPrice",
  "StockRecord",
  "GoodsReceivedNote",
  "GoodsReceivedNoteItem",
  "PurchaseOrder",
  "PurchaseOrderItem",
  "Supplier",
  "SupplierInvoice",
  "SupplierPayment",
  "Invoice",
  "InvoiceItem",
  "Payment",
  "DailySummary",
  "Table",
  "DeliveryZone",
  "Service",
  "Appointment",
  "QueueEntry",
  "StaffSchedule",
  "Expense",
  "Employee",
  "LeaveRequest",
  "EmployeeLoan",
  "PayrollRun",
  "Payslip",
  "StatutoryRateTable",
  "Asset",
  "AssetDepreciationEntry",
  "ChartOfAccount",
  "JournalEntry",
  "JournalEntryLine",
  "BankAccount",
  "BankTransaction",
  "CreditNote",
  "DebitNote",
  "EtimsInvoice",
  "Customer",
  "Discount",
  "SalesLocation",
  "ReportDefinition",
  "ReportRun",
  "TenantModule",
  "Reseller",
  "ResellerCustomer",
  "ResellerCommission",
  "ResellerPayment",
  "Coupon",
  "CouponUsage",
  "CouponRedemption",
  "Location",
  "Register",
  "UnitOfMeasure",
  "UnitConversion",
  "ProductUoM",
  "Stock",
  "StockMovement",
  "Order",
  "OrderItem",
  "TenantPaymentGateway",
  "Transaction",
  "ActivityLog",
  "JournalLine",
  "DemoRequest",
];
for (const name of tables) {
  const re = new RegExp('^CREATE TABLE "' + name + '" \\(', 'm');
  t = t.replace(re, 'CREATE TABLE IF NOT EXISTS "' + name + '" (');
}

// Patch indexes using the PG IF NOT EXISTS via exception idiom
t = t.replace(/^CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]*)\)/gm, function(m, unique, indexName, tableName, cols) {
  const thenClause = 'CREATE ' + (unique ? 'UNIQUE ' : '') + 'INDEX "' + indexName + '" ON "' + tableName + '"(' + cols + ');';
  return 'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname=' + indexName + ' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=' + 'public' + ') THEN ' + thenClause + ' END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;';
});

fs.writeFileSync(p, t);
console.log('patched. tables:', (t.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 'indexes:', (t.match(/DO \$\$/g) || []).length);
