/** @param {string} raw */
export function isHttpsUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    return new URL(raw.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/** @param {string} raw */
export function parseCommaSeparatedUrls(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Production startup checks for externally visible URLs.
 * @returns {string[]} fatal error messages (empty = ok)
 */
export function validateProductionHttpsEnv() {
  if (process.env.NODE_ENV !== 'production') return [];

  const errors = [];

  const publicApi = process.env.PUBLIC_API_URL?.trim();
  if (!publicApi) {
    errors.push('PUBLIC_API_URL is required in production.');
  } else if (!isHttpsUrl(publicApi)) {
    errors.push('PUBLIC_API_URL must use HTTPS in production.');
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (supabaseUrl && !isHttpsUrl(supabaseUrl)) {
    errors.push('SUPABASE_URL must use HTTPS in production.');
  }

  const corsOrigins = parseCommaSeparatedUrls(process.env.CORS_ORIGINS);
  if (!corsOrigins.length) {
    errors.push(
      'CORS_ORIGINS must list at least one HTTPS web origin in production.',
    );
  } else {
    for (const origin of corsOrigins) {
      if (!isHttpsUrl(origin)) {
        errors.push(
          `CORS_ORIGINS entry must use HTTPS in production: ${origin}`,
        );
      }
    }
  }

  return errors;
}
