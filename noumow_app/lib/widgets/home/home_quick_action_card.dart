import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../theme/app_colors.dart';
import 'home_storyset_image.dart';
import 'home_styles.dart';

class HomeQuickActionCard extends StatelessWidget {
  const HomeQuickActionCard({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.icon,
    this.imageAsset,
    this.iconBackgroundColor,
    this.iconColor,
    this.centerContent = false,
    this.imageHeight = 56,
  }) : assert(
          icon != null || imageAsset != null,
          'Provide either icon or imageAsset',
        );

  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final IconData? icon;
  final String? imageAsset;
  final Color? iconBackgroundColor;
  final Color? iconColor;
  final bool centerContent;
  final double imageHeight;

  static const _iconSize = 44.0;

  @override
  Widget build(BuildContext context) {
    final resolvedIconBg =
        iconBackgroundColor ?? AppColors.green.withOpacity(0.14);
    final resolvedIconColor = iconColor ?? AppColors.green;
    final alignment =
        centerContent ? CrossAxisAlignment.center : CrossAxisAlignment.start;
    final textAlign = centerContent ? TextAlign.center : TextAlign.start;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(context.rs(12)),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.all(HomeStyles.cardPadding(context)),
          decoration: HomeStyles.cardDecoration(
            context,
            shadows: HomeStyles.cardShadow(context),
          ),
          child: Column(
            crossAxisAlignment: alignment,
            children: [
              if (imageAsset != null)
                SizedBox(
                  width: double.infinity,
                  child: HomeStorysetImage(
                    assetPath: imageAsset!,
                    height: imageHeight,
                    width: double.infinity,
                  ),
                )
              else
                Container(
                  width: context.rs(_iconSize),
                  height: context.rs(_iconSize),
                  decoration: BoxDecoration(
                    color: resolvedIconBg,
                    borderRadius: BorderRadius.circular(context.rs(12)),
                  ),
                  child: Icon(
                    icon,
                    color: resolvedIconColor,
                    size: context.rf(24),
                  ),
                ),
              SizedBox(height: context.rs(10)),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: textAlign,
                style: TextStyle(
                  fontSize: context.rf(12),
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPri,
                  height: 1.2,
                ),
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                SizedBox(height: context.rs(4)),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: textAlign,
                  style: TextStyle(
                    fontSize: context.rf(10),
                    color: AppColors.textSec.withOpacity(0.95),
                    height: 1.25,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
