export type BusinessCategory = "RETAIL_GENERAL" | "RESTAURANT_HOSPITALITY" | "BARBERSHOP_SALON";

export const TENANT_TYPE_TO_CATEGORY: Record<string, BusinessCategory> = {
  RETAIL: "RETAIL_GENERAL",
  SUPERMARKET: "RETAIL_GENERAL",
  PHARMACY: "RETAIL_GENERAL",
  HARDWARE: "RETAIL_GENERAL",
  RESTAURANT: "RESTAURANT_HOSPITALITY",
  BAR: "RESTAURANT_HOSPITALITY",
  BARBERSHOP: "BARBERSHOP_SALON",
};

export interface PlanPricing {
  monthly: number;
  annual: number;
}

export interface PlanLimits {
  products: number;
  locations: number;
  staff: number;
  features: string[];
}

export interface PlanConfig {
  limits: PlanLimits;
  pricing: PlanPricing;
}

/**
 * REPORTING FEATURE KEYS — added to close the gap between the original
 * Gemini demo notes' report catalog and what the plan matrix currently
 * gates. Grouped the same way the PDF grouped them (Sales / Stock /
 * Customer / Cashier-Cash-Bank), NOT as one flag per individual report —
 * that would be ~40 keys for no real entitlement benefit, since a tenant
 * either has that report group or doesn't.
 *
 * "analytics" / "stock-records" / "daily-summary" (already existed) stay
 * as the lightweight Professional-tier dashboards. These new keys are the
 * full, exportable report suites from the client's notes and sit one tier
 * up from their lightweight counterparts:
 *
 *   sales-reports     → invoice, sales detailed/summary, unpaid bills,
 *                        sales by hour/day/week/month, by sales rep
 *                        (+ per day), by item (per day), items sold out
 *                        of set price, complementary sales, sales by
 *                        payment method (till/mpesa/card/pdq/cash), sales
 *                        by tax, sales by customer, discount report,
 *                        sales returns/credit sales
 *   stock-reports      → stock detailed/summary (by department), stock
 *                        valuation at cost & selling price, re-order
 *                        points, stock received, items not sold, stock
 *                        transferred, stock adjustment, stock expiry,
 *                        physical stock-take, purchased-by-item, price
 *                        change
 *   customer-reports   → customer statement (detailed/summary), customer
 *                        balance (detailed/summary), balance by
 *                        department, withholding tax by customer
 *   cashier-reports    → cash/bank statement & report (summary/detailed),
 *                        cashier cash/prints report, cheques received,
 *                        transfer reports, cashier shortage report,
 *                        mpesa/card/pdq report, cash collection from
 *                        cashiers — tied to till/cashier activity, so
 *                        this is POS-level and does NOT require the
 *                        Finance module to be enabled
 *
 * Module-scoped report suites (finance statements, supplier reports,
 * payroll reports, asset reports, audit trail) are deliberately NOT new
 * feature keys — they ship as part of the "finance" / "procurement" /
 * "payroll" / "assets" flags already in ENTERPRISE below. There's no
 * reason to sell "payroll reports" as a separate add-on from "payroll"
 * itself.
 */
export const REPORT_GROUP_FEATURES = [
  "sales-reports",
  "stock-reports",
  "customer-reports",
  "cashier-reports",
] as const;

export const VERTICAL_PLANS: Record<
  BusinessCategory,
  Record<string, PlanConfig>
