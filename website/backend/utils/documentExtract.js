import mammoth from 'mammoth';
import { extractPdfHtml } from './pdfOcr.js';

export const INLINE_DOCUMENT_EXT = new Set(['.docx', '.doc', '.pdf', '.txt']);

export function extFromName(name) {
  const i = (name || '').lastIndexOf('.');
  if (i === -1) return '';
  return name.slice(i).toLowerCase();
}

export function isInlineDocumentName(name) {
  return INLINE_DOCUMENT_EXT.has(extFromName(name));
}

export function filenameFromUrl(url) {
  if (!url) return '';
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    return decodeURIComponent(last.split('?')[0]);
  } catch {
    const parts = String(url).split('/');
    const last = parts[parts.length - 1] || '';
    return decodeURIComponent(last.split('?')[0]);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimum extracted plain-text length before inlining a document and clearing media_url. */
export const MIN_INLINABLE_DOCUMENT_CHARS = 120;

export function htmlToPlain(html) {
  if (!html || !String(html).trim()) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function plainTextToHtml(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  const paras = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return '';
  return paras.map((p) => `<p>${escapeHtml(p.replace(/\n/g, ' '))}</p>`).join('');
}

/**
 * Merge therapist-typed HTML with text extracted from an uploaded document.
 * Prefers the longer / richer source so the article body shows document content.
 */
export function mergeArticleBody(existingHtml, extractedHtml) {
  if (!extractedHtml) return existingHtml || '';
  const existingPlain = htmlToPlain(existingHtml);
  const extractedPlain = htmlToPlain(extractedHtml);
  if (!extractedPlain) return existingHtml || '';
  if (!existingPlain) return extractedHtml;
  if (extractedPlain.length > existingPlain.length * 1.25) {
    return extractedHtml;
  }
  if (
    extractedPlain.includes(existingPlain) &&
    extractedPlain.length >= existingPlain.length
  ) {
    return extractedHtml;
  }
  if (existingPlain.includes(extractedPlain)) {
    return existingHtml;
  }
  return `${existingHtml}<hr/><div class="article-from-document">${extractedHtml}</div>`;
}

/**
 * @param {Buffer} buffer
 * @param {string} originalname
 * @returns {Promise<string|null>} HTML snippet or null if unsupported / empty
 */
export async function extractDocumentHtml(buffer, originalname) {
  if (!buffer?.length) return null;
  const ext = extFromName(originalname);

  try {
    if (ext === '.docx') {
      const result = await mammoth.convertToHtml({ buffer });
      return (result.value || '').trim() || null;
    }
    if (ext === '.doc') {
      const result = await mammoth.convertToHtml({ buffer });
      return (result.value || '').trim() || null;
    }
    if (ext === '.pdf') {
      return extractPdfHtml(buffer, {
        onProgress: (message) => console.log('extractPdfHtml:', message),
      });
    }
    if (ext === '.txt') {
      return plainTextToHtml(buffer.toString('utf8')) || null;
    }
  } catch (e) {
    console.error('extractDocumentHtml:', ext, e.message || e);
    return null;
  }

  return null;
}

/**
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function downloadPublicFile(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download document (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Pull text from a stored article attachment into HTML body when needed.
 * Clears media_url when document content was inlined successfully.
 *
 * @returns {Promise<{ body_text: string, media_url: string|null, updated: boolean }>}
 */
export async function resolveArticleBody(bodyText, mediaUrl) {
  const body = bodyText || '';
  const media = (mediaUrl || '').trim() || null;
  if (!media || !isInlineDocumentName(filenameFromUrl(media))) {
    return { body_text: body, media_url: media, updated: false };
  }

  try {
    const buffer = await downloadPublicFile(media);
    const extractedHtml = await extractDocumentHtml(buffer, filenameFromUrl(media));
    if (!extractedHtml) {
      return { body_text: body, media_url: media, updated: false };
    }

    const merged = mergeArticleBody(body, extractedHtml);
    const mergedPlain = htmlToPlain(merged);
    const bodyPlain = htmlToPlain(body);
    const extractedPlain = htmlToPlain(extractedHtml);

    if (!mergedPlain || extractedPlain.length < MIN_INLINABLE_DOCUMENT_CHARS) {
      return { body_text: body, media_url: media, updated: false };
    }

    const shouldInline =
      !bodyPlain ||
      extractedPlain.length > bodyPlain.length * 1.1 ||
      mergedPlain.length > bodyPlain.length + 80;

    if (!shouldInline) {
      return { body_text: body, media_url: media, updated: false };
    }

    return {
      body_text: merged,
      media_url: media,
      updated: merged !== body,
    };
  } catch (e) {
    console.error('resolveArticleBody:', e.message || e);
    return { body_text: body, media_url: media, updated: false };
  }
}
