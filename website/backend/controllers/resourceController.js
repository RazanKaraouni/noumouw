import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import supabase from '../config/supabase.js';
import {
  DOCUMENT_MAX_BYTES,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIMES,
  RESOURCE_ATTACHMENT_MIMES,
  validateUploadBuffer,
} from '../utils/uploadValidation.js';
import { getTherapistId, getTherapistDisplayName } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import {
  boundsFromCdcAgeLabel,
  normalizeCdcAgeLabel,
} from '../utils/cdcMilestoneAgeTiers.js';
import {
  extractDocumentHtml,
  mergeArticleBody,
  htmlToPlain,
  resolveArticleBody,
  isInlineDocumentName,
} from '../utils/documentExtract.js';

export const RESOURCE_SELECT = '*';
export const BUCKET = 'therapist-content';

const memory = multer.memoryStorage();

export const resourceUpload = multer({
  storage: memory,
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

export const resourceUploadFields = resourceUpload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'attachment', maxCount: 1 },
]);

const ALLOWED_RESOURCE_DOMAINS = new Set([
  'all',
  'cognitive',
  'motor',
  'language',
  'social',
  'autism',
]);

const ALLOWED_MEDIA_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_MEDIA_EXT = new Set(['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.webp', '.gif']);
const IMAGE_ONLY_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_ONLY_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_ATTACHMENT_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.odt',
]);
const ALLOWED_ATTACHMENT_MIMES = new Set([
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
]);

function extFromName(name) {
  const i = name.lastIndexOf('.');
  if (i === -1) return '';
  return name.slice(i).toLowerCase();
}

function normalizeResourceAgeRange(s) {
  if (!s || typeof s !== 'string') return null;
  const t = String(s).trim();
  if (t === 'all') return 'all';
  if (/^\d+-\d+$/.test(t)) return t;
  const label = normalizeCdcAgeLabel(t);
  if (boundsFromCdcAgeLabel(label)) return label;
  return null;
}

function resourceHasContent(body_text, video_url, image_url, media_url) {
  return Boolean(
    htmlToPlain(body_text) ||
      (video_url && String(video_url).trim()) ||
      (image_url && String(image_url).trim()) ||
      (media_url && String(media_url).trim()),
  );
}

async function validateProfileImageUpload(file) {
  if (!file?.buffer) return { ok: false, error: 'Invalid file type.' };
  return validateUploadBuffer({
    buffer: file.buffer,
    declaredMime: file.mimetype,
    allowedTypes: PROFILE_IMAGE_MIMES,
    maxBytes: PROFILE_IMAGE_MAX_BYTES,
  });
}

async function validateDocumentUpload(file) {
  if (!file?.buffer) return { ok: false, error: 'Invalid file type.' };
  const ext = extFromName(file.originalname || '');
  if (!ALLOWED_ATTACHMENT_EXT.has(ext)) {
    return {
      ok: false,
      error: 'Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, TXT, RTF, ZIP, or ODT.',
    };
  }

  const strict = await validateUploadBuffer({
    buffer: file.buffer,
    declaredMime: file.mimetype,
    allowedTypes: RESOURCE_ATTACHMENT_MIMES,
    maxBytes: DOCUMENT_MAX_BYTES,
  });
  if (strict.ok) return strict;

  // OOXML files (.docx/.xlsx/.pptx) are ZIP archives; file-type may report application/zip.
  if (['.docx', '.xlsx', '.pptx'].includes(ext)) {
    const detected = await fileTypeFromBuffer(file.buffer);
    const zipMime = detected?.mime;
    if (zipMime === 'application/zip' || zipMime === 'application/x-zip-compressed') {
      return { ok: true, mime: attachmentContentType(file, ext) };
    }
  }

  return strict;
}

function isAllowedVideoOnly(file) {
  if (!file) return false;
  const ext = extFromName(file.originalname || '');
  if (ext !== '.mp4' && ext !== '.mov') return false;
  const mime = (file.mimetype || '').toLowerCase();
  return mime === 'video/mp4' || mime === 'video/quicktime';
}


function attachmentContentType(file, ext) {
  const mime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_ATTACHMENT_MIMES.has(mime)) return file.mimetype;
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (ext === '.txt') return 'text/plain';
  if (ext === '.rtf') return 'application/rtf';
  if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
  if (ext === '.pptx') {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (ext === '.zip') return 'application/zip';
  if (ext === '.odt') return 'application/vnd.oasis.opendocument.text';
  return 'application/octet-stream';
}

function objectPathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const rest = publicUrl.slice(idx + marker.length);
  try {
    return decodeURIComponent(rest.split('?')[0]);
  } catch {
    return rest.split('?')[0];
  }
}

async function parentCanReadTherapistResource(parentUserId, therapistId) {
  if (!parentUserId || !therapistId) return false;
  const { data, error } = await supabase
    .from('therapist_children')
    .select('therapist_id')
    .eq('parent_id', parentUserId)
    .eq('therapist_id', therapistId)
    .maybeSingle();
  if (error) {
    console.error('parentCanReadTherapistResource:', error.message);
    return false;
  }
  return !!data;
}

async function resolveTherapistName(req) {
  const fromAuth = (getTherapistDisplayName(req) || '').trim();
  if (fromAuth) return fromAuth;

  const therapistId = getTherapistId(req);
  if (!therapistId) return null;

  const { data, error } = await supabase
    .from('therapists')
    .select('full_name')
    .eq('therapist_id', therapistId)
    .maybeSingle();

  if (error) {
    console.error('resolveTherapistName:', error.message);
    return null;
  }
  return (data?.full_name || '').trim() || null;
}

function resourceOwnedByTherapist(row, _therapistName, therapistId) {
  return Boolean(row.therapist_id && therapistId && row.therapist_id === therapistId);
}

async function therapistIdForResourceRow(row) {
  return row.therapist_id || null;
}

async function canReadArticleResource(req, row) {
  if (row.is_public === true) return true;
    if (req.auth?.role === 'therapist') {
    if (req.auth.therapistId && row.therapist_id === req.auth.therapistId) return true;
  }
  if (req.auth?.role === 'parent') {
    const therapistId = await therapistIdForResourceRow(row);
    if (therapistId) {
      return parentCanReadTherapistResource(req.auth.parentUserId, therapistId);
    }
  }
  return false;
}

async function uploadFileToBucket(therapistId, file, resolveContentType) {
  // TODO: Route uploads through ClamAV or a cloud malware scanning service (e.g., VirusTotal API) before writing to Supabase storage. Implement before scaling beyond closed beta.
  const ext = extFromName(file.originalname);
  const objectPath = `${therapistId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const uploadContentType = resolveContentType(file, ext);

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, file.buffer, {
    contentType: uploadContentType,
    upsert: false,
  });

  if (upErr) {
    console.error('Storage upload error:', upErr);
    throw new Error(upErr.message || 'Failed to upload file.');
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  if (!pub?.publicUrl) {
    throw new Error('Failed to resolve file URL.');
  }
  return pub.publicUrl;
}

async function uploadMediaFile(therapistId, mediaFile) {
  // TODO: Route uploads through ClamAV or a cloud malware scanning service (e.g., VirusTotal API) before writing to Supabase storage. Implement before scaling beyond closed beta.
  const ext = extFromName(mediaFile.originalname);
  const objectPath = `${therapistId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const mime = (mediaFile.mimetype || '').toLowerCase();
  const uploadContentType = ALLOWED_MEDIA_MIMES.has(mime)
    ? mediaFile.mimetype
    : ext === '.mov'
      ? 'video/quicktime'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'video/mp4';

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, mediaFile.buffer, {
    contentType: uploadContentType,
    upsert: false,
  });

  if (upErr) {
    console.error('Storage upload error:', upErr);
    throw new Error(upErr.message || 'Failed to upload media.');
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  if (!pub?.publicUrl) {
    throw new Error('Failed to resolve media URL.');
  }
  return pub.publicUrl;
}

async function removeStorageObject(publicUrl) {
  const objectPath = objectPathFromPublicUrl(publicUrl);
  if (!objectPath) return;
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
  if (rmErr) {
    console.warn('Could not delete storage object:', rmErr.message);
  }
}

function mapInsertErrorMessage(insErr) {
  const detail = String(insErr.message || insErr.details || insErr.code || '').trim();
  const d = detail.toLowerCase();
  const looksLikeMissingColumn =
    d.includes('column') && (d.includes('does not exist') || d.includes('could not find'));
  const looksLikeBadContentTypeCheck =
    d.includes('resources_content_type_check') ||
    (d.includes('content_type') && d.includes('check constraint'));

  if (looksLikeMissingColumn) {
    return `Database may be missing domain/age columns — run backend/sql/resources_domain_age_range.sql in Supabase SQL. (${detail})`;
  }
  if (looksLikeBadContentTypeCheck) {
    return `Database check constraint failed — run backend/sql/resources_unified_media.sql in Supabase SQL. ${detail}`;
  }
  return detail ? `Failed to save resource: ${detail}` : 'Failed to save resource.';
}

/** Call once at startup so uploads work without manual bucket creation in Supabase UI. */
export async function ensureTherapistContentBucket() {
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.error(`Storage listBuckets: ${listErr.message}`);
      return;
    }
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (exists) return;
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
    });
    if (createErr) {
      console.error(`Could not create storage bucket "${BUCKET}": ${createErr.message}`);
    } else {
      console.log(`Created storage bucket "${BUCKET}" (public).`);
    }
  } catch (e) {
    console.error('ensureTherapistContentBucket:', e);
  }
}

