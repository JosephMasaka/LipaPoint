/**
 * Offline Mode policy + queue-contract check.
 *
 * Follows the repo's standalone-check convention (feature-registry.check.ts):
 *
 *   npx tsx offline-mode.check.ts
 *
 * Exit 0 = policy and contract hold, 1 = a regression (printed).
 *
 * What it pins:
 *  1. Offline Mode is free for every tenant on every plan — no tier, no
 *     module, no price, no revocable row.
 *  2. The queue replay contract: each action type maps to the right endpoint,
 *     failures are classified retry-vs-reject correctly, backoff grows and
 *     caps, claims/backoff/refusals make `isDue` answer correctly.
 *  3. The queue inspector describes stored records (including rows written by
 *     older builds, which lack `clientRef`/`attempts`) without losing them.
 *  4. No entitlement probe came back into the write path.
 */
import { readFileSync } from "node:fs";
import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  featuresForCategory,
  isFreeFeature,
} from "./src/lib/module-registry";
import {
  FEATURE_PRICES,
  formatFeaturePrice,
  getFeaturePrice,
  type BusinessCategory,
} from "./src/lib/plans";
import {
  OFFLINE_ACTION_TYPES,
  buildActionRequest,
  buildOrderRequest,
  classifyFailure,
  describeRecord,
  isDue,
  newClientRef,
  normalizeRecord,
  offlineActionLabel,
  retryDelayMs,
  type OfflineRecord,
} from "./src/lib/offline-sync";

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ *
 * 1. Free for everyone
 * ------------------------------------------------------------------ */
console.log("\n1. Offline Mode is free for every tenant");
const def = FEATURE_REGISTRY["offline-mode"];
check(def.free === true, "registry marks offline-mode free");
check(isFreeFeature("offline-mode"), "isFreeFeature(offline-mode)");
check(def.core === false, "free is distinct from core");
check(def.requires.length === 0, "no module/tier dependency (works without the POS module)");
check(def.softRequires === undefined, "no soft dependency either");
check(FEATURE_KEYS.filter((k) => isFreeFeature(k)).length === 1, "exactly one free feature");

const price = getFeaturePrice("offline-mode");
check(price !== null && price.monthly === 0, "à la carte price is 0", JSON.stringify(price));
check(!price?.includedWith, "not bundled behind another paid feature");
check(formatFeaturePrice("offline-mode") === "Free", `pricing surfaces say "Free" (got ${formatFeaturePrice("offline-mode")})`);
check(
  Object.entries(FEATURE_PRICES).every(([k, p]) => !FEATURE_REGISTRY[k as "offline-mode"].free || p.monthly === 0),
  "no price entry can make a free feature paid"
);

// Every vertical sees it (mistaken applicableCategories would hide it in the
// Apps screen for some businesses).
const categories: BusinessCategory[] = [
  "RETAIL_GENERAL",
  "RESTAURANT_HOSPITALITY",
  "BARBERSHOP_SALON",
  "HEALTHCARE_PHARMACY",
  "FINANCE",
  "LOGISTICS_WAREHOUSING",
  "PROFESSIONAL_SERVICES",
];
check(
  categories.every((c) => featuresForCategory(c).includes("offline-mode")),
  "listed for every business category"
);

