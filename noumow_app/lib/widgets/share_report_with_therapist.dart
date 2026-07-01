import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/chat_conversation.dart';
import '../screens/chat_page.dart';
import '../services/chat_service.dart';
import '../theme/app_colors.dart';
import '../utils/milestone_localization.dart';

String buildMilestoneReportShareMessage({
  required Map<String, dynamic> report,
  required String childName,
  required String childAgeLabel,
}) {
  final summary =
      (report['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  final completionRate =
      (summary['completion_rate'] as num?)?.toDouble() ?? 0.0;
  final completed = (summary['completed'] as num?)?.toInt() ?? 0;
  final total = (summary['total'] as num?)?.toInt() ?? 0;

  final buffer = StringBuffer()
    ..writeln('report_share_milestone_intro'.tr())
    ..writeln()
    ..writeln('report_share_child'.tr(namedArgs: {'name': childName}))
    ..writeln('report_share_age'.tr(namedArgs: {'age': childAgeLabel}))
    ..writeln(
      'report_share_completion'.tr(namedArgs: {
        'rate': completionRate.toStringAsFixed(1),
        'completed': '$completed',
        'total': '$total',
      }),
    );

  final categories =
      (report['category_breakdown'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};
  if (categories.isNotEmpty) {
    buffer.writeln();
    buffer.writeln('report_share_categories'.tr());
    for (final entry in categories.entries) {
      final value =
          (entry.value as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final categoryLabel = localizedMilestoneCategory(entry.key);
      final catCompleted = (value['completed'] as num?)?.toInt() ?? 0;
      final catTotal = (value['total'] as num?)?.toInt() ?? 0;
      buffer.writeln('• $categoryLabel: $catCompleted/$catTotal');
    }
  }

  return buffer.toString().trim();
}

String buildAutismReportShareMessage({
  required Map<String, dynamic> reportPayload,
  required String childName,
}) {
  final screening =
      (reportPayload['report'] as Map?)?['screening'] as Map<String, dynamic>? ??
          (reportPayload['screening'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};

  final score = screening['score'] ?? screening['total_score'] ?? 0;
  final total = screening['total_questions'] ?? 0;
  final risk = (screening['risk_level'] ?? 'Unknown').toString();

  return [
    'report_share_screening_intro'.tr(),
    '',
    'report_share_child'.tr(namedArgs: {'name': childName}),
    'report_share_screening_score'
        .tr(namedArgs: {'score': '$score', 'total': '$total'}),
    'report_share_screening_risk'.tr(namedArgs: {'risk': risk}),
  ].join('\n');
}

Future<void> shareReportWithTherapist(
  BuildContext context, {
  required String message,
}) async {
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
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) => SafeArea(
          child: SingleChildScrollView(
            padding: Responsive.padSymmetric(ctx, horizontal: 16, vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'report_share_pick_therapist'.tr(),
                  style: TextStyle(
                    fontSize: ctx.rf(16),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: ctx.rg(8)),
                ...conversations.map(
                  (c) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      radius: ctx.rs(20),
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => Navigator.pop(ctx, c),
                  ),
                ),
                SizedBox(height: ctx.rg(8)),
              ],
            ),
          ),
        ),
      );
      if (picked == null || !context.mounted) return;
      target = picked;
    }

    await chatService.sendParentMessageApi(
      roomId: target.chatRoomId,
      content: message,
    );
    if (!context.mounted) return;

    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'report_share_success'.tr(namedArgs: {'name': target.therapistName}),
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
          'report_share_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
        ),
      ),
    );
  }
}
