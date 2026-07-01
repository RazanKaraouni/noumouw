import { Server } from 'socket.io';

import { isAccountSuspended } from '../services/suspensionCheckService.js';
import { verifyBearerToken } from '../middleware/auth.js';

import {
  clearTherapistActiveChatRoom,
  setTherapistActiveChatRoom,
} from '../services/chatPresenceService.js';
import { userSocketRoom } from '../services/videoRoomService.js';



let io = null;



export function getIO() {

  return io;

}



export function initSocketServer(httpServer, { corsOriginResolver }) {

  io = new Server(httpServer, {

    cors: {

      origin: corsOriginResolver,

      methods: ['GET', 'POST'],

      credentials: true,

    },

  });



  io.use(async (socket, next) => {

    try {

      const token =

        socket.handshake.auth?.token ||

        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||

        '';

      const auth = await verifyBearerToken(token);

      if (!auth) {

        console.warn('[socket] rejected: invalid token');

        return next(new Error('Unauthorized'));

      }

      if (await isAccountSuspended(auth)) {

        console.warn('[socket] rejected: suspended account');

        return next(new Error('Account suspended'));

      }



      socket.data.auth = auth;

      socket.data.userId = auth.userId;

      socket.data.role = auth.role;



      socket.join(userSocketRoom(auth.userId));

      console.log('[socket] connected', {

        userId: auth.userId,

        role: auth.role,

      });



      return next();

    } catch (err) {

      console.error('[socket] auth error:', err?.message || err);

      return next(new Error('Authentication failed'));

    }

  });



  io.on('connection', (socket) => {
    socket.on('chat:viewing', ({ roomId } = {}) => {
      if (socket.data.role !== 'therapist') return;
      setTherapistActiveChatRoom(socket.data.userId, roomId);
    });

    socket.on('chat:left', () => {
      if (socket.data.role !== 'therapist') return;
      clearTherapistActiveChatRoom(socket.data.userId);
    });

    socket.on('disconnect', (reason) => {
      if (socket.data.role === 'therapist') {
        clearTherapistActiveChatRoom(socket.data.userId);
      }
      console.log('[socket] disconnected', socket.data.userId, reason);
    });
  });



  return io;

}

