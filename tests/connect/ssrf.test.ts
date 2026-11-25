import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeUrl, isBlockedHostName, isPrivateAddress } from "../../src/lib/connect/ssrf";
import { ConnectError } from "../../src/lib/connect/errors";

async function expectRejection(raw: string, code: string) {
  await assert.rejects(
    () => assertSafeUrl(raw),
    (error: unknown) => error instanceof ConnectError && error.code === code
  );
}

test("refuses plain http in production-like environments", async () => {
  delete process.env.CONNECT_ALLOW_INSECURE_LOCAL;
  await expectRejection("http://example.com", "CONNECT_URL_INSECURE");
});

test("refuses loopback, private and link-local hosts", async () => {
  await expectRejection("https://localhost", "CONNECT_URL_BLOCKED");
  await expectRejection("https://api.localhost", "CONNECT_URL_BLOCKED");
  await expectRejection("https://169.254.169.254/latest/meta-data", "CONNECT_URL_BLOCKED");
  await expectRejection("https://10.0.0.5", "CONNECT_URL_BLOCKED");
  await expectRejection("https://192.168.1.10", "CONNECT_URL_BLOCKED");
  await expectRejection("https://172.16.4.4", "CONNECT_URL_BLOCKED");
  await expectRejection("https://[::1]", "CONNECT_URL_BLOCKED");
});

test("refuses non-default ports", async () => {
  await expectRejection("https://example.com:8443/api", "CONNECT_URL_PORT_BLOCKED");
});

test("refuses credentials embedded in the URL", async () => {
  await expectRejection("https://user:pass@example.com", "CONNECT_URL_HAS_CREDENTIALS");
});

test("refuses internal suffixes", () => {
  assert.equal(isBlockedHostName("db.internal"), true);
  assert.equal(isBlockedHostName("printer.local"), true);
  assert.equal(isBlockedHostName("api.example.com"), false);
});

test("classifies private and public addresses", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("10.1.2.3"), true);
  assert.equal(isPrivateAddress("172.20.1.1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
  assert.equal(isPrivateAddress("::1"), true);
});
