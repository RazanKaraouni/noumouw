/**
 * @deprecated Import from `models/chatModel.js` instead.
 */
import { chatModel } from '../../models/chatModel.js';
import type { ChatMessage, ConversationSummary } from './types';

export async function getTherapistConversations(): Promise<ConversationSummary[]> {
  return chatModel.listConversations() as Promise<ConversationSummary[]>;
}

export async function getRoomMessages(roomId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
  return chatModel.getMessages(roomId, limit, before) as Promise<ChatMessage[]>;
}

export async function sendTherapistMessage(roomId: string, content: string): Promise<ChatMessage> {
  return chatModel.sendMessage(roomId, content) as Promise<ChatMessage>;
}

export async function markRoomAsRead(roomId: string): Promise<void> {
  await chatModel.markRoomRead(roomId);
}
