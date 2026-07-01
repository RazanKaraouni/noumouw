import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/moderation_report_service.dart';
import '../theme/app_colors.dart';

/// Target kinds accepted by the moderation API.
enum ReportTargetType {
  resource('resource'),
  post('post'),
  comment('comment'),
  tip('tip');

  const ReportTargetType(this.apiValue);
  final String apiValue;
}

/// Bottom sheet for flagging community or learn content.
Future<bool?> showReportContentSheet(
  BuildContext context, {
  required ReportTargetType targetType,
  required String targetId,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(context.rs(20))),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: ctx.rs(20),
        right: ctx.rs(20),
        top: ctx.rs(20),
        bottom: MediaQuery.of(ctx).viewInsets.bottom + ctx.rs(24),
      ),
      child: _ReportContentSheetBody(
        targetType: targetType,
        targetId: targetId,
      ),
    ),
  );
}

class _ReportContentSheetBody extends StatefulWidget {
  const _ReportContentSheetBody({
    required this.targetType,
    required this.targetId,
  });

  final ReportTargetType targetType;
  final String targetId;

  @override
  State<_ReportContentSheetBody> createState() => _ReportContentSheetBodyState();
}

class _ReportContentSheetBodyState extends State<_ReportContentSheetBody> {
  final _reasonController = TextEditingController();
  final _service = ModerationReportService();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'report_error_empty_reason'.tr());
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _service.submitReport(
        targetType: widget.targetType.apiValue,
        reason: reason,
        resourceId:
            widget.targetType == ReportTargetType.resource ? widget.targetId : null,
        postId: widget.targetType == ReportTargetType.post ? widget.targetId : null,
        commentId:
            widget.targetType == ReportTargetType.comment ? widget.targetId : null,
        tipId: widget.targetType == ReportTargetType.tip ? widget.targetId : null,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('report_submitted_success'.tr())),
      );
    } on ModerationReportException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = sanitizeUserMessage(e.message);
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingErrorMessage(e);
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final typeLabel = switch (widget.targetType) {
      ReportTargetType.resource => 'report_type_resource'.tr(),
      ReportTargetType.post => 'report_type_post'.tr(),
      ReportTargetType.comment => 'report_type_comment'.tr(),
      ReportTargetType.tip => 'report_type_tip'.tr(),
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'report_title'.tr(namedArgs: {'type': typeLabel}),
          style: TextStyle(
            fontSize: context.rf(20),
            fontWeight: FontWeight.w700,
            color: AppColors.textPri,
          ),
        ),
        SizedBox(height: context.rg(8)),
        Text(
          'report_description'.tr(),
          style: TextStyle(fontSize: context.rf(14), color: AppColors.textSec),
        ),
        SizedBox(height: context.rg(16)),
        TextField(
          controller: _reasonController,
          maxLines: 4,
          decoration: InputDecoration(
            hintText: 'report_reason_hint'.tr(),
            filled: true,
            fillColor: AppColors.bg,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(context.rs(12)),
              borderSide: const BorderSide(color: AppColors.border),
            ),
          ),
        ),
        if (_error != null) ...[
          SizedBox(height: context.rg(12)),
          Text(
            _error!,
            style: TextStyle(color: Colors.redAccent, fontSize: context.rf(13)),
          ),
        ],
        SizedBox(height: context.rg(20)),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.white,
            padding: Responsive.padSymmetric(context, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(context.rs(12)),
            ),
          ),
          child: Text(
            _submitting ? 'report_submitting'.tr() : 'report_submit'.tr(),
          ),
        ),
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(false),
          child: Text('report_cancel'.tr()),
        ),
      ],
    );
  }
}
