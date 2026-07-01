/** In-memory map of therapistId → chat room they are actively viewing. */
const activeChatRoomByTherapist = new Map();

export function setTherapistActiveChatRoom(therapistId, roomId) {
  const tid = String(therapistId || '').trim();
  const rid = String(roomId || '').trim();
  if (!tid || !rid) return;
  activeChatRoomByTherapist.set(tid, rid);
}

export function clearTherapistActiveChatRoom(therapistId) {
  const tid = String(therapistId || '').trim();
  if (!tid) return;
  activeChatRoomByTherapist.delete(tid);
}

export function isTherapistViewingChatRoom(therapistId, roomId) {
  const tid = String(therapistId || '').trim();
  const rid = String(roomId || '').trim();
  if (!tid || !rid) return false;
  return activeChatRoomByTherapist.get(tid) === rid;
}
