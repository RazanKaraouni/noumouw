import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/child_assignment.dart';
import '../services/assignments_api_service.dart';
import '../theme/app_colors.dart';

/// Bottom sheet for a parent to mark an assignment complete and leave notes.
class AssignmentParentSheet extends StatefulWidget {
  const AssignmentParentSheet({super.key, required this.assignment});

  final ChildAssignment assignment;

  static Future<ChildAssignment?> show(
    BuildContext context, {
    required ChildAssignment assignment,
  }) {
    return showModalBottomSheet<ChildAssignment>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => AssignmentParentSheet(assignment: assignment),
    );
  }

  @override
  State<AssignmentParentSheet> createState() => _AssignmentParentSheetState();
}

class _AssignmentParentSheetState extends State<AssignmentParentSheet> {
  final _api = AssignmentsApiService();
  late ChildAssignment _assignment;
  late final TextEditingController _noteController;
  bool _completing = false;
  bool _savingNote = false;

  @override
  void initState() {
    super.initState();
    _assignment = widget.assignment;
    _noteController = TextEditingController(text: _assignment.parentNotes ?? '');
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _saveNote() async {
    if (_savingNote) return;
    setState(() => _savingNote = true);
    try {
      final updated = await _api.saveParentNotes(
        _assignment.assignedActivityId,
        _noteController.text,
      );
      if (!mounted) return;
      setState(() {
        _assignment = updated;
        _savingNote = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('assignments_note_saved'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _savingNote = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    }
  }

  Future<void> _markComplete() async {
    if (_assignment.isCompleted || _completing) return;
    setState(() => _completing = true);
    try {
      final updated =
          await _api.markAssignmentComplete(_assignment.assignedActivityId);
      if (!mounted) return;
      setState(() {
        _assignment = updated;
        _completing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('assignments_marked_complete'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _completing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        top: false,
        child: ResponsiveScrollBody(
          padding: Responsive.padSymmetric(context, horizontal: 24, vertical: 16)
              .copyWith(bottom: context.rs(16)),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: context.rs(40),
                height: context.rs(4),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(context.rs(2)),
                ),
              ),
            ),
            SizedBox(height: context.rg(16)),
            Text(
              _assignment.activityTitle,
              style: TextStyle(
                fontSize: context.rf(18),
                fontWeight: FontWeight.w700,
                color: AppColors.textPri,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'assignments_assigned_by'.tr(namedArgs: {
                'therapist': _assignment.therapistName,
              }),
              style: const TextStyle(fontSize: 12, color: AppColors.textSec),
            ),
            if (_assignment.description?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text(
                _assignment.description!.trim(),
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textPri,
                  height: 1.4,
                ),
              ),
            ],
            if (_assignment.hasTherapistReply) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.green.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.green.withOpacity(0.22)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'assignments_therapist_reply'.tr(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.green,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _assignment.therapistReply!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textPri,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              'assignments_add_note'.tr(),
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPri,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'assignments_note_hint_subtitle'.tr(),
              style: const TextStyle(fontSize: 12, color: AppColors.textSec),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _noteController,
              maxLines: 4,
              minLines: 3,
              decoration: InputDecoration(
                hintText: 'assignments_note_hint'.tr(),
                filled: true,
                fillColor: AppColors.bg,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _savingNote ? null : _saveNote,
              icon: _savingNote
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined, size: 18),
              label: Text('assignments_save_note'.tr()),
            ),
            if (!_assignment.isCompleted) ...[
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _completing ? null : _markComplete,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: _completing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: Text('assignments_mark_complete'.tr()),
              ),
            ] else ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _assignment.statusLabel,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.green,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context, _assignment),
              child: Text('milestones_track_ok'.tr()),
            ),
          ],
        ),
        ),
      ),
    );
  }
}
