import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/child_assignment.dart';

class AssignmentsApiException implements Exception {
  AssignmentsApiException(this.statusCode, this.body);
  final int statusCode;
  final String body;

  String get message => body.isEmpty ? 'Request failed ($statusCode)' : body;

  @override
  String toString() => message;
}

/// Loads therapist assignments for a child via Supabase (same session as milestones/children).
class AssignmentsApiService {
  AssignmentsApiService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  static const _selectColumns =
      'assignment_id, child_id, title, description, domain, status, '
      'parent_notes, therapist_reply, due_date, priority, created_at, '
      'therapists(full_name)';

  int? _parseChildId(String childId) {
    final trimmed = childId.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed);
  }

  Map<String, dynamic> _mapRow(Map<String, dynamic> row) {
    final therapist = row['therapists'];
    String? therapistName;
    if (therapist is Map) {
      therapistName = therapist['full_name']?.toString();
    }
    return {
      'assignment_id': row['assignment_id'],
      'activity_title': row['title'],
      'title': row['title'],
      'description': row['description'],
      'domain': row['domain'],
      'status': row['status'],
      'due_date': row['due_date'],
      'priority': row['priority'],
      'parent_notes': row['parent_notes'],
      'therapist_reply': row['therapist_reply'],
      'therapist_name': therapistName ?? 'Therapist',
    };
  }

  Future<ChildAssignment> saveParentNotes(
    String assignedActivityId,
    String? notes,
  ) async {
    final id = assignedActivityId.trim();
    if (id.isEmpty) {
      throw AssignmentsApiException(400, 'assigned_activity_id is required.');
    }
    if (_supabase.auth.currentUser == null) {
      throw AssignmentsApiException(401, 'Sign in required.');
    }

    final trimmed = notes?.trim();
    final payload = trimmed == null || trimmed.isEmpty
        ? <String, dynamic>{'parent_notes': null}
        : <String, dynamic>{'parent_notes': trimmed};

    try {
      final row = await _supabase
          .from('assignments')
          .update(payload)
          .eq('assignment_id', id)
          .select(_selectColumns)
          .maybeSingle();

      if (row == null) {
        throw AssignmentsApiException(404, 'Assignment not found.');
      }

      return ChildAssignment.fromJson(
        _mapRow(Map<String, dynamic>.from(row)),
      );
    } on PostgrestException catch (e) {
      throw AssignmentsApiException(
        int.tryParse(e.code ?? '') ?? 500,
        e.message,
      );
    }
  }

  Future<List<ChildAssignment>> fetchAssignmentsForChild(String childId) async {
    final id = _parseChildId(childId);
    if (id == null) {
      throw AssignmentsApiException(400, 'Invalid child id.');
    }
    if (_supabase.auth.currentUser == null) {
      throw AssignmentsApiException(401, 'Sign in required.');
    }

    try {
      final rows = await _supabase
          .from('assignments')
          .select(_selectColumns)
          .eq('child_id', id)
          .order('created_at', ascending: false);

      return rows
          .map((e) => ChildAssignment.fromJson(
              _mapRow(Map<String, dynamic>.from(e))))
          .where((a) => a.assignedActivityId.isNotEmpty)
          .toList();
    } on PostgrestException catch (e) {
      throw AssignmentsApiException(
        int.tryParse(e.code ?? '') ?? 500,
        e.message,
      );
    }
  }

  Future<ChildAssignment> markAssignmentComplete(String assignedActivityId) async {
    final id = assignedActivityId.trim();
    if (id.isEmpty) {
      throw AssignmentsApiException(400, 'assigned_activity_id is required.');
    }
    if (_supabase.auth.currentUser == null) {
      throw AssignmentsApiException(401, 'Sign in required.');
    }

    try {
      final row = await _supabase
          .from('assignments')
          .update({'status': 'completed'})
          .eq('assignment_id', id)
          .select(_selectColumns)
          .maybeSingle();

      if (row == null) {
        throw AssignmentsApiException(404, 'Assignment not found.');
      }

      return ChildAssignment.fromJson(
        _mapRow(Map<String, dynamic>.from(row)),
      );
    } on PostgrestException catch (e) {
      throw AssignmentsApiException(
        int.tryParse(e.code ?? '') ?? 500,
        e.message,
      );
    }
  }
}
