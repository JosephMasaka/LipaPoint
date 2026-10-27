/**
 * Policy check for the paid `offline-mode` entitlement (sub-feature spec
 * §1/§9 step 8) — the cache/fallback logic the offline write queue relies on.
 *
 * Follows the feature-registry.check.ts / report-engine.*.check.* convention:
 *
 *   npx tsx offline-entitlement.check.ts
 *
 * Exit 0 = policy holds, 1 = a regression (printed). Runs in Node with
 * localStorage/fetch polyfilled, so it exercises src/lib/offline-entitlement
 * exactly as the browser would.
 *
 * Documented policy:
 *  - fresh cache (≤5 min)   → trusted as-is, no network call
 *  - stale/absent cache     → refresh; the API answer wins
 *  - refresh can't reach API → last known value; `true` if we never had one
 *                              (fail open: never lose a sale to a stale cache)
 */

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

type Mode = "enabled" | "disabled" | "error";
let fetchMode: Mode = "enabled";
let fetchCalls = 0;
(globalThis as { fetch?: unknown }).fetch = async () => {
  fetchCalls++;
  if (fetchMode === "error") throw new Error("network down");
  const enabled =
    fetchMode === "enabled"
      ? ["offline-mode", "core-till", "payroll"]
      : ["core-till", "payroll"];
  return { ok: true, json: async () => ({ enabled }) };
};

let failures = 0;
function expect(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label} (got ${String(got)}, want ${String(want)})`);
}

const ENABLED = "lipapoint-offline-mode-enabled";
const STAMP = "lipapoint-offline-mode-checked-at";
const seed = (value: "0" | "1", ageMs = 0) => {
  store.clear();
  store.set(ENABLED, value);
  store.set(STAMP, String(Date.now() - ageMs));
};

async function main() {
  const { isOfflineQueueEnabled, refreshOfflineEntitlement } = await import(
    "./src/lib/offline-entitlement"
  );

  // 1. cold cache, server says entitled
  store.clear();
  fetchMode = "enabled";
  expect("no cache + API says enabled → queue allowed", await isOfflineQueueEnabled(), true);
  expect("answer was cached", store.get(ENABLED), "1");

  // 2. fresh cache is trusted without a network round-trip
  seed("1");
  fetchCalls = 0;
  fetchMode = "error";
  expect("fresh cache → answer returned", await isOfflineQueueEnabled(), true);
  expect("fresh cache short-circuits the network", fetchCalls, 0);

  // 3. stale cache, API says disabled → tightened
  seed("1", 10 * 60 * 1000);
  fetchMode = "disabled";
  expect("stale enabled cache + API disabled → refused", await isOfflineQueueEnabled(), false);
  expect("result cached as disabled", store.get(ENABLED), "0");

  // 4/5. offline with the last known answer
  seed("0");
  fetchMode = "error";
  expect("offline + cached disabled → refused", await isOfflineQueueEnabled(), false);
  seed("1");
  expect("offline + cached enabled → allowed", await isOfflineQueueEnabled(), true);

  // 6. offline, never fetched before → fail open so a sale still queues
  store.clear();
  expect("offline + no cache at all → fail open", await isOfflineQueueEnabled(), true);

  // 7. explicit refresh: API unreachable → last known value
  seed("1");
  fetchMode = "error";
  expect("refresh + network error → last known enabled", await refreshOfflineEntitlement(), true);
  seed("0");
  expect("refresh + network error → last known disabled", await refreshOfflineEntitlement(), false);

  // 8. explicit refresh: API reachable → API wins both ways
  seed("0", 10 * 60 * 1000);
  fetchMode = "enabled";
  expect("refresh + API enabled → granted", await refreshOfflineEntitlement(), true);
  seed("1", 10 * 60 * 1000);
  fetchMode = "disabled";
  expect("refresh + API disabled → revoked", await refreshOfflineEntitlement(), false);

  console.log(
    failures === 0
      ? "\nAll offline entitlement policy checks passed.\n"
      : `\n${failures} check(s) FAILED.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();