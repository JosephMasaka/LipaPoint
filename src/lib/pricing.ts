/**
 * Branch pricing.
 *
 * A product has one base selling price. A branch may override it with a
 * `ProductLocationPrice` row; without one the base price applies. Every
 * price surface (POS tiles, order pricing, product editor) resolves through
 * these helpers so they can never disagree about what a till charges.
 */

export interface BranchPrice {
  locationId: string;
  price: number;
}

/** The price charged at `locationId`, falling back to the base price. */
export function priceAtLocation(
  basePrice: number,
  locationId: string | null | undefined,
  overrides: BranchPrice[] | null | undefined
): number {
  if (!locationId || !overrides?.length) return basePrice;
  const override = overrides.find((p) => p.locationId === locationId);
  return override && Number.isFinite(override.price) ? override.price : basePrice;
}

/** True when the branch sells this product at something other than base. */
export function hasBranchPrice(
  basePrice: number,
  locationId: string,
  overrides: BranchPrice[] | null | undefined
): boolean {
  return priceAtLocation(basePrice, locationId, overrides) !== basePrice;
}
