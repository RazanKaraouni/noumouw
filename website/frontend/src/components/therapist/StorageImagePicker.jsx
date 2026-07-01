import { useEffect, useId, useRef, useState } from 'react';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);

function isImageFile(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  if (IMAGE_MIMES.has(mime)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
}

function isVideoFile(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  if (VIDEO_MIMES.has(mime)) return true;
  return /\.(mp4|mov)$/i.test(file.name || '');
}

/** @returns {'video' | 'image' | null} */
export function detectMediaContentType(file) {
  if (!file) return null;
  if (isVideoFile(file)) return 'video';
  if (isImageFile(file)) return 'image';
  return null;
}

function looksLikeImageUrl(url) {
  if (!url) return false;
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

/**
 * Native file picker with thumbnail preview for therapist media uploads.
 * Selected files are uploaded to Supabase Storage when the parent form submits.
 *
 * @param {{
 *   file?: File | null;
 *   onChange: (file: File | null) => void;
 *   accept?: string;
 *   buttonLabel?: string;
 *   existingUrl?: string | null;
 *   disabled?: boolean;
 *   hint?: string;
 * }} props
 */
export default function StorageImagePicker({
  file = null,
  onChange,
  accept = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif',
  buttonLabel = 'Upload Image',
  existingUrl = null,
  disabled = false,
  hint,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    if (!isImageFile(file)) {
      setPreviewUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const clearSelection = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const showExisting = !file && existingUrl;
  const showImagePreview = Boolean(previewUrl || (showExisting && looksLikeImageUrl(existingUrl)));
  const previewSrc = previewUrl || (showExisting ? existingUrl : null);
  const showVideoMeta = file && isVideoFile(file);

  return (
    <div className="storage-image-picker">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="storage-image-picker-input"
        onChange={(e) => {
          onChange(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />

      {showImagePreview && previewSrc ? (
        <div className="storage-image-picker-preview">
          <img src={previewSrc} alt="" className="storage-image-picker-thumb" />
          <div className="storage-image-picker-meta">
            {file ? (
              <span className="storage-image-picker-name" title={file.name}>
                {file.name}
              </span>
            ) : (
              <span className="storage-image-picker-name storage-image-picker-name-muted">
                Current image
              </span>
            )}
            <div className="storage-image-picker-actions">
              <button
                type="button"
                className="storage-image-picker-btn storage-image-picker-btn-secondary"
                onClick={openPicker}
                disabled={disabled}
              >
                {file ? 'Change image' : buttonLabel}
              </button>
              {file && (
                <button
                  type="button"
                  className="storage-image-picker-btn storage-image-picker-btn-ghost"
                  onClick={clearSelection}
                  disabled={disabled}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ) : showVideoMeta ? (
        <div className="storage-image-picker-preview storage-image-picker-preview-video">
          <div className="storage-image-picker-video-icon" aria-hidden>
            <VideoIcon />
          </div>
          <div className="storage-image-picker-meta">
            <span className="storage-image-picker-name" title={file.name}>
              {file.name}
            </span>
            <div className="storage-image-picker-actions">
              <button
                type="button"
                className="storage-image-picker-btn storage-image-picker-btn-secondary"
                onClick={openPicker}
                disabled={disabled}
              >
                Change file
              </button>
              <button
                type="button"
                className="storage-image-picker-btn storage-image-picker-btn-ghost"
                onClick={clearSelection}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="storage-image-picker-btn storage-image-picker-btn-primary"
          onClick={openPicker}
          disabled={disabled}
        >
          <UploadIcon />
          {buttonLabel}
        </button>
      )}

      {showExisting && !file && !looksLikeImageUrl(existingUrl) && (
        <p className="storage-image-picker-existing">
          Current:{' '}
          <a href={existingUrl} target="_blank" rel="noopener noreferrer">
            View file
          </a>
        </p>
      )}

      {hint && <p className="storage-image-picker-hint">{hint}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 16V7.85l-2.6 2.6L7 9l5-5 5 5-1.4 1.45-2.6-2.6V16h-2zm-7 4v-2h14v2H4z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  );
}

export const IMAGE_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif';

export const VIDEO_OR_IMAGE_ACCEPT =
  '.mp4,.mov,.jpg,.jpeg,.png,.webp,.gif,video/mp4,video/quicktime,image/jpeg,image/png,image/webp,image/gif';