// The entitlement engine must not be able to revoke it.
const featuresSource = readFileSync("src/lib/features.ts", "utf8");
check(
  /def\.core \|\| def\.free/.test(featuresSource),
  "revokeFeature refuses free features"
);
check(
  /isFreeFeature\(featureKey\)\) return true/.test(featuresSource),
  "isFeatureEnabled short-circuits free features before any DB read"
);
check(
  /if \(isFreeFeature\(key\)\) \{\s*out\.add\(key\);\s*continue;/.test(featuresSource),
  "getEffectiveEnabledFeatures always includes free features"
);
const offlineDbSource = readFileSync("src/lib/offline-db.ts", "utf8");
check(
  !/offline-entitlement|isOfflineQueueEnabled|OfflineModeRequiredError/.test(offlineDbSource),
  "the write path has no entitlement gate left"
);
check(
  readFileSync("src/app/api/features/route.ts", "utf8").includes(
    "free: FEATURE_REGISTRY[key].free === true"
  ),
  "GET /api/features tells the Apps screen which features are free"
);

/* ------------------------------------------------------------------ *
 * 2. Replay contract
 * ------------------------------------------------------------------ */
console.log("\n2. Replay contract");
const expected: Record<string, { url: string; method: string }> = {
  stock_add: { url: "/api/stock", method: "POST" },
  stock_initialize: { url: "/api/stock", method: "POST" },
  tab_open: { url: "/api/orders/tabs", method: "POST" },
  tab_add: { url: "/api/orders/tabs", method: "PUT" },
  expense_add: { url: "/api/expenses", method: "POST" },
  unit_create: { url: "/api/units", method: "POST" },
  unit_conversion: { url: "/api/units", method: "PUT" },
  product_create: { url: "/api/products", method: "POST" },
  product_update: { url: "/api/products/p1", method: "PUT" },
  location_add: { url: "/api/locations", method: "POST" },
  location_update: { url: "/api/locations", method: "PUT" },
  user_create: { url: "/api/users", method: "POST" },
  user_toggle: { url: "/api/users/u1", method: "PATCH" },
  user_delete: { url: "/api/users/u1", method: "DELETE" },
  role_create: { url: "/api/roles", method: "POST" },
  role_update: { url: "/api/roles", method: "PUT" },
  settings_update: { url: "/api/settings", method: "PUT" },
};

let mappingProblems = 0;
for (const type of OFFLINE_ACTION_TYPES) {
  const request = buildActionRequest(type, { _productId: "p1", _userId: "u1" });
  const want = expected[type];
  if (!request || !want || request.url !== want.url || request.method !== want.method) {
    mappingProblems++;
    console.error(`    ${type}: got ${JSON.stringify(request)}, want ${JSON.stringify(want)}`);
  }
}
check(mappingProblems === 0, `all ${OFFLINE_ACTION_TYPES.length} action types replay to the right endpoint`);
check(
  Object.keys(expected).length === OFFLINE_ACTION_TYPES.length,
  "the check covers every action type (no silent gaps)"
);
check(buildActionRequest("nonsense", {}) === null, "unknown action types are refused, not posted somewhere");
check(
  buildActionRequest("stock_add", { productId: "p", quantity: 2 })?.body?.action === "addStock",
  "stock_add keeps its action envelope"
);
check(
  buildActionRequest("user_toggle", { _userId: "u1", isActive: false })?.body?.isActive === false,
  "user_toggle sends only the fields the endpoint accepts"
);
check(
  buildOrderRequest({ total: 10 }).url === "/api/orders" &&
    buildOrderRequest({ total: 10 }).method === "POST",
  "sales replay to POST /api/orders"
);

/* ------------------------------------------------------------------ *
 * 3. Failure handling and retry timing
 * ------------------------------------------------------------------ */
console.log("\n3. Failure handling");
check(classifyFailure(500) === "retry", "500 retries");
check(classifyFailure(503) === "retry", "503 retries");
check(classifyFailure(408) === "retry", "408 retries");
check(classifyFailure(429) === "retry", "429 retries");
for (const status of [400, 401, 403, 404, 409, 422]) {
  check(classifyFailure(status) === "reject", `${status} is a permanent refusal`);
}
check(retryDelayMs(1) === 10_000, "first retry waits 10s");
check(retryDelayMs(2) === 20_000, "second retry waits 20s");
check(retryDelayMs(3) === 40_000, "backoff doubles");
check(retryDelayMs(4) === 80_000, "backoff keeps doubling up to the cap");
check(retryDelayMs(99) === 2 * 60 * 1000, "backoff caps at 2 minutes");
check(retryDelayMs(0) === 10_000, "attempt 0 behaves like a first retry");

const base: OfflineRecord = {
  id: 1,
  data: {},
  createdAt: new Date().toISOString(),
  clientRef: "ref-1",
  attempts: 0,
};
const now = Date.now();
check(isDue(base, now), "a fresh record is due");
check(!isDue({ ...base, nextAttemptAt: new Date(now + 60_000).toISOString() }, now), "backoff defers it");
check(isDue({ ...base, nextAttemptAt: new Date(now - 1).toISOString() }, now), "due again once backoff lapses");
check(
  !isDue({ ...base, rejectedAt: new Date().toISOString(), rejectReason: "price floor" }, now),
  "a refused record is never retried automatically"
);
check(
  !isDue({ ...base, syncingAt: new Date(now - 5_000).toISOString() }, now),
  "a live claim keeps other workers off it"
);
check(
  isDue({ ...base, syncingAt: new Date(now - 3 * 60_000).toISOString() }, now),
  "a stale claim is reclaimable (crashed worker can't park a sale)"
);

/* ------------------------------------------------------------------ *
 * 4. Queue records and labels
 * ------------------------------------------------------------------ */
console.log("\n4. Queue records");
const legacy = {
  id: 7,
  data: { orderNo: "OFF-1", total: 1250 },
  createdAt: new Date(Date.now() - 60_000).toISOString(),
} as unknown as OfflineRecord;
const normalized = normalizeRecord(legacy);
check(normalized.attempts === 0, "legacy record gains attempts=0");
check(normalized.clientRef.startsWith("legacy-7-"), "legacy record gets a stable clientRef", normalized.clientRef);
check(
  normalizeRecord(legacy).clientRef === normalized.clientRef,
  "the legacy clientRef is stable across replays"
);
check(newClientRef() !== newClientRef(), "new clientRefs are unique");
check(
  /^[A-Za-z0-9:._-]{8,200}$/.test(normalized.clientRef),
  "clientRef passes the server's idempotency-key validation"
);

const sale = describeRecord("offline-orders", normalized);
check(sale?.label === "Sale OFF-1", `sale is labelled by order number (got ${sale?.label})`);
check(sale?.amount === 1250, "sale shows its amount");
check(sale?.status === "queued", "a fresh sale is queued");

const refused = describeRecord("offline-orders", {
  ...normalized,
  rejectedAt: new Date().toISOString(),
  rejectReason: "Price is below the till's floor",
});
check(refused?.status === "needs-attention", "a refused sale needs attention");
check(
  refused?.detail === "Price is below the till's floor",
  "the server's reason is shown to the cashier"
);

const waiting = describeRecord("offline-actions", {
  ...normalized,
  type: "stock_add",
  attempts: 2,
  nextAttemptAt: new Date(Date.now() + 30_000).toISOString(),
  lastError: "No connection to the server",
});
check(waiting?.status === "retrying", "a record in backoff is retrying");
check(waiting?.label === "Stock received", "actions use human labels");
check(
  offlineActionLabel("nonsense") === "Offline change",
  "unknown action types still get a safe label"
);

/* ------------------------------------------------------------------ */
console.log(
  failures === 0
    ? "\nAll offline-mode policy and queue-contract checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
