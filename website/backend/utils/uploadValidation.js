import { fileTypeFromBuffer } from 'file-type';

export const PROFILE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MIMES = ['application/pdf'];
/** Resource/article attachments (Word, PDF, Office, etc.). */
export const RESOURCE_ATTACHMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.oasis.opendocument.text',
];

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * @param {{ buffer: Buffer, declaredMime?: string, allowedTypes: string[], maxBytes?: number }} opts
 * @returns {Promise<{ ok: true, mime: string } | { ok: false, error: string }>}
 */
export async function validateUploadBuffer({
  buffer,
  declaredMime,
  allowedTypes,
  maxBytes,
}) {
  if (!buffer?.length) {
    return { ok: false, error: 'Invalid file type.' };
  }

  if (maxBytes != null && buffer.length > maxBytes) {
    return { ok: false, error: 'File is too large.' };
  }

  const declared = String(declaredMime || '').trim().toLowerCase();
  if (!declared || declared === 'application/octet-stream') {
    return { ok: false, error: 'Invalid file type.' };
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime;
  if (!mime || !allowedTypes.includes(mime)) {
    return { ok: false, error: 'Invalid file type.' };
  }

  if (declared !== mime) {
    return { ok: false, error: 'Invalid file type.' };
  }

  return { ok: true, mime };
}
