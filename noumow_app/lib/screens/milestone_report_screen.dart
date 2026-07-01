import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/milestone_report_service.dart';
import '../utils/milestone_localization.dart';
import '../utils/error_feedback.dart';
import '../widgets/share_report_with_therapist.dart';

class MilestoneReportScreen extends StatefulWidget {
  const MilestoneReportScreen({
    super.key,
    required this.childId,
    required this.childName,
    required this.childAgeLabel,
  });

  final String childId;
  final String childName;
  final String childAgeLabel;

  @override
  State<MilestoneReportScreen> createState() => _MilestoneReportScreenState();
}

class _MilestoneReportScreenState extends State<MilestoneReportScreen> {
  final MilestoneReportService _reportService = MilestoneReportService();
  bool _loading = true;
  bool _sharing = false;
  String? _error;
  Map<String, dynamic>? _report;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final report = await _reportService.fetchReport(widget.childId);
      if (!mounted) return;
      setState(() {
        _report = report;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = userFacingErrorMessage(e);
      });
    }
  }

  Future<void> _shareWithTherapist() async {
    final report = _report;
    if (report == null || _sharing) return;
    setState(() => _sharing = true);
    try {
      final message = buildMilestoneReportShareMessage(
        report: report,
        childName: widget.childName,
        childAgeLabel: widget.childAgeLabel,
      );
      await shareReportWithTherapist(context, message: message);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  String _statusLabel(double completionRate) {
    if (completionRate > 75) return 'milestone_report_status_on_track'.tr();
    if (completionRate < 50) {
      return 'milestone_report_status_needs_attention'.tr();
    }
    return 'milestone_report_status_in_progress'.tr();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('milestone_report_title'.tr()),
        actions: [
          if (_report != null)
            IconButton(
              onPressed: _sharing ? null : _shareWithTherapist,
              tooltip: 'report_share_therapist'.tr(),
              icon: _sharing
                  ? SizedBox(
                      width: context.rs(20),
                      height: context.rs(20),
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _buildReportBody(),
      ),
    );
  }

  Widget _buildReportBody() {
    final report = _report ?? <String, dynamic>{};
    final child =
        (report['child'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final summary =
        (report['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final categories =
        (report['category_breakdown'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
    final recent = (report['recent_achievements'] as List?) ?? const [];
    final notes = (report['notes'] as List?) ?? const [];
    final childNotes = (child['notes'] ?? '').toString().trim();

    final completionRate = (summary['completion_rate'] as num?)?.toDouble() ?? 0;
    final status = _statusLabel(completionRate);

    return RefreshIndicator(
      onRefresh: _loadReport,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          context.rs(16),
          context.rs(12),
          context.rs(16),
          context.scrollBottomInset,
        ),
        children: [
          AppCard(
            padding: Responsive.padAll(context, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.childName,
                  style: TextStyle(
                    fontSize: context.rf(18),
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: context.rg(6)),
                Text(
                  'milestone_report_age'.tr(
                    namedArgs: {'age': widget.childAgeLabel},
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (childNotes.isNotEmpty) ...[
                  SizedBox(height: context.rg(8)),
                  Text(
                    'milestone_report_child_notes'.tr(
                      namedArgs: {'notes': childNotes},
                    ),
                    maxLines: 6,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                SizedBox(height: context.rg(10)),
                Text(
                  'milestone_report_completion'.tr(
                    namedArgs: {'rate': completionRate.toStringAsFixed(1)},
                  ),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: context.rf(14),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: context.rg(4)),
                Text(
                  'milestone_report_status'.tr(namedArgs: {'status': status}),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          SizedBox(height: context.rg(12)),
          Text(
            'milestone_report_progress_cards'.tr(),
            style: TextStyle(
              fontSize: context.rf(16),
              fontWeight: FontWeight.w700,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: context.rg(8)),
          ...categories.entries.map((entry) {
            final value =
                (entry.value as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
            final categoryLabel = localizedMilestoneCategory(entry.key);
            final total = (value['total'] as num?)?.toInt() ?? 0;
            final completed = (value['completed'] as num?)?.toInt() ?? 0;
            final rate = (value['completion_rate'] as num?)?.toDouble() ?? 0;

            return Padding(
              padding: EdgeInsets.only(bottom: context.rg(10)),
              child: AppCard(
                padding: Responsive.padAll(context, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      categoryLabel,
                      style: TextStyle(
                        fontSize: context.rf(15),
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: context.rg(6)),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(context.rs(4)),
                      child: LinearProgressIndicator(
                        value: rate / 100,
                        minHeight: context.rs(8),
                      ),
                    ),
                    SizedBox(height: context.rg(6)),
                    Text(
                      'milestone_report_completed'.tr(namedArgs: {
                        'completed': '$completed',
                        'total': '$total',
                        'rate': rate.toStringAsFixed(0),
                      }),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          }),
          SizedBox(height: context.rg(8)),
          Text(
            'milestone_report_recent_achievements'.tr(),
            style: TextStyle(
              fontSize: context.rf(16),
              fontWeight: FontWeight.w700,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: context.rg(8)),
          if (recent.isEmpty)
            AppCard(
              padding: Responsive.padAll(context, 12),
              child: Text('milestone_report_no_completed'.tr()),
            )
          else
            ...recent.take(8).map((item) {
              final row = (item as Map).cast<String, dynamic>();
              final title = localizedMilestoneTitleByText(
                row['title']?.toString() ?? '',
              );
              final category = localizedMilestoneCategory(
                row['category']?.toString() ?? '',
              );

              return Padding(
                padding: EdgeInsets.only(bottom: context.rg(10)),
                child: AppCard(
                  padding: Responsive.padAll(context, 12),
                  child: Text(
                    'milestone_report_achievement_line'.tr(namedArgs: {
                      'title': (title.trim().isEmpty
                              ? row['title']?.toString()
                              : title) ??
                          'milestone_report_milestone_default'.tr(),
                      'category': (category.trim().isEmpty
                              ? row['category']?.toString()
                              : category) ??
                          'milestone_report_category_default'.tr(),
                      'date': row['completion_date']?.toString() ??
                          'milestone_report_no_date'.tr(),
                    }),
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              );
            }),
          SizedBox(height: context.rg(8)),
          Text(
            'milestone_report_notes_section'.tr(),
            style: TextStyle(
              fontSize: context.rf(16),
              fontWeight: FontWeight.w700,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: context.rg(8)),
          if (notes.isEmpty)
            AppCard(
              padding: Responsive.padAll(context, 12),
              child: Text('milestone_report_no_notes'.tr()),
            )
          else
            ...notes.map((item) {
              final row = (item as Map).cast<String, dynamic>();

              return Padding(
                padding: EdgeInsets.only(bottom: context.rg(10)),
                child: AppCard(
                  padding: Responsive.padAll(context, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row['title']?.toString() ??
                            'milestone_report_milestone_default'.tr(),
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: context.rf(14),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: context.rg(4)),
                      Text(
                        row['notes']?.toString() ?? '',
                        maxLines: 8,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
