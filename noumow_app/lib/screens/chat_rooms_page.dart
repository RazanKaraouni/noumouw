import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'chat_page.dart';

class ChatRoomsPage extends StatefulWidget {
  const ChatRoomsPage({super.key});

  @override
  State<ChatRoomsPage> createState() => _ChatRoomsPageState();
}

class _ChatRoomsPageState extends State<ChatRoomsPage> {
  final _supabase = Supabase.instance.client;

  Future<List<Map<String, dynamic>>> _loadRooms() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];
    final data = await _supabase
        .from('chat_rooms')
        .select('chat_room_id, therapist_id, therapists(full_name)')
        .eq('parent_id', user.id)
        .order('created_at', ascending: false);
    return data.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('chat_rooms_title'.tr())),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _loadRooms(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final rooms = snapshot.data ?? [];
          if (rooms.isEmpty) {
            return Center(
              child: Padding(
                padding: context.pagePadding,
                child: Text(
                  'chat_page_start_consultation'.tr(),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          return ListView.separated(
            padding: context.pagePadding,
            itemCount: rooms.length,
            separatorBuilder: (_, __) => Divider(height: context.rs(1)),
            itemBuilder: (context, index) {
              final room = rooms[index];
              final therapist =
                  (room['therapists'] as Map<String, dynamic>?) ?? {};
              final therapistName =
                  (therapist['full_name'] ?? '').toString().trim();
              return ListTile(
                contentPadding: EdgeInsets.symmetric(vertical: context.rs(4)),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
                title: Text(
                  therapistName.isEmpty
                      ? 'chat_therapist_default'.tr()
                      : therapistName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  (room['chat_room_id'] ?? '').toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  Navigator.push<void>(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => ChatPage(
                        roomId: (room['chat_room_id'] ?? '').toString(),
                        title: therapistName.isEmpty
                            ? 'chat_therapist_default'.tr()
                            : therapistName,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
