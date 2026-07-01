/** Origins for the split admin vs therapist web apps. Override with VITE_* in production. */
function resolvePortalOrigin(envUrl, devFallbackPort) {
  const configured = envUrl?.trim();
  if (configured) {
    if (import.meta.env.PROD && configured.startsWith('http://')) {
      throw new Error(
        'Portal app URLs must use HTTPS in production builds.',
      );
    }
    return configured.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return `http://localhost:${devFallbackPort}`;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  throw new Error('Portal app URL is not configured for production builds.');
}

export const adminAppOrigin = () => resolvePortalOrigin(import.meta.env.VITE_ADMIN_APP_URL, 5173);

export const therapistAppOrigin = () =>
  resolvePortalOrigin(import.meta.env.VITE_THERAPIST_APP_URL, 5174);

/** Cross-origin session handoff (fragment is not sent to the server). */
export function buildAuthHandoffUrl(origin, path, token, user) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const fragment = encodeURIComponent(JSON.stringify({ token, user }));
  return `${origin}${p}#noumouw_auth=${fragment}`;
}
