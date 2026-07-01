import jwt from 'jsonwebtoken';

// SERVICE ROLE: justified because verifyBearerToken calls auth.getUser with the service client.
import supabase from '../config/supabase.js';
import blocklistGuard from './blocklistGuard.js';
import { isAccountSuspended } from '../services/suspensionCheckService.js';
import {
  logAuthEvent,
  requestIp,
  tokenCorrelationPrefix,
} from '../services/authAuditService.js';
import { authTokenCache } from '../utils/ttlCache.js';

const SUPABASE_AUTH_CACHE_TTL_MS = 120_000;

/**
 * @typedef {'admin'|'therapist'|'parent'} AuthRole
 * @typedef {{
 *   userId: string,
 *   role: AuthRole,
 *   email: string,
 *   adminId?: string,
 *   therapistId?: string,
 *   parentUserId?: string,
 *   displayName?: string,
 * }} RequestAuth
 */

export function parseBearerToken(req) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) return null;
  return hdr.slice(7).trim();
}

/**
 * @param {string} rawToken
 * @param {{ allowSupabase?: boolean }} [options]
 */
export async function verifyBearerToken(rawToken, { allowSupabase = true } = {}) {
  const token = String(rawToken || '').trim();
  if (!token) return null;

  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const role = String(decoded?.role || '').toLowerCase();

      if (role === 'therapist') {
        const therapistId = decoded.therapist_id || decoded.id;
        if (!therapistId) return null;
        return {
          userId: therapistId,
          role: 'therapist',
          therapistId,
          email: decoded.email || '',
          displayName: decoded.full_name || '',
          raw: decoded,
        };
      }

      if (role === 'admin') {
        const adminId = decoded.admin_id || decoded.id;
        if (!adminId) return null;
        return {
          userId: adminId,
          role: 'admin',
          adminId,
          email: decoded.email || '',
          displayName: decoded.full_name || '',
          raw: decoded,
        };
      }

      const parentUserId =
        decoded.parent_user_id || decoded.user_id || decoded.id || decoded.sub;
      if (parentUserId) {
        return {
          userId: parentUserId,
          role: 'parent',
          parentUserId,
          email: decoded.email || '',
          raw: decoded,
        };
      }
    } catch {
      /* fall through to Supabase when allowed */
    }
  }

  if (!allowSupabase) return null;

  const cacheKey = `supabase:${token}`;
  const cached = authTokenCache.get(cacheKey);
  if (cached) return cached;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (!error && user?.id) {
      const verified = {
        userId: user.id,
        role: 'parent',
        parentUserId: user.id,
        email: user.email || '',
        raw: { role: 'parent', id: user.id },
      };
      authTokenCache.set(cacheKey, verified, SUPABASE_AUTH_CACHE_TTL_MS);
      return verified;
    }
  } catch {
    return null;
  }

  return null;
}

/** @param {import('express').Request} req */
function applyAuth(req, verified) {
  /** @type {RequestAuth} */
  const auth = {
    userId: verified.userId,
    role: verified.role,
    email: verified.email || '',
  };

  if (verified.role === 'admin') {
    auth.adminId = verified.adminId || verified.userId;
  }
  if (verified.role === 'therapist') {
    auth.therapistId = verified.therapistId || verified.userId;
    auth.displayName = verified.displayName || '';
  }
  if (verified.role === 'parent') {
    auth.parentUserId = verified.parentUserId || verified.userId;
  }

  req.auth = auth;
}

/** Reject suspended therapist/parent accounts (401). */
export async function rejectIfSuspended(auth, res, req) {
  try {
    if (await isAccountSuspended(auth)) {
      void logAuthEvent({
        userId: auth?.userId,
        ip: requestIp(req),
        outcome: 'suspended',
        details: `token auth role=${auth?.role || 'unknown'}`,
      });
      res.status(401).json({ error: 'Account suspended' });
      return true;
    }
  } catch (err) {
    console.error('[auth] suspension check failed:', err?.message || err);
    res.status(401).json({ message: 'Token verification failed.' });
    return true;
  }
  return false;
}

async function authenticateWithOptions(req, res, next, { allowSupabase }) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  try {
    const verified = await verifyBearerToken(token, { allowSupabase });
    if (!verified) {
      void logAuthEvent({
        ip: requestIp(req),
        outcome: 'invalid_token',
        details: `prefix:${tokenCorrelationPrefix(token)}`,
      });
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    applyAuth(req, verified);
    req.accessToken = token;
    if (await rejectIfSuspended(req.auth, res, req)) return;
    return blocklistGuard(req, res, next);
  } catch (err) {
    console.error('[auth]', err?.message || err);
    return res.status(401).json({ message: 'Token verification failed.' });
  }
}

/** JWT (portal) or Supabase parent session. */
export function authenticate(req, res, next) {
  return authenticateWithOptions(req, res, next, { allowSupabase: true });
}

/** App-issued JWT only (admin / therapist / parent signup token). */
export function authenticateJwt(req, res, next) {
  return authenticateWithOptions(req, res, next, { allowSupabase: false });
}

export function requireRole(...roles) {
  const allowed = new Set(roles.map((r) => String(r).toLowerCase()));
  return (req, res, next) => {
    const role = String(req.auth?.role || '').toLowerCase();
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    return next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required.' });
}

export function requireTherapist(req, res, next) {
  if (req.auth?.role === 'therapist') return next();
  return res.status(403).json({ message: 'Therapist access only.' });
}

export function requireParent(req, res, next) {
  if (req.auth?.role === 'parent') return next();
  return res.status(403).json({ message: 'Parent access only.' });
}

/** Therapist portal routes (JWT therapist token). */
export const authenticateTherapist = [authenticateJwt, requireTherapist];

/** Parent mobile / Supabase routes. */
export const authenticateParent = [authenticate, requireParent];

/** Admin dashboard routes. */
export const authenticateAdmin = [authenticateJwt, requireAdmin];
