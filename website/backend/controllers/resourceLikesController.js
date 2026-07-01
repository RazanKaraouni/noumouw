import supabase from '../config/supabase.js';
import {
  sendNotification,
  THERAPIST_NOTIFICATION_TYPES,
} from '../services/notificationService.js';
import { getParentUserId, isParent } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

function requireParent(req, res) {
  const parentUserId = getParentUserId(req);
  if (!isParent(req) || !parentUserId) {
    res.status(403).json({ message: 'Parent sign-in required to like content.' });
    return null;
  }
  return String(parentUserId);
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
    console.error('[resourceLikes] parentCanReadTherapistResource:', error.message);
    return false;
  }
  return !!data;
}

export async function canParentLikeResource(parentUserId, row) {
  if (!row) return false;
  if (row.is_public === true) return true;
  return parentCanReadTherapistResource(parentUserId, row.therapist_id);
}

function contentTypeLabel(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t === 'article') return 'article';
  if (t === 'video') return 'video';
  if (t === 'image') return 'image';
  return 'resource';
}

/** GET /api/resources/likes?ids=uuid1,uuid2 */
export async function listMyResourceLikes(req, res) {
  try {
    const parentUserId = requireParent(req, res);
    if (!parentUserId) return undefined;

    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      return res.json({ likes: {} });
    }

    const q = await supabase
      .from('resource_likes')
      .select('resources_id')
      .eq('parent_user_id', parentUserId)
      .in('resources_id', ids);

    if (q.error) throw q.error;

    const likes = Object.fromEntries(ids.map((id) => [id, false]));
    for (const row of q.data || []) {
      const rid = row.resources_id;
      if (rid) likes[rid] = true;
    }

    return res.json({ likes });
  } catch (err) {
    console.error('[listMyResourceLikes]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/resources/:id/like — toggle like; notifies resource owner therapist on like. */
export async function toggleResourceLike(req, res) {
  try {
    const parentUserId = requireParent(req, res);
    if (!parentUserId) return undefined;

    const resourceId = String(req.params.id || '').trim();
    if (!resourceId) {
      return res.status(400).json({ message: 'Resource id is required.' });
    }

    const { data: row, error: rowErr } = await supabase
      .from('resources')
      .select('resources_id, therapist_id, title, content_type, is_public')
      .eq('resources_id', resourceId)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    if (!(await canParentLikeResource(parentUserId, row))) {
      return res.status(403).json({ message: 'Not allowed to like this resource.' });
    }

    const therapistId = String(row.therapist_id || '').trim();
    if (!therapistId) {
      return res.status(400).json({ message: 'Resource has no owning therapist.' });
    }

    const existing = await supabase
      .from('resource_likes')
      .select('resource_like_id')
      .eq('resources_id', resourceId)
      .eq('parent_user_id', parentUserId)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (existing.data) {
      const del = await supabase
        .from('resource_likes')
        .delete()
        .eq('resources_id', resourceId)
        .eq('parent_user_id', parentUserId);
      if (del.error) throw del.error;
      return res.json({ liked: false, resources_id: resourceId });
    }

    const ins = await supabase.from('resource_likes').insert({
      resources_id: resourceId,
      parent_user_id: parentUserId,
    });
    if (ins.error) throw ins.error;

    const resourceTitle = (row.title || 'Learn content').trim();
    const kind = contentTypeLabel(row.content_type);

    try {
      await sendNotification({
        recipientId: therapistId,
        senderId: parentUserId,
        type: THERAPIST_NOTIFICATION_TYPES.RESOURCE_LIKE,
        title: 'New like on Learn content',
        message: `A parent liked your ${kind} "${resourceTitle}".`,
      });
    } catch (notifErr) {
      console.error('[toggleResourceLike] sendNotification:', notifErr?.message || notifErr);
    }

    return res.json({ liked: true, resources_id: resourceId });
  } catch (err) {
    console.error('[toggleResourceLike]', err);
    return sendErrorResponse(res, err, 500);
  }
}
