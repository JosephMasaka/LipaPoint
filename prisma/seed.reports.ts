import { PrismaClient } from "@prisma/client";


export const CATALOG = [
  // ── Finance (highest-value confirmed/partial gaps from gap analysis) ──
  {
    key: "profit-and-loss",
    name: "Profit and Loss Statement",
    module: "finance",
    category: "finance",
    description: "Revenue, cost of sales and expenses with net profit for a period.",
    parameters: JSON.stringify({ dateRange: true, branch: false, comparePrevious: true }),
    columns: JSON.stringify([
      { key: "period", label: "Period", kind: "text" },
      { key: "accountGroup", label: "Account Group", kind: "text" },
      { key: "netTotal", label: "Net Total", kind: "currency" },
      { key: "previousNetTotal", label: "Previous Period", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
    ]),
  },
  {
    key: "balance-sheet",
    name: "Balance Sheet",
    module: "finance",
    category: "finance",
    description: "Assets, liabilities and equity as at a reporting date.",
    parameters: JSON.stringify({ asAt: true, branch: false }),
    columns: JSON.stringify([
      { key: "section", label: "Section", kind: "text" },
      { key: "account", label: "Account", kind: "text" },
      { key: "balance", label: "Balance", kind: "currency" },
    ]),
  },
  {
    key: "trial-balance",
    name: "Trial Balance",
    module: "finance",
    category: "finance",
    description: "Client notes call this \"Prior Balance\". All account balances for a period.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "accountCode", label: "Account Code", kind: "text" },
      { key: "accountName", label: "Account Name", kind: "text" },
      { key: "debit", label: "Debit", kind: "currency" },
      { key: "credit", label: "Credit", kind: "currency" },
      { key: "netBalance", label: "Net Balance", kind: "currency" },
    ]),
  },
  {
    key: "gl-journal-register",
    name: "General Journal Register",
    module: "finance",
    category: "finance",
    description: "All journal entries with lines, in date order.",
    parameters: JSON.stringify({ dateRange: true, branch: false, journalType: true }),
    columns: JSON.stringify([
      { key: "entryDate", label: "Date", kind: "date" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "accountCode", label: "Account", kind: "text" },
      { key: "debit", label: "Debit", kind: "currency" },
      { key: "credit", label: "Credit", kind: "currency" },
    ]),
  },
  // ── Cash / Bank / Cashier (highest-value gaps) ──
  {
    key: "cash-bank-statement",
    name: "Cash / Bank Statement (Detailed)",
    module: "finance",
    category: "cash-bank",
    description: "Bank account and cash wallet transactions in date order.",
    parameters: JSON.stringify({ bankAccount: true, dateRange: true, reconciled: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "bankAccount", label: "Account", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "direction", label: "Direction", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "reconciled", label: "Reconciled", kind: "text" },
    ]),
  },
  {
    key: "cash-bank-summary",
    name: "Cash / Bank Summary",
    module: "finance",
    category: "cash-bank",
    description: "Opening balance, receipts, payments and closing balance per account.",
    parameters: JSON.stringify({ dateRange: true, bankAccount: false }),
    columns: JSON.stringify([
      { key: "bankAccount", label: "Account", kind: "text" },
      { key: "openingBalance", label: "Opening Balance", kind: "currency" },
      { key: "totalReceipts", label: "Total Receipts", kind: "currency" },
      { key: "totalPayments", label: "Total Payments", kind: "currency" },
      { key: "closingBalance", label: "Closing Balance", kind: "currency" },
    ]),
  },
  {
    key: "mpesa-card-pdq-report",
    name: "M-Pesa / Card / PDQ Report",
    module: "finance",
    category: "cash-bank",
    description: "Payments collected via M-Pesa, card/PDQ and related gateways.",
    parameters: JSON.stringify({ dateRange: true, paymentMethod: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "paymentMethod", label: "Payment Method", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },
  // ── Maintenance / Audit trail (gap analysis: writeAuditLog exists, no report) ──
  {
    key: "audit-trail",
    name: "Audit Trail Report",
    module: "platform",
    category: "maintenance",
    description: "Filterable audit log across tenants, users and actions.",
    parameters: JSON.stringify({ tenant: true, user: true, action: true, dateRange: true, entity: true }),
    columns: JSON.stringify([
      { key: "timestamp", label: "Timestamp", kind: "date" },
      { key: "tenant", label: "Tenant", kind: "text" },
      { key: "user", label: "User", kind: "text" },
      { key: "action", label: "Action", kind: "text" },
      { key: "entity", label: "Entity", kind: "text" },
      { key: "entityId", label: "Entity ID", kind: "text" },
      { key: "details", label: "Details", kind: "text" },
    ]),
  },

  // ── Payroll (already have payslip register + P9; add the summary + statutory gaps) ──
  {
    key: "payroll-run-summary",
    name: "Payroll Run Summary",
    module: "payroll",
    category: "payroll",
    description: "Each payroll run with active employee count, payslip count and totals.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "runId", label: "Run ID", kind: "text" },
      { key: "period", label: "Period", kind: "text" },
      { key: "employeeCount", label: "Employees", kind: "number" },
      { key: "payslipCount", label: "Payslips", kind: "number" },
      { key: "grossPay", label: "Gross Pay", kind: "currency" },
      { key: "totalDeductions", label: "Total Deductions", kind: "currency" },
      { key: "netPay", label: "Net Pay", kind: "currency" },
    ]),
  },
  {
    key: "statutory-deductions-summary",
    name: "Statutory Deductions Summary (PAYE / NSSF / SHIF / Housing Levy)",
    module: "payroll",
    category: "payroll",
    description: "PAYE, NSSF, SHIF and Housing Levy totals per run or period.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "period", label: "Period", kind: "text" },
      { key: "paye", label: "PAYE", kind: "currency" },
      { key: "nssf", label: "NSSF", kind: "currency" },
      { key: "shif", label: "SHIF", kind: "currency" },
      { key: "housingLevy", label: "Housing Levy", kind: "currency" },
      { key: "total", label: "Total Statutory", kind: "currency" },
    ]),
  },

  {
    key: "payslip-register",
    name: "Payslip Register",
    module: "payroll",
    category: "payroll",
    description: "List view of every payslip across employees for a period.",
    parameters: JSON.stringify({ dateRange: true, branch: false, employee: true }),
    columns: JSON.stringify([
      { key: "period", label: "Period", kind: "text" },
      { key: "staffNumber", label: "Staff No.", kind: "text" },
      { key: "employee", label: "Employee", kind: "text" },
      { key: "grossPay", label: "Gross Pay", kind: "currency" },
      { key: "totalDeductions", label: "Deductions", kind: "currency" },
      { key: "netPay", label: "Net Pay", kind: "currency" },
      { key: "status", label: "Run Status", kind: "text" },
    ]),
  },
  {
    key: "p9-annual-export",
    name: "P9 Annual Export",
    module: "payroll",
    category: "payroll",
    description: "Per-employee statutory P9 summary for KRA filing.",
    parameters: JSON.stringify({ year: true, employee: true }),
    columns: JSON.stringify([
      { key: "staffNumber", label: "Staff No.", kind: "text" },
      { key: "employee", label: "Employee", kind: "text" },
      { key: "kraPin", label: "KRA PIN", kind: "text" },
      { key: "monthsWorked", label: "Months", kind: "number" },
      { key: "annualTaxablePay", label: "Annual Taxable Pay", kind: "currency" },
      { key: "annualPaye", label: "PAYE Paid", kind: "currency" },
      { key: "personalRelief", label: "Personal Relief", kind: "currency" },
      { key: "annualNetPay", label: "Net Pay", kind: "currency" },
    ]),
  },

  // ── Assets (gap analysis: depreciation schedule not confirmed) ──
  {
    key: "asset-register",
    name: "Asset Register",
    module: "assets",
    category: "asset",
    description: "Full fixed asset register with cost, location, status and depreciation.",
    parameters: JSON.stringify({ branch: false, status: true, category: true }),
    columns: JSON.stringify([
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "cost", label: "Cost", kind: "currency" },
      { key: "accumulatedDepreciation", label: "Accum. Depr.", kind: "currency" },
      { key: "netBookValue", label: "Net Book Value", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },
  {
    key: "depreciation-schedule",
    name: "Depreciation Schedule",
    module: "assets",
    category: "asset",
    description: "Depreciation postings and projected monthly depreciation by asset.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "monthlyDepreciation", label: "Monthly Depr.", kind: "currency" },
      { key: "yearToDate", label: "YTD Depr.", kind: "currency" },
      { key: "remainingLifeMonths", label: "Remaining Months", kind: "number" },
    ]),
  },

  {
    key: "maintenance-cost-report",
    name: "Asset Maintenance Cost Report",
    module: "assets",
    category: "asset",
    description: "Maintenance spend per asset and in total.",
    parameters: JSON.stringify({ dateRange: true, branch: false, category: true }),
    columns: JSON.stringify([
      { key: "assetTag", label: "Asset Tag", kind: "text" },
      { key: "name", label: "Asset", kind: "text" },
      { key: "maintenanceCount", label: "Services", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "lastServiceDate", label: "Last Service", kind: "date" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },

  // ── eTIMS (gap analysis: submission log + VAT reconciliation partial) ──
  {
    key: "etims-submission-log",
    name: "eTIMS Submission Log / Status Report",
    module: "etims",
    category: "etims",
    description: "eTIMS invoice submission status, retries and failures.",
    parameters: JSON.stringify({ dateRange: true, status: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "submittedAt", label: "Submitted At", kind: "date" },
      { key: "status", label: "Status", kind: "text" },
      { key: "retryCount", label: "Retries", kind: "number" },
      { key: "lastError", label: "Last Error", kind: "text" },
    ]),
  },
  {
    key: "vat-output-reconciliation",
    name: "VAT Output Reconciliation Report",
    module: "etims",
    category: "etims",
    description: "VAT output reconciliation against eTIMS submissions.",
    parameters: JSON.stringify({ dateRange: true, taxPoint: true }),
    columns: JSON.stringify([
      { key: "period", label: "Period", kind: "text" },
      { key: "taxableSales", label: "Taxable Sales", kind: "currency" },
      { key: "vatOutput", label: "VAT Output", kind: "currency" },
      { key: "etimsSubmitted", label: "Submitted to eTIMS", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
    ]),
  },

  // ── Supplier (gap analysis: partials already exist as lists; add the report views) ──
  {
    key: "supplier-statement",
    name: "Supplier Statement",
    module: "procurement",
    category: "supplier",
    description: "Supplier balance, invoices and payments for a period.",
    parameters: JSON.stringify({ supplier: true, dateRange: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "details", label: "Details", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ]),
  },
  {
    key: "supplier-unpaid-invoices",
    name: "Supplier Unpaid Invoices",
    module: "procurement",
    category: "supplier",
    description: "Supplier invoices not yet paid, with aging.",
    parameters: JSON.stringify({ supplier: true, dateRange: true, aging: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "invoiceDate", label: "Invoice Date", kind: "date" },
      { key: "dueDate", label: "Due Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "daysOutstanding", label: "Days Outstanding", kind: "number" },
    ]),
  },
  {
    key: "supplier-invoice-received",
    name: "Supplier Invoice Received Report",
    module: "procurement",
    category: "supplier",
    description: "Invoices received against GRNs, with matching status.",
    parameters: JSON.stringify({ supplier: true, dateRange: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "grnReference", label: "GRN", kind: "text" },
      { key: "receivedDate", label: "Received Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },

  // ── Customer reports (gap analysis: none confirmed) ──
  {
    key: "customer-statement",
    name: "Customer Statement (Detailed & Summary)",
    module: "crm",
    category: "customer",
    description: "Customer ledger with opening balance, invoices, payments and closing balance.",
    parameters: JSON.stringify({ customer: true, dateRange: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ]),
  },
  {
    key: "customer-balance",
    name: "Customer Balance (Detailed & Summary)",
    module: "crm",
    category: "customer",
    description: "Outstanding customer balances with aging.",
    parameters: JSON.stringify({ customer: false, dateRange: false, aging: true }),
    columns: JSON.stringify([
      { key: "customer", label: "Customer", kind: "text" },
      { key: "openingBalance", label: "Opening Balance", kind: "currency" },
      { key: "totalInvoices", label: "Invoices", kind: "currency" },
      { key: "totalPayments", label: "Payments", kind: "currency" },
      { key: "closingBalance", label: "Closing Balance", kind: "currency" },
      { key: "daysOutstanding", label: "Days Outstanding", kind: "number" },
    ]),
  },

  {
    key: "customer-balance-by-department",
    name: "Customer Balance by Department",
    module: "crm",
    category: "customer",
    description: "Outstanding customer balances grouped by department.",
    parameters: JSON.stringify({ dateRange: false, aging: true }),
    columns: JSON.stringify([
      { key: "department", label: "Department", kind: "text" },
      { key: "customers", label: "Customers", kind: "number" },
      { key: "closingBalance", label: "Closing Balance", kind: "currency" },
    ]),
  },
  {
    key: "withholding-tax-by-customer",
    name: "Withholding Tax by Customer",
    module: "crm",
    category: "customer",
    description: "WHT withheld per customer for a period.",
    parameters: JSON.stringify({ dateRange: true }),
    columns: JSON.stringify([
      { key: "customer", label: "Customer", kind: "text" },
      { key: "grossAmount", label: "Gross Amount", kind: "currency" },
      { key: "whtRate", label: "WHT Rate", kind: "text" },
      { key: "whtAmount", label: "WHT Withheld", kind: "currency" },
      { key: "netPaid", label: "Net Paid", kind: "currency" },
    ]),
  },

  // ── Stock / Inventory (gap analysis: many not confirmed) ──
  {
    key: "stock-report",
    name: "Stock Report (Detailed & Summary)",
    module: "inventory",
    category: "stock",
    description: "Current stock on hand by item with location and value.",
    parameters: JSON.stringify({ branch: false, category: true, location: true }),
    columns: JSON.stringify([
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "quantityOnHand", label: "On Hand", kind: "number" },
      { key: "costPrice", label: "Cost Price", kind: "currency" },
      { key: "sellingPrice", label: "Selling Price", kind: "currency" },
      { key: "stockValue", label: "Stock Value", kind: "currency" },
    ]),
  },
  {
    key: "stock-by-department",
    name: "Stock Report by Department",
    module: "inventory",
    category: "stock",
    description: "Stock on hand grouped by department/category.",
    parameters: JSON.stringify({ branch: false, department: true }),
    columns: JSON.stringify([
      { key: "department", label: "Department", kind: "text" },
      { key: "itemCount", label: "Items", kind: "number" },
      { key: "totalQuantity", label: "Total Qty", kind: "number" },
      { key: "totalValue", label: "Total Value", kind: "currency" },
    ]),
  },
  {
    key: "stock-valuation",
    name: "Stock Valuation Report (Cost & Selling Price)",
    module: "inventory",
    category: "stock",
    description: "Stock value at cost and at selling price, with margin.",
    parameters: JSON.stringify({ branch: false }),
    columns: JSON.stringify([
      { key: "item", label: "Item", kind: "text" },
      { key: "quantityOnHand", label: "On Hand", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "totalSelling", label: "Total Selling", kind: "currency" },
      { key: "margin", label: "Margin", kind: "currency" },
    ]),
  },
  {
    key: "reorder-points",
    name: "Re-order Points Report",
    module: "inventory",
    category: "stock",
    description: "Items at or below reorder level, with suggested order quantity.",
    parameters: JSON.stringify({ branch: false, category: true }),
    columns: JSON.stringify([
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "quantityOnHand", label: "On Hand", kind: "number" },
      { key: "reorderLevel", label: "Reorder Level", kind: "number" },
      { key: "reorderQuantity", label: "Reorder Qty", kind: "number" },
      { key: "preferredSupplier", label: "Preferred Supplier", kind: "text" },
    ]),
  },
  {
    key: "stock-received",
    name: "Stock Received Report (Detailed & Summary)",
    module: "inventory",
    category: "stock",
    description: "Goods received notes and stock received by item.",
    parameters: JSON.stringify({ dateRange: true, supplier: true, branch: false }),
    columns: JSON.stringify([
      { key: "grnNumber", label: "GRN", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "item", label: "Item", kind: "text" },
      { key: "receivedDate", label: "Received Date", kind: "date" },
      { key: "quantityReceived", label: "Qty Received", kind: "number" },
      { key: "unitCost", label: "Unit Cost", kind: "currency" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
    ]),
  },
  {
    key: "items-not-sold",
    name: "Items Not Sold Report",
    module: "inventory",
    category: "stock",
    description: "Items with no sales in the selected period.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "stockOnHand", label: "Stock on Hand", kind: "number" },
      { key: "lastCostPrice", label: "Last Cost", kind: "currency" },
    ]),
  },
  {
    key: "stock-adjustment",
    name: "Stock Adjustment Report",
    module: "inventory",
    category: "stock",
    description: "Stock adjustments with reason and before/after quantities.",
    parameters: JSON.stringify({ dateRange: true, branch: false, reason: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "beforeQuantity", label: "Before", kind: "number" },
      { key: "afterQuantity", label: "After", kind: "number" },
      { key: "adjustedBy", label: "Adjusted By", kind: "text" },
    ]),
  },
  {
    key: "price-change",
    name: "Price Change Report",
    module: "inventory",
    category: "stock",
    description: "Items whose selling price changed in the period.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "previousPrice", label: "Previous Price", kind: "currency" },
      { key: "newPrice", label: "New Price", kind: "currency" },
      { key: "changedBy", label: "Changed By", kind: "text" },
    ]),
  },

  {
    key: "stock-transferred",
    name: "Stock Transferred Report",
    module: "inventory",
    category: "stock",
    description: "Stock moved between locations, with reference and user.",
    parameters: JSON.stringify({ dateRange: true, branch: false, location: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "fromLocation", label: "From", kind: "text" },
      { key: "toLocation", label: "To", kind: "text" },
      { key: "quantity", label: "Quantity", kind: "number" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "transferredBy", label: "Transferred By", kind: "text" },
    ]),
  },
  {
    key: "stock-expiry",
    name: "Stock Expiry Report",
    module: "inventory",
    category: "stock",
    description: "Stock approaching or past its expiry date.",
    parameters: JSON.stringify({ dateRange: true, branch: false, daysAhead: true }),
    columns: JSON.stringify([
      { key: "item", label: "Item", kind: "text" },
      { key: "batch", label: "Batch", kind: "text" },
      { key: "expiryDate", label: "Expiry Date", kind: "date" },
      { key: "quantityOnHand", label: "On Hand", kind: "number" },
      { key: "daysToExpiry", label: "Days to Expiry", kind: "number" },
      { key: "location", label: "Location", kind: "text" },
    ]),
  },
  {
    key: "physical-stock-take",
    name: "Physical Stock-Take Report",
    module: "inventory",
    category: "stock",
    description: "Counted quantity against book quantity, with variance.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "countDate", label: "Count Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "bookQuantity", label: "Book Qty", kind: "number" },
      { key: "countedQuantity", label: "Counted Qty", kind: "number" },
      { key: "variance", label: "Variance", kind: "number" },
      { key: "location", label: "Location", kind: "text" },
      { key: "notes", label: "Notes", kind: "text" },
    ]),
  },
  {
    key: "purchased-by-item",
    name: "Purchased-by-Item Report",
    module: "procurement",
    category: "stock",
    description: "Purchases aggregated per item across suppliers.",
    parameters: JSON.stringify({ dateRange: true, branch: false, supplier: true }),
    columns: JSON.stringify([
      { key: "item", label: "Item", kind: "text" },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "quantityPurchased", label: "Qty Purchased", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "lastPurchased", label: "Last Purchased", kind: "date" },
    ]),
  },

  // ── Sales / POS reports (gap analysis: many not confirmed) ──
  {
    key: "invoice-report",
    name: "Invoice Report",
    module: "pos",
    category: "sales",
    description: "Posted invoices with customer, items, tax and payment.",
    parameters: JSON.stringify({ dateRange: true, branch: false, customer: true, status: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice No.", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "items", label: "Items", kind: "number" },
      { key: "subtotal", label: "Subtotal", kind: "currency" },
      { key: "tax", label: "Tax", kind: "currency" },
      { key: "total", label: "Total", kind: "currency" },
      { key: "paymentMethod", label: "Payment", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },
  {
    key: "sales-detailed",
    name: "Sales Detailed Report",
    module: "pos",
    category: "sales",
    description: "Every sold line with quantity, price, tax and payment method.",
    parameters: JSON.stringify({ dateRange: true, branch: false, item: true, customer: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "unitPrice", label: "Unit Price", kind: "currency" },
      { key: "lineTotal", label: "Line Total", kind: "currency" },
      { key: "tax", label: "Tax", kind: "currency" },
      { key: "paymentMethod", label: "Payment", kind: "text" },
    ]),
  },
  {
    key: "sales-summary",
    name: "Sales Summary Report",
    module: "pos",
    category: "sales",
    description: "Sales totals by day/week/month with returns and discounts.",
    parameters: JSON.stringify({ dateRange: true, branch: false, groupBy: true }),
    columns: JSON.stringify([
      { key: "period", label: "Period", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "grossSales", label: "Gross Sales", kind: "currency" },
      { key: "returns", label: "Returns", kind: "currency" },
      { key: "discounts", label: "Discounts", kind: "currency" },
      { key: "tax", label: "Tax", kind: "currency" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-day",
    name: "Sales by Day Report",
    module: "pos",
    category: "sales",
    description: "Daily sales totals.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "paymentMethodBreakdown", label: "Payment Breakdown", kind: "text" },
    ]),
  },
  {
    key: "sales-by-week",
    name: "Sales by Week Report",
    module: "pos",
    category: "sales",
    description: "Weekly sales totals.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "weekEnding", label: "Week Ending", kind: "date" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "invoices", label: "Invoices", kind: "number" },
    ]),
  },
  {
    key: "sales-by-month",
    name: "Sales by Month Report",
    module: "pos",
    category: "sales",
    description: "Monthly sales totals.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "month", label: "Month", kind: "date" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "invoices", label: "Invoices", kind: "number" },
    ]),
  },
  {
    key: "sales-by-hour",
    name: "Sales by Hour Report",
    module: "pos",
    category: "sales",
    description: "Sales distribution by hour of day.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "hour", label: "Hour", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-item",
    name: "Sales by Item per Day Report",
    module: "pos",
    category: "sales",
    description: "Item sales per day.",
    parameters: JSON.stringify({ dateRange: true, branch: false, item: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-customer",
    name: "Sales by Customer Report",
    module: "pos",
    category: "sales",
    description: "Sales totals by customer.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "customer", label: "Customer", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "returns", label: "Returns", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-payment-method",
    name: "Sales by Till / M-Pesa / Card / PDQ / Cash Report",
    module: "pos",
    category: "sales",
    description: "Sales breakdown by payment method/till.",
    parameters: JSON.stringify({ dateRange: true, branch: false, paymentMethod: true }),
    columns: JSON.stringify([
      { key: "paymentMethod", label: "Payment Method", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-tax",
    name: "Sales by Tax Report",
    module: "pos",
    category: "sales",
    description: "Sales and tax collected by tax rate/type.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "taxType", label: "Tax Type", kind: "text" },
      { key: "taxRate", label: "Tax Rate", kind: "text" },
      { key: "taxableSales", label: "Taxable Sales", kind: "currency" },
      { key: "taxCollected", label: "Tax Collected", kind: "currency" },
    ]),
  },
  {
    key: "discount-report",
    name: "Discount Report",
    module: "pos",
    category: "sales",
    description: "Discounts given by type, item and cashier.",
    parameters: JSON.stringify({ dateRange: true, branch: false, discountType: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "discountType", label: "Type", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "discountAmount", label: "Discount", kind: "currency" },
    ]),
  },
  {
    key: "sales-return-report",
    name: "Sales Return / Credit Sales Report",
    module: "pos",
    category: "sales",
    description: "Returns and credit notes issued.",
    parameters: JSON.stringify({ dateRange: true, branch: false, customer: true }),
    columns: JSON.stringify([
      { key: "creditNoteNumber", label: "Credit Note", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },
  {
    key: "unpaid-bills",
    name: "Unpaid Bills Report",
    module: "pos",
    category: "sales",
    description: "Outstanding customer invoices/bills.",
    parameters: JSON.stringify({ dateRange: true, branch: false, aging: true }),
    columns: JSON.stringify([
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "invoiceDate", label: "Invoice Date", kind: "date" },
      { key: "dueDate", label: "Due Date", kind: "date" },
      { key: "amountDue", label: "Amount Due", kind: "currency" },
      { key: "daysOutstanding", label: "Days Outstanding", kind: "number" },
    ]),
  },

  // ── Sales reports the original catalog pass missed (spec §2) ──
  {
    key: "sales-by-sales-rep",
    name: "Sales by Sales Rep Report",
    module: "pos",
    category: "sales",
    description: "Invoice counts, sales and discounts per sales rep for a period.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "rep", label: "Sales Rep", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "discounts", label: "Discounts", kind: "currency" },
    ]),
  },
  {
    key: "sales-by-sales-rep-per-day",
    name: "Sales by Sales Rep per Day Report",
    module: "pos",
    category: "sales",
    description: "Per-rep sales broken out by day.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "rep", label: "Sales Rep", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ]),
  },
  {
    key: "items-sold-out-of-set-price",
    name: "Items Sold Out of Set Price Report",
    module: "pos",
    category: "sales",
    description: "Every line-level price override: variance against the set price, the supplier price of the line and a below-cost flag.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "item", label: "Item", kind: "text" },
      { key: "qty", label: "Qty", kind: "number" },
      { key: "setPrice", label: "Set Price", kind: "currency" },
      { key: "soldPrice", label: "Sold At", kind: "currency" },
      { key: "variance", label: "Variance / Unit", kind: "currency" },
      { key: "lineVariance", label: "Line Variance", kind: "currency" },
      { key: "supplierPrice", label: "Supplier Price", kind: "currency" },
      { key: "belowCost", label: "Below Cost", kind: "text" },
      { key: "cashier", label: "Cashier", kind: "text" },
    ]),
  },
  {
    key: "sales-complementary",
    name: "Sales Complementary Report",
    module: "pos",
    category: "sales",
    description: "Comped/free sales flagged as complementary.",
    parameters: JSON.stringify({ dateRange: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "items", label: "Items", kind: "text" },
      { key: "listValue", label: "List Value", kind: "currency" },
      { key: "cashier", label: "Cashier", kind: "text" },
    ]),
  },

  // ── Cashier / branch operations ──
  {
    key: "cashier-cash-print-report",
    name: "Cashier Cash / Prints Report",
    module: "pos",
    category: "cash-bank",
    description: "Cashier drawer openings, prints and closings.",
    parameters: JSON.stringify({ dateRange: true, cashier: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "openingFloat", label: "Opening Float", kind: "currency" },
      { key: "prints", label: "Prints", kind: "number" },
      { key: "closingCash", label: "Closing Cash", kind: "currency" },
    ]),
  },
  {
    key: "cashier-shortage-report",
    name: "Cashier Shortage / Over-report",
    module: "pos",
    category: "cash-bank",
    description: "Cashier drawer shortages and overs at close.",
    parameters: JSON.stringify({ dateRange: true, cashier: true, branch: false }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "expectedCash", label: "Expected Cash", kind: "currency" },
      { key: "actualCash", label: "Actual Cash", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
    ]),
  },
  {
    key: "cash-collection-from-cashiers",
    name: "Cash Collection from Cashiers Report",
    module: "pos",
    category: "cash-bank",
    description: "Cash collected from cashiers into the bank.",
    parameters: JSON.stringify({ dateRange: true, branch: false, cashier: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "amountCollected", label: "Amount Collected", kind: "currency" },
      { key: "reference", label: "Reference", kind: "text" },
    ]),
  },
  {
    key: "cheques-received",
    name: "Cheques Received Report / Statement",
    module: "finance",
    category: "cash-bank",
    description: "Cheques received from customers.",
    parameters: JSON.stringify({ dateRange: true, customer: true }),
    columns: JSON.stringify([
      { key: "chequeNumber", label: "Cheque No.", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "bank", label: "Bank", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
    ]),
  },
  {
    key: "transfer-report",
    name: "Transfer Report",
    module: "finance",
    category: "cash-bank",
    description: "Money transfers between cashiers, accounts or branches.",
    parameters: JSON.stringify({ dateRange: true, fromAccount: true, toAccount: true }),
    columns: JSON.stringify([
      { key: "date", label: "Date", kind: "date" },
      { key: "fromAccount", label: "From", kind: "text" },
      { key: "toAccount", label: "To", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "reference", label: "Reference", kind: "text" },
    ]),
  },
];

