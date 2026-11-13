/**
 * Branch pricing.
 *
 * A product has one base selling price and optional per-selling-unit prices
 * (crate, pack, ...). A branch may override either with a
 * `ProductLocationPrice` row; without one the catalogue price applies. Every
 * price surface (POS tiles, UoM picker, order pricing, product editor)
 * resolves through these helpers so they can never disagree about what a till
 * charges.
 */

export interface BranchPrice {
  locationId: string;
  /** Null targets the base unit; set targets that ProductUoM. */
  productUomId?: string | null;
  price: number;
}

/**
 * The price charged at `locationId` for a unit, falling back to that unit's
 * catalogue price (`basePrice` for the base unit) when the branch has no row.
 */
export function priceAtLocation(
  basePrice: number,
  locationId: string | null | undefined,
  overrides: BranchPrice[] | null | undefined,
  productUomId: string | null = null
): number {
  if (!locationId || !overrides?.length) return basePrice;
  const override = overrides.find(
    (p) =>
      p.locationId === locationId &&
      (productUomId ? p.productUomId === productUomId : !p.productUomId)
  );
  return override && Number.isFinite(override.price) ? override.price : basePrice;
}

/** True when the branch sells this unit at something other than catalogue. */
export function hasBranchPrice(
  basePrice: number,
  locationId: string,
  overrides: BranchPrice[] | null | undefined,
  productUomId: string | null = null
): boolean {
  return priceAtLocation(basePrice, locationId, overrides, productUomId) !== basePrice;
}