> = {
  RETAIL_GENERAL: {
    STARTER: {
      limits: {
        products: 300,
        locations: 1,
        staff: 2,
        features: [
          "pos",
          "orders",
          "tabs",
          "inventory",
          "expenses",
          "customers",
        ],
      },
      pricing: { monthly: 999, annual: 9990 },
    },

    PROFESSIONAL: {
      limits: {
        products: 3000,
        locations: 2,
        staff: 5,
        features: [
          "pos",
          "orders",
          "tabs",
          "inventory",
          "expenses",
          "customers",
          "discounts",
          "analytics",
          "stock-records",
          "daily-summary",
          "ai-assistant",
          "sales-reports",
          "stock-reports",
        ],
      },
      pricing: { monthly: 2499, annual: 24990 },
    },

    ENTERPRISE: {
      limits: {
        products: Infinity,
        locations: Infinity,
        staff: Infinity,
        features: [
          "pos",
          "orders",
          "tabs",
          "inventory",
          "expenses",
          "customers",
          "discounts",
          "analytics",
          "stock-records",
          "daily-summary",
          "ai-assistant",
          "sales-reports",
          "stock-reports",
          "customer-reports",
          "cashier-reports",
          "api-access",
          "custom-reports",
          "finance",
          "procurement",
          "etims",
          "payroll",
          "assets",
        ],
      },
      pricing: { monthly: 5999, annual: 59990 },
    },
  },

  RESTAURANT_HOSPITALITY: {
    STARTER: {
      limits: {
        products: 300,
        locations: 1,
        staff: 2,
        features: [
          "pos",
          "orders",
          "tabs",
          "table-management",
          "menu-management",
          "customers",
        ],
      },
      pricing: { monthly: 1499, annual: 14990 },
    },

    PROFESSIONAL: {
      limits: {
        products: 3000,
        locations: 2,
        staff: 5,
        features: [
          "pos",
          "orders",
          "tabs",
          "table-management",
          "menu-management",
          "customers",
          "kitchen-display",
          "online-ordering",
          "ai-assistant",
          "analytics",
          "discounts",
          "sales-reports",
          "stock-reports",
        ],
      },
      pricing: { monthly: 3999, annual: 39990 },
    },

    ENTERPRISE: {
      limits: {
        products: Infinity,
        locations: Infinity,
        staff: Infinity,
        features: [
          "pos",
          "orders",
          "tabs",
          "table-management",
          "menu-management",
          "customers",
          "kitchen-display",
          "online-ordering",
          "ai-assistant",
          "analytics",
          "discounts",
          "delivery-management",
          "sales-reports",
          "stock-reports",
          "customer-reports",
          "cashier-reports",
          "api-access",
          "custom-reports",
          "finance",
          "procurement",
          "etims",
          "payroll",
          "assets",
        ],
      },
      pricing: { monthly: 7999, annual: 79990 },
    },
  },

  BARBERSHOP_SALON: {
    STARTER: {
      limits: {
        products: 300,
        locations: 1,
        staff: 2,
        features: [
          "pos",
          "orders",
          "appointments",
          "service-catalog",
          "queue-management",
          "customers",
        ],
      },
      pricing: { monthly: 999, annual: 9990 },
    },

    PROFESSIONAL: {
      limits: {
        products: 3000,
        locations: 2,
        staff: 5,
        features: [
          "pos",
          "orders",
          "appointments",
          "service-catalog",
          "queue-management",
          "customers",
          "staff-scheduling",
          "ai-assistant",
          "analytics",
          "discounts",
          "sales-reports",
        ],
      },
      pricing: { monthly: 1999, annual: 19990 },
    },

    ENTERPRISE: {
      limits: {
        products: Infinity,
        locations: Infinity,
        staff: Infinity,
        features: [
          "pos",
          "orders",
          "appointments",
          "service-catalog",
          "queue-management",
          "customers",
          "staff-scheduling",
          "ai-assistant",
          "analytics",
          "discounts",
          "sales-reports",
          "customer-reports",
          "cashier-reports",
          "api-access",
          "custom-reports",
          "finance",
          "procurement",
          "etims",
          "payroll",
          "assets",
        ],
      },
      pricing: { monthly: 4499, annual: 44990 },
    },
  },
};

