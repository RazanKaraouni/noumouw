import supabase from '../config/supabase.js';
import { getParentSupabase } from '../utils/supabaseForRequest.js';
import { therapistCanNotifyParentUser } from '../services/pushNotificationAuthService.js';
import {
  notifyParent,
  sendNotification,
  THERAPIST_NOTIFICATION_TYPES,
} from '../services/notificationService.js';
import { isTherapistViewingChatRoom } from '../services/chatPresenceService.js';
import { getIO } from '../realtime/socketServer.js';
import { userSocketRoom } from '../services/videoRoomService.js';
import {
  ensureTherapistSenderId,
  fetchRoomMessages,
  fetchTherapistRoomsWithStats,
  getTherapistRoomIdentifiers,
  getTherapistSenderId,
  sanitizePagination,
  verifyParentRoomAccess,
  verifyTherapistRoomAccess,
} from '../services/chatService.js';
import {
  getAuthEmail,
  getParentUserId,
  getTherapistDisplayName,
  getTherapistId,
} from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

const MESSAGE_COLUMNS = 'message_id, room_id, sender_id, content, is_read, created_at';
const ROOM_COLUMNS = 'chat_room_id, parent_id, therapist_id, created_at';

async function assertTherapistCaseloadForParent(req, parentUserId) {
  const therapistId = getTherapistId(req);
  const allowed = await therapistCanNotifyParentUser({
    therapistId,
    parentUserId: String(parentUserId || '').trim(),
  });
  return allowed;
}

