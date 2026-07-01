import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';

/// Role badge shown beside author names on community post cards.
class CommunityAuthorBadge extends StatelessWidget {
  const CommunityAuthorBadge({
    super.key,
    required this.role,
  });

  final CommunityAuthorRole role;

  @override
  Widget build(BuildContext context) {
    final isSpecialist = role == CommunityAuthorRole.specialist;

    return Container(
      padding: Responsive.padSymmetric(context, horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isSpecialist ? const Color(0xFFE6F1FB) : AppColors.roleParentBg,
        borderRadius: BorderRadius.circular(context.rs(8)),
        border: Border.all(
          color: isSpecialist
              ? const Color(0xFF185FA5)
              : AppColors.roleParentBorder,
          width: 0.8,
        ),
      ),
      child: Text(
        isSpecialist
            ? 'community_badge_specialist'.tr()
            : 'community_badge_parent'.tr(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: context.rf(10),
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
          color: isSpecialist
              ? const Color(0xFF185FA5)
              : AppColors.roleParentBorder,
        ),
      ),
    );
  }
}
