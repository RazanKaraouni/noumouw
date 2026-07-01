import supabase from '../config/supabase.js';
import { normalizeBlocklistEmail } from '../middleware/blocklistGuard.js';
import { sendAccountSuspensionWarningEmail } from './moderationEmailService.js';

/**
 * Mark parent row suspended (single source of truth for admin moderation).
 */
export async function suspendParentByUserId(userId, reason = 'Admin suspension') {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('parents')
    .update({ is_suspended: true, suspended_at: stamp })
    .eq('user_id', userId)
    .select('parent_id, user_id, email, is_suspended')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Parent account not found for this user.');
  return { ...data, reason };
}

export async function suspendParentByParentId(parentId, reason = 'Admin suspension') {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('parents')
    .update({ is_suspended: true, suspended_at: stamp })
    .eq('parent_id', parentId)
    .select('parent_id, user_id, email, is_suspended')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Parent account not found.');
  return { ...data, reason };
}

async function emailForUserId(userId) {
  const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  return normalizeBlocklistEmail(authUser?.user?.email);
}

/**
 * Full parent suspension: parents.is_suspended + blocklist + auth ban.
 * Used by community posts, report queue, and suspend-account.
 */
export async function suspendParentAccount(userId, reason = 'Admin suspension') {
  const parent = await suspendParentByUserId(userId, reason);
  const email =
    normalizeBlocklistEmail(parent.email) || (await emailForUserId(userId));

  if (email) {
    const { error: blockErr } = await supabase.from('email_blocklist').upsert(
      { email, reason: String(reason || '').trim() || 'Moderation action' },
      { onConflict: 'email' },
    );
    if (blockErr) throw blockErr;
  }

  try {
    const { error: banErr } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (banErr) console.warn('[suspendParentAccount] auth ban:', banErr.message || banErr);
  } catch (banErr) {
    console.warn('[suspendParentAccount] auth ban:', banErr?.message || banErr);
  }

  try {
    await supabase.auth.admin.signOut(userId, 'global');
  } catch (signOutErr) {
    console.warn('[suspendParentAccount] signOut:', signOutErr?.message || signOutErr);
  }

  if (email) {
    try {
      sendAccountSuspensionWarningEmail({ toEmail: email, reason });
    } catch (mailErr) {
      console.warn('[suspendParentAccount] email:', mailErr?.message || mailErr);
    }
  }

  return { ...parent, email };
}
