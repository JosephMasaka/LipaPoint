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

export const VERTICAL_PLANS: Record<BusinessCategory, Record<string, PlanConfig>> = {
  RETAIL_GENERAL: {
    STARTER: {
      limits: { products: 100, locations: 1, staff: 2, features: ["pos", "orders", "tabs", "inventory", "expenses", "customers"] },
      pricing: { monthly: 2999, annual: 29990 },
    },
    PROFESSIONAL: {
      limits: { products: Infinity, locations: 3, staff: 10, features: ["pos", "orders", "tabs", "inventory", "expenses", "customers", "discounts", "analytics", "stock-records", "daily-summary", "ai-assistant"] },
      pricing: { monthly: 7999, annual: 79990 },
    },
    ENTERPRISE: {
      limits: { products: Infinity, locations: Infinity, staff: Infinity, features: ["pos", "orders", "tabs", "inventory", "expenses", "customers", "discounts", "analytics", "stock-records", "daily-summary", "ai-assistant", "api-access", "custom-reports"] },
      pricing: { monthly: 19999, annual: 199990 },
    },
  },
  RESTAURANT_HOSPITALITY: {
    STARTER: {
      limits: { products: 100, locations: 1, staff: 2, features: ["pos", "orders", "tabs", "table-management", "menu-management", "customers"] },
      pricing: { monthly: 2999, annual: 29990 },
    },
    PROFESSIONAL: {
      limits: { products: Infinity, locations: 3, staff: 10, features: ["pos", "orders", "tabs", "table-management", "menu-management", "customers", "kitchen-display", "online-ordering", "ai-assistant", "analytics", "discounts"] },
      pricing: { monthly: 7999, annual: 79990 },
    },
    ENTERPRISE: {
      limits: { products: Infinity, locations: Infinity, staff: Infinity, features: ["pos", "orders", "tabs", "table-management", "menu-management", "customers", "kitchen-display", "online-ordering", "ai-assistant", "analytics", "discounts", "delivery-management", "api-access", "custom-reports"] },
      pricing: { monthly: 19999, annual: 199990 },
    },
  },
  BARBERSHOP_SALON: {
    STARTER: {
      limits: { products: 100, locations: 1, staff: 2, features: ["pos", "orders", "appointments", "service-catalog", "queue-management", "customers"] },
      pricing: { monthly: 1999, annual: 19990 },
    },
    PROFESSIONAL: {
      limits: { products: Infinity, locations: 3, staff: 10, features: ["pos", "orders", "appointments", "service-catalog", "queue-management", "customers", "staff-scheduling", "ai-assistant", "analytics", "discounts"] },
      pricing: { monthly: 4999, annual: 49990 },
    },
    ENTERPRISE: {
      limits: { products: Infinity, locations: Infinity, staff: Infinity, features: ["pos", "orders", "appointments", "service-catalog", "queue-management", "customers", "staff-scheduling", "ai-assistant", "analytics", "discounts", "api-access", "custom-reports"] },
      pricing: { monthly: 12999, annual: 129990 },
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
  "custom-reports": "Custom Reports",
  "table-management": "Table Management",
  "menu-management": "Menu Management",
  "kitchen-display": "Kitchen Display (KDS)",
  "online-ordering": "Online Ordering",
  "delivery-management": "Delivery Management",
  "appointments": "Appointment Booking",
  "service-catalog": "Service Catalog",
  "queue-management": "Queue Management",
  "staff-scheduling": "Staff Scheduling",
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
