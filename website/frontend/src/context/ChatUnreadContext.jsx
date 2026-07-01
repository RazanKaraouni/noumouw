import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import api from '../services/axios';
import { supabase } from '../lib/supabaseClient';
import { getTherapistSocket } from '../lib/therapistSocket';

const ChatUnreadContext = createContext({
  totalUnread: 0,
  refreshChatUnread: async () => {},
});

export function ChatUnreadProvider({ children }) {
  const { therapist } = useAuth();
  const therapistId = therapist?.therapist_id;
  const therapistSenderId = therapist?.sender_id;
  const [totalUnread, setTotalUnread] = useState(0);
  const [roomIds, setRoomIds] = useState([]);
  const refreshTimerRef = useRef(null);

  const refreshChatUnread = useCallback(async () => {
    if (!therapistId) {
      setTotalUnread(0);
      setRoomIds([]);
      return;
    }
    try {
      const { data } = await api.get('/chat/rooms');
      const list = data || [];
      setRoomIds(list.map((r) => r.chat_room_id));
      const total = list.reduce((sum, r) => sum + (Number(r.unread_count) || 0), 0);
      setTotalUnread(total);
    } catch {
      /* keep previous count */
    }
  }, [therapistId]);

  const scheduleRefreshChatUnread = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshChatUnread();
    }, 400);
  }, [refreshChatUnread]);

  useEffect(() => {
    refreshChatUnread();
  }, [refreshChatUnread]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!therapistId || roomIds.length === 0) return undefined;
    const roomIdSet = new Set(roomIds);
    const onMessageChange = (payload) => {
      const roomId = payload?.new?.room_id;
      if (roomId && roomIdSet.has(roomId)) scheduleRefreshChatUnread();
    };
    const channel = supabase
      .channel(`chat-unread-msgs-${therapistId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        onMessageChange,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        onMessageChange,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [therapistId, roomIds, scheduleRefreshChatUnread]);

  useEffect(() => {
    if (!therapistId) return undefined;
    const channels = [];
    const onRoomInserted = () => refreshChatUnread();
    const byTherapistId = supabase
      .channel(`chat-unread-rooms-${therapistId}`)
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
      const byUserId = supabase
        .channel(`chat-unread-rooms-user-${therapistSenderId}`)
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
      channels.push(byUserId);
    }
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [therapistId, therapistSenderId, refreshChatUnread]);

  // Real-time badge bump when a parent message arrives (socket is reliable even if Supabase realtime lags).
  useEffect(() => {
    if (!therapistId) return undefined;
    const socket = getTherapistSocket();
    if (!socket) return undefined;

    const onChatMessage = (payload) => {
      if (payload?.viewing) return;
      setTotalUnread((count) => count + 1);
      scheduleRefreshChatUnread();
    };

    socket.on('chat:message', onChatMessage);
    return () => {
      socket.off('chat:message', onChatMessage);
    };
  }, [therapistId, scheduleRefreshChatUnread]);

  const value = useMemo(
    () => ({ totalUnread, refreshChatUnread }),
    [totalUnread, refreshChatUnread],
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
