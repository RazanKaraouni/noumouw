class ChildAssignment {
  const ChildAssignment({
    required this.assignedActivityId,
    required this.activityTitle,
    required this.therapistName,
    required this.status,
    this.description,
    this.domain,
    this.dueDate,
    this.priority,
    this.parentNotes,
    this.therapistReply,
  });

  final String assignedActivityId;
  final String activityTitle;
  final String therapistName;
  final String status;
  final String? description;
  final String? domain;
  final String? dueDate;
  final String? priority;
  final String? parentNotes;
  final String? therapistReply;

  bool get isCompleted => status.toLowerCase() == 'completed';
  bool get isPending => status.toLowerCase() == 'pending';
  bool get hasParentNotes =>
      parentNotes != null && parentNotes!.trim().isNotEmpty;
  bool get hasTherapistReply =>
      therapistReply != null && therapistReply!.trim().isNotEmpty;

  String get statusLabel {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'incomplete':
        return 'Incomplete';
      default:
        return 'Pending';
    }
  }

  factory ChildAssignment.fromJson(Map<String, dynamic> json) {
    final id = (json['assigned_activity_id'] ??
            json['assignment_id'] ??
            json['id'] ??
            '')
        .toString()
        .trim();
    final title = (json['activity_title'] ?? json['title'] ?? 'Activity')
        .toString()
        .trim();
    final therapist = (json['therapist_name'] ?? 'Therapist').toString().trim();
    final status = (json['status'] ?? 'pending').toString().trim().toLowerCase();
    String? textOrNull(dynamic v) {
      final s = v?.toString().trim();
      return s == null || s.isEmpty ? null : s;
    }

    return ChildAssignment(
      assignedActivityId: id,
      activityTitle: title.isEmpty ? 'Activity' : title,
      therapistName: therapist.isEmpty ? 'Therapist' : therapist,
      status: status,
      description: textOrNull(json['description']),
      domain: textOrNull(json['domain']),
      dueDate: textOrNull(json['due_date']),
      priority: textOrNull(json['priority']),
      parentNotes: textOrNull(json['parent_notes']),
      therapistReply: textOrNull(json['therapist_reply']),
    );
  }

  ChildAssignment copyWith({
    String? status,
    String? parentNotes,
    String? therapistReply,
  }) {
    return ChildAssignment(
      assignedActivityId: assignedActivityId,
      activityTitle: activityTitle,
      therapistName: therapistName,
      status: status ?? this.status,
      description: description,
      domain: domain,
      dueDate: dueDate,
      priority: priority,
      parentNotes: parentNotes ?? this.parentNotes,
      therapistReply: therapistReply ?? this.therapistReply,
    );
  }
}
