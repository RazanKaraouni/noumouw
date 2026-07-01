import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../theme/app_colors.dart';
import '../../utils/parenting_hub_categories.dart';

IconData iconForHubCategory(ParentingHubCategory category) {
  switch (category.iconName) {
    case 'child_care':
      return Icons.child_care_rounded;
    case 'favorite':
      return Icons.favorite_rounded;
    case 'psychology':
      return Icons.psychology_rounded;
    case 'bedtime':
      return Icons.bedtime_rounded;
    case 'diversity_3':
      return Icons.diversity_3_rounded;
    case 'devices':
      return Icons.devices_rounded;
    case 'handshake':
      return Icons.handshake_rounded;
    case 'groups':
      return Icons.groups_rounded;
    case 'spa':
      return Icons.spa_rounded;
    default:
      return Icons.category_rounded;
  }
}

class ParentingCategoryDropdown extends StatelessWidget {
  const ParentingCategoryDropdown({
    super.key,
    required this.selectedCategoryId,
    required this.onCategorySelected,
  });

  final String? selectedCategoryId;
  final ValueChanged<String?> onCategorySelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'tips_hub_categories_title'.tr(),
          style: TextStyle(
            fontSize: context.rf(16),
            fontWeight: FontWeight.w800,
            color: AppColors.primary,
          ),
        ),
        SizedBox(height: context.rg(10)),
        DropdownButtonFormField<String?>(
          value: selectedCategoryId,
          isExpanded: true,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(context.rs(12)),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(context.rs(12)),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            contentPadding: Responsive.padSymmetric(
              context,
              horizontal: 14,
              vertical: 12,
            ),
          ),
          hint: Text(
            'tips_filter_all'.tr(),
            style: TextStyle(
              fontSize: context.rf(14),
              fontWeight: FontWeight.w600,
              color: AppColors.textPri,
            ),
          ),
          items: [
            DropdownMenuItem<String?>(
              value: null,
              child: Row(
                children: [
                  Icon(
                    Icons.apps_rounded,
                    size: context.rs(20),
                    color: AppColors.primary,
                  ),
                  SizedBox(width: context.rg(10)),
                  Expanded(
                    child: Text(
                      'tips_filter_all'.tr(),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: context.rf(14),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ...parentingHubCategories.map((category) {
              return DropdownMenuItem<String?>(
                value: category.id,
                child: Row(
                  children: [
                    Icon(
                      iconForHubCategory(category),
                      size: context.rs(20),
                      color: AppColors.primary,
                    ),
                    SizedBox(width: context.rg(10)),
                    Expanded(
                      child: Text(
                        category.labelKey.tr(),
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: context.rf(14),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
          onChanged: onCategorySelected,
        ),
      ],
    );
  }
}
