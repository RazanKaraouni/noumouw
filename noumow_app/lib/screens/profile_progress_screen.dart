import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/child_progress_controller.dart';
import '../theme/app_colors.dart';
import '../widgets/child_progress_widgets.dart';
import '../widgets/milestone_tracker_panel.dart';
import 'child_assignments_screen.dart';

/// Profile & Progress section: milestone tracking and therapist assignments.
class ProfileProgressScreen extends StatefulWidget {
  const ProfileProgressScreen({
    super.key,
    required this.controller,
    this.onTrackerCompleted,
    this.onOpenMilestoneReport,
    this.onOpenAutismReport,
    this.showReportActions = false,
    this.expandTabs = false,
  });

  final ChildProgressController controller;
  final VoidCallback? onTrackerCompleted;
  final void Function(Map<String, dynamic> child)? onOpenMilestoneReport;
  final void Function(Map<String, dynamic> child)? onOpenAutismReport;

  /// When false, report view actions are hidden (Progress module only).
  final bool showReportActions;

  /// When true, [TabBarView] fills remaining vertical space instead of a fixed height.
  final bool expandTabs;

  @override
  State<ProfileProgressScreen> createState() => _ProfileProgressScreenState();
}

class _ProfileProgressScreenState extends State<ProfileProgressScreen>
    with SingleTickerProviderStateMixin {
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE8EAE4);

  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Widget _buildTabBar(BuildContext context) {
    return Padding(
      padding: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF7F8F5),
          borderRadius: BorderRadius.circular(context.rs(12)),
          border: Border.all(color: _border),
        ),
        child: TabBar(
          controller: _tabController,
          indicator: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(context.rs(10)),
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          dividerColor: Colors.transparent,
          labelColor: Colors.white,
          unselectedLabelColor: _textSec,
          labelStyle: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w500,
          ),
          tabs: [
            Tab(text: 'profile_progress_tab_milestones'.tr()),
            Tab(text: 'profile_progress_tab_assignments'.tr()),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressTab() {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Milestone tracking for the selected child
            TrackingChildLabel(child: widget.controller.activeChild),
            ProfileMilestoneTrackerCard(
              controller: widget.controller,
              onCompleted: widget.onTrackerCompleted,
            ),
            if (widget.showReportActions &&
                widget.onOpenMilestoneReport != null &&
                widget.onOpenAutismReport != null)
              MilestoneReportActions(
                controller: widget.controller,
                onOpenMilestoneReport: widget.onOpenMilestoneReport!,
                onOpenAutismReport: widget.onOpenAutismReport!,
              ),
            if (widget.controller.activeChild != null &&
                !widget.controller.checkingSavedMilestones &&
                !widget.controller.hasSavedMilestones)
              ProfileSectionEmptyState(
                icon: Icons.insights_outlined,
                title: 'profile_progress_empty_title'.tr(),
                subtitle: 'profile_progress_empty_subtitle'.tr(namedArgs: {
                  'name': ChildProgressController.nameOf(
                      widget.controller.activeChild),
                }),
              ),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }

  Widget _buildAssignmentsTab() {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final child = widget.controller.activeChild;
        final childId = ChildProgressController.idOf(child);
        if (childId == null) {
          return Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(24, 32, 24, 0),
            child: Text(
              'profile_progress_select_child'.tr(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: _textSec, height: 1.4),
            ),
          );
        }
        return ChildAssignmentsScreen(
          key: ValueKey<String>(childId),
          childId: childId,
          childName: ChildProgressController.nameOf(child),
        );
      },
    );
  }

  Widget _buildTabBarView() {
    final tabBarView = TabBarView(
      controller: _tabController,
      children: [
        SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          child: _buildProgressTab(),
        ),
        _buildAssignmentsTab(),
      ],
    );

    if (widget.expandTabs) {
      return Expanded(child: tabBarView);
    }

    return SizedBox(height: context.rs(520), child: tabBarView);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: Responsive.padDirectional(context, start: 24, top: 8, end: 24),
          child: Text(
            'profile_progress_development_title'.tr(),
            style: TextStyle(
              fontSize: context.rf(15),
              fontWeight: FontWeight.w700,
              color: _textPri,
            ),
          ),
        ),
        Padding(
          padding: Responsive.padDirectional(context, start: 24, top: 4, end: 24),
          child: Text(
            'profile_progress_development_subtitle'.tr(),
            style: TextStyle(fontSize: context.rf(12), color: _textSec),
          ),
        ),
        _buildTabBar(context),
        _buildTabBarView(),
      ],
    );
  }
}
