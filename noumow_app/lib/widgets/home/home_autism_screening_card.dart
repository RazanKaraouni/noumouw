import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../theme/app_colors.dart';
import 'home_styles.dart';

class HomeAutismScreeningCard extends StatelessWidget {
  const HomeAutismScreeningCard({
    super.key,
    required this.onStart,
  });

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: HomeStyles.sectionPadding(context, top: 6),
      child: Container(
        padding: EdgeInsets.all(context.rs(14)),
        decoration: HomeStyles.cardDecoration(
          context,
          shadows: HomeStyles.cardShadow(context),
        ),
        child: Row(
          children: [
            Container(
              width: context.rs(48),
              height: context.rs(48),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F4FC),
                borderRadius: BorderRadius.circular(context.rs(14)),
              ),
              child: Icon(
                Icons.psychology_alt_rounded,
                color: const Color(0xFF2B6CB0),
                size: context.rf(26),
              ),
            ),
            SizedBox(width: context.rs(14)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'home_autism_screening_title'.tr(),
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
                    'home_autism_screening_subtitle'.tr(),
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
            SizedBox(width: context.rs(8)),
            FilledButton(
              onPressed: onStart,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.green,
                foregroundColor: AppColors.white,
                padding: EdgeInsets.symmetric(
                  horizontal: context.rs(12),
                  vertical: context.rs(8),
                ),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(context.rs(8)),
                ),
                textStyle: TextStyle(
                  fontSize: context.rf(12),
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text(
                'home_start_screening'.tr(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
