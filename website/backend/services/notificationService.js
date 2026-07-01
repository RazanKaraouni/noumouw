import supabase from '../config/supabase.js';
import { getIO } from '../realtime/socketServer.js';
import { userSocketRoom } from './videoRoomService.js';
import FcmService from './fcmService.js';

export const THERAPIST_NOTIFICATION_TYPES = Object.freeze({
  APPOINTMENT_REQUEST: 'APPOINTMENT_REQUEST',
  ASSIGNMENT_DONE: 'ASSIGNMENT_DONE',
  ASSIGNMENT_NOTE: 'ASSIGNMENT_NOTE',
  NEW_MESSAGE: 'NEW_MESSAGE',
  RESOURCE_LIKE: 'RESOURCE_LIKE',
  MODERATION_WARNING: 'MODERATION_WARNING',
  MODERATION_SUSPENSION: 'MODERATION_SUSPENSION',
});

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

/**
 * Persists a therapist notification and emits `new_notification` to their socket room.
 */
export async function sendNotification({
  recipientId,
  type,
  title,
  message,
  senderId = null,
}) {
  const therapistId = String(recipientId || '').trim();
  if (!therapistId) {
    throw new Error('recipientId is required.');
  }

  const timestamp = new Date().toISOString();
  let row = null;

  try {
    const ins = await supabase
      .from('therapist_notifications')
      .insert({
        recipient_id: therapistId,
        sender_id: senderId || null,
        type,
        title,
        message,
        is_read: false,
        created_at: timestamp,
      })
      .select(
        'notification_id, recipient_id, sender_id, type, title, message, is_read, created_at',
      )
      .maybeSingle();
    if (ins.error) {
      console.error('[sendNotification] insert failed:', ins.error.message);
    } else {
      row = ins.data;
    }
  } catch (err) {
    console.error('[sendNotification] insert exception:', err?.message || err);
  }

  const payload = row
    ? mapTherapistNotificationRow(row)
    : {
        id: null,
        recipientId: therapistId,
        senderId: senderId || null,
        type,
        title,
        message,
        isRead: false,
        createdAt: timestamp,
      };

  const io = getIO();
  if (io) {
    io.to(userSocketRoom(therapistId)).emit('new_notification', payload);
    console.log('[sendNotification] emitted new_notification →', userSocketRoom(therapistId));
  }

  return payload;
}

/**
 * Persists a notification and emits `new-notification` to the parent's user room.
 */
export async function notifyParent({
  userId,
  appointmentId,
  assignmentId,
  type,
  title,
  message,
  data: extraData = {},
}) {
  const timestamp = new Date().toISOString();
  let row = null;

  try {
    const ins = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        appointment_id: appointmentId || null,
        type: type || 'meeting_started',
        title,
        body: message,
        sent: true,
        sent_at: timestamp,
      })
      .select('notification_id, title, body, sent_at, created_at')
      .maybeSingle();
    if (ins.error) {
      console.error('[notifyParent] insert failed:', ins.error.message);
    } else {
      row = ins.data;
    }
  } catch (err) {
    console.error('[notifyParent] insert exception:', err?.message || err);
  }

  const payload = {
    id: row?.notification_id || null,
    title,
    message,
    timestamp: row?.sent_at || row?.created_at || timestamp,
    appointment_id: appointmentId || null,
    type: type || 'meeting_started',
  };

  const io = getIO();
  if (io) {
    io.to(userSocketRoom(userId)).emit('new-notification', payload);
    console.log('[notifyParent] emitted new-notification →', userSocketRoom(userId));
  }

  try {
    const push = await FcmService.instance.sendToUser(userId, {
      title,
      body: message,
      data: {
        type: type || 'meeting_started',
        appointmentId: appointmentId || '',
        assignmentId: assignmentId || extraData.assignmentId || '',
        childId: extraData.childId || '',
        notificationId: payload.id || '',
        ...Object.fromEntries(
          Object.entries(extraData).map(([key, value]) => [key, String(value ?? '')]),
        ),
      },
    });
    if (push.skipped) {
      console.log('[notifyParent] FCM skipped:', push.reason);
    } else {
      console.log(
        `[notifyParent] FCM sent=${push.sent} failed=${push.failed} devices=${push.tokens}`,
      );
    }
  } catch (err) {
    console.error('[notifyParent] FCM error:', err?.message || err);
  }

  return payload;
}
