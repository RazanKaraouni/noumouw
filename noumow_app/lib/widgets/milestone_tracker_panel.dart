import 'dart:async';
import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_progress_controller.dart';
import '../services/api_http_client.dart';
import '../services/milestone_catalog_service.dart';
import '../theme/app_colors.dart';
import '../utils/auth_headers.dart';
import '../utils/cdc_milestone_age_tiers.dart';
import '../utils/milestone_localization.dart';
import '../utils/milestone_question_text.dart';
import '../screens/booking_child_pick_page.dart';
import '../utils/therapists_api.dart';
import 'milestone_tracker_card.dart';

class _MilestoneAssessment {
  const _MilestoneAssessment({
    required this.titleKey,
    required this.messageKey,
    this.messageArgs = const {},
    required this.needsTherapist,
    this.incomplete = false,
  });

  final String titleKey;
  final String messageKey;
  final Map<String, String> messageArgs;
  final bool needsTherapist;
  final bool incomplete;
}

/// Inline milestone questionnaire: one card per page with back/next and generate.
class MilestoneTrackerPanel extends StatefulWidget {
  const MilestoneTrackerPanel({
    super.key,
    required this.childProgress,
    this.initialChildId,
    this.embedded = false,
    this.showLibraryLink = false,
    this.onCompleted,
    this.onOpenLibrary,
  });

  final ChildProgressController childProgress;
  final String? initialChildId;
  final bool embedded;
  final bool showLibraryLink;
  final VoidCallback? onCompleted;
  final VoidCallback? onOpenLibrary;

  @override
  State<MilestoneTrackerPanel> createState() => _MilestoneTrackerPanelState();
}

class _MilestoneTrackerPanelState extends State<MilestoneTrackerPanel> {
  final _supabase = Supabase.instance.client;
  static const int _cardsPerPage = 1;
  List<Map<String, dynamic>> _children = [];
  String? _selectedChildId;
  String _selectedChildAgeText = '0 months';
  List<Map<String, dynamic>> _milestones = [];
  final Map<String, bool?> _completed = {};
  final Map<String, String> _progressRowIdByMilestoneId = {};
  final Map<String, bool?> _baselineCompleted = {};
  final Set<String> _dirtyMilestoneIds = {};
  bool _loadingChildren = true;
  bool _loadingMilestones = false;
  bool _savingAll = false;
  int _currentPage = 0;

  String? _todayDate() => DateTime.now().toIso8601String().split('T').first;

  @override
  void initState() {
    super.initState();
    widget.childProgress.addListener(_onActiveChildChanged);
    _loadChildren();
  }

  @override
  void dispose() {
    widget.childProgress.removeListener(_onActiveChildChanged);
    super.dispose();
  }

  void _onActiveChildChanged() {
    if (!mounted) return;
    _applyChildSelection(reloadMilestones: true);
  }

  int _ageInMonthsFromDob(String? rawDob) {
    if (rawDob == null || rawDob.trim().isEmpty) return 0;
    try {
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      return months < 0 ? 0 : months;
    } catch (_) {
      return 0;
    }
  }

  String _ageLabelFromDob(String? rawDob) {
    if (rawDob == null || rawDob.trim().isEmpty) {
      return 'milestones_track_age_zero_months'.tr();
    }
    try {
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      final days = now.difference(dob).inDays;
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      if (months < 0) months = 0;
      if (months < 1) {
        return days == 1
            ? 'milestones_track_age_one_day'.tr()
            : 'milestones_track_age_days'.tr(namedArgs: {'count': '$days'});
      }
      if (months < 12) {
        return 'milestones_track_age_months'
            .tr(namedArgs: {'count': '$months'});
      }
      final years = months ~/ 12;
      final remainingMonths = months % 12;
      if (remainingMonths == 0) {
        return 'milestones_track_age_years'
            .tr(namedArgs: {'count': '$years'});
      }
      return 'milestones_track_age_years_months'.tr(namedArgs: {
        'years': '$years',
        'months': '$remainingMonths',
      });
    } catch (_) {
      return 'milestones_track_age_zero_months'.tr();
    }
  }

