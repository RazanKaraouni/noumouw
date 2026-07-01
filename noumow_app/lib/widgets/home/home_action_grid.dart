import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../constants/home_assets.dart';
import '../../theme/app_colors.dart';
import 'home_quick_action_card.dart';
import 'home_styles.dart';

class HomeActionGrid extends StatelessWidget {
  const HomeActionGrid({
    super.key,
    required this.onTherapists,
    required this.onNearby,
  });

  final VoidCallback onTherapists;
  final VoidCallback onNearby;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: HomeStyles.sectionPadding(context, top: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'home_quick_actions_title'.tr(),
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
                    title: 'home_view_all_therapists'.tr(),
                    imageAsset: HomeAssets.viewAllTherapists,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onTherapists,
                  ),
                ),
                SizedBox(width: HomeStyles.gridGap(context)),
                Expanded(
                  child: HomeQuickActionCard(
                    title: 'home_nearby_providers_title'.tr(),
                    imageAsset: HomeAssets.nearbyProviders,
                    centerContent: true,
                    imageHeight: 100,
                    onTap: onNearby,
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
