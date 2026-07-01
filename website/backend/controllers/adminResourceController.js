import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { getAdminId } from '../utils/authContext.js';
import { writeModerationAudit } from '../services/moderationAuditService.js';
import supabase from '../config/supabase.js';
import { apiCache } from '../utils/ttlCache.js';

const ADMIN_RESOURCES_CACHE_TTL_MS = 30_000;

function invalidateAdminResourcesCache() {
  apiCache.invalidate('admin:resources:list');
}

const BUCKET = 'therapist-content';
const RESOURCE_COLUMNS =
  'resources_id, title, content_type, body_text, media_url, video_url, image_url, domain, age_range, is_public, created_at, therapist_id, publisher';

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

async function therapistNameById(therapistIds) {
  const unique = [...new Set((therapistIds || []).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('therapists')
    .select('therapist_id, full_name')
    .in('therapist_id', unique);

  if (error) throw error;

  return new Map((data || []).map((t) => [t.therapist_id, t.full_name || '—']));
}

function withTherapistNames(rows, nameMap) {
  return (rows || []).map((row) => {
    const publisher = (row.publisher || '').trim();
    return {
      ...row,
      therapist_name: nameMap.get(row.therapist_id) || publisher || '—',
    };
  });
}

function countRowsById(rows, idField) {
  const counts = {};
  for (const row of rows || []) {
    const id = row[idField];
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

async function fetchEngagementRows(table, resourceIds, columnCandidates) {
  for (const column of columnCandidates) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .in(column, resourceIds);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('column') || msg.includes('does not exist')) continue;
      throw error;
    }
    return { data: data || [], column };
  }
  return { data: [], column: columnCandidates[0] };
}

async function engagementCountsForResources(resourceIds) {
  const unique = [...new Set((resourceIds || []).filter(Boolean))];
  if (unique.length === 0) {
    return { likes: {}, saves: {} };
  }

  const [likeResult, saveResult] = await Promise.all([
    fetchEngagementRows('resource_likes', unique, ['resources_id']),
    fetchEngagementRows('resource_saves', unique, ['resources_id', 'resource_id']),
  ]);

  return {
    likes: countRowsById(likeResult.data, likeResult.column),
    saves: countRowsById(saveResult.data, saveResult.column),
  };
}

function withEngagement(rows, likes, saves) {
  return (rows || []).map((row) => ({
    ...row,
    likes_count: likes[row.resources_id] || 0,
    saves_count: saves[row.resources_id] || 0,
  }));
}

function isMissingColumnError(error, column) {
  const detail = String(error?.message || '').toLowerCase();
  return detail.includes(column) && detail.includes('column');
}

async function listResourcesForAdmin() {
  return supabase
    .from('resources')
    .select(RESOURCE_COLUMNS)
    .order('created_at', { ascending: false });
}

/** GET /api/admin/resources — list therapist uploads for moderation. */
export async function listAdminResources(req, res) {
  try {
    const payload = await apiCache.getOrSet(
      'admin:resources:list',
      ADMIN_RESOURCES_CACHE_TTL_MS,
      async () => {
        const { data: resources, error } = await listResourcesForAdmin();
        if (error) throw error;

        const therapistIds = (resources || []).map((r) => r.therapist_id).filter(Boolean);
        const nameMap = therapistIds.length
          ? await therapistNameById(therapistIds)
          : new Map();
        const { likes, saves } = await engagementCountsForResources(
          (resources || []).map((r) => r.resources_id),
        );
        return withEngagement(withTherapistNames(resources, nameMap), likes, saves);
      },
    );
    return res.json(payload);
  } catch (e) {
    console.error(e);
    if (isMissingColumnError(e, 'is_public')) {
      return res.status(500).json({
        message:
          'Database missing is_public column — run backend/sql/resources_is_public.sql in Supabase.',
      });
    }
    return res.status(500).json({ message: e.message || 'Server error.' });
  }
}

/** PATCH /api/admin/resources/:id/public */
export async function setAdminResourcePublic(req, res) {
  try {
    const { id } = req.params;
    const is_public = Boolean(req.body?.is_public);

    const { data: row, error } = await supabase
      .from('resources')
      .update({ is_public })
      .eq('resources_id', id)
      .select(RESOURCE_COLUMNS)
      .single();

    if (error) {
      console.error('admin resources public toggle error:', error);
      if (isMissingColumnError(error, 'is_public')) {
        return res.status(500).json({
          message:
            'Database missing is_public column — run backend/sql/resources_is_public.sql in Supabase.',
        });
      }
      return res.status(500).json({
        message: userFacingErrorMessage(error),
      });
    }
    if (!row) {
      return res.status(404).json({ message: 'Resource not found.' });
    }

    const nameMap = row.therapist_id
      ? await therapistNameById([row.therapist_id])
      : new Map();
    invalidateAdminResourcesCache();
    return res.json(withTherapistNames([row], nameMap)[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}

/** DELETE /api/admin/resources/:id */
export async function deleteAdminResource(req, res) {
  try {
    const { id } = req.params;

    const { data: existing, error: findErr } = await supabase
      .from('resources')
      .select('resources_id, media_url, title')
      .eq('resources_id', id)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ message: 'Resource not found.' });
    }

    const { error: delErr } = await supabase.from('resources').delete().eq('resources_id', id);

    if (delErr) {
      console.error('admin resources delete error:', delErr);
      return res.status(500).json({ message: 'Failed to delete resource.' });
    }

    const objectPath = objectPathFromPublicUrl(existing.media_url);
    if (objectPath) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
      if (rmErr) {
        console.warn('Could not delete media object:', rmErr.message);
      }
    }

    await writeModerationAudit({
      event_type: 'resource_deleted',
      adminId: getAdminId(req),
      targetTable: 'resources',
      targetId: id,
      metadata: {
        target_label: existing.title || 'Resource',
        reason: 'Admin deleted resource',
      },
    });

    invalidateAdminResourcesCache();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error.' });
  }
}
