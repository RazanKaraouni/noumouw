import supabase from '../config/supabase.js';
import { ensureParentRowForAuthUser } from './parentResolver.js';

/**
 * Inserts a row into `public.reports` for admin clinical list views.
 */
export async function persistClinicalReport({
  parentAuthId,
  child,
  reportType,
  title,
  dataPayload,
  parentHints = {},
}) {
  const parentsPk = await ensureParentRowForAuthUser(parentAuthId, parentHints);
  if (!parentsPk) {
    return {
      ok: false,
      error: 'Parent profile not found; link parents.user_id to this account or complete signup.',
    };
  }

  const { data: parentRow, error: parentErr } = await supabase
    .from('parents')
    .select('parent_id, user_id, full_name, email, address')
    .eq('parent_id', parentsPk)
    .maybeSingle();
  if (parentErr) return { ok: false, error: parentErr.message };

  const enrichedPayload = {
    ...dataPayload,
    parent: {
      parent_id: parentRow?.parent_id ?? parentsPk,
      user_id: parentRow?.user_id ?? parentAuthId,
      full_name: parentRow?.full_name ?? parentHints.fullName ?? null,
      email: parentRow?.email ?? parentHints.email ?? null,
      address: parentRow?.address ?? null,
      ...(dataPayload.parent && typeof dataPayload.parent === 'object' ? dataPayload.parent : {}),
    },
    child: {
      children_id: child.children_id,
      child_id: child.child_id ?? null,
      parent_id: child.parent_id ?? null,
      full_name: child.full_name ?? null,
      date_of_birth: child.date_of_birth ?? null,
      gender: child.gender ?? null,
      notes: child.notes ?? '',
      ...(dataPayload.child && typeof dataPayload.child === 'object' ? dataPayload.child : {}),
    },
  };

  const { data, error } = await supabase
    .from('reports')
    .insert({
      child_id: child.children_id,
      parent_id: parentsPk,
      report_type: reportType,
      title,
      data_payload: enrichedPayload,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, report: data };
}
