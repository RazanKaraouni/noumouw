import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';
import '../widgets/home/home_action_tile.dart';
import '../widgets/home/home_styles.dart';
import 'community_feed_page.dart';
import 'therapist_chat_page.dart';

/// Entry point for Community tab — therapist chat or parent peer support.
class CommunityHubPage extends StatelessWidget {
  const CommunityHubPage({super.key});

  void _openTherapistChat(BuildContext context) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const TherapistChatPage(),
      ),
    );
  }

  void _openPeerSupport(BuildContext context) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const CommunityFeedPage(),
      ),
    );
  }

  Widget _forwardChevron(BuildContext context) {
    final isRtl = context.locale.languageCode == 'ar';
    return Icon(
      isRtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded,
      color: AppColors.textSec.withOpacity(0.85),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chevron = _forwardChevron(context);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text('home_nav_community'.tr()),
      ),
      body: ResponsiveScrollBody(
        padding: HomeStyles.sectionPadding(context, top: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HomeActionTile(
              title: 'community_hub_ask_therapist_title'.tr(),
              subtitle: 'community_hub_ask_therapist_subtitle'.tr(),
              icon: Icons.medical_services_rounded,
              iconBackgroundColor: AppColors.green.withOpacity(0.14),
              iconColor: AppColors.green,
              onTap: () => _openTherapistChat(context),
              forwardChevron: chevron,
            ),
            SizedBox(height: HomeStyles.listGap(context)),
            HomeActionTile(
              title: 'community_hub_peer_support_title'.tr(),
              subtitle: 'community_hub_peer_support_subtitle'.tr(),
              icon: Icons.groups_rounded,
              iconBackgroundColor: AppColors.roleParentBg,
              iconColor: AppColors.roleParentBorder,
              onTap: () => _openPeerSupport(context),
              forwardChevron: chevron,
            ),
          ],
        ),
      ),
    );
  }
}
