export function userSocketRoom(userId) {

  return `user-${String(userId || '').trim()}`;

}

