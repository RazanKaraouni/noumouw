import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/child_assignment.dart';
import '../services/active_child_progress_service.dart';
import '../services/assignments_api_service.dart';
import '../services/auth_sign_out.dart';
import '../services/child_deletion_service.dart';
import '../services/child_progress_controller.dart';
import '../services/parent_reports_service.dart';
import '../services/resource_save_service.dart';
import '../theme/app_colors.dart';
import '../widgets/assignment_parent_sheet.dart';
import '../widgets/child_profile_avatar.dart';
import 'autism_report_view_page.dart';
import 'create_child_page.dart';
import 'saved_resources_page.dart';
import '../widgets/milestone_tracker_panel.dart';
import 'milestone_report_screen.dart';

/// Child profile: active-child development tracking and account settings.
class FamilyProfileHubScreen extends StatefulWidget {
  const FamilyProfileHubScreen({
    super.key,
    required this.childProgress,
    this.childrenListRefresh,
    this.openCreateChildOverlay,
  });

  final ChildProgressController childProgress;
  final Listenable? childrenListRefresh;
  final void Function({Map<String, dynamic>? initialChild})?
      openCreateChildOverlay;

  @override
  State<FamilyProfileHubScreen> createState() => _FamilyProfileHubScreenState();
}

class _FamilyProfileHubScreenState extends State<FamilyProfileHubScreen> {
  final _supabase = Supabase.instance.client;
  final _progressService = ActiveChildProgressService();
  final _saveService = ResourceSaveService();
  final _assignmentsApi = AssignmentsApiService();
  final _reportsService = ParentReportsService();

  ActiveChildProgressSnapshot _progressSnapshot =
      ActiveChildProgressSnapshot.empty;
  bool _progressLoading = false;

  List<ChildAssignment> _assignments = [];
  bool _assignmentsLoading = false;
  bool _assignmentsVisible = false;

  bool _reportsLoading = false;
  bool _reportsVisible = false;
  List<Map<String, dynamic>> _reports = [];

  String? _parentName;
  String? _parentEmail;
  bool _accountLoading = true;

  int _savedResourceCount = 0;
  String? _openMenuChildId;

  @override
  void initState() {
    super.initState();
    widget.childrenListRefresh?.addListener(_onExternalChildrenRefresh);
    _refreshAll();
  }

