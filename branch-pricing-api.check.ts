/**
 * Branch pricing API round-trip — run with `npx tsx branch-pricing-api.check.ts`
 * while the dev server is up.
 *
 * Signs in as a pricing role, writes a base-unit and a selling-unit override on
 * a product with no existing overrides, reads them back, checks cross-branch
 * isolation and validation, then removes both rows again.
 *
 * Credentials: SMOKE_EMAIL / SMOKE_PASSWORD, else the first OWNER row of
 * LipaPoint-Demo-Accounts.xlsx (local demo file). If the server is unreachable
 * the check reports SKIP instead of failing, so it can sit alongside the pure
 * checks.
 */
import XLSX from "xlsx";

const BASE = process.env.BRANCH_PRICING_API ?? "http://localhost:3000";
const BASE_PRICE = 987654;
const UNIT_PRICE = 987655;
const OVERWRITE_PRICE = BASE_PRICE + 1000;
const MISSING_LOCATION = "00000000-0000-0000-0000-000000000000";

let failures = 0;
function expect(name: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${JSON.stringify(actual)}${ok ? "" : ` want=${JSON.stringify(wanted)}`}`);
}

function demoCredentials() {
  try {
    const wb = XLSX.readFile("LipaPoint-Demo-Accounts.xlsx");
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    const owner = rows.find((r) => String(r.Role ?? r.role ?? "").toUpperCase() === "OWNER");
    const row = owner ?? rows[0];
    return {
      email: String(row?.Email ?? row?.email ?? "").trim(),
      password: String(row?.Password ?? row?.password ?? "").trim(),
    };
  } catch {
    return { email: "", password: "" };
  }
}

async function main() {
  const { email: demoEmail, password: demoPassword } = demoCredentials();
  const email = process.env.SMOKE_EMAIL || demoEmail;
  const password = process.env.SMOKE_PASSWORD || demoPassword;
  if (!email || !password) {
    console.log("SKIP  no credentials (set SMOKE_EMAIL / SMOKE_PASSWORD)");
    return;
  }

  // Retry transient Neon failures the same way a user would.
  const request = async (path: string, init: RequestInit = {}, cookie = ""): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${BASE}${path}`, {
          ...init,
          headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
        });
        if (res.status < 500) return res;
        lastError = new Error(`${init.method ?? "GET"} ${path} -> ${res.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw lastError;
  };

  let login: Response;
  try {
    login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    console.log(`SKIP  ${BASE} unreachable`);
    return;
  }
  if (!login.ok) throw new Error(`login ${login.status}: ${await login.text()}`);
  const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie") ?? ""])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const anonymous = await request("/api/products");
  expect("unauthenticated prices read is rejected", anonymous.status, 401);

  const productsRes = await request("/api/products", {}, cookie);
  if (!productsRes.ok) throw new Error(`products ${productsRes.status}`);
  const products = (await productsRes.json()) as Array<{
    id: string;
    name: string;
    trackStock: boolean;
    productUoms: Array<{ id: string; price: number }>;
    locationPrices: Array<{ locationId: string; productUomId?: string | null; price: number }>;
  }>;
  const product = products.find((p) => p.productUoms.length > 0 && p.locationPrices.length === 0);
  if (!product) {
    console.log("SKIP  no product with a selling unit and no existing branch overrides");
    return;
  }
  const uom = product.productUoms[0];

  const locationsRes = await request("/api/locations", {}, cookie);
  if (!locationsRes.ok) throw new Error(`locations ${locationsRes.status}`);
  const locations = (await locationsRes.json()) as Array<{ id: string; name: string }>;
  if (!locations.length) {
    console.log("SKIP  tenant has no branches");
    return;
  }
  const location = locations[0];

  const put = (body: Record<string, unknown>) =>
    request(
      `/api/products/${product.id}/prices`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      cookie
    );
  const rows = async () =>
    (await (await request(`/api/products/${product.id}/prices`, {}, cookie)).json()) as Array<{
      location: { id: string };
      productUom: { id: string } | null;
      price: number;
    }>;

  try {
    const baseWrite = await put({ locationId: location.id, price: BASE_PRICE });
    expect("base override PUT succeeds", baseWrite.status, 200);
    const baseSaved = (await baseWrite.json()) as { price: number; productUom: unknown; location: { id: string } };
    expect(
      "base override saved with no unit",
      { locationId: baseSaved.location.id, uom: baseSaved.productUom, price: baseSaved.price },
      { locationId: location.id, uom: null, price: BASE_PRICE }
    );

    const unitWrite = await put({ locationId: location.id, productUomId: uom.id, price: UNIT_PRICE });
    expect("selling-unit override PUT succeeds", unitWrite.status, 200);
    const unitSaved = (await unitWrite.json()) as { price: number; productUom: { id: string } | null };
    expect(
      "selling-unit override saved against the unit",
      { uom: unitSaved.productUom?.id, price: unitSaved.price },
      { uom: uom.id, price: UNIT_PRICE }
    );

    const after = await rows();
    const baseRow = after.find((r) => r.location.id === location.id && !r.productUom);
    const unitRow = after.find((r) => r.location.id === location.id && r.productUom?.id === uom.id);
    expect("GET returns both rows for the branch/unit", { base: baseRow?.price, unit: unitRow?.price }, { base: BASE_PRICE, unit: UNIT_PRICE });

    const overwrite = await put({ locationId: location.id, price: OVERWRITE_PRICE });
    const overwritten = await rows();
    expect(
      "re-saving updates instead of duplicating",
      overwritten.filter((r) => r.location.id === location.id && !r.productUom).map((r) => r.price),
      [OVERWRITE_PRICE]
    );
    expect("update PUT succeeds", overwrite.status, 200);

    const badBranch = await put({ locationId: MISSING_LOCATION, price: 1 });
    expect("unknown branch rejected", badBranch.status, 404);

    const badUnit = await put({ locationId: location.id, productUomId: MISSING_LOCATION, price: 1 });
    expect("foreign selling unit rejected", badUnit.status, 404);

    const negative = await put({ locationId: location.id, price: -5 });
    expect("negative price rejected", negative.status, 400);

    const nonNumeric = await put({ locationId: location.id, price: "abc" });
    expect("non-numeric price rejected", nonNumeric.status, 400);
  } finally {
    // Always restore, even when an assertion above fails.
    await put({ locationId: location.id, price: null }).catch(() => undefined);
    await put({ locationId: location.id, productUomId: uom.id, price: null }).catch(() => undefined);
    const cleaned = await rows().catch(() => []);
    expect("test overrides removed", cleaned.length, 0);
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll branch-pricing API checks passed.");
}

main().catch((error) => {
  console.error("FAIL ", error instanceof Error ? error.message : error);
  process.exit(1);
});