export interface HardwareAddon {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const HARDWARE_ADDONS: HardwareAddon[] = [
  { id: "thermal-printer", name: "Thermal Receipt Printer", description: "58mm/80mm thermal printer, USB + Bluetooth", price: 8500 },
  { id: "barcode-scanner", name: "Barcode Scanner", description: "USB wired barcode scanner, 1D/2D", price: 4500 },
  { id: "tablet-terminal", name: "Tablet / POS Terminal", description: "10.1\" Android tablet with stand", price: 25000 },
];

export const CATEGORY_DISPLAY: Record<BusinessCategory, { label: string; description: string }> = {
  RETAIL_GENERAL: { label: "Retail & General", description: "Shops, supermarkets, pharmacies, hardware" },
  RESTAURANT_HOSPITALITY: { label: "Restaurant & Hospitality", description: "Restaurants, bars, lounges, cafes" },
  BARBERSHOP_SALON: { label: "Barbershop & Salon", description: "Barbershops, salons, spas" },
};

export const FEATURE_DISPLAY: Record<string, string> = {
  "pos": "Point of Sale",
  "orders": "Order Management",
  "tabs": "Tab Management",
  "inventory": "Inventory Tracking",
  "expenses": "Expense Tracking",
  "customers": "Customer Management",
  "discounts": "Discounts & Coupons",
  "analytics": "Analytics & Reports",
  "stock-records": "Stock Records",
  "daily-summary": "Daily Summary",
  "ai-assistant": "AI Business Assistant",
  "api-access": "API Access",
  "custom-reports": "Custom Report Builder",
  "sales-reports": "Full Sales Report Suite (by hour/day/week/month, by item, by rep, by payment method, by tax, discounts, returns)",
  "stock-reports": "Full Stock Report Suite (valuation, re-order points, transfers, adjustments, expiry, stock-take)",
  "customer-reports": "Customer Statements & Balance Reports",
  "cashier-reports": "Cashier & Cash/Bank Reports (shortages, till reconciliation, mpesa/card/pdq)",
  "table-management": "Table Management",
  "menu-management": "Menu Management",
  "kitchen-display": "Kitchen Display (KDS)",
  "online-ordering": "Online Ordering",
  "delivery-management": "Delivery Management",
  "appointments": "Appointment Booking",
  "service-catalog": "Service Catalog",
  "queue-management": "Queue Management",
  "staff-scheduling": "Staff Scheduling",
  "finance": "Accounting & General Ledger",
  "procurement": "Procurement & Suppliers",
  "etims": "KRA eTIMS Invoicing",
  "payroll": "HR & Statutory Payroll",
  "assets": "Fixed Assets & Depreciation",
};

export const BUSINESS_TYPES = [
  { value: "RETAIL", label: "Retail Shop" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "BAR", label: "Bar / Lounge" },
  { value: "SUPERMARKET", label: "Supermarket" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "HARDWARE", label: "Hardware Store" },
  { value: "BARBERSHOP", label: "Barbershop / Salon" },
];

export function getBusinessCategory(tenantType: string): BusinessCategory {
  return TENANT_TYPE_TO_CATEGORY[tenantType] || "RETAIL_GENERAL";
}

export function getPlanLimits(tier: string, tenantType?: string): PlanLimits {
  const category = getBusinessCategory(tenantType || "RETAIL");
  return VERTICAL_PLANS[category]?.[tier]?.limits || VERTICAL_PLANS.RETAIL_GENERAL.STARTER.limits;
}

export function getPlanPricing(tier: string, tenantType?: string): PlanPricing {
  const category = getBusinessCategory(tenantType || "RETAIL");
  return VERTICAL_PLANS[category]?.[tier]?.pricing || VERTICAL_PLANS.RETAIL_GENERAL.STARTER.pricing;
}

export function canAccessFeature(tier: string, feature: string, tenantType?: string): boolean {
  const limits = getPlanLimits(tier, tenantType);
  return limits.features.includes(feature);
}

export function formatPrice(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

export interface UsageStatus {
  products: { used: number; limit: number; exceeded: boolean };
  locations: { used: number; limit: number; exceeded: boolean };
  staff: { used: number; limit: number; exceeded: boolean };
}

export function checkUsage(
  tier: string,
  counts: { products: number; locations: number; staff: number },
  tenantType?: string
): UsageStatus {
  const limits = getPlanLimits(tier, tenantType);
  return {
    products: { used: counts.products, limit: limits.products, exceeded: counts.products >= limits.products },
    locations: { used: counts.locations, limit: limits.locations, exceeded: counts.locations >= limits.locations },
    staff: { used: counts.staff, limit: limits.staff, exceeded: counts.staff >= limits.staff },
  };
}