import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import 'report_content_sheet.dart';

Future<void> showCommunityPostActionsSheet(
  BuildContext context, {
  required String postId,
  String? authorUserId,
  required VoidCallback onBlocked,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(context.rs(20))),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(height: ctx.rg(8)),
          Container(
            width: ctx.rs(40),
            height: ctx.rs(4),
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(ctx.rs(2)),
            ),
          ),
          ListTile(
            leading: Icon(
              Icons.flag_outlined,
              color: const Color(0xFFC97B63),
              size: ctx.rs(24),
            ),
            title: Text(
              'community_actions_report_post'.tr(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            onTap: () async {
              Navigator.pop(ctx);
              await showReportContentSheet(
                context,
                targetType: ReportTargetType.post,
                targetId: postId,
              );
            },
          ),
          if (authorUserId != null && authorUserId.isNotEmpty)
            ListTile(
              leading: Icon(
                Icons.block_outlined,
                color: const Color(0xFF8A8A82),
                size: ctx.rs(24),
              ),
              title: Text(
                'community_actions_block_user'.tr(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () async {
                Navigator.pop(ctx);
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (dCtx) => AlertDialog(
                    title: Text('community_actions_block_title'.tr()),
                    content: Text('community_actions_block_body'.tr()),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(dCtx, false),
                        child: Text('community_actions_cancel'.tr()),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(dCtx, true),
                        child: Text('community_actions_block'.tr()),
                      ),
                    ],
                  ),
                );
                if (confirmed != true || !context.mounted) return;
                try {
                  await CommunityApiService().blockUser(authorUserId);
                  onBlocked();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('community_actions_user_blocked'.tr()),
                    ),
                  );
                } on CommunityApiException catch (e) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(sanitizeUserMessage(e.message))),
                  );
                }
              },
            ),
          SizedBox(height: ctx.rg(8)),
        ],
      ),
    ),
  );
}
