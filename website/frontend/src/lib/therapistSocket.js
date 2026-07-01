import { io } from 'socket.io-client';
import { getToken, API_BASE } from '../models/httpClient.js';

let socket = null;

export function getTherapistSocket() {
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  } else if (!socket.connected) {
    socket.auth = { token };
    socket.connect();
  }

  return socket;
}

export function disconnectTherapistSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
