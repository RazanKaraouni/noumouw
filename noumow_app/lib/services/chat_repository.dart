import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/chat_conversation.dart';
import '../models/chat_message.dart';
import 'chat_service.dart';

class ChatRepository {
  ChatRepository({
    ChatService? service,
    SupabaseClient? supabaseClient,
  })  : _service = service ?? ChatService(),
        _supabaseClient = supabaseClient ?? Supabase.instance.client;

  final ChatService _service;
  final SupabaseClient _supabaseClient;

  Future<List<ChatConversation>> getConversations() {
    return _service.fetchParentConversations();
  }

  Future<List<ChatMessage>> getMessages({
    required String roomId,
    int limit = 30,
    String? beforeIso,
  }) {
    return _service.fetchParentRoomMessages(roomId, limit: limit, beforeIso: beforeIso);
  }

  Future<void> sendMessage({
    required String roomId,
    required String content,
  }) {
    return _service.sendParentMessageApi(roomId: roomId, content: content);
  }

  Future<void> markRead(String roomId) {
    return _service.markParentRoomRead(roomId);
  }

  RealtimeChannel subscribeToMessages({
    required String roomId,
    required void Function(ChatMessage message) onInserted,
  }) {
    return _service.subscribeToRoomMessages(
      roomId: roomId,
      onInserted: (row) => onInserted(ChatMessage.fromJson(row)),
    );
  }

  String? get currentUserId => _supabaseClient.auth.currentUser?.id;
}

