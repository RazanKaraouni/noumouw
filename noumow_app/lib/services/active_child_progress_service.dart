import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_progress_controller.dart';
import '../services/milestone_catalog_service.dart';
import '../utils/cdc_milestone_age_tiers.dart';
import '../utils/milestone_localization.dart';

/// Progress snapshot for the currently selected child.
class ActiveChildProgressSnapshot {
  const ActiveChildProgressSnapshot({
    required this.percent,
    required this.completed,
    required this.total,
    this.tierLabel,
  });

  static const empty = ActiveChildProgressSnapshot(
    percent: 0,
    completed: 0,
    total: 0,
  );

  final double percent;
  final int completed;
  final int total;
  final String? tierLabel;
}

/// One CDC milestone prompt for the daily tracker card.
class DailyMilestonePrompt {
  const DailyMilestonePrompt({
    required this.milestone,
    required this.question,
    this.progressRowId,
    this.currentAnswer,
  });

  final Map<String, dynamic> milestone;
  final String question;
  final String? progressRowId;
  final bool? currentAnswer;
}

/// Loads milestone completion % and daily prompts for [ChildProgressController.activeChild].
class ActiveChildProgressService {
  ActiveChildProgressService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  Future<ActiveChildProgressSnapshot> loadProgress(
    Map<String, dynamic>? child,
  ) async {
    if (child == null) return ActiveChildProgressSnapshot.empty;

    final childrenId = ChildProgressController.idOf(child);
    if (childrenId == null) return ActiveChildProgressSnapshot.empty;

    final ageMonths = ChildProgressController.ageMonthsOf(child);
    final tier = CdcMilestoneAgeTiers.tierForChildAge(ageMonths);
    if (tier == null) {
      return const ActiveChildProgressSnapshot(
        percent: 0,
        completed: 0,
        total: 0,
        tierLabel: null,
      );
    }

    final catalog = await MilestoneCatalogService.instance.fetchCatalog();
    final tierMilestones = catalog
        .where((row) => CdcMilestoneAgeTiers.rowMatchesTier(row, tier))
        .toList();
    if (tierMilestones.isEmpty) {
      return ActiveChildProgressSnapshot(
        percent: 0,
        completed: 0,
        total: 0,
        tierLabel: tier.label,
      );
    }

    final childrenIdInt = int.tryParse(childrenId) ??
        (child['children_id'] is num
            ? (child['children_id'] as num).toInt()
            : null);
    if (childrenIdInt == null) {
      return ActiveChildProgressSnapshot(
        percent: 0,
        completed: 0,
        total: tierMilestones.length,
        tierLabel: tier.label,
      );
    }

    final progressRows = await _supabase
        .from('child_milestones')
        .select(
          'milestone_title,milestone_category,target_age_months,is_completed',
        )
        .eq('child_id', childrenIdInt)
        .timeout(const Duration(seconds: 8));

    final mastered = MilestoneCatalogService.masteredByMilestoneId(
      catalog: tierMilestones,
      progressRows: List<Map<String, dynamic>>.from(progressRows),
    );

    final total = tierMilestones.length;
    final completed =
        mastered.values.where((completed) => completed == true).length;
    final percent = total == 0 ? 0.0 : (completed / total) * 100;

    return ActiveChildProgressSnapshot(
      percent: percent,
      completed: completed,
      total: total,
      tierLabel: tier.label,
    );
  }

