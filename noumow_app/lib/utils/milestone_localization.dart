import 'package:easy_localization/easy_localization.dart';

import 'milestone_question_text.dart';

String _lookup(String key, String fallback) {
  if (!trExists(key)) return fallback;
  return key.tr();
}

int? milestoneIdFromRow(Map<String, dynamic> row) {
  final raw = row['milestones_id'] ?? row['milestone_id'];
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  return int.tryParse(raw?.toString() ?? '');
}

String localizedMilestoneTitle(int milestoneId, String fallback) {
  return _lookup('milestone_${milestoneId}_title', fallback.trim());
}

String localizedMilestoneTitleFromRow(Map<String, dynamic> row) {
  final title = (row['title'] ?? row['milestone_title'] ?? '').toString();
  final id = milestoneIdFromRow(row);
  if (id != null) return localizedMilestoneTitle(id, title);
  return localizedMilestoneTitleByText(title);
}

String localizedMilestoneTitleByText(String title) {
  final normalized = title.trim().toLowerCase();
  if (normalized.isEmpty) return title;
  return _lookup('milestone_title_$normalized', title.trim());
}

String localizedMilestoneDescription(int milestoneId, String fallback) {
  final trimmed = fallback.trim();
  if (trimmed.isEmpty) return '';
  return _lookup('milestone_${milestoneId}_description', trimmed);
}

String localizedMilestoneDescriptionFromRow(Map<String, dynamic> row) {
  final description =
      (row['description'] ?? row['milestone_description'] ?? '').toString();
  final id = milestoneIdFromRow(row);
  if (id != null) return localizedMilestoneDescription(id, description);
  return description.trim();
}

String localizedMilestoneQuestion(int milestoneId, String titleFallback) {
  final fallback = formatMilestoneQuestion(titleFallback);
  return _lookup('milestone_${milestoneId}_question', fallback);
}

String localizedMilestoneQuestionFromRow(Map<String, dynamic> row) {
  final title = (row['title'] ?? row['milestone_title'] ?? '').toString();
  final id = milestoneIdFromRow(row);
  if (id != null) return localizedMilestoneQuestion(id, title);
  final fallback = formatMilestoneQuestion(title);
  return _lookup(
    'milestone_question_${title.trim().toLowerCase()}',
    fallback,
  );
}

String localizedMilestoneDomain(String domain) {
  final normalized = domain.trim().toLowerCase();
  if (normalized.isEmpty) return domain;
  return _lookup('milestone_domain_$normalized', domain);
}

String localizedMilestoneCategory(String category) {
  final normalized = category.trim().toLowerCase();
  if (normalized.isEmpty) return category;
  final domainKey = 'milestone_domain_$normalized';
  if (trExists(domainKey)) return domainKey.tr();
  return _lookup('milestone_category_$normalized', category);
}
