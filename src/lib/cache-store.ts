/**
 * Small cache/limiter store used by the AI surfaces.
 *
 * Two backends, chosen by environment:
 * - Upstash Redis over its REST API when `UPSTASH_REDIS_REST_URL` and
 *   `UPSTASH_REDIS_REST_TOKEN` are set. Shared across every app instance, which
 *   is what a multi-instance deployment needs.
 * - Otherwise an in-process Map. Correct for one instance, and enough for local
 *   development, but it is per process — that is why the roadmap lists shared
 *   state as a prerequisite for scaling out.
 *
 * Values are JSON. REST is used directly with `fetch`, so no client library or
 * connection pool is needed.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Deletes every key starting with `prefix` (used for per-tenant invalidation). */
  deleteByPrefix(prefix: string): Promise<void>;
  /** Increments a counter, setting its TTL on the first increment. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  readonly backend: "upstash" | "memory";
}

const MAX_MEMORY_ENTRIES = 2000;

class MemoryStore implements CacheStore {
  readonly backend = "memory" as const;
  private entries = new Map<string, { value: unknown; expiresAt: number }>();

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Drop the oldest insertions if a busy process outgrows the cap.
    while (this.entries.size > MAX_MEMORY_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.sweep();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    this.sweep();
    const entry = this.entries.get(key);
    const now = Date.now();
    if (!entry || entry.expiresAt <= now) {
      this.entries.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = (entry.value as number) + 1;
    entry.value = next;
    return next;
  }

  /** Test helper: number of live entries. */
  size(): number {
    this.sweep();
    return this.entries.size;
  }
}

class UpstashStore implements CacheStore {
  readonly backend = "upstash" as const;

  constructor(
    private url: string,
    private token: string,
    private fetcher: typeof fetch = fetch
  ) {
    this.url = url.replace(/\/+$/, "");
  }

  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await this.fetcher(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Upstash command ${args[0]} failed with ${response.status}`);
    }
    const body = (await response.json()) as { result?: T; error?: string };
    if (body.error) throw new Error(`Upstash command ${args[0]} failed: ${body.error}`);
    return body.result as T;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.command<string | null>(["GET", key]);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.command(["SET", key, JSON.stringify(value), "EX", Math.max(1, Math.round(ttlSeconds))]);
  }

  async delete(key: string): Promise<void> {
    await this.command(["DEL", key]);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    let cursor = "0";
    do {
      const [next, keys] = await this.command<[string, string[]]>([
        "SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", 200,
      ]);
      cursor = next;
      if (keys.length > 0) await this.command(["DEL", ...keys]);
    } while (cursor !== "0");
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.command<number>(["INCR", key]);
    // A brand-new counter has no TTL yet; always (re)assert it so a crash
    // between INCR and EXPIRE cannot leave a key that never expires.
    if (count === 1 || count % 10 === 0) {
      await this.command(["EXPIRE", key, Math.max(1, Math.round(ttlSeconds))]);
    }
    return count;
  }
}

let store: CacheStore | undefined;

export function getCacheStore(): CacheStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  store = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return store;
}

/** Test seam: swap the store, then restore with `resetCacheStore()`. */
export function setCacheStore(next: CacheStore | undefined): void {
  store = next;
}

export function resetCacheStore(): void {
  store = undefined;
}

export { MemoryStore, UpstashStore };