export const listTherapistRooms = async (req, res) => {
  try {
    const therapistId = getTherapistId(req);
    const email = getAuthEmail(req);
    const therapistSenderId = await getTherapistSenderId(therapistId, email);
    const therapistRoomIds = await getTherapistRoomIdentifiers(therapistId, email);
    const rooms = await fetchTherapistRoomsWithStats(therapistRoomIds, therapistSenderId);
    res.json(rooms);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

/** Therapist: ensure a chat room exists with a parent (by parent's auth user id). */
export const ensureTherapistRoomWithParent = async (req, res) => {
  try {
    const therapistId = getTherapistId(req);
    const parentUserId = String(req.body?.parent_user_id || req.body?.user_id || '').trim();
    if (!parentUserId) {
      return res.status(400).json({ message: 'parent_user_id is required.' });
    }

    const onCaseload = await assertTherapistCaseloadForParent(req, parentUserId);
    if (!onCaseload) {
      return res.status(403).json({ message: "You don't have permission to message this parent." });
    }

    const { data: existing, error: findErr } = await supabase
      .from('chat_rooms')
      .select(ROOM_COLUMNS)
      .eq('parent_id', parentUserId)
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing) return res.json(existing);

    const { data, error } = await supabase
      .from('chat_rooms')
      .insert({ parent_id: parentUserId, therapist_id: therapistId })
      .select(ROOM_COLUMNS)
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

export const listRoomMessages = async (req, res) => {
  try {
    const roomId = req.params.chat_room_id || req.params.roomId;
    const therapistRoomIds = await getTherapistRoomIdentifiers(
      getTherapistId(req),
      getAuthEmail(req),
    );
    const room = await verifyTherapistRoomAccess(roomId, therapistRoomIds);
    if (!room) return res.status(404).json({ message: 'Chat room not found.' });

    const onCaseload = await assertTherapistCaseloadForParent(req, room.parent_id);
    if (!onCaseload) {
      return res.status(403).json({ message: "You don't have permission to access this conversation." });
    }

    const { limit, before } = sanitizePagination(req.query || {});
    const data = await fetchRoomMessages({ roomId, limit, before });
    res.json(data || []);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const sendTherapistMessage = async (req, res) => {
  try {
    const roomId = req.params.chat_room_id || req.params.roomId;
    const {
      content,
      child_id: rawChildId,
      children_id: childrenIdInput,
      report_links: reportLinks,
    } = req.body;

    const senderId = await ensureTherapistSenderId(
      getTherapistId(req),
      getAuthEmail(req),
      getTherapistDisplayName(req),
    );
    if (!senderId) {
      return res.status(400).json({
        message: 'Therapist sender identity is not linked to auth.users yet.',
      });
    }

    const therapistRoomIds = await getTherapistRoomIdentifiers(
      getTherapistId(req),
      getAuthEmail(req),
    );
    const room = await verifyTherapistRoomAccess(roomId, therapistRoomIds);
    if (!room) return res.status(404).json({ message: 'Chat room not found.' });

    const onCaseload = await assertTherapistCaseloadForParent(req, room.parent_id);
    if (!onCaseload) {
      return res.status(403).json({ message: "You don't have permission to message this parent." });
    }

    let childrenId = null;
    if (childrenIdInput !== undefined && childrenIdInput !== null && childrenIdInput !== '') {
      const numericId = Number(childrenIdInput);
      childrenId = Number.isFinite(numericId) ? numericId : null;
    } else if (rawChildId) {
      const numericId = Number(rawChildId);
      if (Number.isFinite(numericId) && Number.isInteger(numericId)) {
        childrenId = numericId;
      } else {
        const { data: childRow } = await supabase
          .from('children')
          .select('children_id')
          .eq('child_id', String(rawChildId))
          .maybeSingle();
        childrenId = childRow?.children_id ?? null;
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        content,
        ...(childrenId != null ? { child_id: childrenId } : {}),
        ...(Array.isArray(reportLinks) ? { report_links: reportLinks } : {}),
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) throw error;

    const parentUserId = room.parent_id;
    if (parentUserId) {
      const therapistName = getTherapistDisplayName(req).trim() || 'Your therapist';
      const preview = String(content || '').trim();
      const snippet =
        preview.length > 80 ? `${preview.slice(0, 80)}…` : preview || 'You have a new message';
      try {
        await notifyParent({
          userId: parentUserId,
          appointmentId: null,
          type: 'new_message',
          title: 'New message',
          message: `${therapistName}: ${snippet}`,
          data: { chatRoomId: roomId },
        });
      } catch (notifErr) {
        console.error('[sendTherapistMessage] notifyParent:', notifErr?.message || notifErr);
      }
    }

    res.status(201).json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const markRoomMessagesRead = async (req, res) => {
  try {
    const roomId = req.params.chat_room_id || req.params.roomId;
    const therapistRoomIds = await getTherapistRoomIdentifiers(
      getTherapistId(req),
      getAuthEmail(req),
    );
    const hasAccess = await verifyTherapistRoomAccess(roomId, therapistRoomIds);
    if (!hasAccess) return res.status(404).json({ message: 'Chat room not found.' });

    const onCaseload = await assertTherapistCaseloadForParent(req, hasAccess.parent_id);
    if (!onCaseload) {
      return res.status(403).json({ message: "You don't have permission to access this conversation." });
    }

    const senderId = await ensureTherapistSenderId(
      getTherapistId(req),
      getAuthEmail(req),
    );
    if (!senderId) return res.json({ updated: 0 });

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', senderId)
      .eq('is_read', false);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const handleMessageWebhook = async (_req, res) => {
  res.status(200).json({ skipped: true, reason: 'push_notifications_disabled' });
};

export const listParentRooms = async (req, res) => {
  try {
    const parentId = getParentUserId(req);
    const db = getParentSupabase(req);
    const { data, error } = await db
      .from('chat_rooms')
      .select(ROOM_COLUMNS)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const therapistIds = [
      ...new Set((data || []).map((room) => room.therapist_id).filter(Boolean)),
    ];
    const { data: therapistsById } = therapistIds.length
      ? await supabase
          .from('therapists')
          .select('therapist_id, user_id, full_name, email, profession')
          .in('therapist_id', therapistIds)
      : { data: [] };
    const { data: therapistsByUserId } = therapistIds.length
      ? await supabase
          .from('therapists')
          .select('therapist_id, user_id, full_name, email, profession')
          .in('user_id', therapistIds)
      : { data: [] };
    const therapistMap = new Map();
    for (const t of [...(therapistsById || []), ...(therapistsByUserId || [])]) {
      therapistMap.set(t.therapist_id, t);
      if (t.user_id) therapistMap.set(t.user_id, t);
    }

    const roomIds = (data || []).map((room) => room.chat_room_id);
    const { data: messages } = roomIds.length
      ? await supabase
          .from('messages')
          .select(MESSAGE_COLUMNS)
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })
      : { data: [] };
    const latestByRoom = new Map();
    const unreadByRoom = new Map();
    for (const message of messages || []) {
      if (!latestByRoom.has(message.room_id)) latestByRoom.set(message.room_id, message);
      if (!message.is_read && message.sender_id !== parentId) {
        unreadByRoom.set(message.room_id, (unreadByRoom.get(message.room_id) || 0) + 1);
      }
    }

    const rooms = (data || []).map((room) => {
      const therapist = therapistMap.get(room.therapist_id) || {};
      const therapistName = (therapist.full_name || '').trim() || 'Therapist';
      const latest = latestByRoom.get(room.chat_room_id);
      return {
        chat_room_id: room.chat_room_id,
        therapist_id: room.therapist_id,
        therapist_name: therapistName,
        therapist_email: therapist.email || null,
        therapist_role: therapist.profession || null,
        created_at: room.created_at,
        unread_count: unreadByRoom.get(room.chat_room_id) || 0,
        last_message: latest
          ? {
              message_id: latest.message_id,
              content: latest.content,
              sender_id: latest.sender_id,
              is_read: latest.is_read,
              created_at: latest.created_at,
            }
          : null,
      };
    });
    res.json(rooms);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const ensureParentRoom = async (req, res) => {
  try {
    const parentId = getParentUserId(req);
    const db = getParentSupabase(req);
    const { therapist_id: therapistInputId } = req.body || {};
    let therapistId = therapistInputId;

    // chat_rooms.therapist_id must reference therapists.therapist_id (FK-safe).
    // If caller passes therapists.user_id, resolve back to therapists.therapist_id.
    const { data: therapistById } = await supabase
      .from('therapists')
      .select('therapist_id, user_id')
      .eq('therapist_id', therapistInputId)
      .maybeSingle();
    if (therapistById?.therapist_id) {
      therapistId = therapistById.therapist_id;
    } else {
      const { data: therapistByUserId } = await supabase
        .from('therapists')
        .select('therapist_id, user_id')
        .eq('user_id', therapistInputId)
        .maybeSingle();
      if (therapistByUserId?.therapist_id) therapistId = therapistByUserId.therapist_id;
    }

    if (!therapistId) {
      return res.status(400).json({ message: 'Invalid therapist_id.' });
    }

    const { data: existing, error: findErr } = await db
      .from('chat_rooms')
      .select(ROOM_COLUMNS)
      .eq('parent_id', parentId)
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing) return res.json(existing);

    const { data, error } = await db
      .from('chat_rooms')
      .insert({ parent_id: parentId, therapist_id: therapistId })
      .select(ROOM_COLUMNS)
      .single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const listParentRoomMessages = async (req, res) => {
  try {
    const parentId = getParentUserId(req);
    const roomId = req.params.chat_room_id || req.params.roomId;
    const room = await verifyParentRoomAccess(roomId, parentId);
    if (!room) return res.status(404).json({ message: 'Chat room not found.' });

    const { limit, before } = sanitizePagination(req.query || {});
    const data = await fetchRoomMessages({ roomId, limit, before });
    res.json(data || []);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const sendParentMessage = async (req, res) => {
  try {
    const parentId = getParentUserId(req);
    const db = getParentSupabase(req);
    const roomId = req.params.chat_room_id || req.params.roomId;
    const { content } = req.body || {};

    const room = await verifyParentRoomAccess(roomId, parentId);
    if (!room) return res.status(404).json({ message: 'Chat room not found.' });

    const { data, error } = await db
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: parentId,
        content,
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) throw error;

    const therapistId = room.therapist_id;
    const therapistViewingRoom = therapistId
      ? isTherapistViewingChatRoom(therapistId, roomId)
      : false;

    if (therapistId) {
      const io = getIO();
      if (io) {
        io.to(userSocketRoom(therapistId)).emit('chat:message', {
          roomId,
          messageId: data.message_id,
          viewing: therapistViewingRoom,
        });
      }
    }

    if (therapistId && !therapistViewingRoom) {
      const parentName = (await supabase
        .from('parents')
        .select('full_name')
        .eq('user_id', parentId)
        .maybeSingle()).data?.full_name?.trim() || 'Parent';
      const preview = String(content || '').trim();
      const snippet =
        preview.length > 80 ? `${preview.slice(0, 80)}…` : preview || 'You have a new message';
      try {
        await sendNotification({
          recipientId: therapistId,
          senderId: parentId,
          type: THERAPIST_NOTIFICATION_TYPES.NEW_MESSAGE,
          title: 'New message',
          message: `${parentName}: ${snippet}`,
        });
      } catch (notifErr) {
        console.error('[sendParentMessage] sendNotification:', notifErr?.message || notifErr);
      }
    }

    res.status(201).json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const markParentRoomRead = async (req, res) => {
  try {
    const parentId = getParentUserId(req);
    const db = getParentSupabase(req);
    const roomId = req.params.chat_room_id || req.params.roomId;
    const hasAccess = await verifyParentRoomAccess(roomId, parentId);
    if (!hasAccess) return res.status(404).json({ message: 'Chat room not found.' });
    const { error } = await db
      .from('messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', parentId)
      .eq('is_read', false);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};
