class ActivitySuggestion {
  const ActivitySuggestion({
    required this.title,
    required this.instructions,
    required this.domain,
    required this.estimatedMinutes,
    this.whyThisActivity,
  });

  final String title;
  final String instructions;
  final String domain;
  final int estimatedMinutes;
  final String? whyThisActivity;

  factory ActivitySuggestion.fromJson(Map<String, dynamic> json) {
    return ActivitySuggestion(
      title: json['title']?.toString() ?? '',
      instructions: json['instructions']?.toString() ?? '',
      domain: json['domain']?.toString() ?? '',
      estimatedMinutes: (json['estimated_minutes'] as num?)?.toInt() ?? 0,
      whyThisActivity: json['why_this_activity']?.toString(),
    );
  }
}

class ActivitySuggestionResponse {
  const ActivitySuggestionResponse({
    required this.activity,
    required this.resolvedDomain,
    this.ageMonths,
    this.overdueCount,
    this.latestRiskLevel,
  });

  final ActivitySuggestion activity;
  final String resolvedDomain;
  final int? ageMonths;
  final int? overdueCount;
  final String? latestRiskLevel;

  factory ActivitySuggestionResponse.fromJson(Map<String, dynamic> json) {
    final summary = json['context_summary'];
    return ActivitySuggestionResponse(
      activity: ActivitySuggestion.fromJson(
        Map<String, dynamic>.from(json['activity'] as Map? ?? {}),
      ),
      resolvedDomain: json['resolved_domain']?.toString() ?? '',
      ageMonths: summary is Map ? (summary['age_months'] as num?)?.toInt() : null,
      overdueCount:
          summary is Map ? (summary['overdue_count'] as num?)?.toInt() : null,
      latestRiskLevel:
          summary is Map ? summary['latest_risk_level']?.toString() : null,
    );
  }
}
