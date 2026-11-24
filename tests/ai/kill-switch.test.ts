import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../../src/lib/db";
import {
  AiDisabledError,
  assertAiEnabled,
  isAiDisabledGlobally,
  isAiEnabledForTenant,
} from "../../src/lib/ai/kill-switch";

/**
 * The kill switch has two levels. The global flag is pure environment state;
 * the tenant flag needs a row, so those cases are opt-in with RUN_DB_TESTS=1.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 to run database tests";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tenantId = `it-killswitch-${stamp}`;

const originalFlag = process.env.AI_DISABLED;

before(async () => {
  if (!RUN) return;
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: "Kill Switch Test",
      type: "RETAIL",
      email: `${tenantId}@example.test`,
      aiEnabled: false,
    },
  });
});

after(async () => {
  if (originalFlag === undefined) delete process.env.AI_DISABLED;
  else process.env.AI_DISABLED = originalFlag;
  if (!RUN) return;
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
});

test("the global flag understands the usual spellings", () => {
  for (const on of ["1", "true", "TRUE", " yes "]) {
    process.env.AI_DISABLED = on;
    assert.equal(isAiDisabledGlobally(), true, `${on} should disable`);
  }
  for (const off of ["", "0", "false", "no"]) {
    process.env.AI_DISABLED = off;
    assert.equal(isAiDisabledGlobally(), false, `${off} should not disable`);
  }
});

test("a tenant that switched AI off is refused", { skip }, async () => {
  delete process.env.AI_DISABLED;
  assert.equal(await isAiEnabledForTenant(tenantId), false);
  await assert.rejects(
    () => assertAiEnabled(tenantId),
    (err: unknown) => err instanceof AiDisabledError && err.code === "AI_DISABLED" && err.status === 503
  );
});

test("the global flag overrides a tenant that left AI on", { skip }, async () => {
  await db.tenant.update({ where: { id: tenantId }, data: { aiEnabled: true } });
  assert.equal(await isAiEnabledForTenant(tenantId), true);
  await assertAiEnabled(tenantId);

  process.env.AI_DISABLED = "true";
  assert.equal(await isAiEnabledForTenant(tenantId), false);
  await assert.rejects(() => assertAiEnabled(tenantId), AiDisabledError);
});
