import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getRoomMessages, getTherapistConversations, markRoomAsRead, sendTherapistMessage } from './chatApi';
import type { ChatMessage, ConversationSummary } from './types';

const mergeDedup = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  const map = new Map(prev.map((m) => [m.message_id, m]));
  for (const message of incoming) map.set(message.message_id, message);
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
};

type Props = {
  therapistSenderId: string;
};

export default function TherapistInbox({ therapistSenderId }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.chat_room_id === activeRoomId) ?? null,
    [conversations, activeRoomId],
  );

  useEffect(() => {
    const load = async () => {
      setLoadingConversations(true);
      try {
        const data = await getTherapistConversations();
        setConversations(data);
        if (data.length > 0) setActiveRoomId(data[0].chat_room_id);
      } finally {
        setLoadingConversations(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    const load = async () => {
      setLoadingMessages(true);
      try {
        const data = await getRoomMessages(activeRoomId, 50);
        setMessages(data);
        await markRoomAsRead(activeRoomId);
      } finally {
        setLoadingMessages(false);
      }
    };
    load();
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    const channel = supabase
      .channel(`therapist-room-insert-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${activeRoomId}`,
        },
        async (payload) => {
          setMessages((prev) => mergeDedup(prev, [payload.new as ChatMessage]));
          await markRoomAsRead(activeRoomId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoomId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !activeRoomId) return;
    const optimistic: ChatMessage = {
      message_id: `temp-${Date.now()}`,
      room_id: activeRoomId,
      sender_id: therapistSenderId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => mergeDedup(prev, [optimistic]));
    setText('');
    try {
      await sendTherapistMessage(activeRoomId, content);
      setMessages((prev) => prev.filter((m) => !String(m.message_id).startsWith('temp-')));
    } catch {
      setMessages((prev) => prev.filter((m) => !String(m.message_id).startsWith('temp-')));
    }
  };

  return (
    <div className="chat-inbox">
      <aside className="chat-panel chat-panel--list">
        <div className="chat-panel__head">Inbox</div>
        {loadingConversations ? (
          <div className="chat-panel__loading">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="chat-panel__empty">No conversations yet.</div>
        ) : (
          <div>
            {conversations.map((c) => (
              <button
                key={c.chat_room_id}
                type="button"
                onClick={() => setActiveRoomId(c.chat_room_id)}
                className={`chat-convo-btn${activeRoomId === c.chat_room_id ? ' is-active' : ''}`}
              >
                <div className="chat-convo-btn__name">{c.parent_name}</div>
                <div className="chat-convo-btn__preview">
                  {c.last_message?.content ?? c.parent_email}
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="chat-panel chat-panel--thread">
        <div className="chat-panel__head">
          {activeConversation?.parent_name ?? 'Select conversation'}
        </div>
        {loadingMessages ? (
          <div className="chat-panel__loading">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="chat-panel__empty">No messages yet.</div>
        ) : (
          <div ref={listRef} className="chat-messages">
            {messages.map((m) => {
              const mine = m.sender_id === therapistSenderId;
              return (
                <div
                  key={m.message_id}
                  className={`chat-bubble-row ${mine ? 'chat-bubble-row--mine' : 'chat-bubble-row--theirs'}`}
                >
                  <div className={`chat-bubble ${mine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}>
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="chat-compose">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            className="chat-compose__input"
            placeholder="Type message..."
          />
          <button type="button" onClick={handleSend} className="chat-compose__send">
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
