import axios from 'axios';
import { getErrorMessage } from '../utils/errorMessages.js';
import { resolveApiBaseUrl } from '../lib/apiUrl.js';

/** Target API SLA — backend logs requests slower than this. */
export const API_SLA_MS = 2000;

/** Default client timeout — many routes exceed the 2s SLA in practice. */
export const EXTENDED_API_TIMEOUT_MS = 30_000;

const apiBase = resolveApiBaseUrl();

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

const api = axios.create({ baseURL: apiBase, timeout: EXTENDED_API_TIMEOUT_MS });

api.interceptors.request.use((config) => {
  // Token is stored per-tab in sessionStorage so that two tabs (e.g. admin
  // and therapist) keep independent sessions.
  const token =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('noumouw_token')
      : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const safe = getErrorMessage(error);
    error.userFacingMessage = safe;
    if (error.response?.data && typeof error.response.data === 'object') {
      error.response.data.message = safe;
      error.response.data.error = safe;
    }
    return Promise.reject(error);
  },
);

export { getErrorMessage };
export default api;
