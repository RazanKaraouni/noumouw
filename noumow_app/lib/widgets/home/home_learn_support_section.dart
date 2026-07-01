import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../constants/home_assets.dart';
import '../../theme/app_colors.dart';
import 'home_quick_action_card.dart';
import 'home_styles.dart';

class HomeLearnSupportSection extends StatelessWidget {
  const HomeLearnSupportSection({
    super.key,
    required this.onEducate,
    required this.onTips,
    required this.onMilestones,
    required this.onAutismScreening,
  });

  final VoidCallback onEducate;
  final VoidCallback onTips;
  final VoidCallback onMilestones;
  final VoidCallback onAutismScreening;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: HomeStyles.sectionPadding(context, top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'home_learn_support_title'.tr(),
            style: TextStyle(
              fontSize: context.rf(15),
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          SizedBox(height: context.rs(8)),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: HomeQuickActionCard(
                    title: 'home_learn_title'.tr(),
                    imageAsset: HomeAssets.educateYourself,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onEducate,
                  ),
                ),
                SizedBox(width: HomeStyles.gridGap(context)),
                Expanded(
                  child: HomeQuickActionCard(
                    title: 'home_parenting_tips_title'.tr(),
                    imageAsset: HomeAssets.parentingTips,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onTips,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: HomeStyles.gridGap(context)),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: HomeQuickActionCard(
                    title: 'home_milestones_guide'.tr(),
                    imageAsset: HomeAssets.milestones,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onMilestones,
                  ),
                ),
                SizedBox(width: HomeStyles.gridGap(context)),
                Expanded(
                  child: HomeQuickActionCard(
                    title: 'home_autism_screening_title'.tr(),
                    imageAsset: HomeAssets.autismScreening,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onAutismScreening,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
