import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Deletes a child and all related records (milestones, screenings, caseload, etc.).
class ChildDeletionService {
  ChildDeletionService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  static int? childrenIdFrom(Map<String, dynamic> child) {
    final raw = child['children_id'] ?? child['child_id'];
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '');
  }

  Future<void> deleteChild({
    required int childrenId,
    required String parentId,
  }) async {
    try {
      await _supabase.rpc(
        'delete_child_and_related',
        params: {
          'p_children_id': childrenId,
          'p_parent_id': parentId,
        },
      );
      return;
    } catch (e) {
      debugPrint('delete_child_and_related RPC failed, falling back: $e');
    }

    await _supabase
        .from('children')
        .delete()
        .eq('children_id', childrenId)
        .eq('parent_id', parentId);
  }
}
