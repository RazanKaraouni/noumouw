import supabase from '../config/supabase.js';
import FcmService from './fcmService.js';
import { sendModerationWarningEmail } from './moderationEmailService.js';
import {
  notifyParent,
  sendNotification,
  THERAPIST_NOTIFICATION_TYPES,
} from './notificationService.js';

const DEFAULT_REASON = 'Moderation warning';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function resolveUserEmail(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  const [parentRes, therapistRes] = await Promise.all([
    supabase.from('parents').select('email').eq('user_id', id).maybeSingle(),
    supabase.from('therapists').select('email').eq('user_id', id).maybeSingle(),
  ]);

  if (parentRes.data?.email) return normalizeEmail(parentRes.data.email);
  if (therapistRes.data?.email) return normalizeEmail(therapistRes.data.email);

  const { data: authUser, error } = await supabase.auth.admin.getUserById(id);
  if (error) throw error;
  return normalizeEmail(authUser?.user?.email);
}

async function resolveUserRole(userId) {
  const [parentRes, therapistRes] = await Promise.all([
    supabase.from('parents').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase
      .from('therapists')
      .select('therapist_id, user_id')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (parentRes.data) return { role: 'parent', therapistId: null };
  if (therapistRes.data) {
    return { role: 'therapist', therapistId: therapistRes.data.therapist_id };
  }
  return { role: null, therapistId: null };
}

async function notifyModerationActionAsync({ userId, action, reason }) {
  const id = String(userId || '').trim();
  if (!id) return;

  const text = String(reason || '').trim() || DEFAULT_REASON;
  const isWarn = action === 'warn';

  const { role, therapistId } = await resolveUserRole(id);
  if (!role) {
    console.warn('[moderationNotify] could not resolve role for user', id);
    return;
  }

  if (role === 'parent') {
    const title = isWarn ? 'Community warning' : 'Account suspended';
    const message = isWarn
      ? `You received a warning from Noumouw moderation: ${text}`
      : `Your Noumouw account has been suspended. Reason: ${text}`;
    const type = isWarn ? 'moderation_warning' : 'moderation_suspended';

    await notifyParent({
      userId: id,
      type,
      title,
      message,
      data: { action, reason: text },
    });

    if (isWarn) {
      try {
        const email = await resolveUserEmail(id);
        if (email) sendModerationWarningEmail({ toEmail: email, reason: text });
      } catch (err) {
        console.error('[moderationNotify] parent warning email:', err?.message || err);
      }
    }
    return;
  }

  const title = isWarn ? 'Moderation warning' : 'Account suspended';
  const message = isWarn
    ? `You received a warning from Noumouw moderation: ${text}`
    : `Your therapist account has been suspended. Reason: ${text}`;
  const type = isWarn
    ? THERAPIST_NOTIFICATION_TYPES.MODERATION_WARNING
    : THERAPIST_NOTIFICATION_TYPES.MODERATION_SUSPENSION;

  await sendNotification({
    recipientId: therapistId,
    type,
    title,
    message,
  });

  try {
    await FcmService.instance.sendToUser(id, {
      title,
      body: message,
      data: {
        type,
        action,
        reason: text,
      },
    });
  } catch (err) {
    console.error('[moderationNotify] therapist FCM:', err?.message || err);
  }

  if (isWarn) {
    try {
      const email = await resolveUserEmail(id);
      if (email) sendModerationWarningEmail({ toEmail: email, reason: text });
    } catch (err) {
      console.error('[moderationNotify] therapist warning email:', err?.message || err);
    }
  }
}

/** Fire-and-forget moderation notification (does not block admin actions). */
export function queueModerationNotification({ userId, action, reason }) {
  Promise.resolve()
    .then(() => notifyModerationActionAsync({ userId, action, reason }))
    .catch((err) => {
      console.error('[moderationNotify]', err?.message || err);
    });
}
