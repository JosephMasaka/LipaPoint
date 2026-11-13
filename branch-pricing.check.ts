/**
 * Branch pricing resolver checks — run with `npx tsx branch-pricing.check.ts`.
 *
 * Pure function tests; the API round-trip lives in branch-pricing-api.check.ts.
 */
import { hasBranchPrice, priceAtLocation, type BranchPrice } from "./src/lib/pricing";

let failures = 0;
function expect(name: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${JSON.stringify(actual)}${ok ? "" : ` want=${JSON.stringify(wanted)}`}`);
}

const MAIN = "loc-main";
const OTHER = "loc-other";
const UOM_STRIP = "uom-strip";
const UOM_CRATE = "uom-crate";

const overrides: BranchPrice[] = [
  { locationId: MAIN, price: 548 },
  { locationId: OTHER, price: 500 },
  { locationId: MAIN, productUomId: UOM_STRIP, price: 1554 },
];

// Base unit precedence
expect("no location → catalogue", priceAtLocation(600, null, overrides), 600);
expect("undefined location → catalogue", priceAtLocation(600, undefined, overrides), 600);
expect("no overrides → catalogue", priceAtLocation(600, MAIN, []), 600);
expect("no overrides (null) → catalogue", priceAtLocation(600, MAIN, null), 600);
expect("branch base override wins", priceAtLocation(600, MAIN, overrides), 548);
expect("other branch override is independent", priceAtLocation(600, OTHER, overrides), 500);

// Unit precedence: unit row → branch base → catalogue unit price
expect("unit override wins over branch base", priceAtLocation(700, MAIN, overrides, UOM_STRIP), 1554);
expect("unit without override falls back to catalogue unit price", priceAtLocation(700, MAIN, overrides, UOM_CRATE), 700);
expect("unit override does not leak to another branch", priceAtLocation(700, OTHER, overrides, UOM_STRIP), 700);
expect("unit at a branch with no rows → catalogue unit price", priceAtLocation(700, "loc-none", overrides, UOM_STRIP), 700);

// Base lookup never picks a unit row, and vice versa
expect("base ignores unit-only rows", priceAtLocation(600, MAIN, [{ locationId: MAIN, productUomId: UOM_STRIP, price: 1554 }]), 600);
expect("unit ignores base-only rows", priceAtLocation(600, MAIN, [{ locationId: MAIN, price: 548 }], UOM_STRIP), 600);

// Defensive: a non-numeric override price must not become the charge
expect("NaN override → catalogue", priceAtLocation(600, MAIN, [{ locationId: MAIN, price: Number.NaN }]), 600);
expect("Infinity override → catalogue", priceAtLocation(600, MAIN, [{ locationId: MAIN, price: Number.POSITIVE_INFINITY }]), 600);

// hasBranchPrice mirrors resolution
expect("hasBranchPrice true when base differs", hasBranchPrice(600, MAIN, overrides), true);
expect("hasBranchPrice false when equal", hasBranchPrice(548, MAIN, overrides), false);
expect("hasBranchPrice true for unit override", hasBranchPrice(700, MAIN, overrides, UOM_STRIP), true);
expect("hasBranchPrice false for unit without override at priced branch", hasBranchPrice(548, MAIN, overrides, UOM_CRATE), false);

// Zero is a valid explicit price, not a missing one
expect("zero override is honoured", priceAtLocation(600, MAIN, [{ locationId: MAIN, price: 0 }]), 0);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll branch-pricing checks passed.");
