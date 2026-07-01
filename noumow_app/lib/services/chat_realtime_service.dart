import 'package:supabase_flutter/supabase_flutter.dart';

class ChatRealtimeService {
  ChatRealtimeService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;
  final Map<String, RealtimeChannel> _channels = {};

  void subscribeToRoom({
    required String roomId,
    required void Function(Map<String, dynamic> message) onInsert,
  }) {
    if (_channels.containsKey(roomId)) return;

    final channel = _client.channel('chat-room-$roomId');
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'messages',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'room_id',
        value: roomId,
      ),
      callback: (payload) => onInsert(payload.newRecord),
    );
    channel.subscribe();
    _channels[roomId] = channel;
  }

  Future<void> unsubscribeRoom(String roomId) async {
    final channel = _channels.remove(roomId);
    if (channel != null) {
      await _client.removeChannel(channel);
    }
  }

  Future<void> dispose() async {
    final channels = _channels.values.toList();
    _channels.clear();
    for (final channel in channels) {
      await _client.removeChannel(channel);
    }
  }
}

