class ParentingTip {
  final String tipId;
  final String title;
  final String content;
  final String category; // 'emotional_regulation' | 'communication' | 'routines' | 'general'
  final String? ageRange;
  final String? exampleBefore;
  final String? exampleAfter;
  final DateTime createdAt;

  const ParentingTip({
    required this.tipId,
    required this.title,
    required this.content,
    required this.category,
    this.ageRange,
    this.exampleBefore,
    this.exampleAfter,
    required this.createdAt,
  });

  bool get hasExamples =>
      (exampleBefore?.trim().isNotEmpty ?? false) ||
      (exampleAfter?.trim().isNotEmpty ?? false);

  factory ParentingTip.fromJson(Map<String, dynamic> json) => ParentingTip(
        tipId: (json['tip_id'] ?? json['id'] ?? '').toString(),
        title: (json['title'] ?? '').toString(),
        content: (json['content'] ?? '').toString(),
        category: (json['category'] ?? 'general').toString(),
        ageRange: _parseOptionalString(json['age_range']),
        exampleBefore: _parseOptionalString(json['example_before']),
        exampleAfter: _parseOptionalString(json['example_after']),
        createdAt: json['created_at'] != null
            ? DateTime.parse(json['created_at'].toString())
            : DateTime.now(),
      );

  static String? _parseOptionalString(dynamic raw) {
    if (raw == null) return null;
    final text = raw.toString().trim();
    return text.isEmpty ? null : text;
  }
}
