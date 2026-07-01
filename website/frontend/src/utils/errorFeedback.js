/** User-safe error messages for admin & therapist dashboards. */

export const ERROR_OCCURRED = 'An error occurred';
export const NETWORK_ERROR_OCCURRED = 'Network error occurred';

export function isTechnicalErrorText(text) {
  const msg = String(text ?? '').trim().toLowerCase();
  if (!msg) return true;

  if (/https?:\/\//.test(msg)) return true;
  if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/.test(msg)) return true;

  const patterns = [
    'socketexception',
    'timeoutexception',
    'clientexception',
    'future not completed',
    'future was not completed',
    'timed out',
    'timeout',
    'connection refused',
    'connection reset',
    'connection timed out',
    'connection failed',
    'failed host lookup',
    'network is unreachable',
    'postgrest',
    'postgres',
    'postgresql',
    'sqlstate',
    'sql error',
    'database',
    'backend',
    'failed to fetch',
    'request failed',
    'status code',
    'internal server error',
    'stack trace',
    'supabase.co',
    'pgrst',
    'econnrefused',
    'err_network',
    'network error',
    'localhost:5000',
    'port 5000',
    'signal aborted',
    'aborted without reason',
  ];

  if (patterns.some((p) => msg.includes(p))) return true;
  if (/\w+exception\b/i.test(msg)) return true;
  if (String(text).trim().length > 180) return true;

  return false;
}

export function isNetworkErrorText(text) {
  const msg = String(text ?? '').trim().toLowerCase();
  if (!msg) return false;

  const patterns = [
    'timeout',
    'timed out',
    'connection refused',
    'connection reset',
    'connection timed out',
    'connection failed',
    'failed host lookup',
    'network is unreachable',
    'network error',
    'connection error',
    'failed to fetch',
    'could not connect',
    'cannot reach',
    'no internet',
    'offline',
    'econnrefused',
    'econnreset',
    'enotfound',
    'etimedout',
    'err_network',
    'network error occurred',
    'signal aborted',
    'aborted without reason',
    'aborterror',
  ];

  return patterns.some((p) => msg.includes(p));
}

function isAbortError(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  const msg = String(err.message ?? '').toLowerCase();
  return msg.includes('signal aborted') || msg.includes('aborted without reason');
}

export function isNetworkError(err) {
  if (!err) return false;

  if (isAbortError(err)) return true;

  const code = String(err.code ?? '').toUpperCase();
  if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ERR_NETWORK'].includes(code)) {
    return true;
  }

  // Axios: no response usually means network / server down.
  if (err.isAxiosError && !err.response && err.request) return true;

  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    (typeof err === 'string' ? err : '');

  if (isNetworkErrorText(raw)) return true;
  return isNetworkErrorText(String(err));
}

export function sanitizeUserMessage(message) {
  const text = String(message ?? '').trim();
  if (text === NETWORK_ERROR_OCCURRED || text === ERROR_OCCURRED) return text;
  if (!text || isTechnicalErrorText(text)) {
    if (isNetworkErrorText(text)) return NETWORK_ERROR_OCCURRED;
    return ERROR_OCCURRED;
  }
  return text;
}

/** Safe message for toasts, inline errors, and alerts. */
export function getUserFacingError(err, fallback = ERROR_OCCURRED) {
  if (isNetworkError(err)) return NETWORK_ERROR_OCCURRED;

  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    (typeof err === 'string' ? err : '');

  if (!raw) return isNetworkError(err) ? NETWORK_ERROR_OCCURRED : fallback;

  if (isNetworkErrorText(raw)) return NETWORK_ERROR_OCCURRED;
  if (isTechnicalErrorText(raw)) return ERROR_OCCURRED;
  return String(raw).trim();
}
