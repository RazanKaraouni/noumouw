import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/chat_conversation.dart';
import '../screens/chat_page.dart';
import '../services/chat_service.dart';
import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import '../utils/community_age_category.dart';
import '../utils/community_developmental_category.dart';

String buildCommunityPostShareMessage(CommunityPost post) {
  final ageLabel = CommunityAgeCategory.label(post.ageCategoryKey);
  final devKey = CommunityDevelopmentalCategory.normalizeKey(post.developmentalCategory);
  final devLabel =
      devKey != null ? CommunityDevelopmentalCategory.label(devKey) : null;
  final locale = post.localeTag?.trim();

  final buffer = StringBuffer()
    ..writeln('community_share_intro'.tr())
    ..writeln()
    ..writeln(post.content.trim());

  buffer.writeln();
  buffer.write(
    'community_share_age_tier'.tr(namedArgs: {'age': ageLabel}),
  );
  if (devLabel != null) {
    buffer.write(
      ' · ${'community_share_topic'.tr(namedArgs: {'topic': devLabel})}',
    );
  }
  if (locale != null && locale.isNotEmpty) {
    buffer.write(
      ' · ${'community_share_region'.tr(namedArgs: {'region': locale})}',
    );
  }
  buffer.writeln();
  buffer.write(
    'community_share_post_id'.tr(namedArgs: {'id': post.id}),
  );

  return buffer.toString().trim();
}

Future<void> shareCommunityPostWithSpecialist(
  BuildContext context,
  CommunityPost post,
) async {
  final chatService = ChatService();
  final messenger = ScaffoldMessenger.of(context);

  try {
    final conversations = await chatService.fetchParentConversations();
    if (!context.mounted) return;

    if (conversations.isEmpty) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('community_share_no_chat_title'.tr()),
          content: Text('community_share_no_chat_body'.tr()),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('community_share_ok'.tr()),
            ),
          ],
        ),
      );
      return;
    }

    ChatConversation target;
    if (conversations.length == 1) {
      target = conversations.first;
    } else {
      final picked = await showModalBottomSheet<ChatConversation>(
        context: context,
        backgroundColor: AppColors.white,
        isScrollControlled: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(context.rs(20))),
        ),
        builder: (ctx) {
          final maxListHeight = MediaQuery.sizeOf(ctx).height * 0.55;
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(height: ctx.rg(12)),
                Text(
                  'community_share_title'.tr(),
                  style: TextStyle(
                    fontSize: ctx.rf(16),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: ctx.rg(8)),
                ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxListHeight),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: conversations.length,
                    itemBuilder: (context, index) {
                      final c = conversations[index];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFFE6F1FB),
                          child: Icon(
                            Icons.medical_services_outlined,
                            size: ctx.rs(20),
                          ),
                        ),
                        title: Text(
                          c.therapistName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          c.therapistRole.isEmpty
                              ? 'community_share_specialist_fallback'.tr()
                              : c.therapistRole,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () => Navigator.pop(ctx, c),
                      );
                    },
                  ),
                ),
                SizedBox(height: ctx.rg(8)),
              ],
            ),
          );
        },
      );
      if (picked == null || !context.mounted) return;
      target = picked;
    }

    final message = buildCommunityPostShareMessage(post);
    await chatService.sendParentMessageApi(
      roomId: target.chatRoomId,
      content: message,
    );
    if (!context.mounted) return;

    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'community_share_success'.tr(
            namedArgs: {'name': target.therapistName},
          ),
        ),
      ),
    );

    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ChatPage(
          roomId: target.chatRoomId,
          title: target.therapistName,
        ),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'community_share_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
        ),
      ),
    );
  }
}
