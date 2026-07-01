import supabase from '../config/supabase.js';

export const CHILD_PROFILES_BUCKET = 'child-profiles';
/** Signed URLs expire in 1 hour. Do not cache these URLs long-term. */
export const CHILD_PROFILE_SIGNED_URL_TTL_SEC = 3600;

const PUBLIC_PATH_MARKERS = [
  `/storage/v1/object/public/${CHILD_PROFILES_BUCKET}/`,
  `/storage/v1/object/sign/${CHILD_PROFILES_BUCKET}/`,
  `/storage/v1/object/authenticated/${CHILD_PROFILES_BUCKET}/`,
];

/** Normalize stored value (path or legacy public URL) to a bucket object path. */
export function childProfileStoragePath(stored) {
  const raw = String(stored || '').trim();
  if (!raw) return null;
  if (!raw.includes('://') && !raw.startsWith('/')) {
    return raw.replace(/^\/+/, '');
  }
  for (const marker of PUBLIC_PATH_MARKERS) {
    const idx = raw.indexOf(marker);
    if (idx === -1) continue;
    const rest = raw.slice(idx + marker.length);
    try {
      return decodeURIComponent(rest.split('?')[0]);
    } catch {
      return rest.split('?')[0];
    }
  }
  return null;
}

/** Signed URLs expire in 1 hour. Do not cache these URLs long-term. */
export async function signChildProfileUrl(storedPathOrUrl) {
  const filePath = childProfileStoragePath(storedPathOrUrl);
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(CHILD_PROFILES_BUCKET)
    .createSignedUrl(filePath, CHILD_PROFILE_SIGNED_URL_TTL_SEC);

  if (error) {
    console.error('[childProfileSignedUrl]', error.message || error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Signed URLs expire in 1 hour. Do not cache these URLs long-term. */
export async function attachSignedChildProfileUrl(childRow) {
  if (!childRow || typeof childRow !== 'object') return childRow;
  const stored = childRow.profile_image_url;
  if (!stored) return childRow;

  const signedUrl = await signChildProfileUrl(stored);
  return {
    ...childRow,
    profile_image_storage_path: childProfileStoragePath(stored),
    profile_image_url: signedUrl,
  };
}

export async function attachSignedChildProfileUrls(rows) {
  const list = rows || [];
  return Promise.all(list.map((row) => attachSignedChildProfileUrl(row)));
}
