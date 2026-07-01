import api from '../services/axios.js';

export const chatModel = {
  listConversations: async () => {
    const { data } = await api.get('/chat/conversations');
    return data || [];
  },
  listRooms: async () => {
    const { data } = await api.get('/chat/rooms');
    return data || [];
  },
  getMessages: async (roomId, limit = 50, before) => {
    const qs = before ? `?limit=${limit}&before=${encodeURIComponent(before)}` : `?limit=${limit}`;
    const { data } = await api.get(`/chat/rooms/${roomId}/messages${qs}`);
    return data || [];
  },
  sendMessage: async (roomId, content) => {
    const { data } = await api.post(`/chat/rooms/${roomId}/messages`, { content });
    return data;
  },
  markRoomRead: (roomId) => api.patch(`/chat/rooms/${roomId}/read`),
};
