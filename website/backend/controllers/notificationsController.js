import supabase from '../config/supabase.js';
import { getParentUserId, getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

function mapTherapistNotificationRow(row) {
  return {
    id: row.notification_id,
    recipientId: row.recipient_id,
    senderId: row.sender_id,
    type: row.type,
    title: row.title || '',
    message: row.message || '',
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

/** GET /api/notifications — therapist notifications (newest first). */
export async function listTherapistNotifications(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ message: 'Therapist session required.' });
    }

    const q = await supabase
      .from('therapist_notifications')
      .select(
        'notification_id, recipient_id, sender_id, type, title, message, is_read, created_at',
      )
      .eq('recipient_id', therapistId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (q.error) throw q.error;

    return res.json((q.data || []).map(mapTherapistNotificationRow));
  } catch (err) {
    console.error('[listTherapistNotifications]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** PATCH /api/notifications/:id/read — mark one therapist notification as read. */
export async function markTherapistNotificationRead(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ message: 'Therapist session required.' });
    }

    const notificationId = String(req.params.id || '').trim();
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification id is required.' });
    }

    const q = await supabase
      .from('therapist_notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)
      .eq('recipient_id', therapistId)
      .select(
        'notification_id, recipient_id, sender_id, type, title, message, is_read, created_at',
      )
      .maybeSingle();

    if (q.error) throw q.error;
    if (!q.data) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json(mapTherapistNotificationRow(q.data));
  } catch (err) {
    console.error('[markTherapistNotificationRead]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** PATCH /api/notifications/read-all — mark all therapist notifications as read. */
export async function markAllTherapistNotificationsRead(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ message: 'Therapist session required.' });
    }

    const q = await supabase
      .from('therapist_notifications')
      .update({ is_read: true })
      .eq('recipient_id', therapistId)
      .eq('is_read', false)
      .select('notification_id');

    if (q.error) throw q.error;

    return res.json({ updated: (q.data || []).length });
  } catch (err) {
    console.error('[markAllTherapistNotificationsRead]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** GET /api/notifications/mine — recent alerts for the authenticated parent. */
export async function listMyNotifications(req, res) {
  try {
    const userId = getParentUserId(req) || req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Parent session required.' });
    }

    const q = await supabase
      .from('notifications')
      .select('notification_id, title, body, type, appointment_id, sent_at, created_at')
      .eq('user_id', userId)
      .is('cleared_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (q.error) throw q.error;

    const rows = (q.data || []).map((n) => ({
      id: n.notification_id,
      title: n.title || '',
      message: n.body || '',
      timestamp: n.sent_at || n.created_at || '',
      type: n.type || '',
      appointment_id: n.appointment_id,
    }));

    return res.json(rows);
  } catch (err) {
    console.error('[listMyNotifications]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/notifications/clear — mark notifications cleared (not deleted). */
export async function clearMyNotifications(req, res) {
  try {
    const userId = getParentUserId(req) || req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Parent session required.' });
    }

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => String(id || '').trim()).filter(Boolean)
      : null;

    const clearedAt = new Date().toISOString();
    let query = supabase
      .from('notifications')
      .update({ cleared_at: clearedAt })
      .eq('user_id', userId)
      .is('cleared_at', null);

    if (ids?.length) {
      query = query.in('notification_id', ids);
    }

    const q = await query.select('notification_id');
    if (q.error) throw q.error;

    return res.json({
      cleared: (q.data || []).length,
      cleared_at: clearedAt,
    });
  } catch (err) {
    console.error('[clearMyNotifications]', err);
    return sendErrorResponse(res, err, 500);
  }
}