export function handleResourceMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File exceeds maximum size (20 MB for documents, 5 MB for images).' });
  }
  return next(err);
}

export async function getArticleBody(req, res) {
  try {
    const { id } = req.params;
    const { data: row, error } = await supabase
      .from('resources')
      .select(RESOURCE_SELECT)
      .eq('resources_id', id)
      .single();

    if (error || !row) {
      return res.status(404).json({ message: 'Article not found.' });
    }
    const readableTypes = new Set(['article', 'resource']);
    if (!readableTypes.has(row.content_type)) {
      return res.status(400).json({ message: 'Not an article.' });
    }
    if (!(await canReadArticleResource(req, row))) {
      return res.status(403).json({ message: 'Not allowed to view this article.' });
    }

    const resolved = await resolveArticleBody(row.body_text, row.media_url);
    if (resolved.updated) {
      const { error: updErr } = await supabase
        .from('resources')
        .update({
          body_text: resolved.body_text,
          media_url: resolved.media_url,
        })
        .eq('resources_id', id);
      if (updErr) {
        console.error('article body backfill error:', updErr.message);
      } else if (row.media_url && !resolved.media_url) {
        await removeStorageObject(row.media_url);
      }
    }

    return res.json({
      resources_id: row.resources_id,
      title: row.title,
      body_text: resolved.body_text,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function listMyResources(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist not found.' });
    }

    const { data, error } = await supabase
      .from('resources')
      .select(RESOURCE_SELECT)
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('resources list error:', error);
      return res.status(500).json({
        message: userFacingErrorMessage(error),
      });
    }
    return res.json(data || []);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function createResource(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const therapistName = await resolveTherapistName(req);
    const title = (req.body.title || '').trim();
    const content_type = (req.body.content_type || '').trim();
    let body_text = (req.body.body_text || '').trim();

    const { data: therapistRow, error: thErr } = await supabase
      .from('therapists')
      .select('therapist_id')
      .eq('therapist_id', therapistId)
      .single();

    if (thErr || !therapistRow || !therapistName) {
      return res.status(403).json({ message: 'Therapist not found.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }
    const domainRaw = (req.body.domain || '').trim().toLowerCase();
    const ageRangeRaw = (req.body.age_range || '').trim();
    if (!ALLOWED_RESOURCE_DOMAINS.has(domainRaw)) {
      return res.status(400).json({
        message: 'Choose a domain: all, cognitive, motor, language, social, or autism.',
      });
    }
    const ageRange = normalizeResourceAgeRange(ageRangeRaw);
    if (!ageRange) {
      return res.status(400).json({ message: 'Choose a valid age range.' });
    }
    if (
      content_type !== 'article' &&
      content_type !== 'video' &&
      content_type !== 'image' &&
      content_type !== 'resource'
    ) {
      return res.status(400).json({
        message: 'content_type must be article, video, image, or resource.',
      });
    }

    const uploadedVideo = req.files?.video?.[0];
    const uploadedImage = req.files?.image?.[0];
    const uploadedAttachment = req.files?.attachment?.[0];

    let video_url = null;
    let image_url = null;
    let media_url = null;

    const usesAttachment = content_type === 'article' || content_type === 'resource';
    if (usesAttachment && uploadedAttachment) {
      const docCheck = await validateDocumentUpload(uploadedAttachment);
      if (!docCheck.ok) {
        return res.status(400).json({ message: docCheck.error });
      }
      try {
        const extractedHtml = await extractDocumentHtml(
          uploadedAttachment.buffer,
          uploadedAttachment.originalname || '',
        );
        if (extractedHtml) {
          body_text = mergeArticleBody(body_text, extractedHtml);
        }
        const inlineDoc = isInlineDocumentName(uploadedAttachment.originalname || '');
        const inlinedText = htmlToPlain(body_text);
        if (!inlinedText || !inlineDoc) {
          media_url = await uploadFileToBucket(
            therapistId,
            uploadedAttachment,
            attachmentContentType,
          );
        }
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload attachment: ${detail}` : 'Failed to upload attachment.',
        });
      }
    }

    if (uploadedVideo) {
      if (!isAllowedVideoOnly(uploadedVideo)) {
        return res.status(400).json({
          message: 'Invalid video type. Allowed: MP4 or MOV.',
        });
      }
      try {
        video_url = await uploadMediaFile(therapistId, uploadedVideo);
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload video: ${detail}` : 'Failed to upload video.',
        });
      }
    }

    if (uploadedImage) {
      const imgCheck = await validateProfileImageUpload(uploadedImage);
      if (!imgCheck.ok) {
        return res.status(400).json({ message: imgCheck.error });
      }
      try {
        image_url = await uploadMediaFile(therapistId, uploadedImage);
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload image: ${detail}` : 'Failed to upload image.',
        });
      }
    }

    if (content_type === 'article' && !htmlToPlain(body_text)) {
      return res.status(400).json({
        message:
          'Article body is required. Type text in the editor or attach a Word (.docx), PDF, or TXT file with readable content.',
      });
    }

    if (content_type === 'resource' && !resourceHasContent(body_text, video_url, image_url, media_url)) {
      return res.status(400).json({
        message: 'Add body text, a document, a video, or an image.',
      });
    }

    if (content_type === 'video' && !video_url) {
      return res.status(400).json({ message: 'Video file is required.' });
    }

    if (content_type === 'image' && !image_url) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    const insertRow = {
      therapist_id: therapistId,
      publisher: therapistName,
      title,
      content_type,
      domain: domainRaw,
      age_range: ageRange,
      body_text: body_text || null,
      media_url,
      video_url,
      image_url,
    };

    const { data: row, error: insErr } = await supabase
      .from('resources')
      .insert(insertRow)
      .select(RESOURCE_SELECT)
      .single();

    if (insErr) {
      console.error('resources insert error:', insErr);
      return res.status(500).json({ message: mapInsertErrorMessage(insErr) });
    }

    return res.status(201).json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function updateResource(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const therapistName = await resolveTherapistName(req);
    const { id } = req.params;

    const { data: existing, error: findErr } = await supabase
      .from('resources')
      .select(RESOURCE_SELECT)
      .eq('resources_id', id)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    if (!resourceOwnedByTherapist(existing, therapistName, therapistId)) {
      return res.status(403).json({ message: 'Not allowed.' });
    }

    const title = (req.body.title ?? '').trim();
    let body_text = (req.body.body_text ?? '').trim();

    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const uploadedVideo = req.files?.video?.[0];
    const uploadedImage = req.files?.image?.[0];
    const uploadedAttachment = req.files?.attachment?.[0];

    let video_url =
      existing.video_url ||
      (existing.content_type === 'video' ? existing.media_url : null);
    let image_url =
      existing.image_url ||
      (existing.content_type === 'image' ? existing.media_url : null);
    let media_url = existing.media_url;
    const oldObjectPaths = [];
    let content_type = existing.content_type;

    const usesAttachment =
      content_type === 'article' || content_type === 'resource' || content_type === 'video' || content_type === 'image';

    if (usesAttachment && uploadedAttachment) {
      const docCheck = await validateDocumentUpload(uploadedAttachment);
      if (!docCheck.ok) {
        return res.status(400).json({ message: docCheck.error });
      }
      try {
        const extractedHtml = await extractDocumentHtml(
          uploadedAttachment.buffer,
          uploadedAttachment.originalname || '',
        );
        if (extractedHtml) {
          body_text = mergeArticleBody(body_text || existing.body_text || '', extractedHtml);
        }
        const inlineDoc = isInlineDocumentName(uploadedAttachment.originalname || '');
        const inlinedText = htmlToPlain(body_text);
        if (!inlinedText || !inlineDoc) {
          media_url = await uploadFileToBucket(
            therapistId,
            uploadedAttachment,
            attachmentContentType,
          );
          oldObjectPaths.push(objectPathFromPublicUrl(existing.media_url));
        } else {
          oldObjectPaths.push(objectPathFromPublicUrl(existing.media_url));
          media_url = null;
        }
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload attachment: ${detail}` : 'Failed to upload attachment.',
        });
      }
    }

    if (uploadedVideo) {
      if (!isAllowedVideoOnly(uploadedVideo)) {
        return res.status(400).json({
          message: 'Invalid video type. Allowed: MP4 or MOV.',
        });
      }
      try {
        video_url = await uploadMediaFile(therapistId, uploadedVideo);
        oldObjectPaths.push(
          objectPathFromPublicUrl(existing.video_url) ||
            (existing.content_type === 'video' ? objectPathFromPublicUrl(existing.media_url) : null),
        );
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload video: ${detail}` : 'Failed to upload video.',
        });
      }
    }

    if (uploadedImage) {
      const imgCheck = await validateProfileImageUpload(uploadedImage);
      if (!imgCheck.ok) {
        return res.status(400).json({ message: imgCheck.error });
      }
      try {
        image_url = await uploadMediaFile(therapistId, uploadedImage);
        oldObjectPaths.push(
          objectPathFromPublicUrl(existing.image_url) ||
            (existing.content_type === 'image' ? objectPathFromPublicUrl(existing.media_url) : null),
        );
      } catch (uploadErr) {
        const detail = uploadErr.message || String(uploadErr);
        return res.status(500).json({
          message: detail ? `Failed to upload image: ${detail}` : 'Failed to upload image.',
        });
      }
    }

    if (content_type === 'article' && !htmlToPlain(body_text)) {
      return res.status(400).json({
        message:
          'Article body is required. Type text in the editor or attach a Word (.docx), PDF, or TXT file with readable content.',
      });
    }

    if (
      (content_type === 'resource' || content_type === 'video' || content_type === 'image') &&
      !resourceHasContent(body_text, video_url, image_url, media_url)
    ) {
      return res.status(400).json({
        message: 'Add body text, a document, a video, or an image.',
      });
    }

    if (content_type === 'video' || content_type === 'image') {
      content_type = 'resource';
      if (existing.content_type === 'video' && video_url && !image_url) {
        media_url = null;
      }
      if (existing.content_type === 'image' && image_url && !video_url) {
        media_url = null;
      }
    }

    const updateRow = {
      title,
      content_type,
      body_text: body_text || null,
      media_url,
      video_url,
      image_url,
    };

    const { data: row, error: updErr } = await supabase
      .from('resources')
      .update(updateRow)
      .eq('resources_id', id)
      .eq('therapist_id', therapistId)
      .select(RESOURCE_SELECT)
      .single();

    if (updErr) {
      console.error('resources update error:', updErr);
      return res.status(500).json({ message: 'Failed to update resource.' });
    }

    const pathsToRemove = [...new Set(oldObjectPaths.filter(Boolean))];
    if (pathsToRemove.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(pathsToRemove);
      if (rmErr) {
        console.warn('Could not delete previous media object:', rmErr.message);
      }
    }

    return res.json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function deleteResource(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const therapistName = await resolveTherapistName(req);
    const { id } = req.params;

    const { data: existing, error: findErr } = await supabase
      .from('resources')
      .select(RESOURCE_SELECT)
      .eq('resources_id', id)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    if (!resourceOwnedByTherapist(existing, therapistName, therapistId)) {
      return res.status(403).json({ message: 'Not allowed.' });
    }

    const { error: delErr } = await supabase
      .from('resources')
      .delete()
      .eq('resources_id', id)
      .eq('therapist_id', therapistId);

    if (delErr) {
      console.error('resources delete error:', delErr);
      return res.status(500).json({ message: 'Failed to delete resource.' });
    }

    await removeStorageObject(existing.media_url);
    await removeStorageObject(existing.video_url);
    await removeStorageObject(existing.image_url);

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}
