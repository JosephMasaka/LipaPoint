/**
 * Throwaway check for src/lib/price-override.ts — run with `npx tsx price-override.check.ts`.
 */
import {
  priceFloor,
  supplierCostPerUnit,
  resolveLinePrice,
  type PricePolicy,
} from "./src/lib/price-override";

let failures = 0;
function expect(name: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${JSON.stringify(actual)}${ok ? "" : ` want=${JSON.stringify(wanted)}`}`);
}

const policy = (enabled: boolean, mode: string, value: number): PricePolicy => ({
  priceOverrideEnabled: enabled,
  priceFloorMode: mode,
  priceFloorValue: value,
});

// Tolerance floors
expect("10% off 1000 → floor 900", priceFloor(1000, policy(true, "PERCENT", 10)), 900);
expect("flat 100 off 1000 → floor 900", priceFloor(1000, policy(true, "AMOUNT", 100)), 900);
expect("0% → floor = set price", priceFloor(1000, policy(true, "PERCENT", 0)), 1000);
expect("flat 5000 off 1000 → floor 0 (clamped)", priceFloor(1000, policy(true, "AMOUNT", 5000)), 0);

// Supplier cost derivation
expect("base cost × conversion", supplierCostPerUnit(50, 12, 0), 600);
expect("explicit uom cost wins", supplierCostPerUnit(50, 12, 540), 540);
expect("missing cost → 0", supplierCostPerUnit(0, 1, null), 0);

// 1. Override disabled → catalog price always, even if the client asks lower
let r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: 500,
  trackStock: true, supplierCost: 600, policy: policy(false, "PERCENT", 20),
});
expect("disabled: clamped to set price", { ok: r.ok, price: r.unitPrice }, { ok: true, price: 760 });

// 2. Enabled, within tolerance
r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: 700,
  trackStock: true, supplierCost: 600, policy: policy(true, "PERCENT", 10),
});
expect("10% tolerance → 700 accepted (floor 684)", { ok: r.ok, price: r.unitPrice, min: r.minPrice }, { ok: true, price: 700, min: 684 });

// 3. Enabled, below tolerance → rejected with a min
r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: 650,
  trackStock: true, supplierCost: 600, policy: policy(true, "PERCENT", 10),
});
expect("below tolerance → rejected", { ok: r.ok, min: r.minPrice }, { ok: false, min: 684 });

// 4. Supplier floor beats the tolerance
r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: 690,
  trackStock: true, supplierCost: 720, policy: policy(true, "PERCENT", 10),
});
expect("supplier 720 > floor 684 → min 720, rejected", { ok: r.ok, min: r.minPrice }, { ok: false, min: 720 });
expect("message names the supplier price", (r.error || "").includes("supplier price of 720.00"), true);

// 5. Non-stock item: no supplier floor
r = resolveLinePrice({
  itemName: "Consulting", setPrice: 1000, requestedPrice: 550,
  trackStock: false, supplierCost: 900, policy: policy(true, "AMOUNT", 500),
});
expect("no stock → supplier cost ignored", { ok: r.ok, price: r.unitPrice }, { ok: true, price: 550 });

// 6. Above the set price is always fine
r = resolveLinePrice({
  itemName: "Rare item", setPrice: 100, requestedPrice: 250,
  trackStock: true, supplierCost: 40, policy: policy(true, "PERCENT", 0),
});
expect("markup accepted", { ok: r.ok, price: r.unitPrice, overridden: r.overridden }, { ok: true, price: 250, overridden: false });

// 7. Exactly at the floor is allowed
r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: 684,
  trackStock: true, supplierCost: 600, policy: policy(true, "PERCENT", 10),
});
expect("exactly at floor → accepted, flagged overridden", { ok: r.ok, price: r.unitPrice, overridden: r.overridden }, { ok: true, price: 684, overridden: true });

// 8. Missing requested price → set price
r = resolveLinePrice({
  itemName: "Indomie", setPrice: 760, requestedPrice: null,
  trackStock: true, supplierCost: 600, policy: policy(true, "PERCENT", 10),
});
expect("no request → set price", { ok: r.ok, price: r.unitPrice }, { ok: true, price: 760 });

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll price-override checks passed.");
