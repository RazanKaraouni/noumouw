import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/chat_service.dart';
import '../theme/app_colors.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({
    super.key,
    required this.roomId,
    required this.title,
  });

  final String roomId;
  final String title;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ChatService _chatService = ChatService();
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final String? _currentUserId = Supabase.instance.client.auth.currentUser?.id;

  RealtimeChannel? _roomChannel;
  bool _loading = true;
  bool _sending = false;
  final List<Map<String, dynamic>> _messages = [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    final channel = _roomChannel;
    if (channel != null) {
      Supabase.instance.client.removeChannel(channel);
    }
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    await _loadInitialMessages();
    _subscribeRealtime();
  }

  Future<void> _loadInitialMessages() async {
    setState(() => _loading = true);
    try {
      final data = await _chatService.fetchParentRoomMessages(widget.roomId, limit: 50);
      _messages
        ..clear()
        ..addAll(
          data
              .map(
                (m) => {
                  'message_id': m.messageId,
                  'room_id': m.roomId,
                  'sender_id': m.senderId,
                  'content': m.content,
                  'is_read': m.isRead,
                  'created_at': m.createdAt.toIso8601String(),
                },
              )
              .toList(),
        );
      await _chatService.markParentRoomRead(widget.roomId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(userFacingErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
      _scrollToBottom();
    }
  }

  void _subscribeRealtime() {
    _roomChannel = _chatService.subscribeToRoomMessages(
      roomId: widget.roomId,
      onInserted: (row) {
        final id = row['message_id']?.toString();
        if (id == null || id.isEmpty) return;
        if (_messages.any((m) => m['message_id']?.toString() == id)) {
          return;
        }
        setState(() {
          _messages.add(Map<String, dynamic>.from(row));
          _messages.sort(
            (a, b) => (a['created_at'] ?? '').toString().compareTo((b['created_at'] ?? '').toString()),
          );
        });
        if (row['sender_id']?.toString() != _currentUserId) {
          _chatService.markParentRoomRead(widget.roomId);
        }
        _scrollToBottom();
      },
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    final tempId = 'temp-${DateTime.now().microsecondsSinceEpoch}';
    setState(() {
      _sending = true;
      _messages.add({
        'message_id': tempId,
        'room_id': widget.roomId,
        'sender_id': _currentUserId,
        'content': text,
        'is_read': false,
        'created_at': DateTime.now().toIso8601String(),
      });
    });
    _controller.clear();
    _scrollToBottom();
    try {
      await _chatService.sendParentMessageApi(roomId: widget.roomId, content: text);
      if (mounted) {
        setState(() {
          _messages.removeWhere((m) => m['message_id'] == tempId);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.removeWhere((m) => m['message_id'] == tempId);
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? Center(
                        child: Padding(
                          padding: context.pagePadding,
                          child: Text(
                            'chat_page_start_consultation'.tr(),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: Responsive.padSymmetric(context, horizontal: 12, vertical: 6),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          final isMine = msg['sender_id'] == _currentUserId;
                          final bubbleColor = isMine
                              ? AppColors.primary
                              : const Color(0xFFE8ECE8);
                          final textColor =
                              isMine ? Colors.white : const Color(0xFF151515);
                          return Align(
                            alignment: isMine
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              constraints: BoxConstraints(maxWidth: context.wp(0.75)),
                              margin: EdgeInsets.symmetric(
                                horizontal: context.rs(12),
                                vertical: context.rs(6),
                              ),
                              padding: Responsive.padSymmetric(
                                context,
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: bubbleColor,
                                borderRadius: BorderRadius.zero,
                              ),
                              child: Text(
                                msg['content']?.toString() ?? '',
                                style: TextStyle(color: textColor),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: Responsive.padSymmetric(context, horizontal: 8, vertical: 8)
                  .copyWith(top: context.rs(6)),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: 'chat_page_message_hint'.tr(),
                        border: const OutlineInputBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: context.rg(8)),
                  IconButton(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? SizedBox(
                            width: context.rs(18),
                            height: context.rs(18),
                            child: const CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
