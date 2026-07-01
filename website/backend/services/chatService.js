import supabase from '../config/supabase.js';
// SERVICE ROLE: justified because therapist chat helpers resolve identities and rooms server-side.
import crypto from 'node:crypto';

const MESSAGE_COLUMNS = 'message_id, room_id, sender_id, content, is_read, created_at';

export const sanitizePagination = (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
  const before = query.before || null;
  return { limit, before };
};

export const getTherapistSenderId = async (therapistId, therapistEmail) => {
  if (therapistId) {
    const { data: therapist } = await supabase
      .from('therapists')
      .select('therapist_id, user_id')
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (therapist?.user_id) return therapist.user_id;
    if (therapist?.therapist_id) return therapist.therapist_id;
  }

  if (therapistEmail) {
    const { data: therapistByEmail } = await supabase
      .from('therapists')
      .select('therapist_id, user_id')
      .eq('email', therapistEmail)
      .maybeSingle();
    if (therapistByEmail?.user_id) return therapistByEmail.user_id;
    if (therapistByEmail?.therapist_id) return therapistByEmail.therapist_id;
  }

  return null;
};

export const ensureTherapistSenderId = async (therapistId, therapistEmail, therapistName = '') => {
  const existing = await getTherapistSenderId(therapistId, therapistEmail);
  if (existing) return existing;

  const { data: therapistRow } = await supabase
    .from('therapists')
    .select('therapist_id, user_id, email, full_name')
    .or(`therapist_id.eq.${therapistId},email.eq.${therapistEmail}`)
    .limit(1)
    .maybeSingle();
  if (therapistRow?.user_id) return therapistRow.user_id;

  const normalizedEmail = String(therapistEmail || therapistRow?.email || '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return null;

  let authUserId = null;
  let page = 1;
  while (!authUserId) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    if (!users.length) break;
    const match = users.find((u) => String(u.email || '').toLowerCase() === normalizedEmail);
    if (match?.id) {
      authUserId = match.id;
      break;
    }
    page += 1;
  }

  if (!authUserId) {
    const tempPassword = `Tmp-${crypto.randomBytes(12).toString('hex')}!A1`;
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'therapist' },
    });
    if (error) return null;
    authUserId = data?.user?.id || null;
  }

  if (!authUserId) return therapistRow?.therapist_id || therapistId || null;

  if (therapistRow?.therapist_id) {
    const { error: updateError } = await supabase
      .from('therapists')
      .update({ user_id: authUserId })
      .eq('therapist_id', therapistRow.therapist_id);
    if (updateError) return therapistRow.therapist_id;
  }

  return authUserId;
};

export const getTherapistUserId = async (therapistId, therapistEmail) => {
  if (therapistId) {
    const { data: byId } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (byId?.user_id) return byId.user_id;
  }

  if (therapistEmail) {
    const { data: byEmail } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('email', therapistEmail)
      .maybeSingle();
    return byEmail?.user_id || null;
  }

  return null;
};

export const getTherapistTableId = async (therapistId, therapistEmail) => {
  if (therapistId) {
    const { data: byId } = await supabase
      .from('therapists')
      .select('therapist_id')
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (byId?.therapist_id) return byId.therapist_id;
  }

  if (therapistEmail) {
    const { data: byEmail } = await supabase
      .from('therapists')
      .select('therapist_id')
      .eq('email', therapistEmail)
      .maybeSingle();
    return byEmail?.therapist_id || null;
  }

  return null;
};

export const getTherapistRoomIdentifiers = async (therapistId, therapistEmail) => {
  const tableId = await getTherapistTableId(therapistId, therapistEmail);
  const senderId = await getTherapistSenderId(therapistId, therapistEmail);
  const userId = await getTherapistUserId(therapistId, therapistEmail);
  return [...new Set([therapistId, tableId, userId, senderId].filter(Boolean))];
};

export const verifyTherapistRoomAccess = async (chatRoomId, therapistRoomIds) => {
  if (!therapistRoomIds?.length) return null;
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('chat_room_id, parent_id, therapist_id')
    .eq('chat_room_id', chatRoomId)
    .in('therapist_id', therapistRoomIds)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const verifyParentRoomAccess = async (chatRoomId, parentId) => {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('chat_room_id, parent_id, therapist_id')
    .eq('chat_room_id', chatRoomId)
    .eq('parent_id', parentId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const fetchRoomMessages = async ({ roomId, limit, before }) => {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reverse();
};

export const fetchTherapistRoomsWithStats = async (therapistRoomIds, therapistSenderId) => {
  if (!therapistRoomIds?.length) return [];
  const { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('chat_room_id, parent_id, created_at')
    .in('therapist_id', therapistRoomIds)
    .order('created_at', { ascending: false });
  if (roomsError) throw roomsError;

  const roomIds = (rooms || []).map((r) => r.chat_room_id);
  if (roomIds.length === 0) return [];

  const parentIds = [...new Set((rooms || []).map((r) => r.parent_id).filter(Boolean))];
  const { data: parentRows, error: parentsError } = parentIds.length
    ? await supabase
        .from('parents')
        .select('user_id, email, full_name')
        .in('user_id', parentIds)
    : { data: [], error: null };
  if (parentsError) throw parentsError;
  const parentsByUserId = new Map(
    (parentRows || []).map((parent) => [parent.user_id, parent]),
  );

  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .in('room_id', roomIds)
    .order('created_at', { ascending: false });
  if (messageError) throw messageError;

  const latestByRoom = new Map();
  const unreadByRoom = new Map();
  for (const message of messages || []) {
    if (!latestByRoom.has(message.room_id)) latestByRoom.set(message.room_id, message);
    if (!message.is_read && message.sender_id !== therapistSenderId) {
      unreadByRoom.set(message.room_id, (unreadByRoom.get(message.room_id) || 0) + 1);
    }
  }

  return (rooms || []).map((room) => {
    const parent = parentsByUserId.get(room.parent_id) || {};
    const parentName = (parent.full_name || '').trim() || 'Parent';
    const lastMessage = latestByRoom.get(room.chat_room_id);
    return {
      chat_room_id: room.chat_room_id,
      parent_id: room.parent_id,
      parent_name: parentName,
      parent_email: parent.email || null,
      created_at: room.created_at,
      updated_at: room.created_at,
      unread_count: unreadByRoom.get(room.chat_room_id) || 0,
      last_message: lastMessage
        ? {
            message_id: lastMessage.message_id,
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at,
            is_read: lastMessage.is_read,
          }
        : null,
    };
  });
};
