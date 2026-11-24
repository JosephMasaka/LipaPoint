import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore, UpstashStore, getCacheStore, setCacheStore, resetCacheStore } from "../../src/lib/cache-store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("memory store round-trips JSON values and honours TTL", async () => {
  const store = new MemoryStore();
  await store.set("a", { total: 42, label: "sale" }, 60);
  assert.deepEqual(await store.get("a"), { total: 42, label: "sale" });

  await store.set("short", "gone soon", 0.02);
  await sleep(40);
  assert.equal(await store.get("short"), null);
});

test("memory store deletes by prefix only", async () => {
  const store = new MemoryStore();
  await store.set("intel:t1:a", 1, 60);
  await store.set("intel:t1:b", 2, 60);
  await store.set("intel:t10:a", 3, 60);
  await store.deleteByPrefix("intel:t1:");
  assert.equal(await store.get("intel:t1:a"), null);
  assert.equal(await store.get("intel:t1:b"), null);
  assert.equal(await store.get("intel:t10:a"), 3);
});

test("memory store increments and resets after the window", async () => {
  const store = new MemoryStore();
  assert.equal(await store.increment("rl:u1", 0.02), 1);
  assert.equal(await store.increment("rl:u1", 0.02), 2);
  await sleep(40);
  assert.equal(await store.increment("rl:u1", 0.02), 1);
});

test("upstash store sends REST commands and parses results", async () => {
  const sent: string[][] = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)) as string[];
    sent.push(args);
    const [command] = args;
    if (command === "GET") return Response.json({ result: args[1] === "missing" ? null : JSON.stringify({ ok: true }) });
    if (command === "SCAN") return Response.json({ result: ["0", ["intel:t1:a", "intel:t1:b"]] });
    if (command === "INCR") return Response.json({ result: 2 });
    return Response.json({ result: "OK" });
  }) as unknown as typeof fetch;

  const store = new UpstashStore("https://cache.example/", "token", fetcher);
  assert.deepEqual(await store.get("k"), { ok: true });
  assert.equal(await store.get("missing"), null);
  await store.set("k", { ok: true }, 600);
  await store.deleteByPrefix("intel:t1:");
  assert.equal(await store.increment("rl:u1", 60), 2);

  const set = sent.find((c) => c[0] === "SET");
  assert.deepEqual(set, ["SET", "k", JSON.stringify({ ok: true }), "EX", 600]);
  assert.ok(sent.some((c) => c[0] === "DEL" && c.includes("intel:t1:a")));
  assert.equal(sent[0][0], "GET");
  // The URL is normalised: no double slash before the request.
  assert.equal(store.backend, "upstash");
});

test("upstash store surfaces command errors", async () => {
  const fetcher = (async () => Response.json({ error: "WRONGPASS" }, { status: 401 })) as unknown as typeof fetch;
  const store = new UpstashStore("https://cache.example", "token", fetcher);
  await assert.rejects(() => store.get("k"), /Upstash command GET failed/);
});

test("store selection follows the environment", () => {
  const previous = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetCacheStore();
    assert.equal(getCacheStore().backend, "memory");

    process.env.UPSTASH_REDIS_REST_URL = "https://cache.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    resetCacheStore();
    assert.equal(getCacheStore().backend, "upstash");
  } finally {
    if (previous.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previous.url;
    if (previous.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previous.token;
    setCacheStore(undefined);
    resetCacheStore();
  }
});
