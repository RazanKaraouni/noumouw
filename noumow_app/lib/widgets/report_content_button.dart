import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import 'report_content_sheet.dart';

/// Compact flag control for list rows and detail app bars.
class ReportContentButton extends StatelessWidget {
  const ReportContentButton({
    super.key,
    required this.targetType,
    required this.targetId,
    this.iconSize = 22,
    this.tooltip,
    this.iconButtonStyle,
  });

  final ReportTargetType targetType;
  final String targetId;
  final double iconSize;
  final String? tooltip;
  final ButtonStyle? iconButtonStyle;

  @override
  Widget build(BuildContext context) {
    final id = targetId.trim();
    if (id.isEmpty) return const SizedBox.shrink();

    return IconButton(
      tooltip: tooltip ?? 'report_button_tooltip'.tr(),
      style: iconButtonStyle,
      onPressed: () => showReportContentSheet(
        context,
        targetType: targetType,
        targetId: id,
      ),
      icon: Icon(Icons.flag_outlined, size: context.rs(iconSize)),
    );
  }
}
