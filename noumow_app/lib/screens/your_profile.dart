import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_deletion_service.dart';
import '../services/child_progress_controller.dart';
import '../services/parent_reports_service.dart';
import '../services/resource_save_service.dart';
import '../theme/app_colors.dart';
import '../widgets/child_progress_widgets.dart';
import '../widgets/child_profile_avatar.dart';
import 'autism_report_view_page.dart';
import 'create_child_page.dart';
import 'learn_from_therapist_page.dart';
import 'logout_page.dart';
import 'milestone_report_screen.dart';

/// Profile and account management: child CRUD, report history, and saved resources.
/// Daily progress tracking lives in [ProgressPage].
class YourProfilePage extends StatefulWidget {
  const YourProfilePage({
    super.key,
    this.childProgress,
    this.childrenListRefresh,
    this.openCreateChildOverlay,
  });

  final ChildProgressController? childProgress;

  /// Notify this after a child is added elsewhere so the list reloads.
  final Listenable? childrenListRefresh;

  /// When provided (e.g. from [HomePage]), add/edit child opens in-shell so the
  /// main bottom navigation bar stays visible.
  final void Function({Map<String, dynamic>? initialChild})?
      openCreateChildOverlay;

  @override
  State<YourProfilePage> createState() => _YourProfilePageState();
}

class _YourProfilePageState extends State<YourProfilePage> {
  final _supabase = Supabase.instance.client;
  ChildProgressController? _ownedChildProgress;
  final _saveService = ResourceSaveService();
  final _reportsService = ParentReportsService();

  bool _reportsLoading = false;
  bool _reportsVisible = false;
  List<Map<String, dynamic>> _reports = [];

  bool _savedLoading = true;
  List<Map<String, dynamic>> _savedResources = [];
  bool _savedExpanded = false;
  String? _openMenuChildId;

  static const _green = AppColors.green;
  static const _textPri = AppColors.textPri;
  static const _textSec = AppColors.textSec;
  static const _border = AppColors.border;
  static const _reportChevronWidth = 18.0;

  ChildProgressController get _childProgress =>
      widget.childProgress ?? _ownedChildProgress!;