  @override
  void didUpdateWidget(FamilyProfileHubScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childrenListRefresh != widget.childrenListRefresh) {
      oldWidget.childrenListRefresh?.removeListener(_onExternalChildrenRefresh);
      widget.childrenListRefresh?.addListener(_onExternalChildrenRefresh);
    }
  }

  @override
  void dispose() {
    widget.childrenListRefresh?.removeListener(_onExternalChildrenRefresh);
    super.dispose();
  }

  ChildProgressController get _childProgress => widget.childProgress;

  void _onExternalChildrenRefresh() => _refreshAll();

  Future<void> loadChildren() async {
    try {
      await _childProgress.loadChildren();
      if (mounted) await _reloadActiveChildData();
    } catch (_) {}
  }

  Future<void> _loadParentAccount() async {
    setState(() => _accountLoading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        if (mounted) {
          setState(() {
            _parentName = null;
            _parentEmail = null;
            _accountLoading = false;
          });
        }
        return;
      }

      String? name;
      String? email;
      try {
        final parent = await _supabase
            .from('parents')
            .select('full_name, email')
            .eq('user_id', user.id)
            .maybeSingle();
        name = parent?['full_name']?.toString();
        email = parent?['email']?.toString();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _parentName = (name ??
                user.userMetadata?['full_name'] ??
                'home_parent_default'.tr())
            .toString()
            .trim();
        _parentEmail = email ?? user.email;
        _accountLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _accountLoading = false);
    }
  }

  Future<void> _loadSavedCount() async {
    try {
      if (_supabase.auth.currentUser == null) {
        if (mounted) setState(() => _savedResourceCount = 0);
        return;
      }
      final resources = await _saveService.fetchSavedResources();
      if (mounted) setState(() => _savedResourceCount = resources.length);
    } catch (_) {
      if (mounted) setState(() => _savedResourceCount = 0);
    }
  }

  Future<void> _reloadActiveChildData() async {
    final child = _childProgress.activeChild;
    await Future.wait([
      _loadProgressSnapshot(child),
      if (_assignmentsVisible) _loadAssignments(child),
      if (_reportsVisible) _loadReports(),
    ]);
  }

  void _resetAssignmentsSection() {
    _assignmentsVisible = false;
    _assignments = [];
    _assignmentsLoading = false;
  }

  void _resetReportsSection() {
    _reportsVisible = false;
    _reports = [];
    _reportsLoading = false;
  }

  Future<void> _onViewAssignments() async {
    if (_assignmentsLoading) return;
    setState(() => _assignmentsVisible = true);
    await _loadAssignments(_childProgress.activeChild);
  }

  void _onCloseAssignments() {
    setState(_resetAssignmentsSection);
  }

  Future<void> _onViewReports() async {
    if (_reportsLoading) return;
    setState(() => _reportsVisible = true);
    await _loadReports();
  }

  void _onCloseReports() {
    setState(_resetReportsSection);
  }

  Future<void> _loadReports() async {
    setState(() => _reportsLoading = true);
    try {
      if (_supabase.auth.currentUser == null) {
        if (mounted) {
          setState(() {
            _reports = [];
            _reportsLoading = false;
          });
        }
        return;
      }
      final reports = await _reportsService.fetchReportHistory();
      if (!mounted) return;
      setState(() {
        _reports = reports;
        _reportsLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _reports = [];
          _reportsLoading = false;
        });
      }
    }
  }

  Future<void> _loadProgressSnapshot(Map<String, dynamic>? child) async {
    setState(() => _progressLoading = true);
    try {
      final snapshot = await _progressService.loadProgress(child);
      if (!mounted) return;
      setState(() {
        _progressSnapshot = snapshot;
        _progressLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _progressSnapshot = ActiveChildProgressSnapshot.empty;
          _progressLoading = false;
        });
      }
    }
  }

  Future<void> _loadAssignments(Map<String, dynamic>? child) async {
    final childId = ChildProgressController.idOf(child);
    if (childId == null) {
      if (mounted) setState(() => _assignments = []);
      return;
    }
    setState(() => _assignmentsLoading = true);
    try {
      final rows = await _assignmentsApi.fetchAssignmentsForChild(childId);
      if (!mounted) return;
      setState(() {
        _assignments = rows;
        _assignmentsLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _assignments = [];
          _assignmentsLoading = false;
        });
      }
    }
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      loadChildren(),
      _loadParentAccount(),
      _loadSavedCount(),
    ]);
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
    if (result == true) await _refreshAll();
  }

  Future<void> _editChild(Map<String, dynamic> child) async {
    final overlay = widget.openCreateChildOverlay;
    if (overlay != null) {
      overlay(initialChild: child);
      return;
    }
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => CreateChildPage(initialChild: child),
      ),
    );
    if (result == true) await _refreshAll();
  }

  Future<void> _removeChild(Map<String, dynamic> child) async {
    final id = ChildDeletionService.childrenIdFrom(child);
    if (id == null) return;

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('profile_remove_title'.tr()),
        content: Text('profile_remove_confirm'.tr(namedArgs: {
          'name': ChildProgressController.nameOf(child),
        })),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('profile_cancel'.tr()),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('profile_remove'.tr()),
          ),
        ],
      ),
    );
    if (shouldDelete != true) return;

    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;
      await ChildDeletionService().deleteChild(
        childrenId: id,
        parentId: user.id,
      );
      await _refreshAll();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('profile_removed'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('profile_remove_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)})),
        ),
      );
    }
  }

  Future<void> _onChildSelected(int index) async {
    setState(() {
      _resetAssignmentsSection();
      _resetReportsSection();
    });
    await _childProgress.selectChild(index);
    await _reloadActiveChildData();
  }

  Future<void> _onTrackerCompleted() async {
    await _childProgress.refreshSavedMilestonesState();
    await _reloadActiveChildData();
  }

  Future<void> _openMilestoneReport(Map<String, dynamic> child) async {
    final childId = ChildProgressController.idOf(child);
    if (childId == null) return;
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => MilestoneReportScreen(
          childId: childId,
          childName: ChildProgressController.nameOf(child),
          childAgeLabel: ChildProgressController.ageLabelOf(child),
        ),
      ),
    );
  }

  Future<void> _openAutismReport(Map<String, dynamic> child) async {
    final childId = ChildProgressController.idOf(child);
    if (childId == null) return;
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => AutismReportViewPage(
          childId: childId,
          childName: ChildProgressController.nameOf(child),
          childProgress: _childProgress,
        ),
      ),
    );
  }

  void _openReportHistoryItem(Map<String, dynamic> report) {
    final childId = report['child_id']?.toString();
    if (childId == null || childId.isEmpty) return;

    final child = _childProgress.activeChild;
    final childName = child != null &&
            ChildProgressController.idOf(child) == childId
        ? ChildProgressController.nameOf(child)
        : 'profile_child_default'.tr();

    final reportType = (report['report_type'] ?? '').toString().toLowerCase();
    if (reportType == 'screening_summary') {
      _openAutismReport({
        'children_id': childId,
        'full_name': childName,
      });
      return;
    }
    _openMilestoneReport({
      'children_id': childId,
      'full_name': childName,
    });
  }

  bool _reportMatchesActiveChild(Map<String, dynamic> report) {
    final activeId = ChildProgressController.idOf(_childProgress.activeChild);
    if (activeId == null) return false;
    return report['child_id']?.toString() == activeId;
  }

  String _reportTypeLabel(String? reportType) {
    switch (reportType?.toLowerCase()) {
      case 'screening_summary':
        return 'profile_report_screening'.tr();
      case 'milestone_tracking':
        return 'profile_report_milestone'.tr();
      default:
        return reportType ?? 'profile_report_default'.tr();
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('logout_title'.tr()),
        content: Text('logout_message'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('profile_cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('hub_logout'.tr()),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await AuthSignOut.signOutAndNavigateToAuthSplash(context);
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('logout_error_snackbar'.tr())),
      );
    }
  }

  Future<void> _openAssignment(ChildAssignment assignment) async {
    final updated = await AssignmentParentSheet.show(
      context,
      assignment: assignment,
    );
    if (updated == null || !mounted) return;
    setState(() {
      final index = _assignments.indexWhere(
        (a) => a.assignedActivityId == updated.assignedActivityId,
      );
      if (index >= 0) {
        _assignments = List.of(_assignments)..[index] = updated;
      }
    });
  }

  Future<void> _handleChildrenChanged() async {
    final refresh = widget.childrenListRefresh;
    if (refresh is ValueNotifier<int>) {
      refresh.value++;
    } else {
      await _refreshAll();
    }
  }

  Future<void> _openAccountSettings() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => _FamilyHubSettingsPage(
          accountLoading: _accountLoading,
          parentName: _parentName,
          parentEmail: _parentEmail,
          savedResourceCount: _savedResourceCount,
          childProgress: _childProgress,
          openMenuChildId: _openMenuChildId,
          onChildSelected: _onChildSelected,
          onChildrenChanged: _handleChildrenChanged,
          onRemoveChild: _removeChild,
          onMenuOpened: (id) => setState(() => _openMenuChildId = id),
          onMenuClosed: () => setState(() => _openMenuChildId = null),
          onOpenSavedResources: () {
            Navigator.push<void>(
              context,
              MaterialPageRoute<void>(
                builder: (_) => const SavedResourcesPage(),
              ),
            );
          },
          onLogout: _logout,
        ),
      ),
    );
    await _refreshAll();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.bg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _HubStickyHeader(
            childProgress: _childProgress,
            onAddChild: _openCreateChild,
            onOpenSettings: _openAccountSettings,
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.green,
              onRefresh: _refreshAll,
              child: AnimatedBuilder(
                animation: _childProgress,
                builder: (context, _) {
                  return SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.only(bottom: context.rs(32)),
                    child: _DevelopmentBody(
                      controller: _childProgress,
                      progressSnapshot: _progressSnapshot,
                      progressLoading: _progressLoading,
                      assignments: _assignments,
                      assignmentsLoading: _assignmentsLoading,
                      assignmentsVisible: _assignmentsVisible,
                      onViewAssignments: _onViewAssignments,
                      onCloseAssignments: _onCloseAssignments,
                      reports: _reports,
                      reportsLoading: _reportsLoading,
                      reportsVisible: _reportsVisible,
                      onViewReports: _onViewReports,
                      onCloseReports: _onCloseReports,
                      reportMatchesChild: _reportMatchesActiveChild,
                      reportTypeLabel: _reportTypeLabel,
                      onTrackerCompleted: _onTrackerCompleted,
                      onOpenReportHistoryItem: _openReportHistoryItem,
                      onAssignmentTap: _openAssignment,
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HubStickyHeader extends StatelessWidget {
  const _HubStickyHeader({
    required this.childProgress,
    required this.onAddChild,
    required this.onOpenSettings,
  });

  final ChildProgressController childProgress;
  final Future<void> Function() onAddChild;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bg,
      elevation: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AnimatedBuilder(
            animation: childProgress,
            builder: (context, _) {
              final activeChild = childProgress.activeChild;
              final title = activeChild != null
                  ? ChildProgressController.nameOf(activeChild)
                  : 'hub_title'.tr();
              final subtitle = activeChild != null
                  ? 'hub_subtitle_active'.tr(namedArgs: {
                      'name': ChildProgressController.nameOf(activeChild),
                      'age': ChildProgressController.ageLabelOf(activeChild),
                    })
                  : 'hub_subtitle'.tr();

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: Responsive.padDirectional(
                      context,
                      start: 24,
                      top: 8,
                      end: 12,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (activeChild != null) ...[
                          ChildProfileAvatar(
                            imageUrl: (activeChild['profile_image_url'] ?? '')
                                .toString(),
                            gender: activeChild['gender']?.toString(),
                            size: 56,
                          ),
                          SizedBox(width: context.rg(14)),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: TextStyle(
                                  fontSize: context.rf(20),
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPri,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Padding(
                                padding: EdgeInsets.only(top: context.rg(4)),
                                child: Text(
                                  subtitle,
                                  style: TextStyle(
                                    fontSize: context.rf(12),
                                    color: AppColors.textSec,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: onOpenSettings,
                          tooltip: 'hub_segment_account'.tr(),
                          icon: Icon(
                            Icons.settings_outlined,
                            color: AppColors.textPri,
                            size: context.rs(22),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (childProgress.children.isEmpty)
                    _HubEmptyChildrenCard(onAddChild: onAddChild),
                ],
              );
            },
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),
        ],
      ),
    );
  }
}

class _HubEmptyChildrenCard extends StatelessWidget {
  const _HubEmptyChildrenCard({required this.onAddChild});

  final Future<void> Function() onAddChild;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
      child: AppCard(
        padding: Responsive.padAll(context, 20),
        borderColor: AppColors.green.withOpacity(0.25),
        child: Column(
          children: [
            Container(
              width: context.rs(56),
              height: context.rs(56),
              decoration: BoxDecoration(
                color: const Color(0xFFE1F5EE),
                borderRadius: BorderRadius.circular(context.rs(16)),
              ),
              child: Icon(
                Icons.child_care_rounded,
                color: AppColors.green,
                size: context.rs(30),
              ),
            ),
            SizedBox(height: context.rg(14)),
            Text(
              'hub_empty_state_title'.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: context.rf(16),
                fontWeight: FontWeight.w700,
                color: AppColors.textPri,
              ),
            ),
            SizedBox(height: context.rg(6)),
            Text(
              'hub_empty_state_subtitle'.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: context.rf(12),
                color: AppColors.textSec,
                height: 1.4,
              ),
            ),
            SizedBox(height: context.rg(16)),
            FilledButton.icon(
              onPressed: onAddChild,
              icon: Icon(Icons.add_rounded, size: context.rs(20)),
              label: Text('hub_add_child'.tr()),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.green,
                foregroundColor: Colors.white,
                padding: Responsive.padSymmetric(
                  context,
                  horizontal: 20,
                  vertical: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DevelopmentBody extends StatelessWidget {
  const _DevelopmentBody({
    required this.controller,
    required this.progressSnapshot,
    required this.progressLoading,
    required this.assignments,
    required this.assignmentsLoading,
    required this.assignmentsVisible,
    required this.onViewAssignments,
    required this.onCloseAssignments,
    required this.reports,
    required this.reportsLoading,
    required this.reportsVisible,
    required this.onViewReports,
    required this.onCloseReports,
    required this.reportMatchesChild,
    required this.reportTypeLabel,
    required this.onTrackerCompleted,
    required this.onOpenReportHistoryItem,
    required this.onAssignmentTap,
  });

  final ChildProgressController controller;
  final ActiveChildProgressSnapshot progressSnapshot;
  final bool progressLoading;
  final List<ChildAssignment> assignments;
  final bool assignmentsLoading;
  final bool assignmentsVisible;
  final Future<void> Function() onViewAssignments;
  final VoidCallback onCloseAssignments;
  final List<Map<String, dynamic>> reports;
  final bool reportsLoading;
  final bool reportsVisible;
  final Future<void> Function() onViewReports;
  final VoidCallback onCloseReports;
  final bool Function(Map<String, dynamic> report) reportMatchesChild;
  final String Function(String? reportType) reportTypeLabel;
  final Future<void> Function() onTrackerCompleted;
  final void Function(Map<String, dynamic> report) onOpenReportHistoryItem;
  final Future<void> Function(ChildAssignment assignment) onAssignmentTap;

  @override
  Widget build(BuildContext context) {
    final child = controller.activeChild;
    if (child == null) {
      return Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(24, 32, 24, 0),
        child: Text(
          'hub_select_child_hint'.tr(),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppColors.textSec),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileMilestoneTrackerCard(
          controller: controller,
          onCompleted: () => onTrackerCompleted(),
        ),
        const SizedBox(height: 40),
        _HubAssignmentActions(
          assignments: assignments,
          assignmentsLoading: assignmentsLoading,
          assignmentsVisible: assignmentsVisible,
          childName: ChildProgressController.nameOf(child),
          onViewAssignments: onViewAssignments,
          onCloseAssignments: onCloseAssignments,
          onAssignmentTap: onAssignmentTap,
        ),
        _HubReportActions(
          controller: controller,
          reports: reports,
          reportsLoading: reportsLoading,
          reportsVisible: reportsVisible,
          onViewReports: onViewReports,
          onCloseReports: onCloseReports,
          reportMatchesChild: reportMatchesChild,
          reportTypeLabel: reportTypeLabel,
          onOpenReportHistoryItem: onOpenReportHistoryItem,
        ),
      ],
    );
  }
}

class _HubTrackMilestonesCard extends StatelessWidget {
  const _HubTrackMilestonesCard({
    required this.child,
    required this.onTap,
  });

  final Map<String, dynamic> child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withOpacity(0.28),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'progress_widget_track_milestones'.tr(),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'progress_widget_track_development'.tr(
                          namedArgs: {
                            'name': ChildProgressController.nameOf(child),
                          },
                        ),
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.white.withOpacity(0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.track_changes_rounded,
                    color: AppColors.white,
                    size: 26,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HubMilestoneCardLoading extends StatelessWidget {
  const _HubMilestoneCardLoading();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 88,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: const SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

class _HubProgressBarCard extends StatelessWidget {
  const _HubProgressBarCard({
    required this.loading,
    required this.percent,
    required this.onTap,
  });

  final bool loading;
  final int percent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'progress_widget_track_milestones'.tr(),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPri,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSec,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  SizedBox(
                    width: 44,
                    child: loading
                        ? null
                        : Text(
                            '$percent%',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.green,
                            ),
                          ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: loading
                          ? const LinearProgressIndicator(
                              minHeight: 8,
                              color: AppColors.green,
                              backgroundColor: AppColors.border,
                            )
                          : LinearProgressIndicator(
                              value: percent / 100,
                              minHeight: 8,
                              backgroundColor: AppColors.border,
                              color: AppColors.green,
                            ),
                    ),
                  ),
                ],
              ),
              if (!loading) ...[
                const SizedBox(height: 10),
                Text(
                  'hub_progress_completed_message'.tr(
                    namedArgs: {'percent': '$percent'},
                  ),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSec,
                    height: 1.35,
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

class _HubGradientActionButton extends StatelessWidget {
  const _HubGradientActionButton({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback? onPressed;
  final Widget icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    const radius = BorderRadius.all(Radius.circular(10));
    final enabled = onPressed != null;

    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: enabled ? AppColors.primaryGradient : null,
          color: enabled ? null : AppColors.primary.withOpacity(0.55),
          borderRadius: radius,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: radius,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  icon,
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HubReportActions extends StatelessWidget {
  const _HubReportActions({
    required this.controller,
    required this.reports,
    required this.reportsLoading,
    required this.reportsVisible,
    required this.onViewReports,
    required this.onCloseReports,
    required this.reportMatchesChild,
    required this.reportTypeLabel,
    required this.onOpenReportHistoryItem,
  });

  final ChildProgressController controller;
  final List<Map<String, dynamic>> reports;
  final bool reportsLoading;
  final bool reportsVisible;
  final Future<void> Function() onViewReports;
  final VoidCallback onCloseReports;
  final bool Function(Map<String, dynamic> report) reportMatchesChild;
  final String Function(String? reportType) reportTypeLabel;
  final void Function(Map<String, dynamic> report) onOpenReportHistoryItem;

  String _formatReportDate(String? createdAt) {
    if (createdAt == null || createdAt.isEmpty) return '—';
    try {
      final dt = DateTime.parse(createdAt).toLocal();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    } catch (_) {
      return createdAt.split('T').first;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final childReports =
            reports.where(reportMatchesChild).toList(growable: false);

        return Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(24, 12, 24, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!reportsVisible)
                _HubGradientActionButton(
                  onPressed: reportsLoading ? null : onViewReports,
                  icon: reportsLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.white,
                          ),
                        )
                      : const Icon(Icons.description_outlined, size: 18),
                  label: 'hub_view_generated_reports'.tr(),
                )
              else ...[
                if (reportsLoading)
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: LinearProgressIndicator(minHeight: 2),
                  )
                else if (childReports.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      'hub_reports_empty'.tr(),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSec,
                        height: 1.4,
                      ),
                    ),
                  )
                else ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 16, bottom: 8),
                    child: Text(
                      'hub_reports_history'.tr(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPri,
                      ),
                    ),
                  ),
                  ...childReports.map((report) {
                  final dateLabel =
                      _formatReportDate(report['created_at']?.toString());
                  final typeLabel =
                      reportTypeLabel(report['report_type']?.toString());

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        onTap: () => onOpenReportHistoryItem(report),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE1F5EE),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.description_outlined,
                                  color: AppColors.green,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      typeLabel,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textPri,
                                      ),
                                    ),
                                    Text(
                                      dateLabel,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textSec,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: AppColors.textSec,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onCloseReports,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  label: Text('hub_close_reports'.tr()),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HubAssignmentActions extends StatelessWidget {
  const _HubAssignmentActions({
    required this.assignments,
    required this.assignmentsLoading,
    required this.assignmentsVisible,
    required this.childName,
    required this.onViewAssignments,
    required this.onCloseAssignments,
    required this.onAssignmentTap,
  });

  final List<ChildAssignment> assignments;
  final bool assignmentsLoading;
  final bool assignmentsVisible;
  final String childName;
  final Future<void> Function() onViewAssignments;
  final VoidCallback onCloseAssignments;
  final Future<void> Function(ChildAssignment assignment) onAssignmentTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(24, 0, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!assignmentsVisible)
            _HubGradientActionButton(
              onPressed: assignmentsLoading ? null : onViewAssignments,
              icon: assignmentsLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.white,
                      ),
                    )
                  : const Icon(Icons.assignment_outlined, size: 18),
              label: 'hub_view_assignments'.tr(),
            )
          else ...[
            Text(
              'hub_homework_title'.tr(),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPri,
              ),
            ),
            if (assignmentsLoading)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: LinearProgressIndicator(minHeight: 2),
              )
            else
              _HubAssignmentsList(
                loading: false,
                assignments: assignments,
                childName: childName,
                onAssignmentTap: onAssignmentTap,
                embedded: true,
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onCloseAssignments,
              icon: const Icon(Icons.close_rounded, size: 18),
              label: Text('hub_close_assignments'.tr()),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.border),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HubAssignmentsList extends StatelessWidget {
  const _HubAssignmentsList({
    required this.loading,
    required this.assignments,
    required this.childName,
    required this.onAssignmentTap,
    this.embedded = false,
  });

  final bool loading;
  final List<ChildAssignment> assignments;
  final String childName;
  final Future<void> Function(ChildAssignment assignment) onAssignmentTap;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          embedded ? 0 : 24,
          12,
          embedded ? 0 : 24,
          0,
        ),
        child: const LinearProgressIndicator(minHeight: 2, color: AppColors.green),
      );
    }

    if (assignments.isEmpty) {
      return Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          embedded ? 0 : 24,
          12,
          embedded ? 0 : 24,
          0,
        ),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Text(
            'assignments_none_yet'.tr(),
            style: const TextStyle(fontSize: 12, color: AppColors.textSec),
          ),
        ),
      );
    }

    return Column(
      children: assignments.take(4).map((assignment) {
        final done = assignment.isCompleted;
        return Padding(
          padding: EdgeInsetsDirectional.fromSTEB(
            embedded ? 0 : 24,
            10,
            embedded ? 0 : 24,
            0,
          ),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: () => onAssignmentTap(assignment),
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            assignment.activityTitle,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPri,
                            ),
                          ),
                          if (assignment.description?.trim().isNotEmpty == true)
                            Text(
                              assignment.description!.trim(),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textSec,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (done) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.green.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          assignment.statusLabel,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.green,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.textSec,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _FamilyHubSettingsPage extends StatelessWidget {
  const _FamilyHubSettingsPage({
    required this.accountLoading,
    required this.parentName,
    required this.parentEmail,
    required this.savedResourceCount,
    required this.childProgress,
    required this.openMenuChildId,
    required this.onChildSelected,
    required this.onChildrenChanged,
    required this.onRemoveChild,
    required this.onMenuOpened,
    required this.onMenuClosed,
    required this.onOpenSavedResources,
    required this.onLogout,
  });

  final bool accountLoading;
  final String? parentName;
  final String? parentEmail;
  final int savedResourceCount;
  final ChildProgressController childProgress;
  final String? openMenuChildId;
  final Future<void> Function(int index) onChildSelected;
  final Future<void> Function() onChildrenChanged;
  final Future<void> Function(Map<String, dynamic> child) onRemoveChild;
  final void Function(String? childId) onMenuOpened;
  final VoidCallback onMenuClosed;
  final VoidCallback onOpenSavedResources;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text('hub_segment_account'.tr()),
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 32),
        child: _AccountBody(
          accountLoading: accountLoading,
          parentName: parentName,
          parentEmail: parentEmail,
          savedResourceCount: savedResourceCount,
          childProgress: childProgress,
          openMenuChildId: openMenuChildId,
          onChildSelected: onChildSelected,
          onChildrenChanged: onChildrenChanged,
          onRemoveChild: onRemoveChild,
          onMenuOpened: onMenuOpened,
          onMenuClosed: onMenuClosed,
          onOpenSavedResources: onOpenSavedResources,
          onLogout: onLogout,
        ),
      ),
    );
  }
}

class _AccountBody extends StatelessWidget {
  const _AccountBody({
    required this.accountLoading,
    required this.parentName,
    required this.parentEmail,
    required this.savedResourceCount,
    required this.childProgress,
    required this.openMenuChildId,
    required this.onChildSelected,
    required this.onChildrenChanged,
    required this.onRemoveChild,
    required this.onMenuOpened,
    required this.onMenuClosed,
    required this.onOpenSavedResources,
    required this.onLogout,
  });

  final bool accountLoading;
  final String? parentName;
  final String? parentEmail;
  final int savedResourceCount;
  final ChildProgressController childProgress;
  final String? openMenuChildId;
  final Future<void> Function(int index) onChildSelected;
  final Future<void> Function() onChildrenChanged;
  final Future<void> Function(Map<String, dynamic> child) onRemoveChild;
  final void Function(String? childId) onMenuOpened;
  final VoidCallback onMenuClosed;
  final VoidCallback onOpenSavedResources;
  final Future<void> Function() onLogout;

  Future<void> _openCreateChildInSettings(BuildContext context) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(builder: (_) => const CreateChildPage()),
    );
    if (result == true) await onChildrenChanged();
  }

  Future<void> _editChildInSettings(
    BuildContext context,
    Map<String, dynamic> child,
  ) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute<bool>(
        builder: (_) => CreateChildPage(initialChild: child),
      ),
    );
    if (result == true) await onChildrenChanged();
  }

  Future<void> _openSwitchChildSheet(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SwitchChildSheet(
        controller: childProgress,
        onChildSelected: (index) async {
          await onChildSelected(index);
          if (ctx.mounted) Navigator.pop(ctx);
        },
        onAddChild: () async {
          Navigator.pop(ctx);
          await _openCreateChildInSettings(context);
        },
        onEditChild: (child) async {
          Navigator.pop(ctx);
          await _editChildInSettings(context, child);
        },
        onRemoveChild: (child) async {
          Navigator.pop(ctx);
          await onRemoveChild(child);
        },
        onMenuOpened: onMenuOpened,
        onMenuClosed: onMenuClosed,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(24, 20, 24, 0),
          child: Text(
            'hub_account_title'.tr(),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPri,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(24, 12, 24, 0),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: accountLoading
                ? const LinearProgressIndicator(
                    minHeight: 2,
                    color: AppColors.green,
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        parentName ?? 'home_parent_default'.tr(),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPri,
                        ),
                      ),
                      const SizedBox(height: 6),
                      _AccountInfoRow(
                        icon: Icons.email_outlined,
                        value: parentEmail ?? '—',
                      ),
                    ],
                  ),
          ),
        ),
        if (childProgress.children.isNotEmpty)
          ListenableBuilder(
            listenable: childProgress,
            builder: (context, _) {
              final active = childProgress.activeChild;
              final subtitle = active != null
                  ? 'hub_switch_child_subtitle'.tr(namedArgs: {
                      'name': ChildProgressController.nameOf(active),
                      'age': ChildProgressController.ageLabelOf(active),
                    })
                  : null;
              return _HubSettingsTile(
                icon: Icons.swap_horiz_rounded,
                title: 'hub_switch_child'.tr(),
                subtitle: subtitle,
                onTap: () => _openSwitchChildSheet(context),
              );
            },
          ),
        _HubSettingsTile(
          icon: Icons.bookmark_rounded,
          title: 'hub_saved_resources'.tr(),
          subtitle: 'hub_saved_resources_subtitle'.tr(),
          trailing: savedResourceCount > 0 ? '$savedResourceCount' : null,
          onTap: onOpenSavedResources,
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(24, 20, 24, 0),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => onLogout(),
              icon: const Icon(Icons.logout_rounded, size: 20),
              label: Text('hub_logout'.tr()),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFB42318),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _AccountInfoRow extends StatelessWidget {
  const _AccountInfoRow({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSec),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, color: AppColors.textSec),
          ),
        ),
      ],
    );
  }
}

