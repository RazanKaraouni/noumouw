import crypto from 'crypto';

export const PASSWORD_SETUP_TTL_MS = 72 * 60 * 60 * 1000;
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export function hashPasswordSetupToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function generatePasswordSetupToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function isPasswordSetupPending(therapist) {
  if (!therapist?.password_setup_token_hash) return false;
  const expiresAt = therapist.password_setup_expires_at;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function emailHint(email) {
  const normalized = String(email || '').trim();
  const at = normalized.indexOf('@');
  if (at <= 1) return normalized ? '***' : '';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}
