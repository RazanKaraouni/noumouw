import supabase from '../config/supabase.js';
import { enrichParentRow, enrichParentRows } from '../utils/parentAge.js';

const PARENT_COLUMNS =
  'parent_id, user_id, full_name, email, gender, age, date_of_birth, profile_image_url, address, is_verified, is_suspended, suspended_at, created_at';

const CHILD_LIST_COLUMNS =
  'children_id, child_id, parent_id, full_name, date_of_birth, gender, notes, created_at';

export const getAllUsers = async ({ limit, offset } = {}) => {
  let q = supabase
    .from('parents')
    .select(PARENT_COLUMNS)
    .order('created_at', { ascending: false });

  if (limit != null) {
    const lim = Math.min(Math.max(1, Number(limit)), 500);
    const off = Math.max(0, Number(offset) || 0);
    q = q.range(off, off + lim - 1);
  }

  const { data, error } = await q;
  if (error) throw error;
  return enrichParentRows(data);
};

export const upsertUser = async (user) => {
  const { data, error } = await supabase
    .from('parents')
    .upsert(user, { onConflict: 'user_id' })
    .select(PARENT_COLUMNS)
    .single();

  if (error) throw error;
  return enrichParentRow(data);
};

export const getParentByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('parents')
    .select(PARENT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return enrichParentRow(data);
};

export const findUserByAnyId = async (idOrUserId) => {
  const { data: byUserId, error: userIdErr } = await supabase
    .from('parents')
    .select('parent_id, user_id, email')
    .eq('user_id', idOrUserId)
    .maybeSingle();
  if (userIdErr) throw userIdErr;
  if (byUserId) return byUserId;

  const { data: byParentId, error: parentIdErr } = await supabase
    .from('parents')
    .select('parent_id, user_id, email')
    .eq('parent_id', idOrUserId)
    .maybeSingle();
  if (parentIdErr) throw parentIdErr;
  return byParentId;
};

export const deleteParentById = async (parentId) => {
  const { error } = await supabase.from('parents').delete().eq('parent_id', parentId);
  if (error) throw error;
};

/** Parents directory: all parents with children_count (children.parent_id = parents.user_id). */
export const getParentsDirectory = async ({ limit, offset } = {}) => {
  let q = supabase
    .from('parents')
    .select(PARENT_COLUMNS)
    .order('created_at', { ascending: false });

  if (limit != null) {
    const lim = Math.min(Math.max(1, Number(limit)), 500);
    const off = Math.max(0, Number(offset) || 0);
    q = q.range(off, off + lim - 1);
  }

  const { data: parents, error } = await q;
  if (error) throw error;

  const { data: childRows, error: childErr } = await supabase
    .from('children')
    .select('parent_id');
  if (childErr) throw childErr;

  const countByUserId = new Map();
  for (const row of childRows || []) {
    if (!row.parent_id) continue;
    const key = String(row.parent_id);
    countByUserId.set(key, (countByUserId.get(key) || 0) + 1);
  }

  return enrichParentRows(parents || []).map((p) => ({
    ...p,
    children_count: p.user_id ? countByUserId.get(String(p.user_id)) || 0 : 0,
  }));
};

export const getChildrenForParentUserId = async (userId) => {
  const { data, error } = await supabase
    .from('children')
    .select(CHILD_LIST_COLUMNS)
    .eq('parent_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const suspendParentById = async (parentId) => {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('parents')
    .update({ is_suspended: true, suspended_at: stamp })
    .eq('parent_id', parentId)
    .select(PARENT_COLUMNS)
    .single();

  if (error) throw error;
  return enrichParentRow(data);
};

export const reactivateParentById = async (parentId) => {
  const { data, error } = await supabase
    .from('parents')
    .update({ is_suspended: false, suspended_at: null })
    .eq('parent_id', parentId)
    .select(PARENT_COLUMNS)
    .single();

  if (error) throw error;
  return enrichParentRow(data);
};
