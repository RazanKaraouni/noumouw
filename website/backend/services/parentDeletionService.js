import supabase from '../config/supabase.js';
import { deleteChildAndRelated } from './childDeletionService.js';
import { deleteParentById, getChildrenForParentUserId } from '../models/userModel.js';

const del = async (table, column, value) => {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
};

const delIn = async (table, column, values) => {
  if (!values?.length) return;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error) throw error;
};

/** Ignore missing tables/columns on older schemas. */
function isIgnorableDeleteError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

const delOptional = async (table, column, value) => {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error && !isIgnorableDeleteError(error)) throw error;
};

const delInOptional = async (table, column, values) => {
  if (!values?.length) return;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error && !isIgnorableDeleteError(error)) throw error;
};

async function deleteCommunityContentForUser(authUserId) {
  const { data: posts, error: postsErr } = await supabase
    .from('community_posts')
    .select('post_id')
    .eq('user_id', authUserId);
  if (postsErr && !isIgnorableDeleteError(postsErr)) throw postsErr;

  const postIds = (posts || []).map((p) => p.post_id).filter(Boolean);
  await delInOptional('community_comments', 'post_id', postIds);
  await delInOptional('community_likes', 'post_id', postIds);
  await delInOptional('community_saved_posts', 'post_id', postIds);

  await delOptional('community_comments', 'user_id', authUserId);
  await delOptional('community_posts', 'user_id', authUserId);
  await delOptional('community_likes', 'user_id', authUserId);
  await delOptional('community_saved_posts', 'user_id', authUserId);
  await delOptional('community_blocked_users', 'blocker_id', authUserId);
  await delOptional('community_blocked_users', 'blocked_user_id', authUserId);
}

async function deleteChatRoomsForParent(authUserId) {
  const { data: rooms, error: roomsErr } = await supabase
    .from('chat_rooms')
    .select('chat_room_id')
    .eq('parent_id', authUserId);
  if (roomsErr && !isIgnorableDeleteError(roomsErr)) throw roomsErr;

  const roomIds = (rooms || []).map((r) => r.chat_room_id).filter(Boolean);
  await delInOptional('messages', 'room_id', roomIds);
  await delOptional('chat_rooms', 'parent_id', authUserId);
}

/**
 * Remove a parent profile, dependent rows, then the linked Supabase Auth user.
 * Order matters: auth.users cannot be deleted while public.parents still references it.
 */
export async function deleteParentAccount({ parentId, userId = null }) {
  if (!parentId) {
    const err = new Error('parent_id is required.');
    err.status = 400;
    throw err;
  }

  const { data: parent, error: parentErr } = await supabase
    .from('parents')
    .select('parent_id, user_id, full_name, email')
    .eq('parent_id', parentId)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (!parent) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  const authUserId = userId || parent.user_id || null;

  if (authUserId) {
    const children = await getChildrenForParentUserId(authUserId);
    for (const child of children) {
      await deleteChildAndRelated(child.children_id, { parentId: authUserId });
    }

    await delOptional('screening_results', 'parent_id', authUserId);
    await delOptional('resource_saves', 'parent_user_id', authUserId);
    await delOptional('user_warnings', 'user_id', authUserId);
    await delOptional('resource_reports', 'reporter_id', authUserId);
    await delOptional('parenting_tips', 'submitted_by', authUserId);
    await delOptional('device_tokens', 'user_id', authUserId);

    await deleteCommunityContentForUser(authUserId);
    await deleteChatRoomsForParent(authUserId);
  }

  // Parent-level reports (e.g. milestone_tracking without a child_id).
  await del('reports', 'parent_id', parentId);

  await deleteParentById(parentId);

  if (authUserId) {
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(authUserId);
    if (authDeleteErr && authDeleteErr.status !== 404) {
      throw authDeleteErr;
    }
  }

  return parent;
}
