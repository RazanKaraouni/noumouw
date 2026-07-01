/** User-safe API error messages — never expose SQL, stack traces, or URLs. */

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
    'formatexception',
    'handshakeexception',
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
    'syntax error',
    'database',
    'backend',
    'errno',
    'failed to fetch',
    'could not connect',
    'request failed',
    'status code',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'stack trace',
    'at object.',
    'at module.',
    'supabase.co',
    'rest/v1',
    'pgrst',
    'violates foreign key',
    'violates unique',
    'duplicate key',
    'relation ',
    'column ',
    'null value',
    'econnrefused',
    'econnreset',
    'enotfound',
    'etimedout',
    'err_network',
    'network error',
  ];

  if (patterns.some((p) => msg.includes(p))) return true;
  if (/\w+exception\b/i.test(msg)) return true;
  if (String(text).trim().length > 180) return true;
  if (String(text).includes('{') && String(text).includes('}')) return true;

  return false;
}

export function isNetworkErrorText(text) {
  const msg = String(text ?? '').trim().toLowerCase();
  if (!msg) return false;

  const patterns = [
    'socketexception',
    'timeoutexception',
    'clientexception',
    'handshakeexception',
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
    'network error',
    'connection error',
    'failed to fetch',
    'could not connect',
    'cannot reach',
    'no internet',
    'offline',
    'socket',
    'unreachable',
    'host lookup',
    'econnrefused',
    'econnreset',
    'enotfound',
    'etimedout',
    'err_network',
    'network error occurred',
  ];

  return patterns.some((p) => msg.includes(p));
}

export function isNetworkError(err) {
  if (!err) return false;
  const code = String(err.code ?? '').toUpperCase();
  if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ERR_NETWORK'].includes(code)) {
    return true;
  }
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;

  const raw = extractErrorText(err);
  if (isNetworkErrorText(raw)) return true;
  return isNetworkErrorText(String(err));
}

function extractErrorText(err) {
  if (typeof err === 'string') return err.trim();
  if (err?.message && String(err.message).trim()) return String(err.message).trim();
  if (err?.details && String(err.details).trim()) return String(err.details).trim();
  if (err?.hint && String(err.hint).trim()) return String(err.hint).trim();
  return String(err ?? '').replace(/^Error:\s*/i, '').trim();
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

/** Maps any thrown value to a safe client-facing string. */
export function userFacingErrorMessage(err) {
  if (isNetworkError(err)) return NETWORK_ERROR_OCCURRED;
  const raw = extractErrorText(err);
  if (!raw) return ERROR_OCCURRED;
  if (isNetworkErrorText(raw)) return NETWORK_ERROR_OCCURRED;
  if (isTechnicalErrorText(raw)) return ERROR_OCCURRED;
  return raw;
}

/** Send a sanitized JSON error body; logs the real error server-side only. */
export function sendErrorResponse(res, err, status = 500) {
  console.error(err);
  const code = Number(status);
  const safeStatus = code >= 400 && code < 600 ? code : 500;
  return res.status(safeStatus).json({
    message: userFacingErrorMessage(err),
    error: userFacingErrorMessage(err),
  });
}
