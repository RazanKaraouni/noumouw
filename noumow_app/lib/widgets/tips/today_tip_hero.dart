import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../models/parenting_tip.dart';
import '../../theme/app_colors.dart';
import '../../utils/tip_category_style.dart';

class TodayTipHero extends StatelessWidget {
  const TodayTipHero({
    super.key,
    required this.tip,
    this.onTap,
    this.loading = false,
  });

  final ParentingTip? tip;
  final VoidCallback? onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return _buildShell(
        context,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _shimmerBox(context, width: 120, height: 22),
            SizedBox(height: context.rg(14)),
            _shimmerBox(context, width: double.infinity, height: 18),
            SizedBox(height: context.rg(8)),
            _shimmerBox(context, width: double.infinity, height: 14),
          ],
        ),
      );
    }

    if (tip == null) return const SizedBox.shrink();

    final t = tip!;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(context.rs(20)),
        child: _buildShell(
          context,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.warningBg,
                      borderRadius: BorderRadius.circular(context.rs(20)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.lightbulb_rounded,
                          size: context.rs(16),
                          color: AppColors.warningText,
                        ),
                        SizedBox(width: context.rg(6)),
                        Text(
                          'tips_hub_today_label'.tr(),
                          style: TextStyle(
                            fontSize: context.rf(12),
                            fontWeight: FontWeight.w700,
                            color: AppColors.warningText,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Flexible(
                    child: buildCategoryChip(t.category, context: context),
                  ),
                ],
              ),
              SizedBox(height: context.rg(14)),
              Text(
                t.title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: context.rf(20),
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPri,
                  height: 1.25,
                ),
              ),
              SizedBox(height: context.rg(10)),
              Text(
                t.content,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: context.rf(14),
                  height: 1.5,
                  color: AppColors.textPri.withOpacity(0.9),
                ),
              ),
              if (t.hasExamples) ...[
                SizedBox(height: context.rg(14)),
                _exampleBlock(
                  context,
                  labelKey: 'tips_hub_example_instead',
                  text: t.exampleBefore,
                  color: const Color(0xFFFEE2E2),
                  borderColor: const Color(0xFFFECACA),
                ),
                if (t.exampleAfter?.trim().isNotEmpty ?? false) ...[
                  SizedBox(height: context.rg(8)),
                  _exampleBlock(
                    context,
                    labelKey: 'tips_hub_example_say',
                    text: t.exampleAfter,
                    color: const Color(0xFFD1FAE5),
                    borderColor: const Color(0xFFA7F3D0),
                  ),
                ],
              ],
              SizedBox(height: context.rg(12)),
              Row(
                children: [
                  Text(
                    'tips_hub_read_more'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(13),
                      fontWeight: FontWeight.w700,
                      color: AppColors.green,
                    ),
                  ),
                  SizedBox(width: context.rg(4)),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: context.rs(16),
                    color: AppColors.green,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShell(BuildContext context, {required Widget child}) {
    return Container(
      width: double.infinity,
      padding: Responsive.padAll(context, 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.white,
            AppColors.warningBg.withOpacity(0.35),
          ],
        ),
        borderRadius: BorderRadius.circular(context.rs(20)),
        border: Border.all(color: AppColors.warningText.withOpacity(0.25)),
        boxShadow: Responsive.cardShadow(
          context,
          color: AppColors.warningText,
          opacity: 0.08,
          blur: 12,
          offsetY: 4,
        ),
      ),
      child: child,
    );
  }

  Widget _exampleBlock(
    BuildContext context, {
    required String labelKey,
    required String? text,
    required Color color,
    required Color borderColor,
  }) {
    final value = text?.trim() ?? '';
    if (value.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: Responsive.padAll(context, 10),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(context.rs(10)),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            labelKey.tr(),
            style: TextStyle(
              fontSize: context.rf(11),
              fontWeight: FontWeight.w700,
              color: AppColors.textSec,
            ),
          ),
          SizedBox(height: context.rg(4)),
          Text(
            '"$value"',
            style: TextStyle(
              fontSize: context.rf(13),
              fontWeight: FontWeight.w600,
              color: AppColors.textPri,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _shimmerBox(
    BuildContext context, {
    required double width,
    required double height,
  }) {
    return Container(
      width: width == double.infinity ? double.infinity : context.rs(width),
      height: context.rs(height),
      decoration: BoxDecoration(
        color: AppColors.border.withOpacity(0.5),
        borderRadius: BorderRadius.circular(context.rs(8)),
      ),
    );
  }
}
