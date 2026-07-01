import { useEffect, useMemo, useRef, useState } from 'react';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatUnread } from '../../context/ChatUnreadContext';
import api from '../../services/axios';
import { supabase } from '../../lib/supabaseClient';
import { getTherapistSocket } from '../../lib/therapistSocket';

export default function ChatCenter() {
  const location = useLocation();
  const { therapist } = useAuth();
  const { refreshChatUnread } = useChatUnread();
  const therapistId = therapist?.therapist_id;
  const therapistSenderId = therapist?.sender_id;
  const [rooms, setRooms] = useState([]);
  const [roomSummaries, setRoomSummaries] = useState({});
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const listRef = useRef(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.chat_room_id === selectedRoomId),
    [rooms, selectedRoomId],
  );

  const roomIdsSet = useMemo(
    () => new Set(rooms.map((r) => r.chat_room_id)),
    [rooms],
  );

  const mergeUniqueMessages = (prev, incoming) => {
    const map = new Map(prev.map((m) => [m.message_id, m]));
    for (const msg of incoming) map.set(msg.message_id, msg);
    return [...map.values()].sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at)),
    );
  };

  const loadRoomSummaries = async (inputRooms) => {
    const entries = await Promise.all(
      (inputRooms || []).map(async (room) => {
        const { data } = await api.get(`/chat/rooms/${room.chat_room_id}/messages?limit=40`);
        const list = data || [];
        const last = list[list.length - 1];
        const unread = list.filter(
          (m) => m.sender_id !== therapistSenderId && !m.is_read,
        ).length;
        return [
          room.chat_room_id,
          {
            preview: last?.content || 'No messages yet',
            updatedAt: last?.created_at || room.created_at,
            unread,
          },
        ];
      }),
    );
    setRoomSummaries(Object.fromEntries(entries));
    refreshChatUnread().catch(() => {});
  };

  const loadRooms = async () => {
    try {
      const { data } = await api.get('/chat/rooms');
      const list = data || [];
      setRooms(list);
      const preferred = location.state?.roomId;
      const hasPreferred = preferred && list.some((r) => r.chat_room_id === preferred);
      setSelectedRoomId((prev) => prev || (hasPreferred ? preferred : list[0]?.chat_room_id || ''));
      await loadRoomSummaries(list);
      setLoadError('');
    } catch (error) {
      setLoadError(getUserFacingError(error));
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (therapistId) loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId]);

  useEffect(() => {
    if (!therapistId) return undefined;
    const channels = [];
    const onRoomInserted = () => {
      loadRooms().catch(() => {});
    };
    const byTherapistId = supabase
      .channel(`rooms-by-therapist-id-${therapistId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_rooms',
          filter: `therapist_id=eq.${therapistId}`,
        },
        onRoomInserted,
      )
      .subscribe();
    channels.push(byTherapistId);
    if (therapistSenderId && therapistSenderId !== therapistId) {
      const byTherapistUserId = supabase
        .channel(`rooms-by-therapist-user-id-${therapistSenderId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_rooms',
            filter: `therapist_id=eq.${therapistSenderId}`,
          },
          onRoomInserted,
        )
        .subscribe();
      channels.push(byTherapistUserId);
    }
    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [therapistId, therapistSenderId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedRoomId) return;
      setLoadingMessages(true);
      try {
        const { data } = await api.get(`/chat/rooms/${selectedRoomId}/messages?limit=50`);
        setMessages(data || []);
        await api.patch(`/chat/rooms/${selectedRoomId}/read`);
        refreshChatUnread().catch(() => {});
        setLoadError('');
      } catch (error) {
        setLoadError(getUserFacingError(error));
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedRoomId, refreshChatUnread]);

  useEffect(() => {
    const socket = getTherapistSocket();
    if (!socket) return undefined;

    if (selectedRoomId) {
      socket.emit('chat:viewing', { roomId: selectedRoomId });
    } else {
      socket.emit('chat:left');
    }

    return () => {
      socket.emit('chat:left');
    };
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return undefined;
    const channel = supabase
      .channel(`therapist-room-${selectedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoomId}`,
        },
        (payload) => {
          setMessages((prev) => mergeUniqueMessages(prev, [payload.new]));
          api
            .patch(`/chat/rooms/${selectedRoomId}/read`)
            .then(() => refreshChatUnread())
            .catch(() => {});
          loadRoomSummaries(rooms).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoomId, rooms]);

  useEffect(() => {
    if (!rooms.length) return undefined;
    const channel = supabase
      .channel('therapist-global-inboxes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const roomId = payload?.new?.room_id;
          if (!roomIdsSet.has(roomId)) return;
          if (roomId === selectedRoomId) {
            api
              .patch(`/chat/rooms/${selectedRoomId}/read`)
              .then(() => refreshChatUnread())
              .catch(() => {});
          } else {
            refreshChatUnread().catch(() => {});
          }
          loadRoomSummaries(rooms).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rooms, selectedRoomId, roomIdsSet, refreshChatUnread]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedRoomId) {
      setLoadError('No conversation selected. Choose a parent chat from All Inboxes first.');
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    setLoadError('');
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage = {
      message_id: optimisticId,
      room_id: selectedRoomId,
      sender_id: therapistSenderId,
      content: text.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
    try {
      const { data } = await api.post(`/chat/rooms/${selectedRoomId}/messages`, {
        content: text.trim(),
      });
      setText('');
      loadRoomSummaries(rooms).catch(() => {});
      setMessages((prev) =>
        mergeUniqueMessages(
          prev.filter((m) => m.message_id !== optimisticId),
          data ? [data] : [],
        ),
      );
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
      setLoadError(
        getUserFacingError(error)
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aT = roomSummaries[a.chat_room_id]?.updatedAt || a.created_at;
      const bT = roomSummaries[b.chat_room_id]?.updatedAt || b.created_at;
      return String(bT).localeCompare(String(aT));
    });
  }, [rooms, roomSummaries]);

  return (
    <div className="chat-inbox">
      <section className="chat-panel chat-panel--list">
        <div className="chat-panel__head">All Inboxes</div>
        {loadError ? <div className="chat-panel__error">{loadError}</div> : null}
        {loadingRooms ? (
          <div className="chat-panel__loading">Loading...</div>
        ) : sortedRooms.length === 0 ? (
          <div className="chat-panel__empty">No parent messages yet.</div>
        ) : (
          <div>
            {sortedRooms.map((room) => {
              const active = room.chat_room_id === selectedRoomId;
              const summary = roomSummaries[room.chat_room_id] || {};
              return (
                <button
                  key={room.chat_room_id}
                  type="button"
                  onClick={() => setSelectedRoomId(room.chat_room_id)}
                  className={`chat-convo-btn${active ? ' is-active' : ''}`}
                >
                  <div className="chat-convo-btn__row">
                    <div className="chat-convo-btn__name">{room.parent_name || 'Parent'}</div>
                    <div className="chat-convo-btn__time">{formatTime(summary.updatedAt)}</div>
                  </div>
                  <div className="chat-convo-btn__preview-row">
                    <div className="chat-convo-btn__preview">
                      {summary.preview || room.parent_email || room.parent_id}
                    </div>
                    {summary.unread > 0 ? (
                      <span className="chat-unread-badge">{summary.unread}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="chat-panel chat-panel--thread">
        <div className="chat-panel__head">
          {selectedRoom ? selectedRoom.parent_name || 'Parent Chat' : 'Parent Chat'}
        </div>
        {loadingMessages ? (
          <div className="chat-panel__loading">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="chat-panel__empty">Start your consultation</div>
        ) : (
          <div ref={listRef} className="chat-messages">
            {messages.map((message) => {
              const mine = message.sender_id === therapistSenderId;
              return (
                <div
                  key={message.message_id}
                  className={`chat-bubble-row ${mine ? 'chat-bubble-row--mine' : 'chat-bubble-row--theirs'}`}
                >
                  <div className={`chat-bubble ${mine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}>
                    {message.content}
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
              if (e.key === 'Enter') sendMessage();
            }}
            disabled={!selectedRoomId}
            placeholder="Reply to parent..."
            className="chat-compose__input"
          />
          <button
            type="button"
            disabled={sending || !selectedRoomId}
            onClick={sendMessage}
            className="chat-compose__send"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </section>
    </div>
  );
}

