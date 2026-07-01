import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import '../models/chat_conversation.dart';
import '../models/chat_message.dart';
import 'api_http_client.dart';

class ChatService {
  ChatService({SupabaseClient? client, http.Client? httpClient})
      : _client = client ?? Supabase.instance.client,
        _http = httpClient ?? createApiHttpClient();

  final SupabaseClient _client;
  final http.Client _http;

  String get _base => resolvedTherapistsApiBase();

  Map<String, String> get _jsonHeaders => authHeaders(json: true);

  void _ensureAuthenticated() {
    if (!_jsonHeaders.containsKey('Authorization')) {
      throw Exception('Your session expired. Please sign in again.');
    }
  }

  Stream<List<Map<String, dynamic>>> streamMessages(String roomId) {
    return _client
        .from('messages')
        .stream(primaryKey: ['message_id'])
        .eq('room_id', roomId)
        .order('created_at')
        .map((rows) => rows.cast<Map<String, dynamic>>());
  }

  RealtimeChannel subscribeToRoomMessages({
    required String roomId,
    required void Function(Map<String, dynamic> row) onInserted,
  }) {
    final channel = _client.channel('parent-room-$roomId');
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'messages',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'room_id',
        value: roomId,
      ),
      callback: (payload) {
        onInserted(payload.newRecord);
      },
    );
    channel.subscribe();
    return channel;
  }

  Future<void> sendMessage({
    required String roomId,
    required String content,
    String? childId,
    List<Map<String, dynamic>>? reportLinks,
  }) async {
    final senderId = _client.auth.currentUser?.id;
    if (senderId == null) {
      throw Exception('User is not authenticated.');
    }
    await _client.from('messages').insert({
      'room_id': roomId,
      'sender_id': senderId,
      'content': content.trim(),
      if (childId != null && childId.trim().isNotEmpty)
        'child_id': childId.trim(),
      if (reportLinks != null) 'report_links': reportLinks,
    });
  }

  Future<void> markAsRead({
    required String roomId,
    required String readerId,
  }) async {
    await _client
        .from('messages')
        .update({'is_read': true})
        .eq('room_id', roomId)
        .neq('sender_id', readerId)
        .eq('is_read', false);
  }

  Future<List<ChatConversation>> fetchParentConversations() async {
    _ensureAuthenticated();
    final res = await _http.get(
      Uri.parse('$_base/api/chat/parent/conversations'),
      headers: _jsonHeaders,
    );
    if (res.statusCode != 200) {
      throw Exception(
          'Load conversations failed (${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! List) return <ChatConversation>[];
    return decoded
        .map((e) =>
            ChatConversation.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchParentRooms() async {
    final list = await fetchParentConversations();
    return list
        .map(
          (c) => {
            'chat_room_id': c.chatRoomId,
            'therapist_id': c.therapistId,
            'therapist_name': c.therapistName,
            'therapist_role': c.therapistRole,
            'created_at': c.createdAt.toIso8601String(),
            'unread_count': c.unreadCount,
            'last_message': c.lastMessage?.content,
          },
        )
        .toList();
  }

  Future<String?> ensureParentRoom(String therapistId) async {
    _ensureAuthenticated();
    final res = await _http.post(
      Uri.parse('$_base/api/chat/parent/rooms/ensure'),
      headers: _jsonHeaders,
      body: jsonEncode({'therapist_id': therapistId}),
    );
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw Exception('Create room failed (${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! Map) {
      throw Exception('Create room response is invalid: ${res.body}');
    }
    final roomId = decoded['chat_room_id']?.toString();
    if (roomId == null || roomId.isEmpty) {
      throw Exception('Create room response missing chat_room_id: ${res.body}');
    }
    return roomId;
  }

  Future<List<ChatMessage>> fetchParentRoomMessages(
    String roomId, {
    int limit = 30,
    String? beforeIso,
  }) async {
    _ensureAuthenticated();
    final beforeQuery =
        beforeIso == null || beforeIso.isEmpty ? '' : '&before=$beforeIso';
    final res = await _http.get(
      Uri.parse(
          '$_base/api/chat/parent/rooms/$roomId/messages?limit=$limit$beforeQuery'),
      headers: _jsonHeaders,
    );
    if (res.statusCode != 200) {
      throw Exception('Load messages failed (${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! List) return <ChatMessage>[];
    return decoded
        .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<bool> sendParentMessageApi({
    required String roomId,
    required String content,
  }) async {
    _ensureAuthenticated();
    final res = await _http.post(
      Uri.parse('$_base/api/chat/parent/rooms/$roomId/messages'),
      headers: _jsonHeaders,
      body: jsonEncode({'content': content}),
    );
    if (res.statusCode == 201) return true;
    throw Exception('Message send failed (${res.statusCode}): ${res.body}');
  }

  Future<void> markParentRoomRead(String roomId) async {
    _ensureAuthenticated();
    await _http.patch(
      Uri.parse('$_base/api/chat/parent/rooms/$roomId/read'),
      headers: _jsonHeaders,
    );
  }
}
