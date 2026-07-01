import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../services/home_progress_summary_service.dart';
import '../../theme/app_colors.dart';
import '../child_profile_avatar.dart';
import 'home_styles.dart';

class HomeChildProgressCard extends StatelessWidget {
  const HomeChildProgressCard({
    super.key,
    required this.loading,
    required this.summary,
    required this.onViewDevelopment,
    required this.onAddChild,
    this.forwardChevron,
  });

  final bool loading;
  final HomeProgressSummary? summary;
  final VoidCallback onViewDevelopment;
  final VoidCallback onAddChild;
  final Widget? forwardChevron;

  static const _avatarSize = 48.0;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: HomeStyles.sectionPadding(context, top: 8),
      child: GestureDetector(
        onTap: summary?.hasChild == true ? onViewDevelopment : onAddChild,
        child: Container(
          padding: EdgeInsets.all(context.rs(14)),
          decoration: HomeStyles.cardDecoration(
            context,
            shadows: HomeStyles.cardShadow(context),
          ),
          child: loading
              ? SizedBox(
                  height: context.rs(72),
                  child: const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.green,
                    ),
                  ),
                )
              : _buildContent(context),
        ),
      ),
    );
  }

  Widget _buildEmptyStateAvatar(BuildContext context) {
    return Container(
      width: context.rs(_avatarSize),
      height: context.rs(_avatarSize),
      decoration: BoxDecoration(
        color: AppColors.green.withOpacity(0.14),
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.child_care_rounded,
        color: AppColors.green,
        size: context.rf(26),
      ),
    );
  }

  Widget _buildAvatar(BuildContext context, HomeProgressSummary data) {
    return ChildProfileAvatar(
      imageUrl: data.profileImageUrl,
      gender: data.childGender,
      size: context.rs(_avatarSize),
    );
  }

  Widget _buildContent(BuildContext context) {
    final data = summary;
    if (data == null || !data.hasChild) {
      return Row(
        children: [
          _buildEmptyStateAvatar(context),
          SizedBox(width: context.rs(14)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'home_child_progress_title'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(16),
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPri,
                  ),
                ),
                SizedBox(height: context.rs(4)),
                Text(
                  'home_child_progress_add_child'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(12),
                    color: AppColors.textSec.withOpacity(0.95),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final percent = data.percent.clamp(0, 100);
    final percentLabel = percent.round();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _buildAvatar(context, data),
        SizedBox(width: context.rs(14)),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'home_child_progress_title'.tr(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: context.rf(14),
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPri,
                ),
              ),
              SizedBox(height: context.rs(2)),
              RichText(
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  style: const TextStyle(color: AppColors.textPri),
                  children: [
                    TextSpan(
                      text: '$percentLabel%',
                      style: TextStyle(
                        fontSize: context.rf(22),
                        fontWeight: FontWeight.w800,
                        color: AppColors.green,
                      ),
                    ),
                    TextSpan(
                      text: ' ${'home_milestones_achieved_suffix'.tr()}',
                      style: TextStyle(
                        fontSize: context.rf(11),
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSec.withOpacity(0.95),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: context.rs(6)),
              ClipRRect(
                borderRadius: BorderRadius.circular(context.rs(4)),
                child: LinearProgressIndicator(
                  value: percent / 100,
                  minHeight: context.rs(6),
                  backgroundColor: AppColors.border,
                  color: AppColors.green,
                ),
              ),
              SizedBox(height: context.rs(4)),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        'home_view_development'.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: context.rf(11),
                          fontWeight: FontWeight.w600,
                          color: AppColors.green,
                        ),
                      ),
                    ),
                    if (forwardChevron != null) forwardChevron!,
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
