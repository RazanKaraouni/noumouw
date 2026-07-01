/** @param {string} url */
export function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @param {string} label
 */
export function assertHttpsInProduction(url, label) {
  if (!import.meta.env.PROD) return;
  if (url.startsWith('http://')) {
    throw new Error(`${label} must use HTTPS in production builds.`);
  }
  if (!isHttpsUrl(url)) {
    throw new Error(`${label} must be a valid HTTPS URL in production builds.`);
  }
}

/**
 * Resolves the REST API base (includes `/api` suffix when configured).
 * @returns {string}
 */
export function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    const normalized = configured.replace(/\/$/, '');
    assertHttpsInProduction(normalized, 'VITE_API_URL');
    return normalized;
  }

  if (import.meta.env.DEV) {
    return '/api';
  }

  throw new Error(
    'VITE_API_URL must be set to an HTTPS URL (e.g. https://api.example.com/api) for production builds.',
  );
}

/**
 * Server origin for fetch / Socket.io (no `/api` suffix).
 * @returns {string}
 */
export function resolveApiOrigin() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    const raw = configured.replace(/\/$/, '');
    const origin = raw.replace(/\/api$/, '') || raw;
    assertHttpsInProduction(origin, 'VITE_API_URL');
    return origin;
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }

  throw new Error(
    'VITE_API_URL must be set to an HTTPS URL for production builds.',
  );
}
