import 'package:supabase_flutter/supabase_flutter.dart';

class ReportGeneratorService {
  ReportGeneratorService({SupabaseClient? client}) : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> generateLatestReportsForChild(String childId) async {
    final reports = <Map<String, dynamic>>[];
    final autism = await _buildLatestAutismScreeningReport(childId);
    if (autism != null) reports.add(autism);

    final milestone = await _buildMilestoneDelayReport(childId);
    if (milestone != null) reports.add(milestone);
    return reports;
  }

  Future<Map<String, dynamic>?> _buildLatestAutismScreeningReport(String childId) async {
    final latest = await _client
        .from('screening_results')
        .select('screening_results_id,score,risk_level,created_at')
        .eq('child_id', childId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (latest == null) return null;

    final risk = (latest['risk_level'] ?? '').toString();
    final normalizedRisk = _normalizeRisk(risk);
    switch (normalizedRisk) {
      case 'medium':
      case 'high':
        break;
      default:
        return null;
    }

    final scoreValue = latest['score'] ?? 0;
    final failedQuestions = await _findFailedAutismQuestions(childId);

    return {
      'type': 'autism_screening',
      'report_kind': 'clinical_summary',
      'report_id': latest['screening_results_id'],
      'created_at': latest['created_at'],
      'payload': {
        'score': scoreValue,
        'risk_level': risk,
        'failed_questions': failedQuestions,
      },
    };
  }

  Future<List<String>> _findFailedAutismQuestions(String childId) async {
    final latestWithResponses = await _client
        .from('screening_results')
        .select('responses')
        .eq('child_id', childId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    final responses = latestWithResponses?['responses'];
    if (responses is! Map) return <String>[];

    final questions = await _client
        .from('autism_questions')
        .select('autism_qs_id,question_number,question_text,fail_answer')
        .order('question_number', ascending: true);
    final out = <String>[];
    for (final row in List<Map<String, dynamic>>.from(questions)) {
      final num = (row['question_number'] ?? '').toString();
      final questionText = (row['question_text'] ?? '').toString();
      final failAnswer = (row['fail_answer'] ?? '').toString().trim();
      final resp = responses[num];
      if (resp is Map) {
        final answer = (resp['answer'] ?? '').toString().trim();
        if (answer == failAnswer && questionText.isNotEmpty) {
          out.add(questionText);
        }
      }
    }
    return out;
  }

  Future<Map<String, dynamic>?> _buildMilestoneDelayReport(String childId) async {
    final child = await _resolveChild(childId);
    if (child == null) return null;
    final childrenIdValue = child['children_id'];
    final ageMonths = _ageInMonths((child['date_of_birth'] ?? '').toString());

    final milestones = await _client
        .from('milestones')
        .select('milestones_id,title,domain,age_months_max')
        .lte('age_months_max', ageMonths);
    final all = List<Map<String, dynamic>>.from(milestones);
    if (all.isEmpty) return null;

    final childProgress = await _client
        .from('child_milestones')
        .select(
            'child_milestones_id,milestone_title,milestone_category,target_age_months,is_completed')
        .eq('child_id', childrenIdValue);
    final progressRows = List<Map<String, dynamic>>.from(childProgress);

    final delayed = <Map<String, dynamic>>[];
    for (final m in all) {
      final title = (m['title'] ?? '').toString();
      final domain = (m['domain'] ?? '').toString();
      final maxAge = (m['age_months_max'] as num?)?.toInt() ?? 0;
      Map<String, dynamic>? matched;
      for (final row in progressRows) {
        if ((row['milestone_title'] ?? '').toString() == title &&
            (row['milestone_category'] ?? '').toString() == domain &&
            ((row['target_age_months'] as num?)?.toInt() ?? 0) == maxAge) {
          matched = row;
          break;
        }
      }
      final done = matched?['is_completed'] == true;
      if (!done && ageMonths > maxAge) {
        delayed.add({
          'title': title,
          'category': domain,
          'max_age_months': maxAge,
          'child_age_months': ageMonths,
        });
      }
    }

    return {
      'type': 'milestone_delay',
      'report_kind': 'delay_detection',
      'created_at': DateTime.now().toIso8601String(),
      'payload': {
        'child_age_months': ageMonths,
        'delayed_items': delayed,
      },
    };
  }

  String _normalizeRisk(String raw) {
    final v = raw.trim().toLowerCase();
    switch (v) {
      case 'moderate':
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      default:
        return 'low';
    }
  }

  int _ageInMonths(String rawDob) {
    final dob = DateTime.tryParse(rawDob);
    if (dob == null) return 0;
    final now = DateTime.now();
    var months = (now.year - dob.year) * 12 + (now.month - dob.month);
    if (now.day < dob.day) months -= 1;
    return months < 0 ? 0 : months;
  }

  Future<Map<String, dynamic>?> _resolveChild(String childId) async {
    if (childId.trim().isEmpty) return null;
    final asInt = int.tryParse(childId.trim());
    if (asInt != null) {
      final byChildrenId = await _client
          .from('children')
          .select('children_id,child_id,date_of_birth')
          .eq('children_id', asInt)
          .maybeSingle();
      if (byChildrenId != null) return byChildrenId;
    }
    final byChildIdUuid = await _client
        .from('children')
        .select('children_id,child_id,date_of_birth')
        .eq('child_id', childId)
        .maybeSingle();
    return byChildIdUuid;
  }
}
