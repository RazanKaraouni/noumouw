import { writeAuditLog } from './auditLogService.js';

const FAILED_LOGIN_WINDOW_MS = 5 * 60 * 1000;
const FAILED_LOGIN_ALERT_THRESHOLD = 10;

/** @type {Map<string, { count: number, windowStart: number }>} */
const failedLoginByIp = new Map();

/**
 * @param {string | null | undefined} ip
 */
function trackFailedLoginBurst(ip) {
  const key = ip != null && String(ip).trim() ? String(ip).trim() : null;
  if (!key) return;

  const now = Date.now();
  let entry = failedLoginByIp.get(key);
  if (!entry || now - entry.windowStart > FAILED_LOGIN_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
  }
  entry.count += 1;
  failedLoginByIp.set(key, entry);

  if (entry.count > FAILED_LOGIN_ALERT_THRESHOLD) {
    console.error(
      `[SECURITY ALERT] More than ${FAILED_LOGIN_ALERT_THRESHOLD} failed login attempts from IP ${key} in 5 minutes.`,
    );
    // TODO: Send alert to Slack/email once alerting integration is configured.
  }
}

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

/**
 * @param {{
 *   userId?: string | number | null,
 *   ip?: string | null,
 *   outcome: 'success' | 'failed_password' | 'suspended' | 'invalid_token',
 *   details?: string | null,
 * }} event
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function logAuthEvent({ userId = null, ip = null, outcome, details = null }) {
  if (outcome === 'failed_password') {
    trackFailedLoginBurst(ip);
  }

  const userIdStr = userId != null && String(userId).trim() ? String(userId) : null;
  const ipStr = ip != null && String(ip).trim() ? String(ip).slice(0, 64) : null;
  const detailsStr = details != null ? String(details).slice(0, 500) : null;

  await writeAuditLog({
    event_type: `auth_${outcome}`,
    actor_id: userIdStr && UUID_RE.test(userIdStr) ? userIdStr : null,
    target_table: 'auth',
    target_id: userIdStr,
    metadata: {
      outcome,
      ip_address: ipStr,
      details: detailsStr,
      user_id: userIdStr,
    },
  });
}

/** First 8 chars of a bearer token for correlation — never log full tokens. */
export function tokenCorrelationPrefix(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  return t.length <= 8 ? t : t.slice(0, 8);
}
