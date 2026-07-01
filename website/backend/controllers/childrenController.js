import supabase from '../config/supabase.js';
import { getParentSupabase } from '../utils/supabaseForRequest.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { deleteChildAndRelated } from '../services/childDeletionService.js';
import { validateRequired, validationErrorResponse } from '../utils/validation.js';
import {
  attachSignedChildProfileUrl,
  attachSignedChildProfileUrls,
} from '../utils/childProfileSignedUrl.js';

const GENDERS = new Set(['Male', 'Female', 'Other']);

const CHILD_COLUMNS =
  'children_id, child_id, parent_id, full_name, date_of_birth, gender, notes, profile_image_url, created_at';

async function enrichWithParents(childrenRows) {
  const rows = childrenRows || [];
  const parentIds = [...new Set(rows.map((c) => c.parent_id).filter(Boolean))];
  if (parentIds.length === 0) return rows.map((c) => ({ ...c, parent: null }));

  const { data: parents, error: parentsErr } = await supabase
    .from('parents')
    .select('parent_id, user_id, full_name, email')
    .in('user_id', parentIds);

  if (parentsErr) throw parentsErr;

  const parentMap = {};
  (parents || []).forEach((p) => {
    parentMap[p.user_id] = p;
  });

  return rows.map((c) => ({
    ...c,
    parent: c.parent_id ? parentMap[c.parent_id] || null : null,
    parent_name: c.parent_id ? (parentMap[c.parent_id]?.full_name || null) : null,
  }));
}

export async function listChildren(req, res) {
  try {
    // SERVICE ROLE: justified because admin-only route lists all children across parents.
    const { data, error } = await supabase
      .from('children')
      .select(CHILD_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const enriched = await attachSignedChildProfileUrls(await enrichWithParents(data || []));
    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function createChild(req, res) {
  try {
    const parentUserId = req.auth?.parentUserId;
    if (!parentUserId) {
      return res.status(403).json({ message: 'Parent access only.' });
    }

    const requiredErrors = validateRequired(['full_name', 'date_of_birth'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const {
      full_name,
      date_of_birth,
      gender,
      notes,
      profile_image_url,
    } = req.body;

    if (gender != null && gender !== '' && !GENDERS.has(gender)) {
      return res.status(400).json({ errors: ['gender must be Male, Female, Other, or omitted.'] });
    }

    const payload = {
      parent_id: parentUserId,
      full_name: String(full_name).trim(),
      date_of_birth,
      gender: gender || null,
      notes: notes != null && String(notes).trim() ? String(notes).trim() : null,
      profile_image_url:
        profile_image_url != null && String(profile_image_url).trim()
          ? String(profile_image_url).trim()
          : null,
    };

    const db = getParentSupabase(req);
    const { data, error } = await db
      .from('children')
      .insert(payload)
      .select(CHILD_COLUMNS)
      .single();

    if (error) throw error;
    const [enriched] = await attachSignedChildProfileUrls(await enrichWithParents([data]));
    return res.status(201).json(enriched);
  } catch (error) {
    const msg = error?.message || '';
    const code = error?.code;
    if (code === '23503' || /foreign key/i.test(msg)) {
      return res
        .status(400)
        .json({ message: 'Invalid parent_id: parent must exist in the system.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function deleteChild(req, res) {
  try {
    const parentUserId = req.auth?.parentUserId;
    if (!parentUserId) {
      return res.status(403).json({ message: 'Parent access only.' });
    }

    const childIdentifier =
      req.params.children_id || req.params.child_id || req.params.id;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id is required.' });
    }

    const numericId = Number(childIdentifier);
    if (!Number.isFinite(numericId) || !Number.isInteger(numericId)) {
      return res.status(400).json({ message: 'children_id must be an integer.' });
    }

    const db = getParentSupabase(req);
    const { data: child, error: childErr } = await db
      .from('children')
      .select('children_id, parent_id')
      .eq('children_id', numericId)
      .maybeSingle();

    if (childErr) throw childErr;
    if (!child) {
      return res.status(404).json({ message: 'Child not found.' });
    }
    if (String(child.parent_id) !== String(parentUserId)) {
      return res.status(403).json({ message: 'You can only delete your own children.' });
    }

    await deleteChildAndRelated(numericId);
    return res.json({ message: 'Child deleted.' });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: userFacingErrorMessage(error)});
  }
}