  Future<void> loadChildren() async {
    try {
      await _childProgress.loadChildren();
    } catch (_) {}
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
    } catch (e) {
      debugPrint('Load reports failed: $e');
      if (mounted) {
        setState(() {
          _reports = [];
          _reportsLoading = false;
        });
      }
    }
  }

  Future<void> _loadSavedResources() async {
    setState(() => _savedLoading = true);
    try {
      if (_supabase.auth.currentUser == null) {
        if (mounted) {
          setState(() {
            _savedResources = [];
            _savedLoading = false;
          });
        }
        return;
      }

      final resources = await _saveService.fetchSavedResources();
      if (!mounted) return;
      setState(() {
        _savedResources = resources;
        _savedLoading = false;
      });
    } catch (e) {
      debugPrint('Load saved resources failed: $e');
      if (mounted) {
        setState(() {
          _savedResources = [];
          _savedLoading = false;
        });
      }
    }
  }

  Future<void> _unsaveResource(String resourceId) async {
    try {
      await _saveService.toggleSave(resourceId);
      await _loadSavedResources();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('profile_unsave_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)})),
        ),
      );
    }
  }

  Future<void> _onViewReports() async {
    if (_reportsLoading) return;
    setState(() => _reportsVisible = true);
    await _loadReports();
  }

  void _onCloseReports() {
    setState(() {
      _reportsVisible = false;
      _reports = [];
      _reportsLoading = false;
    });
  }

  Widget _closeReportsButton() {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _onCloseReports,
          icon: const Icon(Icons.close_rounded, size: 18),
          label: Text('hub_close_reports'.tr()),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary,
            side: const BorderSide(color: _border),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      loadChildren(),
      if (_reportsVisible) _loadReports(),
      _loadSavedResources(),
    ]);
  }

  String _childNameForReport(int? childId) {
    if (childId == null) return 'profile_child_default'.tr();
    for (final child in _childProgress.children) {
      final raw = child['children_id'];
      final idInt = raw is int ? raw : int.tryParse(raw?.toString() ?? '');
      if (idInt == childId) {
        return ChildProgressController.nameOf(child);
      }
    }
    return 'profile_child_number'.tr(namedArgs: {'id': '$childId'});
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

  /// Subtitle for the Type column: `Child name - YYYY-MM-DD` (never parsed via [indexOf] on the stored title).
  String _reportTypeSubtitle({
    required String childName,
    required String dateLabel,
  }) {
    if (childName.isEmpty || dateLabel == '—') return '';
    return '$childName - $dateLabel';
  }

  static const _reportHeaderStyle = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: _textSec,
    height: 1.2,
  );

  static const _reportDateChildStyle = TextStyle(
    fontSize: 12,
    color: _textPri,
    height: 1.25,
  );

  static const _reportTypeMainStyle = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: _textPri,
    height: 1.25,
  );

  static const _reportTypeSubtitleStyle = TextStyle(
    fontSize: 11,
    color: _textSec,
    height: 1.25,
  );

  Widget _reportHistoryHeaderCell(String label) {
    return Text(label, style: _reportHeaderStyle);
  }

  void _openReport(Map<String, dynamic> report) {
    final childIdRaw = report['child_id'];
    final childId = childIdRaw?.toString();
    if (childId == null || childId.isEmpty) return;

    final childName = _childNameForReport(
      childIdRaw is int ? childIdRaw : int.tryParse(childId),
    );
    final reportType = (report['report_type'] ?? '').toString().toLowerCase();

    if (reportType == 'screening_summary') {
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => AutismReportViewPage(
            childId: childId,
            childName: childName,
            childProgress: _childProgress,
          ),
        ),
      );
      return;
    }

    Map<String, dynamic>? child;
    for (final c in _childProgress.children) {
      if (ChildProgressController.idOf(c) == childId) {
        child = c;
        break;
      }
    }
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => MilestoneReportScreen(
          childId: childId,
          childName: childName,
          childAgeLabel: ChildProgressController.ageLabelOf(child),
        ),
      ),
    );
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
          builder: (_) => CreateChildPage(initialChild: child)),
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
      debugPrint('Remove child failed: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'profile_remove_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)})),
        ),
      );
    }
  }

  Widget _buildManageChildrenList() {
    final children = _childProgress.children;
    if (children.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
        child: Text(
          'profile_no_children'.tr(),
          style: const TextStyle(fontSize: 12, color: _textSec),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      itemCount: children.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final child = children[i];
        final childId = ChildProgressController.idOf(child);
        final isMenuOpen = _openMenuChildId == childId;
        final dimRow = _openMenuChildId != null && _openMenuChildId != childId;

        return AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: dimRow ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isMenuOpen ? Colors.white : const Color(0xFFF7F8F5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isMenuOpen ? _green.withOpacity(0.45) : _border,
                width: isMenuOpen ? 1.2 : 0.8,
              ),
              boxShadow: isMenuOpen
                  ? [
                      BoxShadow(
                        color: _green.withOpacity(0.12),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                ChildProfileAvatar(
                  imageUrl: (child['profile_image_url'] ?? '').toString(),
                  gender: child['gender']?.toString(),
                  size: 36,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ChildProgressController.nameOf(child),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _textPri,
                        ),
                      ),
                      Text(
                        ChildProgressController.ageLabelOf(child),
                        style: const TextStyle(fontSize: 11, color: _textSec),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon:
                      const Icon(Icons.more_vert, size: 22, color: _textSec),
                  padding: EdgeInsets.zero,
                  onOpened: () => setState(() => _openMenuChildId = childId),
                  onCanceled: () => setState(() => _openMenuChildId = null),
                  onSelected: (action) {
                    setState(() => _openMenuChildId = null);
                    switch (action) {
                      case 'edit':
                        _editChild(child);
                        break;
                      case 'remove':
                        _removeChild(child);
                        break;
                    }
                  },
                  itemBuilder: (ctx) => [
                    PopupMenuItem<String>(
                      value: 'edit',
                      child: Text('profile_edit'.tr()),
                    ),
                    PopupMenuItem<String>(
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
        );
      },
    );
  }

  Widget _buildReportsHistorySection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!_reportsVisible)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _reportsLoading ? null : _onViewReports,
                icon: _reportsLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.white,
                        ),
                      )
                    : const Icon(Icons.description_outlined, size: 18),
                label: Text('hub_view_generated_reports'.tr()),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.white,
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.55),
                  disabledForegroundColor: AppColors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            )
          else if (_reportsLoading) ...[
            const LinearProgressIndicator(minHeight: 2, color: _green),
            _closeReportsButton(),
          ] else if (_reports.isEmpty)
            Column(
              children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.description_outlined,
                    size: 40,
                    color: _textSec.withOpacity(0.35),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'profile_no_reports'.tr(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: _textSec.withOpacity(0.9),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'profile_no_reports_hint'.tr(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      color: _textSec.withOpacity(0.75),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            _closeReportsButton(),
              ],
            )
          else
            Column(
              children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _border),
              ),
              child: Column(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF7F8F5),
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(12),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 2,
                          child: _reportHistoryHeaderCell('profile_header_date'.tr()),
                        ),
                        Expanded(
                          flex: 2,
                          child: _reportHistoryHeaderCell('profile_header_child'.tr()),
                        ),
                        Expanded(
                          flex: 3,
                          child: _reportHistoryHeaderCell('profile_header_type'.tr()),
                        ),
                        const SizedBox(width: _reportChevronWidth),
                      ],
                    ),
                  ),
                  ..._reports.map((report) {
                    final createdAt = report['created_at']?.toString();
                    String dateLabel = '—';
                    if (createdAt != null && createdAt.isNotEmpty) {
                      try {
                        final dt = DateTime.parse(createdAt).toLocal();
                        dateLabel =
                            '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
                      } catch (_) {
                        dateLabel = createdAt.split('T').first;
                      }
                    }
                    final childIdRaw = report['child_id'];
                    final childIdInt = childIdRaw is int
                        ? childIdRaw
                        : int.tryParse(childIdRaw?.toString() ?? '');
                    final childName = _childNameForReport(childIdInt);
                    final typeLabel =
                        _reportTypeLabel(report['report_type']?.toString());
                    final typeSubtitle = _reportTypeSubtitle(
                      childName: childName,
                      dateLabel: dateLabel,
                    );

                    return InkWell(
                      onTap: () => _openReport(report),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: _border, width: 0.6),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 2,
                              child: Text(
                                dateLabel,
                                style: _reportDateChildStyle,
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(
                                childName,
                                style: _reportDateChildStyle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    typeLabel,
                                    style: _reportTypeMainStyle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (typeSubtitle.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      typeSubtitle,
                                      style: _reportTypeSubtitleStyle,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(
                              width: _reportChevronWidth,
                              child: Icon(
                                Icons.chevron_right_rounded,
                                size: 18,
                                color: _textSec,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
            _closeReportsButton(),
              ],
            ),
        ],
      ),
    );
  }

  // ── Saved resources ────────────────────────────────────────────────────────

  IconData _contentTypeIcon(String? contentType) {
    switch (contentType?.toLowerCase()) {
      case 'video':
        return Icons.play_circle_outline_rounded;
      case 'image':
        return Icons.image_outlined;
      case 'article':
      default:
        return Icons.article_outlined;
    }
  }

  String _contentTypeLabel(String? contentType) {
    switch (contentType?.toLowerCase()) {
      case 'video':
        return 'profile_content_video'.tr();
      case 'image':
        return 'profile_content_image'.tr();
      case 'article':
      default:
        return 'profile_content_article'.tr();
    }
  }

  void _openSavedResource(Map<String, dynamic> resource) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const LearnFromTherapistPage(),
      ),
    );
  }

  Widget _buildSavedResourcesSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with expand/collapse toggle
          InkWell(
            onTap: () => setState(() => _savedExpanded = !_savedExpanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              'profile_saved'.tr(),
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: _textPri,
                              ),
                            ),
                            if (!_savedLoading && _savedResources.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE1F5EE),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '${_savedResources.length}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: _green,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'profile_saved_subtitle'.tr(),
                          style: const TextStyle(fontSize: 12, color: _textSec),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _savedExpanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 250),
                    child: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: _textSec,
                      size: 22,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Collapsible body
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 280),
            crossFadeState: _savedExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: _buildSavedResourcesBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSavedResourcesBody() {
    if (_savedLoading) {
      return const LinearProgressIndicator(minHeight: 2, color: _green);
    }

    if (_savedResources.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border),
        ),
        child: Row(
          children: [
            Icon(
              Icons.bookmark_border_rounded,
              size: 16,
              color: _textSec.withOpacity(0.6),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'profile_saved_empty'.tr(),
                style: const TextStyle(fontSize: 12, color: _textSec),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _savedResources.map((resource) {
        final resourceId = (resource['resources_id'] ?? '').toString();
        final title = (resource['title'] ?? '').toString().trim();
        final contentType = resource['content_type']?.toString();
        final mediaUrl = (resource['media_url'] ?? '').toString().trim();
        final bodyText = (resource['body_text'] ?? '').toString().trim();
        final isImage = contentType?.toLowerCase() == 'image';
        final isVideo = contentType?.toLowerCase() == 'video';

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border, width: 0.8),
            ),
            child: InkWell(
              onTap: () => _openSavedResource(resource),
              borderRadius: BorderRadius.circular(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Thumbnail for images/videos
                  if ((isImage || isVideo) && mediaUrl.isNotEmpty)
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(12)),
                      child: Stack(
                        children: [
                          CachedNetworkImage(
                            imageUrl: mediaUrl,
                            height: 130,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              height: 130,
                              color: const Color(0xFFF7F8F5),
                              child: const Center(
                                child: CircularProgressIndicator(
                                  color: _green,
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                            errorWidget: (_, __, ___) => Container(
                              height: 130,
                              color: const Color(0xFFF7F8F5),
                              child: const Center(
                                child: Icon(Icons.broken_image_outlined,
                                    color: _textSec),
                              ),
                            ),
                          ),
                          if (isVideo)
                            Positioned.fill(
                              child: Container(
                                color: Colors.black26,
                                child: const Center(
                                  child: Icon(
                                    Icons.play_circle_filled_rounded,
                                    color: Colors.white,
                                    size: 40,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Type icon (only shown when no thumbnail)
                        if (!(isImage || isVideo) || mediaUrl.isEmpty) ...[
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE1F5EE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              _contentTypeIcon(contentType),
                              color: _green,
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title.isNotEmpty
                                    ? title
                                    : _contentTypeLabel(contentType),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: _textPri,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (bodyText.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  bodyText,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: _textSec,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0FAF6),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  _contentTypeLabel(contentType),
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: _green,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Unsave button
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                              minWidth: 32, minHeight: 32),
                          tooltip: 'profile_tooltip_unsave'.tr(),
                          icon: const Icon(
                            Icons.bookmark_rounded,
                            color: _green,
                            size: 18,
                          ),
                          onPressed: () => _unsaveResource(resourceId),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Child management ───────────────────────────────────────────────────────

  Widget _buildChildManagementSection() {
    return AnimatedBuilder(
      animation: _childProgress,
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ChildProgressSelector(
              controller: _childProgress,
              selectedColor: _green,
              showTrailingAddTile: true,
              emptyTitle: 'profile_add_first_child'.tr(),
              emptySubtitle: 'profile_add_first_subtitle'.tr(),
              onAddChild: _openCreateChild,
            ),
            if (_childProgress.children.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 14, 24, 0),
                child: Text(
                  'profile_manage_children'.tr(),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _textPri.withOpacity(0.92),
                  ),
                ),
              ),
              _buildManageChildrenList(),
            ],
          ],
        );
      },
    );
  }

  void _onExternalChildrenRefresh() {
    _refreshAll();
  }

  @override
  void initState() {
    super.initState();
    if (widget.childProgress == null) {
      _ownedChildProgress = ChildProgressController();
    }
    widget.childrenListRefresh?.addListener(_onExternalChildrenRefresh);
    _refreshAll();
  }

  @override
  void didUpdateWidget(YourProfilePage oldWidget) {
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
    return RefreshIndicator(
      color: _green,
      onRefresh: _refreshAll,
      child: ResponsiveScrollBody(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
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
                'profile_title'.tr(),
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
                'profile_subtitle'.tr(),
                style: TextStyle(fontSize: context.rf(12), color: _textSec),
              ),
            ),
            Padding(
              padding: Responsive.padDirectional(
                context,
                start: 24,
                top: 16,
                end: 24,
              ),
              child: Text(
                'profile_children_section'.tr(),
                style: TextStyle(
                  fontSize: context.rf(15),
                  fontWeight: FontWeight.w700,
                  color: _textPri.withOpacity(0.92),
                ),
              ),
            ),
            _buildChildManagementSection(),
            _buildReportsHistorySection(),
            _buildSavedResourcesSection(),
            Padding(
              padding: Responsive.padDirectional(
                context,
                start: 24,
                top: 28,
                end: 24,
              ),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push<void>(
                      context,
                      MaterialPageRoute<void>(
                          builder: (_) => const LogoutPage()),
                    );
                  },
                  icon: Icon(Icons.logout_rounded, size: context.rs(18)),
                  label: Text('home_logout'.tr()),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: _border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(context.rs(10)),
                    ),
                    padding: Responsive.padSymmetric(context, vertical: 12),
                  ),
                ),
              ),
            ),
            SizedBox(height: context.rg(40)),
          ],
        ),
      ),
    );
  }
}