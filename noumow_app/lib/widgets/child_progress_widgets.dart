import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/child_progress_controller.dart';
import '../theme/app_colors.dart';
import 'child_profile_avatar.dart';

/// Illustrative empty state for profile progress sections.
class ProfileSectionEmptyState extends StatelessWidget {
  const ProfileSectionEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _green = Color(0xFF1D9E75);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Responsive.padDirectional(context, start: 24, top: 28, end: 24, bottom: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: context.rs(72),
            height: context.rs(72),
            decoration: BoxDecoration(
              color: const Color(0xFFE1F5EE),
              borderRadius: BorderRadius.circular(context.rs(20)),
            ),
            child: Icon(icon, size: context.rs(36), color: _green),
          ),
          SizedBox(height: context.rg(16)),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: context.rf(15),
              fontWeight: FontWeight.w600,
              color: _textPri,
            ),
          ),
          SizedBox(height: context.rg(8)),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: context.rf(13),
              color: _textSec,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class ChildProgressSelector extends StatelessWidget {
  const ChildProgressSelector({
    super.key,
    required this.controller,
    required this.onAddChild,
    this.selectedColor = AppColors.primary,
    this.showTrailingAddTile = false,
    this.emptyTitle,
    this.emptySubtitle,
  });

  final ChildProgressController controller;
  final Future<void> Function() onAddChild;
  final Color selectedColor;
  final bool showTrailingAddTile;
  final String? emptyTitle;
  final String? emptySubtitle;

  static const _green = Color(0xFF1D9E75);
  static const _selectedChipBg = AppColors.primary;
  static const _selectedChipFg = Colors.white;
  static const _white = Colors.white;
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE8EAE4);

  @override
  Widget build(BuildContext context) {
    final resolvedEmptyTitle =
        emptyTitle ?? 'progress_widget_add_first_child'.tr();

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final children = controller.children;
        if (children.isEmpty) {
          return GestureDetector(
            onTap: onAddChild,
            child: AppCard(
              margin: Responsive.padDirectional(context, start: 24, top: 12, end: 24),
              padding: Responsive.padAll(context, 18),
              color: const Color(0xFFE1F5EE),
              borderColor: _green.withOpacity(0.3),
              child: Row(
                children: [
                  if (emptySubtitle != null)
                    Container(
                      width: context.rs(44),
                      height: context.rs(44),
                      decoration: BoxDecoration(
                        color: _white,
                        borderRadius: BorderRadius.circular(context.rs(12)),
                      ),
                      child: Icon(Icons.add_rounded, color: _green, size: context.rs(22)),
                    ),
                  if (emptySubtitle == null) ...[
                    Icon(Icons.add_rounded, color: _green, size: context.rs(22)),
                    SizedBox(width: context.rg(10)),
                    Expanded(
                      child: Text(
                        resolvedEmptyTitle,
                        style: TextStyle(
                          fontSize: context.rf(13),
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ] else ...[
                    SizedBox(width: context.rg(14)),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            resolvedEmptyTitle,
                            style: TextStyle(
                              fontSize: context.rf(14),
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                          Text(
                            emptySubtitle!,
                            style: TextStyle(
                              fontSize: context.rf(11),
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }

        final chipWidth = context.rs(64);
        final stripHeight = context.rs(100);

        return SizedBox(
          height: stripHeight,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: Responsive.padDirectional(context, start: 24, top: 12, end: 24),
            itemCount: children.length + (showTrailingAddTile ? 1 : 0),
            itemBuilder: (context, i) {
              if (showTrailingAddTile && i == children.length) {
                return GestureDetector(
                  onTap: onAddChild,
                  child: Container(
                    width: chipWidth,
                    margin: EdgeInsetsDirectional.only(end: context.rg(10)),
                    decoration: BoxDecoration(
                      color: _white,
                      borderRadius: BorderRadius.circular(context.rs(16)),
                      border: Border.all(color: _border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_rounded, color: _green, size: context.rs(20)),
                        SizedBox(height: context.rg(4)),
                        Text(
                          'progress_widget_add'.tr(),
                          style: TextStyle(fontSize: context.rf(10), color: _green),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              }

              final child = children[i];
              final selected = i == controller.selectedChildIndex;
              return GestureDetector(
                onTap: () => controller.selectChild(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: chipWidth,
                  margin: EdgeInsets.only(right: context.rg(10)),
                  decoration: BoxDecoration(
                    color: selected ? _selectedChipBg : _white,
                    borderRadius: BorderRadius.circular(context.rs(16)),
                    border: Border.all(
                      color: selected ? _selectedChipBg : _border,
                      width: selected ? 0 : 0.8,
                    ),
                    boxShadow: selected && showTrailingAddTile
                        ? [
                            BoxShadow(
                              color: _selectedChipBg.withOpacity(0.28),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ]
                        : [],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ChildProfileAvatar(
                        imageUrl: (child['profile_image_url'] ?? '').toString(),
                        gender: child['gender']?.toString(),
                        size: 28,
                      ),
                      SizedBox(height: context.rg(5)),
                      Text(
                        ChildProgressController.nameOf(child).split(' ').first,
                        style: TextStyle(
                          fontSize: context.rf(10),
                          fontWeight: FontWeight.w600,
                          color: selected ? _selectedChipFg : _textPri,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        ChildProgressController.ageLabelOf(child),
                        style: TextStyle(
                          fontSize: context.rf(9),
                          color: selected
                              ? const Color(0xFFE8FFF5)
                              : _textSec,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class TrackingChildLabel extends StatelessWidget {
  const TrackingChildLabel({super.key, required this.child});

  final Map<String, dynamic>? child;

  static const _textPri = Color(0xFF1A1A18);

  @override
  Widget build(BuildContext context) {
    if (child == null) return const SizedBox.shrink();
    return Padding(
      padding: Responsive.padDirectional(context, start: 24, top: 14, end: 24),
      child: Center(
        child: Text(
          'progress_widget_tracking_child'.tr(
            namedArgs: {
              'name': ChildProgressController.nameOf(child),
            },
          ),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w600,
            color: _textPri,
          ),
        ),
      ),
    );
  }
}

class MilestoneTrackingCard extends StatelessWidget {
  const MilestoneTrackingCard({
    super.key,
    required this.child,
    required this.onTap,
  });

  final Map<String, dynamic>? child;
  final VoidCallback onTap;

  static const _white = Colors.white;

  @override
  Widget build(BuildContext context) {
    if (child == null) return const SizedBox.shrink();
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
        padding: Responsive.padAll(context, 18),
        decoration: BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.circular(context.rs(18)),
          boxShadow: Responsive.cardShadow(context, color: AppColors.primary, opacity: 0.3),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'progress_widget_track_milestones'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(16),
                      fontWeight: FontWeight.w700,
                      color: _white,
                    ),
                  ),
                  SizedBox(height: context.rg(4)),
                  Text(
                    'progress_widget_track_development'.tr(
                      namedArgs: {
                        'name': ChildProgressController.nameOf(child),
                      },
                    ),
                    style: TextStyle(
                      fontSize: context.rf(12),
                      color: _white.withOpacity(0.8),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: context.rs(52),
              height: context.rs(52),
              decoration: BoxDecoration(
                color: _white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(context.rs(16)),
              ),
              child: Icon(
                Icons.track_changes_rounded,
                color: _white,
                size: context.rs(26),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MilestoneReportActions extends StatelessWidget {
  const MilestoneReportActions({
    super.key,
    required this.controller,
    required this.onOpenMilestoneReport,
    required this.onOpenAutismReport,
  });

  final ChildProgressController controller;
  final void Function(Map<String, dynamic> child) onOpenMilestoneReport;
  final void Function(Map<String, dynamic> child) onOpenAutismReport;

  static const _textSec = Color(0xFF888880);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final child = controller.activeChild;
        final childId = ChildProgressController.idOf(child);
        return Padding(
          padding: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (controller.checkingSavedMilestones)
                Padding(
                  padding: EdgeInsets.only(bottom: context.rg(8)),
                  child: const LinearProgressIndicator(minHeight: 2),
                ),
              OutlinedButton.icon(
                onPressed: (child == null ||
                        childId == null ||
                        !controller.hasSavedMilestones)
                    ? null
                    : () => onOpenMilestoneReport(child),
                icon: Icon(Icons.summarize_outlined, size: context.rs(18)),
                label: Text('progress_widget_child_progress_report'.tr()),
              ),
              SizedBox(height: context.rg(8)),
              OutlinedButton.icon(
                onPressed: (child == null || childId == null)
                    ? null
                    : () => onOpenAutismReport(child),
                icon: Icon(Icons.assignment_turned_in_outlined, size: context.rs(18)),
                label: Text('progress_widget_view_autism_results'.tr()),
              ),
              if (!controller.hasSavedMilestones)
                Padding(
                  padding: EdgeInsets.only(top: context.rg(8)),
                  child: Text(
                    'progress_widget_save_milestones_first'.tr(),
                    style: TextStyle(fontSize: context.rf(12), color: _textSec),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
