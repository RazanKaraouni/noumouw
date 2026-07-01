import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'parenting_hub_categories.dart';

Color categoryColor(String category) {
  switch (category) {
    case 'emotional_regulation':
      return const Color(0xFFD97706);
    case 'communication':
      return const Color(0xFF3B6EA5);
    case 'routines':
      return AppColors.green;
    default:
      return AppColors.textSec;
  }
}

Color categoryBackground(String category) {
  switch (category) {
    case 'emotional_regulation':
      return const Color(0xFFFFF4E5);
    case 'communication':
      return AppColors.roleParentBg;
    case 'routines':
      return const Color(0xFFE8F7F1);
    default:
      return AppColors.ageTierBg;
  }
}

String categoryLabelKey(String category) {
  final hub = hubCategoryById(category);
  if (hub != null) return hub.labelKey;
  switch (category) {
    case 'emotional_regulation':
      return 'tips_filter_emotional';
    case 'communication':
      return 'tips_filter_communication';
    case 'routines':
      return 'tips_filter_routines';
    default:
      return 'tips_filter_general';
  }
}

Widget buildCategoryChip(String category, {BuildContext? context}) {
  final color = categoryColor(category);
  final bg = categoryBackground(category);
  final labelKey = categoryLabelKey(category);
  final label = context != null ? context.tr(labelKey) : labelKey.tr();
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withOpacity(0.35)),
    ),
    child: Text(
      label,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: color,
      ),
    ),
  );
}
