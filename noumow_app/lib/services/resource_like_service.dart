import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class ResourceLikeService {
  ResourceLikeService({SupabaseClient? supabase, http.Client? client})
      : _supabase = supabase ?? Supabase.instance.client,
        _client = client ?? createApiHttpClient();

  final SupabaseClient _supabase;
  final http.Client _client;

  String get _apiRoot => resolvedTherapistsApiBase();

  String? get _parentUserId => _supabase.auth.currentUser?.id;

  void _requireParentUserId() {
    if (_parentUserId == null) {
      throw Exception('Not signed in');
    }
  }

  Future<Map<String, bool>> fetchLikes(Iterable<String> resourceIds) async {
    _requireParentUserId();
    final parentUserId = _parentUserId!;

    final ids =
        resourceIds.map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    if (ids.isEmpty) return {};

    final rows = await _supabase
        .from('resource_likes')
        .select('resources_id')
        .eq('parent_user_id', parentUserId)
        .inFilter('resources_id', ids);

    final out = <String, bool>{for (final id in ids) id: false};
    for (final row in List<Map<String, dynamic>>.from(rows)) {
      final rid = (row['resources_id'] ?? '').toString();
      if (rid.isNotEmpty) out[rid] = true;
    }
    return out;
  }

  Future<bool> toggleLike(String resourceId) async {
    _requireParentUserId();

    final id = resourceId.trim();
    if (id.isEmpty) {
      throw Exception('Resource id is required.');
    }

    try {
      final res = await _client
          .post(
            Uri.parse('$_apiRoot/api/resources/$id/like'),
            headers: authHeaders(json: true),
          )
          .timeout(const Duration(seconds: 20));

      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map) {
          return decoded['liked'] == true;
        }
      }

      if (res.statusCode >= 400 && res.statusCode < 500) {
        String message = 'Could not update like (${res.statusCode})';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map && (decoded['message'] ?? '').toString().isNotEmpty) {
            message = decoded['message'].toString();
          }
        } catch (_) {}
        throw Exception(message);
      }
    } catch (e) {
      if (e is Exception && !e.toString().contains('SocketException')) {
        rethrow;
      }
    }

    return _toggleLikeDirect(id);
  }

  Future<bool> _toggleLikeDirect(String id) async {
    final parentUserId = _parentUserId!;

    final existing = await _supabase
        .from('resource_likes')
        .select('resource_like_id')
        .eq('resources_id', id)
        .eq('parent_user_id', parentUserId)
        .maybeSingle();

    if (existing != null) {
      await _supabase
          .from('resource_likes')
          .delete()
          .eq('resources_id', id)
          .eq('parent_user_id', parentUserId);
      return false;
    }

    await _supabase.from('resource_likes').insert({
      'resources_id': id,
      'parent_user_id': parentUserId,
    });
    return true;
  }
}