  Future<DailyMilestonePrompt?> loadDailyPrompt(
    Map<String, dynamic>? child, {
    int skipOffset = 0,
  }) async {
    if (child == null) return null;

    final childrenId = ChildProgressController.idOf(child);
    if (childrenId == null) return null;

    final childrenIdInt = int.tryParse(childrenId) ??
        (child['children_id'] is num
            ? (child['children_id'] as num).toInt()
            : null);
    if (childrenIdInt == null) return null;

    final ageMonths = ChildProgressController.ageMonthsOf(child);
    final tier = CdcMilestoneAgeTiers.tierForChildAge(ageMonths) ??
        CdcMilestoneAgeTiers.all.first;

    final catalog = await MilestoneCatalogService.instance.fetchCatalog();
    final tierMilestones = catalog
        .where((m) => CdcMilestoneAgeTiers.rowMatchesTier(m, tier))
        .toList();
    if (tierMilestones.isEmpty) return null;

    final progressRows = await _supabase
        .from('child_milestones')
        .select(
          'child_milestones_id,milestone_title,milestone_category,target_age_months,is_completed',
        )
        .eq('child_id', childrenIdInt);

    final progressByKey = <String, Map<String, dynamic>>{};
    for (final row in progressRows) {
      final key = MilestoneCatalogService.progressMatchKey(
        title: (row['milestone_title'] ?? '').toString(),
        category: (row['milestone_category'] ?? '').toString(),
        targetAgeMonths: row['target_age_months'],
      );
      progressByKey.putIfAbsent(key, () => row);
    }

    final unanswered = <Map<String, dynamic>>[];
    final answered = <Map<String, dynamic>>[];

    for (final milestone in tierMilestones) {
      final milestoneId = milestone['milestones_id']?.toString();
      if (milestoneId == null) continue;

      final key = MilestoneCatalogService.progressMatchKey(
        title: (milestone['title'] ?? '').toString(),
        category: (milestone['domain'] ?? '').toString(),
        targetAgeMonths: milestone['age_months_max'],
      );
      final matched = progressByKey[key];
      if (matched == null || matched['is_completed'] != true) {
        unanswered.add(milestone);
      } else {
        answered.add(milestone);
      }
    }

    final pool = unanswered.isNotEmpty ? unanswered : answered;
    if (pool.isEmpty) return null;

    final dayIndex = DateTime.now().difference(DateTime(DateTime.now().year)).inDays;
    final index = (dayIndex + skipOffset) % pool.length;
    final milestone = pool[index];

    final key = MilestoneCatalogService.progressMatchKey(
      title: (milestone['title'] ?? '').toString(),
      category: (milestone['domain'] ?? '').toString(),
      targetAgeMonths: milestone['age_months_max'],
    );
    final matched = progressByKey[key];
    final rowId = matched?['child_milestones_id']?.toString();
    bool? currentAnswer;
    if (matched != null) {
      final completed = matched['is_completed'];
      if (completed is bool) currentAnswer = completed;
    }

    final question = localizedMilestoneQuestionFromRow(milestone);

    return DailyMilestonePrompt(
      milestone: milestone,
      question: question,
      progressRowId: rowId,
      currentAnswer: currentAnswer,
    );
  }

  Future<void> saveDailyAnswer({
    required Map<String, dynamic> child,
    required Map<String, dynamic> milestone,
    required bool isCompleted,
    String? progressRowId,
  }) async {
    final childrenIdInt = int.tryParse(ChildProgressController.idOf(child) ?? '') ??
        (child['children_id'] is num
            ? (child['children_id'] as num).toInt()
            : null);
    if (childrenIdInt == null) {
      throw StateError('Missing children_id for active child.');
    }

    final today = DateTime.now().toIso8601String().split('T').first;
    final payload = <String, dynamic>{
      'milestone_category': (milestone['domain'] ?? 'general').toString(),
      'milestone_title': (milestone['title'] ?? '').toString(),
      'target_age_months': milestone['age_months_max'] ?? 0,
      'is_completed': isCompleted,
      'completion_date': isCompleted ? today : null,
    };

    if (progressRowId != null && progressRowId.isNotEmpty) {
      await _supabase
          .from('child_milestones')
          .update(payload)
          .eq('child_milestones_id', progressRowId);
      return;
    }

    await _supabase.from('child_milestones').insert({
      'child_id': childrenIdInt,
      ...payload,
    });
  }
}
