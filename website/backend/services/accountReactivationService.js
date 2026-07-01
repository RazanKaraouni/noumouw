import supabase from '../config/supabase.js';
import { removeEmailFromBlocklist } from '../middleware/blocklistGuard.js';

/**
 * Clears moderation artifacts that outlive is_suspended (blocklist, auth ban).
 */
export async function clearSuspensionArtifacts({ email, userId } = {}) {
  if (email) {
    await removeEmailFromBlocklist(email);
  }

  if (userId) {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      });
      if (error) {
        console.warn('[clearSuspensionArtifacts] auth unban:', error.message || error);
      }
    } catch (err) {
      console.warn('[clearSuspensionArtifacts] auth unban:', err?.message || err);
    }
  }
}
