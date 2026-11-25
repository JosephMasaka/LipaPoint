/**
 * Provider catalogue — pure data, no Prisma and no network.
 *
 * A provider is code (this registry + a connector in ./connectors), never a
 * database row: `IntegrationConnection.providerId` is a plain string, so
 * adding a provider needs no migration, and a row can never point at a
 * provider whose connector was deleted (the detail route 404s on lookup).
 *
 * `status: "planned"` providers are shown in the catalogue as "Coming soon"
 * and have no connector. That is deliberate: the product must not advertise
 * an integration that cannot be connected.
 */

import type { AuthType, ConnectEntity } from "./types";

export const PROVIDER_CATEGORIES = [
  "Custom",
  "Commerce",
  "Accounting",
  "CRM",
  "ERP",
  "Testing",
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export interface ProviderField {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** Rendered as a password input and encrypted at rest. */
  secret?: boolean;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  category: ProviderCategory;
  description: string;
  status: "available" | "planned";
  authTypes: AuthType[];
  entities: ConnectEntity[];
  supportsFile: boolean;
  supportsWebhooks: boolean;
  /** Shown on the connect screen before credentials are entered. */
  setupHint?: string;
  /** Non-secret connection settings (paths, field names). */
  configFields?: ProviderField[];
  /** Auth inputs; encrypted, write-only from the client's perspective. */
  credentialFields?: ProviderField[];
}

const CUSTOM_API: ProviderDefinition = {
  id: "custom-api",
  label: "Custom API",
  category: "Custom",
  description:
    "Read products and customers from any REST endpoint that returns JSON. Read-only: Connect never writes to the external system in Milestone 1.",
  status: "available",
  authTypes: ["API_KEY", "BEARER", "BASIC", "NONE"],
  entities: ["products", "customers"],
  supportsFile: false,
  supportsWebhooks: true,
  setupHint:
    "The endpoint must be public HTTPS (private networks and IP literals are refused) and return a JSON array, or an object containing one.",
  configFields: [
    {
      key: "productsPath",
      label: "Products path",
      placeholder: "/products",
      help: "Appended to the base URL. Leave blank if this system has no products.",
    },
    {
      key: "customersPath",
      label: "Customers path",
      placeholder: "/customers",
      help: "Appended to the base URL. Leave blank if this system has no customers.",
    },
    {
      key: "itemsPath",
      label: "Records path inside the response",
      placeholder: "data",
      help: "Dot path to the array (e.g. data.items). Blank auto-detects the first array.",
    },
    {
      key: "idField",
      label: "External id field",
      placeholder: "id",
      help: "Field that uniquely identifies a record. Defaults to id.",
    },
    {
      key: "nextCursorPath",
      label: "Next-cursor path",
      placeholder: "meta.next_cursor",
      help: "Optional. Reads the next page cursor from the response.",
    },
  ],
  credentialFields: [
    { key: "apiKey", label: "API key", secret: true, help: "Sent as the x-api-key header." },
    { key: "token", label: "Bearer token", secret: true, help: "Sent as Authorization: Bearer <token>." },
    { key: "username", label: "Username", help: "HTTP Basic username." },
    { key: "password", label: "Password", secret: true, help: "HTTP Basic password." },
  ],
};

const FILE: ProviderDefinition = {
  id: "file",
  label: "CSV / Excel file",
  category: "Custom",
  description:
    "Import products or customers from a spreadsheet upload. Values are mapped by column header, validated row by row, and applied in one tracked job.",
  status: "available",
  authTypes: ["NONE"],
  entities: ["products", "customers"],
  supportsFile: true,
  supportsWebhooks: false,
  setupHint:
    "First row must be column headers. Supported formats: .csv, .xlsx (first worksheet). Files up to 5 MB.",
  credentialFields: [],
  configFields: [],
};

const MOCK: ProviderDefinition = {
  id: "mock",
  label: "Sandbox (generated data)",
  category: "Testing",
  description:
    "Generates simulated products and customers so the sync engine, job history and monitoring can be exercised without an external account. No real system is contacted.",
  status: "available",
  authTypes: ["NONE"],
  entities: ["products", "customers"],
  supportsFile: true,
  supportsWebhooks: true,
  setupHint: "Simulated data only — safe to connect on any tenant, including demos.",
  credentialFields: [],
  configFields: [
    {
      key: "recordCount",
      label: "Records per sync",
      placeholder: "12",
      help: "Between 1 and 200. Re-running updates the same simulated records.",
    },
  ],
};

/** Catalogue entries with no connector yet. Never presented as connectable. */
const PLANNED: ProviderDefinition[] = [
  {
    id: "shopify",
    label: "Shopify",
    category: "Commerce",
    description: "Products, inventory levels and orders from a Shopify store.",
    status: "planned",
    authTypes: ["BEARER"],
    entities: ["products"],
    supportsFile: false,
    supportsWebhooks: true,
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    category: "Commerce",
    description: "Products and orders from a WordPress/WooCommerce store.",
    status: "planned",
    authTypes: ["BASIC"],
    entities: ["products"],
    supportsFile: false,
    supportsWebhooks: true,
  },
  {
    id: "quickbooks",
    label: "QuickBooks",
    category: "Accounting",
    description: "Invoices, payments and customer records from QuickBooks Online.",
    status: "planned",
    authTypes: ["BEARER"],
    entities: ["customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
  {
    id: "xero",
    label: "Xero",
    category: "Accounting",
    description: "Contacts, invoices and payments from Xero.",
    status: "planned",
    authTypes: ["BEARER"],
    entities: ["customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
  {
    id: "odoo",
    label: "Odoo",
    category: "ERP",
    description: "Products and partners from an Odoo instance.",
    status: "planned",
    authTypes: ["BASIC"],
    entities: ["products", "customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
  {
    id: "erpnext",
    label: "ERPNext",
    category: "ERP",
    description: "Items and customers from ERPNext / Frappe.",
    status: "planned",
    authTypes: ["API_KEY"],
    entities: ["products", "customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
  {
    id: "zoho",
    label: "Zoho Books / CRM",
    category: "CRM",
    description: "Contacts and items from Zoho.",
    status: "planned",
    authTypes: ["BEARER"],
    entities: ["customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    category: "CRM",
    description: "Companies and contacts from HubSpot.",
    status: "planned",
    authTypes: ["BEARER"],
    entities: ["customers"],
    supportsFile: false,
    supportsWebhooks: false,
  },
];

export const PROVIDERS: ProviderDefinition[] = [CUSTOM_API, FILE, MOCK, ...PLANNED];

const PROVIDER_INDEX = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

export function getProvider(providerId: string): ProviderDefinition | undefined {
  return PROVIDER_INDEX.get(providerId);
}

export function listProviders(category?: ProviderCategory): ProviderDefinition[] {
  return category ? PROVIDERS.filter((p) => p.category === category) : PROVIDERS;
}

/** Only these may appear with a Connect button. */
export function availableProviders(): ProviderDefinition[] {
  return PROVIDERS.filter((p) => p.status === "available");
}

export function providerSupportsEntity(providerId: string, entity: ConnectEntity): boolean {
  return getProvider(providerId)?.entities.includes(entity) ?? false;
}
