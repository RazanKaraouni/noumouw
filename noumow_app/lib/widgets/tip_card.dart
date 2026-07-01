import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/parenting_tip.dart';
import '../theme/app_colors.dart';
import '../utils/tip_category_style.dart';
import '../utils/tip_age_range.dart';

/// Card for a single approved parenting tip (home + tips list).
class TipCard extends StatelessWidget {
  const TipCard({
    super.key,
    required this.tip,
    this.onTap,
  });

  final ParentingTip tip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = categoryColor(tip.category);

    return AppCard(
      onTap: onTap,
      padding: Responsive.padAll(context, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          buildCategoryChip(tip.category),
          if (formatTipAgeRange(tip.ageRange).isNotEmpty) ...[
            SizedBox(height: context.rg(8)),
            Text(
              formatTipAgeRange(tip.ageRange),
              style: TextStyle(
                fontSize: context.rf(12),
                fontWeight: FontWeight.w600,
                color: AppColors.textSec.withOpacity(0.9),
              ),
            ),
          ],
          SizedBox(height: context.rg(10)),
          Text(
            tip.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.rf(16),
              fontWeight: FontWeight.w700,
              color: AppColors.textPri,
            ),
          ),
          SizedBox(height: context.rg(6)),
          Text(
            tip.content,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.rf(13),
              height: 1.4,
              color: AppColors.textSec.withOpacity(0.95),
            ),
          ),
          SizedBox(height: context.rg(8)),
          Row(
            children: [
              Icon(Icons.arrow_forward_rounded, size: context.rs(16), color: color),
              SizedBox(width: context.rg(4)),
              Expanded(
                child: Text(
                  context.tr(categoryLabelKey(tip.category)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(12),
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