  String _childName(Map<String, dynamic> child) {
    final fullName = (child['full_name'] as String?)?.trim();
    if (fullName != null && fullName.isNotEmpty) return fullName;
    final name = (child['name'] as String?)?.trim();
    if (name != null && name.isNotEmpty) return name;
    return 'milestones_track_unnamed_child'.tr();
  }

  Map<String, dynamic>? get _selectedChild {
    if (_selectedChildId == null) return null;
    for (final child in _children) {
      final childId = (child['children_id'] ?? child['child_id'])?.toString();
      if (childId == _selectedChildId) return child;
    }
    return null;
  }

  int? get _selectedChildrenIdInt {
    final child = _selectedChild;
    if (child == null) return null;
    final raw = child['children_id'];
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '');
  }

  Future<void> _loadChildren() async {
    setState(() => _loadingChildren = true);
    try {
      await widget.childProgress.loadChildren();
      if (!mounted) return;
      await _applyChildSelection(reloadMilestones: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingChildren = false);
      showErrorSnackBar(context, e);
    }
  }

  Future<void> _applyChildSelection({required bool reloadMilestones}) async {
    final children = widget.childProgress.children;
    String? selectedId =
        ChildProgressController.idOf(widget.childProgress.activeChild);
    final initial = widget.initialChildId?.trim();
    if (initial != null &&
        initial.isNotEmpty &&
        children.any((c) => ChildProgressController.idOf(c) == initial)) {
      selectedId = initial;
    }

    setState(() {
      _children = children;
      _selectedChildId = selectedId;
      _loadingChildren = false;
      _currentPage = 0;
    });

    if (!reloadMilestones) return;

    if (_selectedChildId != null) {
      await _loadMilestonesForSelectedChild();
    } else if (mounted) {
      setState(() {
        _milestones = [];
        _completed.clear();
      });
    }
  }

  Future<void> _loadMilestonesForSelectedChild() async {
    final child = _selectedChild;
    final childId = _selectedChildId;
    if (child == null || childId == null) {
      setState(() {
        _milestones = [];
        _completed.clear();
      });
      return;
    }

    setState(() => _loadingMilestones = true);

    final ageMonths = _ageInMonthsFromDob(
      (child['date_of_birth'] ?? child['dob'])?.toString(),
    );
    final ageLabel = _ageLabelFromDob(
      (child['date_of_birth'] ?? child['dob'])?.toString(),
    );
    final childTier = CdcMilestoneAgeTiers.tierForChildAge(ageMonths);
    final activeTier = childTier ?? CdcMilestoneAgeTiers.all.first;

    final cachedCatalog = await MilestoneCatalogService.instance.readCached();
    if (cachedCatalog != null && cachedCatalog.isNotEmpty && mounted) {
      final milestones = cachedCatalog
          .where((m) => CdcMilestoneAgeTiers.rowMatchesTier(m, activeTier))
          .toList();
      setState(() {
        _selectedChildAgeText = ageLabel;
        _milestones = milestones;
        _loadingMilestones = false;
        _currentPage = 0;
      });
    }

    try {
      final childrenIdInt = _selectedChildrenIdInt;
      if (childrenIdInt == null) {
        throw StateError('Missing children_id for selected child.');
      }

      final results = await Future.wait<dynamic>([
        MilestoneCatalogService.instance.fetchCatalog(),
        _supabase
            .from('child_milestones')
            .select(
              'child_milestones_id,milestone_title,milestone_category,target_age_months,is_completed',
            )
            .eq('child_id', childrenIdInt),
      ]);

      final catalog = List<Map<String, dynamic>>.from(results[0] as List);
      final progressRows = List<Map<String, dynamic>>.from(results[1] as List);
      final milestones = catalog
          .where((m) => CdcMilestoneAgeTiers.rowMatchesTier(m, activeTier))
          .toList();

      final progressByKey = <String, Map<String, dynamic>>{};
      for (final row in progressRows) {
        final key = MilestoneCatalogService.progressMatchKey(
          title: (row['milestone_title'] ?? '').toString(),
          category: (row['milestone_category'] ?? '').toString(),
          targetAgeMonths: row['target_age_months'],
        );
        progressByKey.putIfAbsent(key, () => row);
      }

      final completed = <String, bool?>{};
      final rowIds = <String, String>{};
      for (final m in milestones) {
        final milestoneId = m['milestones_id']?.toString();
        if (milestoneId == null) continue;

        final key = MilestoneCatalogService.progressMatchKey(
          title: (m['title'] ?? '').toString(),
          category: (m['domain'] ?? '').toString(),
          targetAgeMonths: m['age_months_max'],
        );
        final matched = progressByKey[key];
        if (matched == null) continue;
        completed[milestoneId] = matched['is_completed'] == true;
        final rowId = matched['child_milestones_id']?.toString();
        if (rowId != null && rowId.isNotEmpty) {
          rowIds[milestoneId] = rowId;
        }
      }

      setState(() {
        _selectedChildAgeText = ageLabel;
        _milestones = milestones;
        _completed
          ..clear()
          ..addAll(completed);
        _baselineCompleted
          ..clear()
          ..addAll(completed);
        _dirtyMilestoneIds.clear();
        _progressRowIdByMilestoneId
          ..clear()
          ..addAll(rowIds);
        _loadingMilestones = false;
        _currentPage = 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingMilestones = false);
      showErrorSnackBar(context, e);
    }
  }

  bool _isDone(String id) => _completed[id] == true;
  bool? _answerOf(String id) => _completed[id];

  Future<void> _insertProgressRow({
    required int childId,
    required Map<String, dynamic> milestone,
    required bool isCompleted,
  }) async {
    final payload = <String, dynamic>{
      'child_id': childId,
      'milestone_category': (milestone['domain'] ?? 'general').toString(),
      'milestone_title': (milestone['title'] ?? '').toString(),
      'target_age_months': milestone['age_months_max'] ?? 0,
      'is_completed': isCompleted,
      'completion_date': isCompleted ? _todayDate() : null,
    };
    final inserted = await _supabase
        .from('child_milestones')
        .insert(payload)
        .select('child_milestones_id')
        .single();
    final rowId = inserted['child_milestones_id']?.toString();
    if (rowId != null && rowId.isNotEmpty) {
      final milestoneId = milestone['milestones_id']?.toString();
      if (milestoneId != null) {
        _progressRowIdByMilestoneId[milestoneId] = rowId;
      }
    }
  }

  Future<void> _updateProgressRow({
    required String rowId,
    required Map<String, dynamic> milestone,
    required bool isCompleted,
  }) async {
    final payload = <String, dynamic>{
      'milestone_category': (milestone['domain'] ?? 'general').toString(),
      'milestone_title': (milestone['title'] ?? '').toString(),
      'target_age_months': milestone['age_months_max'] ?? 0,
      'is_completed': isCompleted,
      'completion_date': isCompleted ? _todayDate() : null,
    };
    await _supabase
        .from('child_milestones')
        .update(payload)
        .eq('child_milestones_id', rowId);
  }

  void _setAnswerLocally(Map<String, dynamic> m, bool answer) {
    final id = m['milestones_id'].toString();
    final original = _baselineCompleted[id];
    setState(() {
      _completed[id] = answer;
      if (original == answer) {
        _dirtyMilestoneIds.remove(id);
      } else {
        _dirtyMilestoneIds.add(id);
      }
    });
  }

  void _showChooseAnswerDialog() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('milestones_track_choose_answer_title'.tr()),
        content: Text('milestones_track_choose_answer_body'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('milestones_track_ok'.tr()),
          ),
        ],
      ),
    );
  }

  _MilestoneAssessment _assessMilestoneProgress() {
    if (_milestones.isEmpty) {
      return const _MilestoneAssessment(
        titleKey: 'milestones_track_no_milestones_title',
        messageKey: 'milestones_track_no_milestones_message',
        needsTherapist: false,
      );
    }

    var answered = 0;
    var yesCount = 0;
    for (final m in _milestones) {
      final id = m['milestones_id']?.toString();
      if (id == null || id.isEmpty) continue;
      final answer = _answerOf(id);
      if (answer == null) continue;
      answered++;
      if (answer) yesCount++;
    }

    if (answered < _milestones.length) {
      return const _MilestoneAssessment(
        titleKey: 'milestones_track_incomplete_title',
        messageKey: 'milestones_track_incomplete_message',
        needsTherapist: false,
        incomplete: true,
      );
    }

    final rate = yesCount / answered;
    if (rate >= 0.75) {
      final childLabel = _selectedChild != null
          ? _childName(_selectedChild!)
          : 'milestones_track_your_child'.tr();
      return _MilestoneAssessment(
        titleKey: 'milestones_track_safe_title',
        messageKey: 'milestones_track_safe_message',
        messageArgs: {
          'child': childLabel,
          'yes': '$yesCount',
          'answered': '$answered',
        },
        needsTherapist: false,
      );
    }
    if (rate >= 0.5) {
      return _MilestoneAssessment(
        titleKey: 'milestones_track_attention_title',
        messageKey: 'milestones_track_attention_message',
        messageArgs: {'yes': '$yesCount', 'answered': '$answered'},
        needsTherapist: true,
      );
    }
    return _MilestoneAssessment(
      titleKey: 'milestones_track_therapist_title',
      messageKey: 'milestones_track_therapist_message',
      messageArgs: {'yes': '$yesCount', 'answered': '$answered'},
      needsTherapist: true,
    );
  }

  Set<String> _collectUnsavedMilestoneIds() {
    final ids = <String>{};
    for (final m in _milestones) {
      final id = m['milestones_id']?.toString();
      if (id == null || id.isEmpty) continue;
      if (_completed[id] == null) continue;
      if (_dirtyMilestoneIds.contains(id)) {
        ids.add(id);
        continue;
      }
      final rowId = _progressRowIdByMilestoneId[id];
      if (rowId == null || rowId.isEmpty) {
        ids.add(id);
      }
    }
    return ids;
  }

  Future<bool> _persistMilestoneAnswers(Set<String> milestoneIds) async {
    final childrenIdInt = _selectedChildrenIdInt;
    if (childrenIdInt == null || milestoneIds.isEmpty) return true;

    for (final milestoneId in milestoneIds) {
      final milestone = _milestones.firstWhere(
        (m) => m['milestones_id'].toString() == milestoneId,
        orElse: () => <String, dynamic>{},
      );
      if (milestone.isEmpty) continue;
      final answer = _completed[milestoneId];
      if (answer == null) continue;

      final rowId = _progressRowIdByMilestoneId[milestoneId];
      if (rowId != null && rowId.isNotEmpty) {
        await _updateProgressRow(
          rowId: rowId,
          milestone: milestone,
          isCompleted: answer,
        );
      } else {
        await _insertProgressRow(
          childId: childrenIdInt,
          milestone: milestone,
          isCompleted: answer,
        );
      }
    }

    await _loadMilestonesForSelectedChild();
    if (!mounted) return false;
    unawaited(_pushMilestoneTrackingReport(childrenIdInt));
    return true;
  }

  Future<void> _onAssessmentDialogOk({
    required BuildContext dialogContext,
    required _MilestoneAssessment assessment,
  }) async {
    Navigator.of(dialogContext).pop();
    if (assessment.incomplete || !mounted) return;

    final unsaved = _collectUnsavedMilestoneIds();
    if (unsaved.isNotEmpty) {
      setState(() => _savingAll = true);
      try {
        final ok = await _persistMilestoneAnswers(unsaved);
        if (!ok || !mounted) return;
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'milestones_track_save_error'
                  .tr(namedArgs: {'error': userFacingErrorMessage(e)}),
            ),
          ),
        );
        return;
      } finally {
        if (mounted) setState(() => _savingAll = false);
      }
    }

    await widget.childProgress.refreshSavedMilestonesState();
    widget.onCompleted?.call();
    if (!widget.embedded && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  void _showTherapistAssessmentDialog({bool saved = false}) {
    final assessment = _assessMilestoneProgress();
    final savedNote = saved ? 'milestones_track_saved_note'.tr() : '';
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(
          assessment.incomplete
              ? Icons.info_outline
              : assessment.needsTherapist
                  ? Icons.medical_services_outlined
                  : Icons.check_circle_outline,
          color: assessment.incomplete
              ? Theme.of(context).colorScheme.primary
              : assessment.needsTherapist
                  ? Colors.orange.shade700
                  : Colors.green.shade700,
          size: context.rs(48),
        ),
        title: Text(assessment.titleKey.tr()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildDialogProgressSummary(),
            SizedBox(height: context.rg(14)),
            Text(
              '$savedNote${assessment.messageKey.tr(namedArgs: assessment.messageArgs)}',
              maxLines: 12,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          if (assessment.needsTherapist)
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => const BookingChildPickPage(),
                  ),
                );
              },
              child: Text('milestones_track_find_therapist'.tr()),
            ),
          TextButton(
            onPressed: () => _onAssessmentDialogOk(
              dialogContext: dialogContext,
              assessment: assessment,
            ),
            child: Text('milestones_track_ok'.tr()),
          ),
        ],
      ),
    );
  }

  bool _canMoveToNextPage(List<Map<String, dynamic>> pageMilestones) {
    for (final m in pageMilestones) {
      final id = m['milestones_id'].toString();
      if (_answerOf(id) == null) return false;
    }
    return true;
  }

  bool _allMilestonesAnswered() {
    if (_milestones.isEmpty) return false;
    for (final m in _milestones) {
      if (_answerOf(m['milestones_id'].toString()) == null) return false;
    }
    return true;
  }

  ({int total, int answered, int yesCount, double progress}) _progressStats() {
    final total = _milestones.length;
    final answered = _milestones
        .where((m) => _answerOf(m['milestones_id'].toString()) != null)
        .length;
    final yesCount =
        _milestones.where((m) => _isDone(m['milestones_id'].toString())).length;
    final progress = total == 0 ? 0.0 : yesCount / total;
    return (total: total, answered: answered, yesCount: yesCount, progress: progress);
  }

  Widget _buildDialogProgressSummary() {
    final stats = _progressStats();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(context.rs(4)),
          child: LinearProgressIndicator(
            value: stats.progress,
            minHeight: context.rs(8),
          ),
        ),
        SizedBox(height: context.rg(6)),
        Text(
          'milestones_track_progress'.tr(namedArgs: {
            'yes': '${stats.yesCount}',
            'total': '${stats.total}',
            'answered': '${stats.answered}',
          }),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: context.rf(12),
              ),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Map<String, dynamic> _milestoneQuestionnaireSnapshot() {
    final items = <Map<String, dynamic>>[];
    for (final m in _milestones) {
      final id = m['milestones_id']?.toString();
      if (id == null || id.isEmpty) continue;
      final ans = _completed[id];
      items.add({
        'milestones_id': id,
        'title': (m['title'] ?? '').toString(),
        'domain': (m['domain'] ?? 'general').toString(),
        'age_months_min': m['age_months_min'],
        'age_months_max': m['age_months_max'],
        'answered_yes': ans == true
            ? true
            : ans == false
                ? false
                : null,
      });
    }
    return {
      'generated_at': DateTime.now().toUtc().toIso8601String(),
      'items': items,
    };
  }

  Future<void> _pushMilestoneTrackingReport(int childrenId) async {
    try {
      final root = resolvedTherapistsApiBase();
      final uri = Uri.parse('$root/api/reports/milestone-tracking');
      final headers = authHeaders(json: true);
      if (headers['Authorization'] == null ||
          headers['Authorization']!.isEmpty) {
        return;
      }
      final response = await createApiHttpClient().post(
        uri,
        headers: headers,
        body: jsonEncode({
          'children_id': childrenId,
          'milestone_questionnaire_snapshot': _milestoneQuestionnaireSnapshot(),
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        debugPrint(
          'milestone-tracking report: ${response.statusCode} ${response.body}',
        );
      }
    } catch (e, st) {
      debugPrint('milestone-tracking report: $e\n$st');
    }
  }

  Future<void> _generateReport() async {
    final childrenIdInt = _selectedChildrenIdInt;
    if (childrenIdInt == null || _savingAll) return;

    if (!_allMilestonesAnswered()) {
      _showChooseAnswerDialog();
      return;
    }

    final unsaved = _collectUnsavedMilestoneIds();
    if (unsaved.isEmpty && _dirtyMilestoneIds.isEmpty) {
      _showTherapistAssessmentDialog();
      return;
    }

    setState(() => _savingAll = true);
    try {
      final toSave = unsaved.isEmpty
          ? _milestones
              .map((m) => m['milestones_id']?.toString())
              .whereType<String>()
              .where((id) => _completed[id] != null)
              .toSet()
          : unsaved;
      await _persistMilestoneAnswers(toSave);
      if (!mounted) return;
      _showTherapistAssessmentDialog(saved: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'milestones_track_save_error'
                .tr(namedArgs: {'error': userFacingErrorMessage(e)}),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _savingAll = false);
    }
  }

  Widget _buildCurrentMilestoneCard(Map<String, dynamic> m) {
    final id = m['milestones_id'].toString();
    final answer = _answerOf(id);
    final title = localizedMilestoneTitleFromRow(m);
    final desc = localizedMilestoneDescriptionFromRow(m);
    final domainFallback = (m['domain'] ?? 'general').toString();
    final domain = localizedMilestoneDomain(domainFallback);
    final ageBandLabel = CdcMilestoneAgeTiers.labelForMilestoneRow(m);
    final question = formatMilestoneQuestion(title);

    return MilestoneTrackerCard(
      metaLabel: '$domain • $ageBandLabel',
      question: question,
      description: desc.trim().isNotEmpty ? desc : null,
      answer: answer,
      yesLabel: 'milestones_track_yes'.tr(),
      noLabel: 'milestones_track_no'.tr(),
      enabled: !_savingAll,
      embedded: widget.embedded,
      onAnswer: (value) => _setAnswerLocally(m, value),
    );
  }

  Widget _buildNavigationRow({
    required int safePage,
    required int totalPages,
    required List<Map<String, dynamic>> pageMilestones,
    required bool isLastPage,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: (_savingAll || safePage == 0)
                    ? null
                    : () => setState(() => _currentPage = safePage - 1),
                style: widget.embedded
                    ? OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(color: Colors.white.withOpacity(0.6)),
                      )
                    : null,
                child: Text(
                  'milestones_track_back'.tr(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            SizedBox(width: context.rg(10)),
            Flexible(
              child: Text(
                'milestones_track_page'.tr(namedArgs: {
                  'current': '${safePage + 1}',
                  'total': '$totalPages',
                }),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: widget.embedded
                    ? TextStyle(
                        fontSize: context.rf(12),
                        color: Colors.white.withOpacity(0.9),
                        fontWeight: FontWeight.w600,
                      )
                    : null,
              ),
            ),
            SizedBox(width: context.rg(10)),
            Expanded(
              child: ElevatedButton(
                onPressed: (_savingAll || isLastPage)
                    ? null
                    : () {
                        if (!_canMoveToNextPage(pageMilestones)) {
                          _showChooseAnswerDialog();
                          return;
                        }
                        setState(() => _currentPage = safePage + 1);
                      },
                style: widget.embedded
                    ? ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.primary,
                      )
                    : null,
                child: Text(
                  'milestones_track_next'.tr(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
        if (isLastPage) ...[
          SizedBox(height: context.rg(10)),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_loadingMilestones || _savingAll || !_allMilestonesAnswered())
                  ? null
                  : _generateReport,
              icon: _savingAll
                  ? SizedBox(
                      width: context.rs(16),
                      height: context.rs(16),
                      child: const CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.auto_awesome_outlined),
              label: Text(
                _savingAll
                    ? 'milestones_track_saving'.tr()
                    : 'milestones_track_generate'.tr(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
              style: widget.embedded
                  ? ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                    )
                  : null,
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final stats = _progressStats();
    final total = stats.total;
    final selectedChild = _selectedChild;
    final totalPages = total == 0 ? 1 : (total / _cardsPerPage).ceil();
    final safePage =
        _currentPage >= totalPages ? totalPages - 1 : _currentPage;
    final startIndex = safePage * _cardsPerPage;
    final endIndex = (startIndex + _cardsPerPage) > total
        ? total
        : (startIndex + _cardsPerPage);
    final pageMilestones = total == 0
        ? <Map<String, dynamic>>[]
        : _milestones.sublist(startIndex, endIndex);
    final currentMilestone =
        pageMilestones.isEmpty ? null : pageMilestones.first;
    final isLastPage = safePage >= totalPages - 1;

    if (_loadingChildren) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_children.isEmpty) {
      return Center(child: Text('milestones_track_no_children'.tr()));
    }

    final questionnaire = _loadingMilestones
        ? Center(
            child: CircularProgressIndicator(
              color: widget.embedded ? Colors.white : null,
            ),
          )
        : _milestones.isEmpty
            ? Center(
                child: Text(
                  'milestones_track_empty_age_group'.tr(),
                  textAlign: TextAlign.center,
                  style: widget.embedded
                      ? TextStyle(color: Colors.white.withOpacity(0.9))
                      : null,
                ),
              )
            : currentMilestone == null
                ? const SizedBox.shrink()
                : _buildCurrentMilestoneCard(currentMilestone);

    if (widget.embedded) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (selectedChild != null) ...[
            Text(
              'progress_widget_track_milestones'.tr(),
              style: TextStyle(
                fontSize: context.rf(16),
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            SizedBox(height: context.rg(4)),
            Text(
              '${_childName(selectedChild)} • $_selectedChildAgeText',
              style: TextStyle(
                fontSize: context.rf(12),
                color: Colors.white.withOpacity(0.85),
              ),
            ),
            if (total > 0) ...[
              SizedBox(height: context.rg(10)),
              ClipRRect(
                borderRadius: BorderRadius.circular(context.rs(4)),
                child: LinearProgressIndicator(
                  value: stats.progress,
                  minHeight: context.rs(6),
                  backgroundColor: Colors.white.withOpacity(0.25),
                  color: Colors.white,
                ),
              ),
              SizedBox(height: context.rg(4)),
              Text(
                'milestones_track_progress'.tr(namedArgs: {
                  'yes': '${stats.yesCount}',
                  'total': '$total',
                  'answered': '${stats.answered}',
                }),
                style: TextStyle(
                  fontSize: context.rf(11),
                  color: Colors.white.withOpacity(0.85),
                ),
              ),
            ],
            SizedBox(height: context.rg(14)),
          ],
          questionnaire,
          if (!_loadingMilestones && _milestones.isNotEmpty) ...[
            SizedBox(height: context.rg(12)),
            _buildNavigationRow(
              safePage: safePage,
              totalPages: totalPages,
              pageMilestones: pageMilestones,
              isLastPage: isLastPage,
            ),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (selectedChild != null)
          Padding(
            padding: Responsive.padDirectional(
              context,
              start: 16,
              top: 16,
              end: 16,
              bottom: 8,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_childName(selectedChild)} • $_selectedChildAgeText',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.showLibraryLink && widget.onOpenLibrary != null) ...[
                  SizedBox(height: context.rg(6)),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: widget.onOpenLibrary,
                      icon: Icon(
                        Icons.library_books_outlined,
                        size: context.rs(18),
                      ),
                      label: Text(
                        'milestones_track_library_button'.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        Expanded(child: questionnaire),
        if (!_loadingMilestones && _milestones.isNotEmpty)
          Padding(
            padding: Responsive.padDirectional(
              context,
              start: 12,
              end: 12,
              bottom: 12,
            ),
            child: _buildNavigationRow(
              safePage: safePage,
              totalPages: totalPages,
              pageMilestones: pageMilestones,
              isLastPage: isLastPage,
            ),
          ),
      ],
    );
  }
}

/// Profile card shell wrapping [MilestoneTrackerPanel].
class ProfileMilestoneTrackerCard extends StatelessWidget {
  const ProfileMilestoneTrackerCard({
    super.key,
    required this.controller,
    this.onCompleted,
  });

  final ChildProgressController controller;
  final VoidCallback? onCompleted;

  @override
  Widget build(BuildContext context) {
    final child = controller.activeChild;
    if (child == null) return const SizedBox.shrink();

    return Container(
      margin: Responsive.padDirectional(context, start: 24, top: 16, end: 24),
      padding: Responsive.padAll(context, 18),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(context.rs(18)),
        boxShadow: Responsive.cardShadow(context, color: AppColors.primary, opacity: 0.3),
      ),
      child: MilestoneTrackerPanel(
        childProgress: controller,
        embedded: true,
        onCompleted: onCompleted,
      ),
    );
  }
}
