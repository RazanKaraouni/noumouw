import 'dart:async' show unawaited;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/chat_conversation.dart';
import '../services/chat_service.dart';
import '../utils/therapists_directory.dart';
import '../theme/app_colors.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  ChatScreenState createState() => ChatScreenState();
}

class ChatScreenState extends State<ChatScreen> {
  final _supabase = Supabase.instance.client;
  final _chatService = ChatService();
  final _messageCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _therapistSearchCtrl = TextEditingController();

  List<Map<String, dynamic>> _therapists = [];
  List<Map<String, dynamic>> _rooms = [];
  List<_RecentChatItem> _recentItems = [];
  String? _selectedTherapistId;
  String? _activeRoomId;
  String _mode = 'empty';
  bool _loading = true;
  bool _sending = false;
  String? _therapistsLoadError;
  String? _roomError;

  List<Map<String, dynamic>> _activeRoomMessages = [];
  bool _activeRoomMessagesLoading = false;
  RealtimeChannel? _activeRoomChannel;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    final ch = _activeRoomChannel;
    if (ch != null) {
      _supabase.removeChannel(ch);
    }
    _messageCtrl.dispose();
    _scrollCtrl.dispose();
    _therapistSearchCtrl.dispose();
    super.dispose();
  }

  void _detachActiveRoom() {
    final ch = _activeRoomChannel;
    if (ch != null) {
      _supabase.removeChannel(ch);
      _activeRoomChannel = null;
    }
    _activeRoomMessages = [];
    _activeRoomMessagesLoading = false;
  }

  Future<void> _bootstrapActiveChatRoom(String roomId) async {
    final prev = _activeRoomChannel;
    if (prev != null) {
      _supabase.removeChannel(prev);
      _activeRoomChannel = null;
    }
    if (!mounted) return;
    setState(() {
      _activeRoomMessagesLoading = true;
      _activeRoomMessages = [];
    });
    try {
      final data = await _chatService.fetchParentRoomMessages(roomId, limit: 50);
      if (!mounted || _activeRoomId != roomId) return;
      setState(() {
        _activeRoomMessages = data.map((m) => m.toJson()).toList();
        _activeRoomMessages.sort(
          (a, b) => (a['created_at'] ?? '')
              .toString()
              .compareTo((b['created_at'] ?? '').toString()),
        );
        _activeRoomMessagesLoading = false;
      });
      await _chatService.markParentRoomRead(roomId);
    } catch (e) {
      if (!mounted || _activeRoomId != roomId) return;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(userFacingErrorMessage(e))),
        );
      }
      setState(() => _activeRoomMessagesLoading = false);
    }
    if (!mounted || _activeRoomId != roomId) return;
    _activeRoomChannel = _chatService.subscribeToRoomMessages(
      roomId: roomId,
      onInserted: (row) {
        if (!mounted || _activeRoomId != roomId) return;
        final id = row['message_id']?.toString();
        if (id == null || id.isEmpty) return;
        setState(() {
          if (_activeRoomMessages
              .any((m) => m['message_id']?.toString() == id)) {
            return;
          }
          _activeRoomMessages.add(Map<String, dynamic>.from(row));
          _activeRoomMessages.sort(
            (a, b) => (a['created_at'] ?? '')
                .toString()
                .compareTo((b['created_at'] ?? '').toString()),
          );
        });
        final me = _supabase.auth.currentUser?.id;
        if (row['sender_id']?.toString() != me) {
          _chatService.markParentRoomRead(roomId);
        }
        _scrollToBottom();
      },
    );
    _scrollToBottom();
  }

  Future<void> _loadInitial() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final user = _supabase.auth.currentUser;
    if (user == null) {
      if (!mounted) return;
      setState(() => _loading = false);
      return;
    }
    try {
      // Backend directory first, then Supabase fallback.
      _therapists = await fetchTherapistsDirectory(_supabase);
      _therapistsLoadError = null;
    } catch (e) {
      _therapists = [];
      _therapistsLoadError = userFacingErrorMessage(e);
    }

    try {
      final conversations = await _chatService.fetchParentConversations();
      _setRecentConversations(conversations);
      if (_rooms.isEmpty) {
        _mode = 'select';
      } else {
        _mode = 'recent';
      }
      _roomError = null;
    } catch (e) {
      _rooms = [];
      _recentItems = [];
      _mode = 'select';
      _roomError = userFacingErrorMessage(e);
    }
    if (!mounted) return;
    setState(() => _loading = false);
  }

  String _therapistName(Map<String, dynamic> row) {
    final full = (row['full_name'] ?? '').toString().trim();
    return full.isEmpty ? 'chat_therapist_default'.tr() : full;
  }

  String _therapistRole(Map<String, dynamic> row) {
    final role = (row['profession'] ?? '').toString().trim();
    return role.isEmpty ? 'chat_role_default'.tr() : role;
  }

  List<Map<String, dynamic>> _filteredTherapists() {
    final query = _therapistSearchCtrl.text.trim().toLowerCase();
    if (query.isEmpty) return _therapists;
    return _therapists
        .where(
          (t) => _therapistName(t).toLowerCase().contains(query),
        )
        .toList();
  }

  String _therapistAvatar(Map<String, dynamic> row) {
    final raw = (row['profile_image_url'] ?? '').toString().trim();
    if (raw.isNotEmpty) return raw;
    final name = Uri.encodeComponent(_therapistName(row));
    return 'https://ui-avatars.com/api/?name=$name&background=2cbecf&color=ffffff';
  }

  Map<String, dynamic>? _therapistById(String therapistId) {
    for (final therapist in _therapists) {
      if (therapist['therapist_id'].toString() == therapistId) {
        return therapist;
      }
    }
    return null;
  }

  List<Map<String, dynamic>> _roomsFromConversations(
    List<ChatConversation> conversations,
  ) {
    return conversations
        .map(
          (conversation) => {
            'chat_room_id': conversation.chatRoomId,
            'therapist_id': conversation.therapistId,
            'therapist_name': conversation.therapistName,
            'therapist_role': conversation.therapistRole,
            'created_at': conversation.createdAt.toIso8601String(),
            'unread_count': conversation.unreadCount,
            'last_message': conversation.lastMessage?.content,
          },
        )
        .toList();
  }

  Widget _chatAvatar(
    BuildContext context, {
    required double radius,
    required String url,
    String? emptyInitial,
  }) {
    final r = context.rs(radius);
    final d = r * 2;
    if (url.isEmpty) {
      if (emptyInitial != null && emptyInitial.isNotEmpty) {
        return CircleAvatar(
          radius: r,
          backgroundColor: const Color(0xFF2DB7B4),
          child: Text(
            emptyInitial.characters.first.toUpperCase(),
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: context.rf(radius * 0.65),
            ),
          ),
        );
      }
      return CircleAvatar(
        radius: r,
        backgroundColor: const Color(0xFF2DB7B4),
        child: Icon(Icons.person, color: Colors.white, size: context.rs(radius)),
      );
    }
    return CircleAvatar(
      radius: r,
      backgroundColor: const Color(0xFF2DB7B4),
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: url,
          width: d,
          height: d,
          fit: BoxFit.cover,
          fadeInDuration: const Duration(milliseconds: 120),
          placeholder: (_, __) => SizedBox(
            width: d,
            height: d,
            child: Center(
              child: SizedBox(
                width: d * 0.35,
                height: d * 0.35,
                child: CircularProgressIndicator(strokeWidth: context.rs(2)),
              ),
            ),
          ),
          errorWidget: (_, __, ___) =>
              emptyInitial != null && emptyInitial.isNotEmpty
                  ? Text(
                      emptyInitial.characters.first.toUpperCase(),
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: context.rf(radius * 0.65),
                      ),
                    )
                  : Icon(Icons.person,
                      color: Colors.white, size: context.rs(radius)),
        ),
      ),
    );
  }

  Future<void> _loadRecentList() async {
    final conversations = await _chatService.fetchParentConversations();
    _setRecentConversations(conversations);
  }

  void _setRecentConversations(List<ChatConversation> conversations) {
    _rooms = _roomsFromConversations(conversations);
    final items = conversations.map((conversation) {
      final therapist = _therapistById(conversation.therapistId);
      final lastMessage = conversation.lastMessage;
      return _RecentChatItem(
        roomId: conversation.chatRoomId,
        therapistId: conversation.therapistId,
        therapistName: therapist == null
            ? conversation.therapistName
            : _therapistName(therapist),
        therapistRole: therapist == null
            ? (conversation.therapistRole.isEmpty
                ? 'chat_role_default'.tr()
                : conversation.therapistRole)
            : _therapistRole(therapist),
        avatarUrl: therapist == null ? '' : _therapistAvatar(therapist),
        preview: lastMessage?.content ?? 'chat_tap_start'.tr(),
        updatedAt: (lastMessage?.createdAt ?? conversation.createdAt)
            .toIso8601String(),
        unreadCount: conversation.unreadCount,
      );
    }).toList();
    items.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _recentItems = items;
  }

  Future<String?> _ensureRoom() async {
    final user = _supabase.auth.currentUser;
    final therapistId = _selectedTherapistId;
    if (user == null || therapistId == null) return null;

    try {
      final existing = _rooms
          .where((r) => r['therapist_id'].toString() == therapistId)
          .toList();
      if (existing.isNotEmpty) {
        _activeRoomId = existing.first['chat_room_id'].toString();
        _roomError = null;
        setState(() {});
        return _activeRoomId;
      }

      final createdRoomId = await _chatService.ensureParentRoom(therapistId);
      if (createdRoomId == null) {
        _roomError = 'chat_room_error'.tr();
        if (mounted) setState(() {});
        return null;
      }

      _rooms = await _chatService.fetchParentRooms();
      _activeRoomId = createdRoomId;
      _roomError = null;
      setState(() {});
      return _activeRoomId;
    } catch (e) {
      _roomError = userFacingErrorMessage(e);
      if (mounted) setState(() {});
      return null;
    }
  }

  Future<void> _send() async {
    final roomId = await _ensureRoom();
    final text = _messageCtrl.text.trim();
    if (roomId == null || text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await _chatService.sendParentMessageApi(roomId: roomId, content: text);
      _messageCtrl.clear();
      await _loadRecentList();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('chat_sent_snack'.tr())),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(userFacingErrorMessage(e)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      _scrollCtrl.animateTo(
        _scrollCtrl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  String _formatTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final hour = dt.hour == 0 ? 12 : (dt.hour >= 12 ? dt.hour - 12 : dt.hour);
    final displayHour = hour == 0 ? 12 : hour;
    final minute = dt.minute.toString().padLeft(2, '0');
    final suffix = dt.hour >= 12 ? 'PM' : 'AM';
    return '$displayHour:$minute $suffix';
  }

  void _openTherapistSelector() {
    _detachActiveRoom();
    setState(() => _mode = 'select');
  }

  void _openChat(_RecentChatItem item) {
    setState(() {
      _selectedTherapistId = item.therapistId;
      _activeRoomId = item.roomId;
      _mode = 'chat';
    });
    unawaited(_bootstrapActiveChatRoom(item.roomId));
  }

  Future<void> openTherapistChat({
    required String therapistId,
    required String roomId,
  }) async {
    if (!mounted) return;

    setState(() {
      _selectedTherapistId = therapistId;
      _activeRoomId = roomId;
      _roomError = null;
      _mode = 'chat';
    });
    await _bootstrapActiveChatRoom(roomId);
    if (!mounted) return;
    await _loadRecentList();
    if (!mounted) return;
    setState(() {});
  }

  Widget _buildSelectEmptyState(
    BuildContext context, {
    required String titleKey,
    required String subtitleKey,
  }) {
    return Center(
      child: Padding(
        padding: Responsive.padSymmetric(context, horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              titleKey.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: context.rf(16),
              ),
            ),
            SizedBox(height: context.rg(8)),
            Text(
              subtitleKey.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: const Color(0xFF688488),
                fontSize: context.rf(14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectState(BuildContext context) {
    return Column(
      children: [
        SizedBox(height: context.rg(8)),
        Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16),
          child: Text(
            'chat_select_therapist'.tr(),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: context.rf(20),
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F2E2E),
            ),
          ),
        ),
        if (_therapistsLoadError != null)
          Padding(
            padding: Responsive.padSymmetric(context, horizontal: 24, vertical: 8),
            child: Text(
              _therapistsLoadError!,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.redAccent,
                fontSize: context.rf(13),
              ),
            ),
          ),
        SizedBox(height: context.rg(12)),
        Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16),
          child: TextField(
            controller: _therapistSearchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'chat_therapist_search_placeholder'.tr(),
              prefixIcon: Icon(Icons.search, size: context.rs(22)),
              suffixIcon: _therapistSearchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: Icon(Icons.clear, size: context.rs(20)),
                      onPressed: () {
                        _therapistSearchCtrl.clear();
                        setState(() {});
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              contentPadding: Responsive.padSymmetric(
                context,
                horizontal: 14,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(context.rs(14)),
                borderSide: const BorderSide(color: Color(0xFFD8E8E4)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(context.rs(14)),
                borderSide: const BorderSide(color: Color(0xFFD8E8E4)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(context.rs(14)),
                borderSide: const BorderSide(
                  color: Color(0xFF1D9E75),
                  width: 1.3,
                ),
              ),
            ),
          ),
        ),
        SizedBox(height: context.rg(12)),
        Expanded(
          child: _therapists.isEmpty
              ? _buildSelectEmptyState(
                  context,
                  titleKey: 'chat_no_therapists_title',
                  subtitleKey: 'chat_no_therapists_subtitle',
                )
              : Builder(
                  builder: (context) {
                    final filtered = _filteredTherapists();
                    if (filtered.isEmpty) {
                      return _buildSelectEmptyState(
                        context,
                        titleKey: 'chat_therapist_search_no_match',
                        subtitleKey: 'chat_therapist_search_try_again',
                      );
                    }
                    return ListView.builder(
                  padding: Responsive.padSymmetric(context, horizontal: 2),
                  itemCount: filtered.length,
                  itemBuilder: (ctx, i) {
                    final therapist = filtered[i];
                    final therapistId = therapist['therapist_id'].toString();
                    final name = _therapistName(therapist);
                    final role = _therapistRole(therapist);
                    return Container(
                      margin: EdgeInsets.fromLTRB(
                        context.rs(14),
                        0,
                        context.rs(14),
                        context.rs(10),
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(context.rs(20)),
                        boxShadow: [
                          BoxShadow(
                            blurRadius: context.rs(12),
                            offset: Offset(0, context.rs(4)),
                            color: const Color(0xFF1D9E75).withOpacity(0.16),
                          ),
                        ],
                      ),
                      child: ListTile(
                        onTap: () async {
                          setState(() {
                            _selectedTherapistId = therapistId;
                            _activeRoomId = null;
                            _roomError = null;
                            _mode = 'chat';
                          });
                          final roomId = await _ensureRoom();
                          if (roomId == null) return;
                          await _loadRecentList();
                          final item = _recentItems.firstWhere(
                            (x) => x.roomId == roomId,
                            orElse: () => _RecentChatItem(
                              roomId: roomId,
                              therapistId: therapistId,
                              therapistName: name,
                              therapistRole: role,
                              avatarUrl: _therapistAvatar(therapist),
                              preview: 'chat_start_consultation'.tr(),
                              updatedAt: DateTime.now().toIso8601String(),
                              unreadCount: 0,
                            ),
                          );
                          _openChat(item);
                        },
                        leading: _chatAvatar(
                          ctx,
                          radius: 23,
                          url: _therapistAvatar(therapist),
                        ),
                        title: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: context.rf(15),
                          ),
                        ),
                        subtitle: Text(
                          role,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          size: context.rs(24),
                        ),
                      ),
                    );
                  },
                );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildRecentState(BuildContext context) {
    return Container(
      color: const Color(0xFFEDF8F4),
      child: Column(
        children: [
          Container(
            margin: EdgeInsets.fromLTRB(
              context.rs(10),
              context.rs(10),
              context.rs(10),
              context.rs(8),
            ),
            padding: Responsive.padSymmetric(context, horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFDDF1EA),
              borderRadius: BorderRadius.circular(context.rs(10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'chat_recent'.tr(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.rf(30),
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF173B35),
                      height: 1,
                    ),
                  ),
                ),
                SizedBox(width: context.rg(8)),
                InkWell(
                  onTap: _openTherapistSelector,
                  borderRadius: BorderRadius.circular(context.rs(8)),
                  child: Container(
                    width: context.rs(24),
                    height: context.rs(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1D9E75),
                      borderRadius: BorderRadius.circular(context.rs(6)),
                    ),
                    child: Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: context.rs(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _recentItems.isEmpty
                ? _buildSelectState(context)
                : ListView.builder(
                    padding: Responsive.padSymmetric(context, horizontal: 2),
                    itemCount: _recentItems.length,
                    itemBuilder: (ctx, i) {
                      final item = _recentItems[i];
                      return Container(
                        margin: EdgeInsets.fromLTRB(
                          context.rs(10),
                          0,
                          context.rs(10),
                          context.rs(8),
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(context.rs(14)),
                          border: Border.all(color: const Color(0xFFD7ECE4)),
                          boxShadow: [
                            BoxShadow(
                              blurRadius: context.rs(10),
                              offset: Offset(0, context.rs(2)),
                              color: const Color(0xFF1D9E75).withOpacity(0.08),
                            ),
                          ],
                        ),
                        child: ListTile(
                          dense: true,
                          onTap: () => _openChat(item),
                          leading: _chatAvatar(
                            ctx,
                            radius: 20,
                            url: item.avatarUrl,
                            emptyInitial: item.therapistName,
                          ),
                          title: Text(
                            item.therapistName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF1A2B28),
                              fontSize: context.rf(14),
                            ),
                          ),
                          subtitle: Text(
                            item.preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: const Color(0xFF4E6761),
                              fontSize: context.rf(13),
                            ),
                          ),
                          trailing: SizedBox(
                            width: context.rs(52),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  _formatTime(item.updatedAt),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: context.rf(10.5),
                                    color: const Color(0xFF7A8F89),
                                  ),
                                ),
                                SizedBox(height: context.rg(4)),
                                if (item.unreadCount > 0)
                                  Container(
                                    padding: Responsive.padSymmetric(
                                      context,
                                      horizontal: 7,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE9435E),
                                      borderRadius:
                                          BorderRadius.circular(context.rs(999)),
                                    ),
                                    child: Text(
                                      '${item.unreadCount}',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: context.rf(11),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatState(BuildContext context) {
    final roomId = _activeRoomId;
    Map<String, dynamic>? therapist;
    for (final t in _therapists) {
      if (t['therapist_id'].toString() == _selectedTherapistId) {
        therapist = t;
        break;
      }
    }
    final therapistName = therapist == null
        ? 'chat_therapist_default'.tr()
        : _therapistName(therapist);
    final therapistRole =
        therapist == null ? 'chat_tap_start'.tr() : _therapistRole(therapist);

    if (roomId == null) {
      return Center(
        child: Padding(
          padding: Responsive.padSymmetric(context, horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_roomError == null)
                const CircularProgressIndicator()
              else
                Text(
                  _roomError!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.w600,
                    fontSize: context.rf(14),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    final me = _supabase.auth.currentUser?.id;

    return Container(
        color: const Color(0xFFF6FAF7),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: Responsive.padDirectional(
                context,
                start: 8,
                top: 12,
                end: 16,
                bottom: 10,
              ),
              margin: EdgeInsets.fromLTRB(
                context.rs(10),
                context.rs(8),
                context.rs(10),
                0,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(context.rs(18)),
                boxShadow: Responsive.cardShadow(
                  context,
                  blur: 10,
                  offsetY: 3,
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () async {
                      _detachActiveRoom();
                      await _loadRecentList();
                      if (!mounted) return;
                      setState(() => _mode = 'recent');
                    },
                    icon: Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: const Color(0xFF24463E),
                      size: context.rs(20),
                    ),
                    padding: EdgeInsets.all(context.rs(8)),
                    constraints: BoxConstraints(
                      minWidth: context.rs(36),
                      minHeight: context.rs(36),
                    ),
                  ),
                  CircleAvatar(
                    radius: context.rs(16),
                    backgroundColor: AppColors.primary,
                    child: Text(
                      therapistName.characters.first.toUpperCase(),
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: context.rf(12),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  SizedBox(width: context.rg(8)),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          therapistName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: const Color(0xFF0F2E2E),
                            fontSize: context.rf(16),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          therapistRole,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontSize: context.rf(12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _activeRoomMessagesLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      controller: _scrollCtrl,
                      padding: Responsive.padSymmetric(
                        context,
                        horizontal: 12,
                        vertical: 10,
                      ),
                      itemCount: _activeRoomMessages.length,
                      itemBuilder: (_, i) {
                        final msg = _activeRoomMessages[i];
                        final mine = msg['sender_id'] == me;
                        final createdAt = (msg['created_at'] ?? '').toString();
                        return Align(
                          alignment: mine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            constraints:
                                BoxConstraints(maxWidth: context.wp(0.75)),
                            margin: EdgeInsets.symmetric(
                              vertical: context.rs(5),
                            ),
                            padding: Responsive.padSymmetric(
                              context,
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: mine
                                  ? AppColors.primary
                                  : Colors.white,
                              borderRadius:
                                  BorderRadius.circular(context.rs(14)),
                              boxShadow: Responsive.cardShadow(
                                context,
                                opacity: 0.08,
                                blur: 7,
                                offsetY: 3,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: mine
                                  ? CrossAxisAlignment.end
                                  : CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (msg['content'] ?? '').toString(),
                                  style: TextStyle(
                                    color: mine
                                        ? Colors.white
                                        : const Color(0xFF1E293B),
                                    fontSize: context.rf(13.5),
                                  ),
                                ),
                                SizedBox(height: context.rg(3)),
                                Text(
                                  _formatTime(createdAt),
                                  style: TextStyle(
                                    color: mine
                                        ? const Color(0xFFD9EFE8)
                                        : const Color(0xFF7A8F89),
                                    fontSize: context.rf(10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: Responsive.padDirectional(
                  context,
                  start: 12,
                  top: 6,
                  end: 12,
                  bottom: 10,
                ),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(context.rs(14)),
                    boxShadow: Responsive.cardShadow(
                      context,
                      blur: 10,
                      offsetY: 4,
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _messageCtrl,
                          decoration: InputDecoration(
                            hintText: 'chat_message_hint'.tr(),
                            border: InputBorder.none,
                            contentPadding: Responsive.padSymmetric(
                              context,
                              horizontal: 12,
                              vertical: 10,
                            ),
                          ),
                          onSubmitted: (_) => _sending ? null : _send(),
                        ),
                      ),
                      Padding(
                        padding: EdgeInsets.only(right: context.rs(4)),
                        child: IconButton(
                          onPressed: _sending ? null : _send,
                          icon: _sending
                              ? SizedBox(
                                  width: context.rs(16),
                                  height: context.rs(16),
                                  child: CircularProgressIndicator(
                                    strokeWidth: context.rs(2),
                                  ),
                                )
                              : Icon(
                                  Icons.send_rounded,
                                  color: Colors.white,
                                  size: context.rs(20),
                                ),
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xFF1D9E75),
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(context.rs(10)),
                            ),
                            minimumSize: Size(
                              context.rs(40),
                              context.rs(40),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFFFFFFF), Color(0xFFEAF6EF)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: _mode == 'recent'
            ? _buildRecentState(context)
            : _mode == 'chat'
                ? _buildChatState(context)
                : _buildSelectState(context),
      ),
    );
  }
}

class _RecentChatItem {
  _RecentChatItem({
    required this.roomId,
    required this.therapistId,
    required this.therapistName,
    required this.therapistRole,
    required this.avatarUrl,
    required this.preview,
    required this.updatedAt,
    required this.unreadCount,
  });

  final String roomId;
  final String therapistId;
  final String therapistName;
  final String therapistRole;
  final String avatarUrl;
  final String preview;
  final String updatedAt;
  final int unreadCount;
}
