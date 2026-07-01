import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConfigured } from '../config/redis.js';

const WINDOW_MS = 15 * 60 * 1000;

function buildStore(prefix) {
  if (!isRedisConfigured()) return undefined;
  const client = getRedisClient();
  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
    prefix: `rl:${prefix}:`,
  });
}

function createLimiter({ windowMs, max, prefix, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(prefix),
    handler: (_req, res) => {
      res.status(429).json(message);
    },
  });
}

/** Global cap for all /api routes. */
export const globalApiRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 100,
  prefix: 'api-global',
  message: { error: 'Too many requests, please try again later.' },
});

/** Stricter cap for portal login and auth endpoints. */
export const authRouterRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 10,
  prefix: 'api-auth',
  message: { error: 'Too many requests, please try again later.' },
});

/** Brute-force protection for portal login (bcrypt + JWT). */
export const loginRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 10,
  prefix: 'login',
  message: { message: 'Too many login attempts. Please try again later.' },
});

/** OTP signup / verify / resend abuse protection. */
export const signupRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 8,
  prefix: 'signup',
  message: { message: 'Too many signup attempts. Please try again later.' },
});

export const verifyOtpRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 12,
  prefix: 'verify-otp',
  message: { message: 'Too many verification attempts. Please try again later.' },
});

export const resendOtpRateLimiter = createLimiter({
  windowMs: WINDOW_MS,
  max: 5,
  prefix: 'resend-otp',
  message: { message: 'Too many OTP resend requests. Please try again later.' },
});
