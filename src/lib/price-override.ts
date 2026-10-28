/**
 * On-the-go pricing ("price override" / bargain pricing) policy — the single
 * source of truth for how far a cashier may deviate from a product's set
 * price at the till.
 *
 * The till UI (src/app/(dashboard)/[tenant]/pos/page.tsx) and the server
 * (/api/orders, /api/orders/tabs) both resolve every line through
 * `resolveLinePrice`, so what the cashier sees is exactly what the server
 * will accept — no drift between the two.
 *
 * Two rules, in order:
 *  1. **Set-price tolerance** — a tenant-wide setting decides how far below
 *     the set price a line may be sold, expressed either as a percentage or
 *     as a flat amount (`priceFloorMode` + `priceFloorValue`).
 *  2. **Supplier floor** — an item that lives in inventory (trackStock) can
 *     never be sold below its supplier price (cost), even when the tolerance
 *     would allow it. The effective minimum is the higher of the two.
 *
 * Pure functions only: safe to import from a Client Component or an API
 * route (no Prisma, no env).
 */

/** How the tolerance below the set price is expressed. */
export type PriceFloorMode = "PERCENT" | "AMOUNT";

/** The three tenant settings that drive the policy (src/app/api/settings). */
export interface PricePolicy {
  priceOverrideEnabled: boolean;
  priceFloorMode: string | null | undefined;
  priceFloorValue: number | null | undefined;
}

/** On-the-go pricing off, no tolerance — the safe default for every tenant. */
export const DEFAULT_PRICE_POLICY: PricePolicy = {
  priceOverrideEnabled: false,
  priceFloorMode: "PERCENT",
  priceFloorValue: 0,
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Money to a plain 2-decimal string (no currency symbol — the UI has one). */
export const money = (n: number): string => round2(n).toFixed(2);

/** How far below the set price a sale may go, in money. */
export function priceAllowance(setPrice: number, policy: PricePolicy): number {
  const value = Number(policy.priceFloorValue ?? 0);
  if (!Number.isFinite(value) || value <= 0 || setPrice <= 0) return 0;
  const raw =
    policy.priceFloorMode === "AMOUNT" ? value : (setPrice * value) / 100;
  return round2(Math.max(0, Math.min(raw, setPrice)));
}

/** The lowest price the tolerance alone allows for this line. */
export function priceFloor(setPrice: number, policy: PricePolicy): number {
  return round2(Math.max(0, setPrice - priceAllowance(setPrice, policy)));
}

/**
 * Supplier cost of ONE sale unit.
 *
 * `baseCost` is Product.cost (per base unit), so a larger selling unit costs
 * `baseCost × conversionFactor` unless the UoM carries its own cost row
 * (ProductUoM.cost, maintained by receiving) — that wins when set.
 */
export function supplierCostPerUnit(
  baseCost: number | null | undefined,
  conversionFactor: number | null | undefined,
  uomCost: number | null | undefined
): number {
  const explicit = Number(uomCost ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return round2(explicit);
  const factor =
    Number.isFinite(Number(conversionFactor)) && Number(conversionFactor) > 0
      ? Number(conversionFactor)
      : 1;
  const base = Number(baseCost);
  return round2((Number.isFinite(base) && base > 0 ? base : 0) * factor);
}

export interface LinePricingInput {
  /** Product name — only used to make the rejection message readable. */
  itemName: string;
  /** Catalog price of the unit being sold (Product.price or UoM price). */
  setPrice: number;
  /** What the till asked for; omitted/NaN means "charge the set price". */
  requestedPrice?: number | null;
  /** The item lives in inventory → the supplier-price floor applies. */
  trackStock: boolean;
  policy: PricePolicy;
  /**
   * Supplier cost of one sale unit, when the caller already knows it (the
   * till caches it on the cart line). Otherwise derive it from
   * baseCost × conversionFactor (or uomCost).
   */
  supplierCost?: number | null;
  baseCost?: number | null;
  conversionFactor?: number | null;
  uomCost?: number | null;
}

export interface LinePricing {
  /** false → the requested price is not allowed; `error` says why. */
  ok: boolean;
  /** The price that must actually be charged (set price when disabled). */
  unitPrice: number;
  setPrice: number;
  /** Effective minimum: max(tolerance floor, supplier floor). */
  minPrice: number;
  /** Supplier cost of the sale unit (0 for non-stock items). */
  supplierCost: number;
  /** The charged price differs from the set price (goes to the reports). */
  overridden: boolean;
  error?: string;
}

/**
 * Resolve what one cart line may be sold for.
 *
 * With on-the-go pricing off the set price always wins — the request is
 * clamped rather than rejected, so an order queued while the setting was on
 * still syncs instead of failing forever. With it on, a request below the
 * effective minimum is rejected with a message naming the item and the floor.
 */
export function resolveLinePrice(input: LinePricingInput): LinePricing {
  const setPrice = round2(Math.max(0, Number(input.setPrice) || 0));
  const supplierCost = input.trackStock
    ? input.supplierCost != null
      ? round2(Number(input.supplierCost) || 0)
      : supplierCostPerUnit(
          input.baseCost,
          input.conversionFactor,
          input.uomCost
        )
    : 0;
  const toleranceFloor = priceFloor(setPrice, input.policy);
  const minPrice = round2(Math.max(toleranceFloor, supplierCost));

  const base = {
    setPrice,
    minPrice,
    supplierCost,
  };

  const requested =
    typeof input.requestedPrice === "number" &&
    Number.isFinite(input.requestedPrice) &&
    input.requestedPrice >= 0
      ? round2(input.requestedPrice)
      : null;

  // On-the-go pricing off → catalog price, always.
  if (!input.policy.priceOverrideEnabled) {
    return { ...base, ok: true, unitPrice: setPrice, overridden: false };
  }

  if (requested === null) {
    return { ...base, ok: true, unitPrice: setPrice, overridden: false };
  }

  if (requested >= minPrice) {
    return {
      ...base,
      ok: true,
      unitPrice: requested,
      overridden: requested < setPrice,
    };
  }

  // Rejected: build a message that says which rule stopped the sale.
  const reasons: string[] = [];
  if (supplierCost > 0 && requested < supplierCost) {
    reasons.push(`below the supplier price of ${money(supplierCost)}`);
  }
  if (requested < toleranceFloor) {
    const v = Number(input.policy.priceFloorValue ?? 0);
    const allowance =
      input.policy.priceFloorMode === "AMOUNT"
        ? `${money(v)}`
        : `${v}%`;
    reasons.push(
      `more than ${allowance} below the set price (min ${money(toleranceFloor)})`
    );
  }

  return {
    ...base,
    ok: false,
    unitPrice: setPrice,
    overridden: false,
    error: `${input.itemName}: minimum selling price is ${money(
      minPrice
    )} — ${
      reasons.join(", and ") || `it may not be sold below ${money(minPrice)}`
    }`,
  };
}
