class ChatMessage {
  ChatMessage({
    required this.messageId,
    required this.roomId,
    required this.senderId,
    required this.content,
    required this.isRead,
    required this.createdAt,
  });

  final String messageId;
  final String roomId;
  final String senderId;
  final String content;
  final bool isRead;
  final DateTime createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: (json['message_id'] ?? '').toString(),
      roomId: (json['room_id'] ?? '').toString(),
      senderId: (json['sender_id'] ?? '').toString(),
      content: (json['content'] ?? '').toString(),
      isRead: json['is_read'] == true,
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  Map<String, dynamic> toJson() => {
        'message_id': messageId,
        'room_id': roomId,
        'sender_id': senderId,
        'content': content,
        'is_read': isRead,
        'created_at': createdAt.toIso8601String(),
      };
}
