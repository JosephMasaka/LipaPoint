import type { ConnectEntity } from "./types";

/**
 * Field mapping (Milestone 1): a documented JSON document, not free-form
 * guessing. Each local field names the external path it reads from, which is
 * what makes "any REST endpoint" workable without per-provider code — and
 * what makes a mapping error a sentence the customer can fix instead of a
 * 500.
 */

export type FieldType = "string" | "number" | "boolean";

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
}

export const ENTITY_FIELDS: Record<ConnectEntity, FieldDefinition[]> = {
  products: [
    { key: "sku", label: "SKU", type: "string", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "price", label: "Selling price", type: "number", required: true },
    { key: "cost", label: "Cost price", type: "number" },
    { key: "description", label: "Description", type: "string" },
    { key: "barcode", label: "Barcode", type: "string" },
    { key: "category", label: "Category name", type: "string" },
    { key: "isActive", label: "Active", type: "boolean" },
    { key: "trackStock", label: "Track stock", type: "boolean" },
    { key: "lowStockAlert", label: "Low-stock alert", type: "number" },
  ],
  customers: [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "phone", label: "Phone", type: "string" },
    { key: "email", label: "Email", type: "string" },
    { key: "address", label: "Address", type: "string" },
    { key: "notes", label: "Notes", type: "string" },
  ],
};

export interface MappingDocument {
  /** local field key -> dot path in the external record */
  fields: Record<string, string>;
  /** applied when the external record has no value for the field */
  defaults?: Record<string, unknown>;
}

export const DEFAULT_MAPPINGS: Record<ConnectEntity, MappingDocument> = {
  products: {
    fields: {
      sku: "sku",
      name: "name",
      price: "price",
      cost: "cost",
      description: "description",
      barcode: "barcode",
      category: "category",
      isActive: "is_active",
      trackStock: "track_stock",
      lowStockAlert: "low_stock_alert",
    },
    defaults: { isActive: true, trackStock: true },
  },
  customers: {
    fields: {
      name: "name",
      phone: "phone",
      email: "email",
      address: "address",
      notes: "notes",
    },
  },
};

export function defaultMapping(entity: ConnectEntity): MappingDocument {
  const source = DEFAULT_MAPPINGS[entity];
  return { fields: { ...source.fields }, defaults: { ...(source.defaults ?? {}) } };
}

/**
 * Accepts stored JSON (possibly null, possibly legacy) and always returns a
 * complete, type-safe document. Unknown local fields are dropped here so a
 * stale mapping can never reach a Prisma update.
 */
export function normaliseMapping(entity: ConnectEntity, raw: unknown): MappingDocument {
  const known = new Set(ENTITY_FIELDS[entity].map((field) => field.key));
  const fallback = defaultMapping(entity);
  if (!raw || typeof raw !== "object") return fallback;

  const candidate = raw as { fields?: unknown; defaults?: unknown };
  if (!candidate.fields || typeof candidate.fields !== "object") return fallback;

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate.fields as Record<string, unknown>)) {
    if (!known.has(key) || typeof value !== "string") continue;
    const path = value.trim();
    if (path) fields[key] = path;
  }

  const defaults: Record<string, unknown> = {};
  if (candidate.defaults && typeof candidate.defaults === "object") {
    for (const [key, value] of Object.entries(candidate.defaults as Record<string, unknown>)) {
      if (known.has(key)) defaults[key] = value;
    }
  }

  // A provided document is used as given: silently filling unmapped required
  // fields from the defaults would make validateMapping() unable to reject a
  // half-configured mapping. Defaults only fill missing *values* per record.
  return { fields, defaults: { ...fallback.defaults, ...defaults } };
}

export function validateMapping(
  entity: ConnectEntity,
  raw: unknown
): { ok: true; mapping: MappingDocument } | { ok: false; errors: string[] } {
  const mapping = normaliseMapping(entity, raw);
  const errors: string[] = [];
  for (const field of ENTITY_FIELDS[entity]) {
    if (field.required && !mapping.fields[field.key]) {
      errors.push(`${field.label} must be mapped to an external field`);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, mapping };
}

/** Dot-path read: `meta.next_cursor`, `items.0.sku`, `sku`. */
export function readPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active", "enabled"].includes(normalised)) return true;
    if (["false", "0", "no", "n", "inactive", "disabled"].includes(normalised)) return false;
  }
  return undefined;
}

function toString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export type MappedRecord = Record<string, string | number | boolean>;

export type ApplyResult =
  | { ok: true; value: MappedRecord }
  | { ok: false; errors: string[] };

/**
 * Maps one external record into local values. Returns every problem at once —
 * a row rejected for two bad fields costs one sync run, not two.
 */
export function applyMapping(
  entity: ConnectEntity,
  mapping: MappingDocument,
  record: Record<string, unknown>
): ApplyResult {
  const errors: string[] = [];
  const value: MappedRecord = {};

  for (const field of ENTITY_FIELDS[entity]) {
    const path = mapping.fields[field.key];
    let raw = path ? readPath(record, path) : undefined;
    if (raw === undefined || raw === null || raw === "") {
      raw = mapping.defaults?.[field.key];
    }

    if (raw === undefined || raw === null || raw === "") {
      if (field.required) errors.push(`${field.label} is missing`);
      continue;
    }

    if (field.type === "number") {
      const parsed = toNumber(raw);
      if (parsed === undefined) {
        errors.push(`${field.label} is not a number`);
        continue;
      }
      if (parsed < 0) {
        errors.push(`${field.label} cannot be negative`);
        continue;
      }
      value[field.key] = parsed;
      continue;
    }

    if (field.type === "boolean") {
      const parsed = toBoolean(raw);
      if (parsed === undefined) {
        errors.push(`${field.label} is not true/false`);
        continue;
      }
      value[field.key] = parsed;
      continue;
    }

    const parsed = toString(raw);
    if (parsed === undefined) {
      if (field.required) errors.push(`${field.label} is empty`);
      continue;
    }
    value[field.key] = parsed.slice(0, 500);
  }

  // SKU is the identity of a product; a blank one would collide on re-sync.
  if (entity === "products" && typeof value.sku === "string" && value.sku.length === 0) {
    errors.push("SKU is empty");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
