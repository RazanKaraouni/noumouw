import { EXTENDED_API_TIMEOUT_MS } from '../services/axios.js';
import { resolveApiOrigin } from '../lib/apiUrl.js';

export { EXTENDED_API_TIMEOUT_MS };

const API_BASE = resolveApiOrigin();

export function getAuthToken() {
  return typeof window !== 'undefined' ? window.sessionStorage.getItem('noumouw_token') : null;
}

export const getToken = getAuthToken;

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

function toTimeoutError() {
  const err = new Error('Request timed out');
  err.code = 'ETIMEDOUT';
  return err;
}

/** Authenticated fetch for therapist (and shared) API routes. */
export async function apiFetch(path, options = {}) {
  const { timeoutMs = EXTENDED_API_TIMEOUT_MS, ...fetchOptions } = options;
  const token = getAuthToken();
  const headers = {
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs,
  );

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (isAbortError(err)) throw toTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { API_BASE };
