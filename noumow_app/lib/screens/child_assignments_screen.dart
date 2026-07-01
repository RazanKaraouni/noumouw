import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/child_assignment.dart';
import '../services/assignments_api_service.dart';
import '../utils/error_feedback.dart';
import '../theme/app_colors.dart';
import '../widgets/child_progress_widgets.dart';

/// Lists therapist-assigned activities for one child with completion progress.
class ChildAssignmentsScreen extends StatefulWidget {
  const ChildAssignmentsScreen({
    super.key,
    required this.childId,
    this.childName,
  });

  final String childId;
  final String? childName;

  @override
  State<ChildAssignmentsScreen> createState() => _ChildAssignmentsScreenState();
}

class _ChildAssignmentsScreenState extends State<ChildAssignmentsScreen> {
  static const _white = Colors.white;
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE8EAE4);
  static const _bg = Color(0xFFF7F8F5);

  final _api = AssignmentsApiService();

  List<ChildAssignment> _assignments = [];
  bool _loading = true;
  String? _error;
  final Set<String> _completingIds = {};
  final Set<String> _savingNoteIds = {};

  int get _completedCount =>
      _assignments.where((a) => a.isCompleted).length;

  double get _progressValue {
    if (_assignments.isEmpty) return 0;
    return _completedCount / _assignments.length;
  }

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  @override
  void didUpdateWidget(ChildAssignmentsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childId != widget.childId) {
      _loadAssignments();
    }
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _api.fetchAssignmentsForChild(widget.childId);
      if (!mounted) return;
      setState(() {
        _assignments = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingErrorMessage(e);
        _assignments = [];
        _loading = false;
      });
    }
  }

  Future<void> _openNoteEditor(ChildAssignment assignment) async {
    final controller = TextEditingController(
      text: assignment.parentNotes ?? '',
    );
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: ctx.rs(24),
            right: ctx.rs(24),
            top: ctx.rs(20),
            bottom: MediaQuery.of(ctx).viewInsets.bottom + ctx.rs(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                assignment.hasParentNotes
                    ? 'assignments_edit_note'.tr()
                    : 'assignments_add_note'.tr(),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _textPri,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'assignments_note_hint_subtitle'.tr(),
                style: const TextStyle(fontSize: 12, color: _textSec, height: 1.35),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                maxLines: 5,
                minLines: 3,
                decoration: InputDecoration(
                  hintText: 'assignments_note_hint'.tr(),
                  filled: true,
                  fillColor: _bg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: _border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: _border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _textSec,
                        side: const BorderSide(color: _border),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: Text('assignments_cancel'.tr()),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: _white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: Text(
                        'assignments_save_note'.tr(),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    if (saved != true || !mounted) {
      controller.dispose();
      return;
    }

    setState(() => _savingNoteIds.add(assignment.assignedActivityId));
    try {
      final updated = await _api.saveParentNotes(
        assignment.assignedActivityId,
        controller.text,
      );
      if (!mounted) return;
      setState(() {
        final i = _assignments.indexWhere(
          (a) => a.assignedActivityId == assignment.assignedActivityId,
        );
        if (i >= 0) {
          _assignments = List.of(_assignments)..[i] = updated;
        }
        _savingNoteIds.remove(assignment.assignedActivityId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('assignments_note_saved'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _savingNoteIds.remove(assignment.assignedActivityId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    } finally {
      controller.dispose();
    }
  }

  Future<void> _markComplete(ChildAssignment assignment) async {
    if (assignment.isCompleted || _completingIds.contains(assignment.assignedActivityId)) {
      return;
    }
    setState(() => _completingIds.add(assignment.assignedActivityId));
    try {
      final updated = await _api.markAssignmentComplete(assignment.assignedActivityId);
      if (!mounted) return;
      setState(() {
        final i = _assignments.indexWhere(
          (a) => a.assignedActivityId == assignment.assignedActivityId,
        );
        if (i >= 0) {
          _assignments = List.of(_assignments)..[i] = updated;
        }
        _completingIds.remove(assignment.assignedActivityId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('assignments_marked_complete'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _completingIds.remove(assignment.assignedActivityId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    }
  }

  Widget _buildProgressHeader() {
    final total = _assignments.length;
    final done = _completedCount;
    return AppCard(
      margin: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
      padding: Responsive.padAll(context, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.childName != null && widget.childName!.isNotEmpty
                      ? 'assignments_header_named'
                          .tr(namedArgs: {'name': widget.childName!})
                      : 'assignments_header_default'.tr(),
                  style: TextStyle(
                    fontSize: context.rf(16),
                    fontWeight: FontWeight.w700,
                    color: _textPri,
                  ),
                ),
              ),
              Text(
                '$done / $total',
                style: TextStyle(
                  fontSize: context.rf(14),
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          SizedBox(height: context.rg(12)),
          ClipRRect(
            borderRadius: BorderRadius.circular(context.rs(8)),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : _progressValue,
              minHeight: context.rs(10),
              backgroundColor: AppColors.primary.withOpacity(0.12),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
          SizedBox(height: context.rg(8)),
          Text(
            total == 0
                ? 'assignments_none_yet'.tr()
                : 'assignments_completed_count'
                    .tr(namedArgs: {'done': '$done', 'total': '$total'}),
            style: TextStyle(fontSize: context.rf(12), color: _textSec),
          ),
        ],
      ),
    );
  }

  Widget _buildNoteBubble({
    required String label,
    required String body,
    required Color accent,
    IconData icon = Icons.chat_bubble_outline_rounded,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withOpacity(0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: accent),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: accent,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: const TextStyle(
              fontSize: 13,
              color: _textPri,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignmentCard(ChildAssignment assignment) {
    final isCompleting =
        _completingIds.contains(assignment.assignedActivityId);
    final isSavingNote =
        _savingNoteIds.contains(assignment.assignedActivityId);
    final statusColor = assignment.isCompleted
        ? const Color(0xFF1D9E75)
        : assignment.status.toLowerCase() == 'incomplete'
            ? Colors.orange.shade700
            : AppColors.primary;

    return AppCard(
      margin: Responsive.padDirectional(
        context,
        start: 24,
        end: 24,
        bottom: 12,
      ),
      padding: Responsive.padAll(context, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  assignment.activityTitle,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _textPri,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  assignment.statusLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.person_outline_rounded,
                  size: 16, color: _textSec.withOpacity(0.9)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'assignments_assigned_by'.tr(namedArgs: {
                    'therapist': assignment.therapistName,
                  }),
                  style: const TextStyle(fontSize: 12, color: _textSec),
                ),
              ),
            ],
          ),
          if (assignment.description != null &&
              assignment.description!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              assignment.description!.trim(),
              style: TextStyle(
                fontSize: 12,
                color: _textSec.withOpacity(0.95),
                height: 1.35,
              ),
            ),
          ],
          if (assignment.hasParentNotes) ...[
            const SizedBox(height: 12),
            _buildNoteBubble(
              label: 'assignments_your_note'.tr(),
              body: assignment.parentNotes!,
              accent: AppColors.primary,
              icon: Icons.edit_note_rounded,
            ),
          ],
          if (assignment.hasTherapistReply) ...[
            const SizedBox(height: 10),
            _buildNoteBubble(
              label: 'assignments_therapist_reply'.tr(),
              body: assignment.therapistReply!,
              accent: const Color(0xFF1D9E75),
              icon: Icons.reply_rounded,
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: isSavingNote ? null : () => _openNoteEditor(assignment),
              icon: isSavingNote
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    )
                  : Icon(
                      assignment.hasParentNotes
                          ? Icons.edit_outlined
                          : Icons.note_add_outlined,
                      size: 18,
                    ),
              label: Text(
                assignment.hasParentNotes
                    ? 'assignments_edit_note_button'.tr()
                    : 'assignments_add_note_button'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          if (!assignment.isCompleted) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: isCompleting
                    ? null
                    : () => _markComplete(assignment),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: _white,
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: isCompleting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _white,
                        ),
                      )
                    : Text(
                        'assignments_mark_complete'.tr(),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        children: [
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: _textSec),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _loadAssignments,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
            ),
            child: Text('assignments_retry'.tr()),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    final name = widget.childName?.trim();
    final hasName = name != null && name.isNotEmpty;
    return ProfileSectionEmptyState(
      icon: Icons.assignment_outlined,
      title: hasName
          ? 'assignments_empty_title_named'.tr()
          : 'assignments_empty_title_default'.tr(),
      subtitle: hasName
          ? 'assignments_empty_subtitle_named'.tr(namedArgs: {'name': name})
          : 'assignments_empty_subtitle_default'.tr(),
    );
  }

  List<Widget> _buildContentSlivers() {
    if (_loading) {
      return [
        const SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: EdgeInsets.only(top: 48),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          ),
        ),
      ];
    }

    if (_error != null) {
      return [SliverToBoxAdapter(child: _buildErrorState())];
    }

    if (_assignments.isEmpty) {
      return [SliverToBoxAdapter(child: _buildEmptyState())];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.only(top: 16, bottom: 24),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => _buildAssignmentCard(_assignments[index]),
            childCount: _assignments.length,
          ),
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _bg,
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadAssignments,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildProgressHeader()),
            ..._buildContentSlivers(),
          ],
        ),
      ),
    );
  }
}
