import { getRedisClient, isRedisConfigured, warnMemoryFallbackOnce } from '../config/redis.js';

const OTP_PREFIX = 'otp:';
const memoryStore = new Map();

/** All OTP codes expire after 60 seconds. */
export const OTP_TTL_SECONDS = 60;
export const OTP_CONFIRM_WINDOW_MS = OTP_TTL_SECONDS * 1000;

function prefixedKey(key) {
  const k = String(key || '').trim();
  return k.startsWith(OTP_PREFIX) ? k : `${OTP_PREFIX}${k}`;
}

function pruneMemoryExpired() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAtMs <= now) memoryStore.delete(key);
  }
}

/**
 * @param {string} key Logical key (will be prefixed with otp:)
 * @param {object} value JSON-serializable pending payload
 * @param {number} ttlSeconds Default 60 seconds
 */
export async function setOtp(key, value, ttlSeconds = OTP_TTL_SECONDS) {
  const redisKey = prefixedKey(key);
  const payload = JSON.stringify(value);

  const redis = getRedisClient();
  if (redis) {
    await redis.set(redisKey, payload, 'EX', ttlSeconds);
    return;
  }

  warnMemoryFallbackOnce('otpStore');
  pruneMemoryExpired();
  memoryStore.set(redisKey, {
    value,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  });
}

/** @returns {Promise<object|null>} */
export async function getOtp(key) {
  const redisKey = prefixedKey(key);
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(redisKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  pruneMemoryExpired();
  const entry = memoryStore.get(redisKey);
  if (!entry) return null;
  if (entry.expiresAtMs <= Date.now()) {
    memoryStore.delete(redisKey);
    return null;
  }
  return entry.value;
}

export async function deleteOtp(key) {
  const redisKey = prefixedKey(key);
  const redis = getRedisClient();
  if (redis) {
    await redis.del(redisKey);
    return;
  }
  memoryStore.delete(redisKey);
}

export { isRedisConfigured };
