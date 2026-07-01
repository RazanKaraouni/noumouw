import express from 'express';
import { authenticateJwt, authenticateParent, requireTherapist } from '../middleware/auth.js';
import { requireWebhookSecret } from '../middleware/webhookAuth.js';
import {
  ensureTherapistRoomWithParent,
  handleMessageWebhook,
  listParentRoomMessages,
  listParentRooms,
  listRoomMessages,
  listTherapistRooms,
  markParentRoomRead,
  markRoomMessagesRead,
  ensureParentRoom,
  sendParentMessage,
  sendTherapistMessage,
} from '../controllers/chatController.js';
import {
  validateEnsureRoomBody,
  validateMessageBody,
  validateUuidParam,
} from '../middleware/chatValidation.js';

const router = express.Router();

const therapistChat = [authenticateJwt, requireTherapist];

router.get('/rooms', ...therapistChat, listTherapistRooms);
router.post('/rooms/ensure-with-parent', ...therapistChat, ensureTherapistRoomWithParent);
router.get('/conversations', ...therapistChat, listTherapistRooms);
router.get(
  '/rooms/:chat_room_id/messages',
  ...therapistChat,
  validateUuidParam('chat_room_id'),
  listRoomMessages,
);
router.post(
  '/rooms/:chat_room_id/messages',
  ...therapistChat,
  validateUuidParam('chat_room_id'),
  validateMessageBody,
  sendTherapistMessage,
);
router.patch(
  '/rooms/:chat_room_id/read',
  ...therapistChat,
  validateUuidParam('chat_room_id'),
  markRoomMessagesRead,
);

router.get('/parent/rooms', ...authenticateParent, listParentRooms);
router.get('/parent/conversations', ...authenticateParent, listParentRooms);
router.post(
  '/parent/rooms/ensure',
  ...authenticateParent,
  validateEnsureRoomBody,
  ensureParentRoom,
);
router.get(
  '/parent/rooms/:chat_room_id/messages',
  ...authenticateParent,
  validateUuidParam('chat_room_id'),
  listParentRoomMessages,
);
router.post(
  '/parent/rooms/:chat_room_id/messages',
  ...authenticateParent,
  validateUuidParam('chat_room_id'),
  validateMessageBody,
  sendParentMessage,
);
router.patch(
  '/parent/rooms/:chat_room_id/read',
  ...authenticateParent,
  validateUuidParam('chat_room_id'),
  markParentRoomRead,
);

router.post('/webhooks/messages', requireWebhookSecret, handleMessageWebhook);

export default router;
