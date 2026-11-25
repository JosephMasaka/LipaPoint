import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMaskedHint,
  decryptSecrets,
  encryptSecrets,
  maskValue,
  sanitizeSecretValues,
} from "../../src/lib/connect/credentials";

// Read lazily by src/lib/crypto.ts, so setting it before the tests run is enough.
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("round-trips credentials through AES-256-GCM", () => {
  const secrets = { authType: "API_KEY" as const, values: { apiKey: "sk-live-123456" } };
  const encoded = encryptSecrets(secrets);

  assert.notEqual(encoded, JSON.stringify(secrets));
  assert.equal(encoded.includes("sk-live-123456"), false);

  const decoded = decryptSecrets(encoded);
  assert.deepEqual(decoded, secrets);
});

test("the same secret encrypts differently each time (random IV)", () => {
  const secrets = { authType: "BEARER" as const, values: { token: "abc" } };
  assert.notEqual(encryptSecrets(secrets), encryptSecrets(secrets));
});

test("masked hints never expose the secret", () => {
  assert.equal(maskValue("sk-live-123456"), "••••3456");
  assert.equal(buildMaskedHint({ authType: "BASIC", values: { username: "", password: "" } }), null);
  const hint = buildMaskedHint({ authType: "API_KEY", values: { apiKey: "super-secret-value" } });
  assert.equal(hint?.includes("super-secret"), false);
});

test("sanitising drops empty values and non-string input", () => {
  const values = sanitizeSecretValues({
    apiKey: "  key-1234  ",
    token: "",
    nested: { secret: "x" },
    password: 12345,
  });
  assert.deepEqual(values, { apiKey: "key-1234" });
});

test("fails loudly without an encryption key", () => {
  const saved = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptSecrets({ authType: "NONE", values: {} }), /ENCRYPTION_KEY/);
  } finally {
    process.env.ENCRYPTION_KEY = saved;
  }
});
