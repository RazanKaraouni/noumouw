/**
 * Lightweight in-process TTL cache for read-heavy API paths.
 * Safe for single-node deployments; use Redis when running multiple instances.
 */
export function createTtlCache({ defaultTtlMs = 60_000, maxEntries = 500 } = {}) {
  /** @type {Map<string, { value: unknown, expiresAt: number }>} */
  const store = new Map();

  function pruneIfNeeded() {
    if (store.size < maxEntries) return;
    const firstKey = store.keys().next().value;
    if (firstKey != null) store.delete(firstKey);
  }

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    pruneIfNeeded();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async function getOrSet(key, ttlMs, factory) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    set(key, value, ttlMs);
    return value;
  }

  function invalidate(key) {
    store.delete(key);
  }

  function invalidatePrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  function clear() {
    store.clear();
  }

  return { get, set, getOrSet, invalidate, invalidatePrefix, clear };
}

/** Shared caches keyed by domain. */
export const apiCache = createTtlCache({ defaultTtlMs: 60_000, maxEntries: 1000 });
export const authTokenCache = createTtlCache({ defaultTtlMs: 120_000, maxEntries: 2000 });