class _HubSettingsTile extends StatelessWidget {
  const _HubSettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Responsive.padDirectional(context, start: 24, top: 10, end: 24),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(context.rs(14)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(context.rs(14)),
          child: Container(
            padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(context.rs(14)),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: context.rs(36),
                  height: context.rs(36),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1F5EE),
                    borderRadius: BorderRadius.circular(context.rs(10)),
                  ),
                  child: Icon(icon, color: AppColors.green, size: context.rs(18)),
                ),
                SizedBox(width: context.rg(12)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: context.rf(14),
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPri,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (subtitle != null) ...[
                        SizedBox(height: context.rg(2)),
                        Text(
                          subtitle!,
                          style: TextStyle(
                            fontSize: context.rf(11),
                            color: AppColors.textSec,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null)
                  Container(
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE1F5EE),
                      borderRadius: BorderRadius.circular(context.rs(20)),
                    ),
                    child: Text(
                      trailing!,
                      style: TextStyle(
                        fontSize: context.rf(11),
                        fontWeight: FontWeight.w700,
                        color: AppColors.green,
                      ),
                    ),
                  ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textSec,
                  size: context.rs(20),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SwitchChildSheet extends StatelessWidget {
  const _SwitchChildSheet({
    required this.controller,
    required this.onChildSelected,
    required this.onAddChild,
    required this.onEditChild,
    required this.onRemoveChild,
    required this.onMenuOpened,
    required this.onMenuClosed,
  });

  final ChildProgressController controller;
  final Future<void> Function(int index) onChildSelected;
  final Future<void> Function() onAddChild;
  final Future<void> Function(Map<String, dynamic> child) onEditChild;
  final Future<void> Function(Map<String, dynamic> child) onRemoveChild;
  final void Function(String? childId) onMenuOpened;
  final VoidCallback onMenuClosed;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final children = controller.children;
        final selectedIndex = controller.selectedChildIndex;

        return Container(
          margin: const EdgeInsets.only(top: 48),
          decoration: const BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'hub_switch_child_sheet_title'.tr(),
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPri,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                      color: AppColors.textSec,
                    ),
                  ],
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.45,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                  itemCount: children.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final child = children[i];
                    final childId = ChildProgressController.idOf(child);
                    final selected = i == selectedIndex;
                    final name = ChildProgressController.nameOf(child);
                    final age = ChildProgressController.ageLabelOf(child);

                    return Material(
                      color: selected ? const Color(0xFFE1F5EE) : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        onTap: () => onChildSelected(i),
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: selected
                                  ? AppColors.green.withOpacity(0.45)
                                  : AppColors.border,
                            ),
                          ),
                          child: Row(
                            children: [
                              ChildProfileAvatar(
                                imageUrl: (child['profile_image_url'] ?? '')
                                    .toString(),
                                gender: child['gender']?.toString(),
                                size: 40,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textPri,
                                      ),
                                    ),
                                    Text(
                                      age,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSec,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (selected)
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: AppColors.green,
                                  size: 22,
                                ),
                              PopupMenuButton<String>(
                                icon: const Icon(
                                  Icons.more_vert,
                                  size: 22,
                                  color: AppColors.textSec,
                                ),
                                onOpened: () => onMenuOpened(childId),
                                onCanceled: onMenuClosed,
                                onSelected: (action) {
                                  onMenuClosed();
                                  switch (action) {
                                    case 'edit':
                                      onEditChild(child);
                                      break;
                                    case 'remove':
                                      onRemoveChild(child);
                                      break;
                                  }
                                },
                                itemBuilder: (ctx) => [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Text('profile_edit'.tr()),
                                  ),
                                  PopupMenuItem(
                                    value: 'remove',
                                    child: Text(
                                      'profile_remove'.tr(),
                                      style: const TextStyle(color: Colors.red),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(24, 8, 24, 16 + bottomInset),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: onAddChild,
                    icon: const Icon(Icons.add_rounded, size: 20),
                    label: Text('hub_switch_child_add'.tr()),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.green,
                      side: BorderSide(color: AppColors.green.withOpacity(0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
