import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/parenting_tip.dart';
import '../../theme/app_colors.dart';
import '../../utils/tip_category_style.dart';
import '../../utils/tip_age_range.dart';
import '../../widgets/report_content_sheet.dart';

void showTipDetailSheet(BuildContext context, ParentingTip tip) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      return DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.35,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(context.rs(20)),
              ),
            ),
            child: Column(
              children: [
                SizedBox(height: context.rg(10)),
                Container(
                  width: context.rs(40),
                  height: context.rs(4),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(context.rs(2)),
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: Responsive.padDirectional(
                      context,
                      start: 20,
                      top: 16,
                      end: 20,
                      bottom: 24,
                    ),
                    children: [
                      buildCategoryChip(tip.category, context: context),
                      if (formatTipAgeRange(tip.ageRange).isNotEmpty) ...[
                        SizedBox(height: context.rg(8)),
                        Text(
                          formatTipAgeRange(tip.ageRange),
                          style: TextStyle(
                            fontSize: context.rf(13),
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSec.withOpacity(0.95),
                          ),
                        ),
                      ],
                      SizedBox(height: context.rg(14)),
                      Text(
                        tip.title,
                        style: TextStyle(
                          fontSize: context.rf(22),
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPri,
                          height: 1.25,
                        ),
                      ),
                      SizedBox(height: context.rg(16)),
                      const Divider(color: AppColors.border, height: 1),
                      SizedBox(height: context.rg(16)),
                      Text(
                        tip.content,
                        style: TextStyle(
                          fontSize: context.rf(15),
                          height: 1.55,
                          color: AppColors.textPri.withOpacity(0.92),
                        ),
                      ),
                      if (tip.hasExamples) ...[
                        SizedBox(height: context.rg(20)),
                        if (tip.exampleBefore?.trim().isNotEmpty ?? false) ...[
                          Text(
                            'tips_hub_example_instead'.tr(),
                            style: TextStyle(
                              fontSize: context.rf(12),
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSec,
                            ),
                          ),
                          SizedBox(height: context.rg(6)),
                          Text(
                            '"${tip.exampleBefore!.trim()}"',
                            style: TextStyle(
                              fontSize: context.rf(14),
                              fontStyle: FontStyle.italic,
                              color: AppColors.textPri.withOpacity(0.9),
                            ),
                          ),
                        ],
                        if (tip.exampleAfter?.trim().isNotEmpty ?? false) ...[
                          SizedBox(height: context.rg(14)),
                          Text(
                            'tips_hub_example_say'.tr(),
                            style: TextStyle(
                              fontSize: context.rf(12),
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSec,
                            ),
                          ),
                          SizedBox(height: context.rg(6)),
                          Text(
                            '"${tip.exampleAfter!.trim()}"',
                            style: TextStyle(
                              fontSize: context.rf(14),
                              fontStyle: FontStyle.italic,
                              color: AppColors.textPri.withOpacity(0.9),
                            ),
                          ),
                        ],
                      ],
                      SizedBox(height: context.rg(24)),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                final buffer = StringBuffer()
                                  ..writeln(tip.title)
                                  ..writeln()
                                  ..writeln(tip.content);
                                if (tip.exampleBefore?.trim().isNotEmpty ?? false) {
                                  buffer
                                    ..writeln()
                                    ..writeln(
                                      '${'tips_hub_example_instead'.tr()} "${tip.exampleBefore!.trim()}"',
                                    );
                                }
                                if (tip.exampleAfter?.trim().isNotEmpty ?? false) {
                                  buffer.writeln(
                                    '${'tips_hub_example_say'.tr()} "${tip.exampleAfter!.trim()}"',
                                  );
                                }
                                Share.share(buffer.toString().trim());
                              },
                              icon: Icon(Icons.share_rounded, size: context.rs(20)),
                              label: Text(
                                'community_share'.tr(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.border),
                                padding: Responsive.padSymmetric(
                                  context,
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(context.rs(12)),
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: context.rg(10)),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: tip.tipId.isEmpty
                                  ? null
                                  : () {
                                      showReportContentSheet(
                                        sheetContext,
                                        targetType: ReportTargetType.tip,
                                        targetId: tip.tipId,
                                      );
                                    },
                              icon: Icon(Icons.flag_outlined, size: context.rs(20)),
                              label: Text(
                                'report_button_tooltip'.tr(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.border),
                                padding: Responsive.padSymmetric(
                                  context,
                                  vertical: 12,
                                ),
                                foregroundColor: AppColors.textSec,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(context.rs(12)),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}
