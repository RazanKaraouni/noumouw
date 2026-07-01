import Redis from 'ioredis';

let client = null;
let warnedMemoryFallback = false;

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL?.trim());
}

export function getRedisClient() {
  if (!isRedisConfigured()) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error('[redis]', err?.message || err);
    });
  }
  return client;
}

export function warnMemoryFallbackOnce(context) {
  if (warnedMemoryFallback || isRedisConfigured()) return;
  warnedMemoryFallback = true;
  console.warn(
    `[${context}] REDIS_URL is not set — using in-memory fallback (not suitable for production).`,
  );
}
