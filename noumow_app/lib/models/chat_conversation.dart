import 'chat_message.dart';

class ChatConversation {
  ChatConversation({
    required this.chatRoomId,
    required this.therapistId,
    required this.therapistName,
    required this.therapistRole,
    required this.createdAt,
    required this.unreadCount,
    this.lastMessage,
  });

  final String chatRoomId;
  final String therapistId;
  final String therapistName;
  final String therapistRole;
  final DateTime createdAt;
  final int unreadCount;
  final ChatMessage? lastMessage;

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    final last = json['last_message'];
    return ChatConversation(
      chatRoomId:
          (json['chat_room_id'] ?? '').toString(),
      therapistId: (json['therapist_id'] ?? '').toString(),
      therapistName: (json['therapist_name'] ?? 'Therapist').toString(),
      therapistRole: (json['therapist_role'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      unreadCount: (json['unread_count'] as num?)?.toInt() ?? 0,
      lastMessage: last is Map<String, dynamic> ? ChatMessage.fromJson(last) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'chat_room_id': chatRoomId,
        'therapist_id': therapistId,
        'therapist_name': therapistName,
        'therapist_role': therapistRole,
        'created_at': createdAt.toIso8601String(),
        'unread_count': unreadCount,
        if (lastMessage != null) 'last_message': lastMessage!.toJson(),
      };
}
