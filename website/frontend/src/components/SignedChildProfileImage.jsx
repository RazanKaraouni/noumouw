import { useEffect, useState } from 'react';

/**
 * Child profile image from API (signed URL).
 * Signed URLs expire in 1 hour. Do not cache these URLs long-term.
 */
export function SignedChildProfileImage({
  src,
  alt = '',
  onExpired,
  className,
  style,
}) {
  const [url, setUrl] = useState(src || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(src || '');
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!url) return undefined;
    // Refresh before the 1-hour signed URL expires.
    const refreshMs = 50 * 60 * 1000;
    const timer = window.setTimeout(() => {
      onExpired?.();
    }, refreshMs);
    return () => window.clearTimeout(timer);
  }, [url, onExpired]);

  if (!url || failed) return null;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        setFailed(true);
        onExpired?.();
      }}
    />
  );
}
