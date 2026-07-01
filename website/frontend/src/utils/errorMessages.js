import { PASSWORD_WEAK_ERROR } from './passwordPolicy.js';

const GENERIC = 'Something went wrong. Please try again.';

const STATUS_MESSAGES = {
  401: 'Your session expired. Please log in again.',
  403: "You don't have permission to do this.",
  404: 'The requested resource was not found.',
  500: 'A server error occurred. Please try again later.',
};

function statusFromError(err) {
  const status = err?.response?.status ?? err?.status;
  return typeof status === 'number' ? status : null;
}

function serverMessage(err) {
  const data = err?.response?.data ?? err?.data;
  if (!data || typeof data !== 'object') return null;
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  if (Array.isArray(data.errors) && data.errors.length) {
    const first = data.errors[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return null;
}

function isSafeClientMessage(msg) {
  if (!msg || msg.length > 400) return false;
  if (/\n\s+at\s/.test(msg)) return false;
  if (/^Error:/i.test(msg)) return false;
  return true;
}

/** Safe user-facing message — never exposes server errors or stack traces. */
export function getErrorMessage(err) {
  if (!err) return GENERIC;

  const status = statusFromError(err);

  if (err?.code === 'ERR_NETWORK' || (err?.isAxiosError && !err?.response)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (err?.code === 'ETIMEDOUT' || err?.name === 'TimeoutError') {
    return 'Request timed out. Check your connection and try again.';
  }

  if (status === 400 || status === 403 || status === 409 || status === 422) {
    const msg = serverMessage(err);
    if (msg && isSafeClientMessage(msg)) {
      if (/password/i.test(msg)) return PASSWORD_WEAK_ERROR;
      return msg;
    }
  }

  if (status === 401) {
    const msg = serverMessage(err);
    if (msg && isSafeClientMessage(msg)) return msg;
    return STATUS_MESSAGES[401];
  }

  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }

  return GENERIC;
}

export default getErrorMessage;
