import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../services/child_progress_controller.dart';
import '../utils/responsive.dart';
import '../widgets/child_progress_widgets.dart';
import '../theme/app_colors.dart';
import 'create_child_page.dart';
import 'profile_progress_screen.dart';

/// Dedicated Progress module: daily milestone and assignment tracking only.
/// Administrative profile setup and report history live in [YourProfilePage].
class ProgressPage extends StatefulWidget {
  const ProgressPage({
    super.key,
    this.childProgress,
    this.childrenListRefresh,
    this.openCreateChildOverlay,
  });

  final ChildProgressController? childProgress;

  /// Notify this after a child is added elsewhere so the list reloads.
  final Listenable? childrenListRefresh;

  /// When provided (e.g. from [HomePage]), add child opens in-shell so the
  /// main bottom navigation bar stays visible.
  final void Function({Map<String, dynamic>? initialChild})?
      openCreateChildOverlay;

  @override
  State<ProgressPage> createState() => _ProgressPageState();
}

class _ProgressPageState extends State<ProgressPage> {
  ChildProgressController? _ownedChildProgress;

  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);

  ChildProgressController get _childProgress =>
      widget.childProgress ?? _ownedChildProgress!;

  Future<void> loadChildren() async {
    try {
      await _childProgress.loadChildren();
    } catch (_) {}
  }

  Future<void> _openCreateChild() async {
    final overlay = widget.openCreateChildOverlay;
    if (overlay != null) {
      overlay(initialChild: null);
      return;
    }
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(builder: (_) => const CreateChildPage()),
    );
    if (result == true) await loadChildren();
  }

  Future<void> _onTrackerCompleted() async {
    await _childProgress.refreshSavedMilestonesState();
  }

  void _onExternalChildrenRefresh() {
    loadChildren();
  }

  @override
  void initState() {
    super.initState();
    if (widget.childProgress == null) {
      _ownedChildProgress = ChildProgressController();
    }
    widget.childrenListRefresh?.addListener(_onExternalChildrenRefresh);
    loadChildren();
  }

  @override
  void didUpdateWidget(ProgressPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childrenListRefresh != widget.childrenListRefresh) {
      oldWidget.childrenListRefresh?.removeListener(_onExternalChildrenRefresh);
      widget.childrenListRefresh?.addListener(_onExternalChildrenRefresh);
    }
  }

  @override
  void dispose() {
    widget.childrenListRefresh?.removeListener(_onExternalChildrenRefresh);
    _ownedChildProgress?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFF7F8F5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: Responsive.padDirectional(
              context,
              start: 24,
              top: 8,
              end: 24,
            ),
            child: Text(
              'progress_monitor_title'.tr(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(20),
                fontWeight: FontWeight.w700,
                color: _textPri,
              ),
            ),
          ),
          Padding(
            padding: Responsive.padDirectional(
              context,
              start: 24,
              top: 4,
              end: 24,
            ),
            child: Text(
              'progress_subtitle'.tr(),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(12),
                color: _textSec,
              ),
            ),
          ),
          Padding(
            padding: Responsive.padDirectional(
              context,
              start: 24,
              top: 12,
              end: 24,
            ),
            child: Text(
              'progress_choose_children'.tr(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(12),
                fontWeight: FontWeight.w700,
                color: _textPri,
              ),
            ),
          ),
          AnimatedBuilder(
            animation: _childProgress,
            builder: (context, _) {
              return ChildProgressSelector(
                controller: _childProgress,
                selectedColor: AppColors.primary,
                onAddChild: _openCreateChild,
              );
            },
          ),
          Expanded(
            child: ProfileProgressScreen(
              controller: _childProgress,
              onTrackerCompleted: _onTrackerCompleted,
              expandTabs: true,
              showReportActions: false,
            ),
          ),
        ],
      ),
    );
  }
}
