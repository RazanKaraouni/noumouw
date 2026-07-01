import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../theme/app_colors.dart';
import 'home_styles.dart';

class HomeActionTile extends StatelessWidget {
  const HomeActionTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.iconBackgroundColor,
    this.iconColor,
    this.forwardChevron,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final Color? iconBackgroundColor;
  final Color? iconColor;
  final Widget? forwardChevron;

  static const _iconSize = 48.0;

  @override
  Widget build(BuildContext context) {
    final resolvedIconBg =
        iconBackgroundColor ?? AppColors.green.withOpacity(0.14);
    final resolvedIconColor = iconColor ?? AppColors.green;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(context.rs(14)),
        decoration: HomeStyles.cardDecoration(
          context,
          shadows: HomeStyles.cardShadow(context),
        ),
        child: Row(
          children: [
            Container(
              width: context.rs(_iconSize),
              height: context.rs(_iconSize),
              decoration: BoxDecoration(
                color: resolvedIconBg,
                borderRadius: BorderRadius.circular(context.rs(14)),
              ),
              child: Icon(icon, color: resolvedIconColor, size: context.rf(26)),
            ),
            SizedBox(width: context.rs(14)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
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
                    subtitle,
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
            forwardChevron ??
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textSec.withOpacity(0.85),
                  size: context.rf(22),
                ),
          ],
        ),
      ),
    );
  }
}
