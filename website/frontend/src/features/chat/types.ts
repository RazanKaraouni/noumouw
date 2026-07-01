export interface ChatMessage {
  message_id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  chat_room_id: string;
  parent_id: string;
  parent_name: string;
  parent_email: string | null;
  created_at: string;
  updated_at?: string;
  unread_count: number;
  last_message: ChatMessage | null;
}