/** Map a catalog category to the human "section" label used by the report catalog. */
export function sectionFor(category: string): string {
  switch (category) {
    case "finance":
      return "Finance Reports";
    case "cash-bank":
      return "Cash / Bank / Cashier Reports";
    case "maintenance":
      return "Maintenance Reports";
    case "sales":
      return "Sales Reports";
    case "customer":
      return "Customer Reports";
    case "stock":
      return "Stock Reports";
    case "supplier":
      return "Supplier Reports";
    case "payroll":
      return "Payroll Reports";
    case "asset":
      return "Asset Reports";
    case "etims":
      return "eTIMS Reports";
    default:
      return "Finance Reports";
  }
}

/**
 * ReportDefinition rows to insert for a tenant, minus keys it already has.
 * Shared by this script and the app (`src/lib/report-catalog.ts`) so signup
 * and the seed can never drift apart.
 */
export function buildReportDefinitions(tenantId: string, existingKeys: Set<string>) {
  return CATALOG.filter((r) => !existingKeys.has(r.key)).map((r) => ({
    tenantId,
    key: r.key,
    title: r.name,
    description: r.description,
    category: r.category,
    section: sectionFor(r.category),
    module: r.module,
    parameters: r.parameters,
    columns: r.columns,
    isSystem: true,
    isEnabled: true,
  }));
}

