import supabase from '../config/supabase.js';
import { getParentUserId, isParent } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { canParentLikeResource } from './resourceLikesController.js';

function requireParent(req, res) {
  const parentUserId = getParentUserId(req);
  if (!isParent(req) || !parentUserId) {
    res.status(403).json({ message: 'Parent sign-in required to save content.' });
    return null;
  }
  return String(parentUserId);
}

/** GET /api/resources/saved — bookmarked resources for profile settings */
export async function listMySavedResources(req, res) {
  try {
    const parentUserId = requireParent(req, res);
    if (!parentUserId) return undefined;

    const savesQ = await supabase
      .from('resource_saves')
      .select('resources_id, created_at')
      .eq('parent_user_id', parentUserId)
      .order('created_at', { ascending: false });

    if (savesQ.error) throw savesQ.error;

    const savedIds = (savesQ.data || [])
      .map((r) => r.resources_id)
      .filter(Boolean);
    if (!savedIds.length) {
      return res.json({ resources: [] });
    }

    const resourcesQ = await supabase
      .from('resources')
      .select(
        'resources_id, title, content_type, media_url, video_url, image_url, body_text, created_at, is_public, therapist_id',
      )
      .in('resources_id', savedIds);

    if (resourcesQ.error) throw resourcesQ.error;

    const readable = [];
    for (const row of resourcesQ.data || []) {
      if (await canParentLikeResource(parentUserId, row)) {
        readable.push(row);
      }
    }

    const byId = new Map(readable.map((r) => [r.resources_id, r]));
    const ordered = savedIds.map((id) => byId.get(id)).filter(Boolean);

    return res.json({ resources: ordered });
  } catch (err) {
    console.error('[listMySavedResources]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** GET /api/resources/saves?ids=uuid1,uuid2 */
export async function listMyResourceSaves(req, res) {
  try {
    const parentUserId = requireParent(req, res);
    if (!parentUserId) return undefined;

    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      return res.json({ saves: {} });
    }

    const q = await supabase
      .from('resource_saves')
      .select('resources_id')
      .eq('parent_user_id', parentUserId)
      .in('resources_id', ids);

    if (q.error) throw q.error;

    const saves = Object.fromEntries(ids.map((id) => [id, false]));
    for (const row of q.data || []) {
      const rid = row.resources_id;
      if (rid) saves[rid] = true;
    }

    return res.json({ saves });
  } catch (err) {
    console.error('[listMyResourceSaves]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/resources/:id/save — toggle bookmark */
export async function toggleResourceSave(req, res) {
  try {
    const parentUserId = requireParent(req, res);
    if (!parentUserId) return undefined;

    const resourceId = String(req.params.id || '').trim();
    if (!resourceId) {
      return res.status(400).json({ message: 'Resource id is required.' });
    }

    const { data: row, error: rowErr } = await supabase
      .from('resources')
      .select('resources_id, therapist_id, is_public')
      .eq('resources_id', resourceId)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    if (!(await canParentLikeResource(parentUserId, row))) {
      return res.status(403).json({ message: 'Not allowed to save this resource.' });
    }

    const existing = await supabase
      .from('resource_saves')
      .select('resource_save_id')
      .eq('resources_id', resourceId)
      .eq('parent_user_id', parentUserId)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (existing.data) {
      const del = await supabase
        .from('resource_saves')
        .delete()
        .eq('resources_id', resourceId)
        .eq('parent_user_id', parentUserId);
      if (del.error) throw del.error;
      return res.json({ saved: false, resources_id: resourceId });
    }

    const ins = await supabase.from('resource_saves').insert({
      resources_id: resourceId,
      parent_user_id: parentUserId,
    });
    if (ins.error) throw ins.error;

    return res.json({ saved: true, resources_id: resourceId });
  } catch (err) {
    console.error('[toggleResourceSave]', err);
    return sendErrorResponse(res, err, 500);
  }
}