async function main() {
  const db = new PrismaClient();
  // TENANT_SLUG seeds exactly one tenant; with no slug every tenant is
  // seeded, so accounts created before catalog-at-signup existed aren't
  // left with an empty Reports page.
  const tenants = process.env.TENANT_SLUG
    ? await db.$queryRaw<{ id: string }[]>`SELECT id FROM "public"."Tenant" WHERE "slug" = ${process.env.TENANT_SLUG} LIMIT 1`
    : await db.$queryRaw<{ id: string }[]>`SELECT id FROM "public"."Tenant" ORDER BY "createdAt" ASC`;
  if (tenants.length === 0) {
    console.error("No tenant found to seed report definitions");
    await db.$disconnect();
    return;
  }

  let createdTotal = 0;
  for (const tenant of tenants) {
    const tenantId = tenant.id;
    const existing = await db.reportDefinition.findMany({ where: { tenantId }, select: { key: true } });
    const existingKeys = new Set(existing.map((r) => r.key));
    const toCreate = buildReportDefinitions(tenantId, existingKeys);
    const skipped = CATALOG.filter((r) => existingKeys.has(r.key));

    if (toCreate.length === 0) {
      console.log(`${tenantId}: catalog already seeded (${skipped.length} definitions).`);
    } else {
      await db.reportDefinition.createMany({ data: toCreate });
      createdTotal += toCreate.length;
      console.log(`${tenantId}: created ${toCreate.length} ReportDefinitions.`);
    }
  }

  const total = await db.reportDefinition.count();
  console.log(`Seeded ${tenants.length} tenant(s); created ${createdTotal} ReportDefinitions; ${total} exist in total.`);
  await db.$disconnect();
}

// Runs only when executed directly — app code imports CATALOG /
// buildReportDefinitions from here and must not trigger a seed run.
if (process.argv[1]?.includes("seed.reports")) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
