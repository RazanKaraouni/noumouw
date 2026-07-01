import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/offline_cache_service.dart';
import '../services/api_http_client.dart';
import 'api_timeouts.dart';
import 'auth_headers.dart';
import 'therapists_api.dart';

const _cacheKey = 'therapists:directory:v1';
Duration get _backendProbeTimeout => kStandardApiTimeout;
const _supabaseTimeout = Duration(seconds: 8);

final http.Client _apiHttpClient = createApiHttpClient();

String _normalizedApiBase() {
  return resolvedTherapistsApiBase();
}

List<Map<String, dynamic>> _normalizeRows(dynamic decoded) {
  if (decoded is List) {
    return decoded
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  if (decoded is Map) {
    final data = decoded['data'];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
  }
  return <Map<String, dynamic>>[];
}

Future<List<Map<String, dynamic>>?> readCachedTherapistsDirectory() async {
  final cached =
      await OfflineCacheService.instance.readJson<List<dynamic>>(_cacheKey);
  if (cached == null || cached.isEmpty) return null;
  return cached
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

Future<void> _persistDirectory(List<Map<String, dynamic>> rows) async {
  if (rows.isEmpty) return;
  await OfflineCacheService.instance.saveJson(_cacheKey, rows);
}

Future<List<Map<String, dynamic>>?> _fetchFromBackend() async {
  final uri = Uri.parse('${_normalizedApiBase()}/api/therapists-directory');
  final response = await _apiHttpClient
      .get(uri, headers: authHeaders())
      .timeout(_backendProbeTimeout);
  if (response.statusCode != 200) {
    throw Exception('Directory API failed (${response.statusCode}).');
  }
  return _normalizeRows(jsonDecode(response.body));
}

Future<List<Map<String, dynamic>>?> _fetchFromSupabase(
  SupabaseClient supabase,
) async {
  final data = await supabase
      .from('therapists')
      .select(
        'therapist_id, full_name, email, profession, bio, phone, address, years_of_experience, profile_image_url, created_at',
      )
      .order('created_at', ascending: false)
      .timeout(_supabaseTimeout);
  return List<Map<String, dynamic>>.from(data);
}

/// Loads therapist directory from backend API and Supabase in parallel.
/// Uses cache for instant UI; prefers the first non-empty successful source.
Future<List<Map<String, dynamic>>> fetchTherapistsDirectory(
  SupabaseClient supabase,
) async {
  List<Map<String, dynamic>>? backendRows;
  List<Map<String, dynamic>>? supabaseRows;
  Object? backendErr;
  Object? supabaseErr;

  await Future.wait([
    _fetchFromBackend().then((v) => backendRows = v).catchError((e) {
      backendErr = e;
      return <Map<String, dynamic>>[];
    }),
    _fetchFromSupabase(supabase).then((v) => supabaseRows = v).catchError((e) {
      supabaseErr = e;
      return <Map<String, dynamic>>[];
    }),
  ]);

  final merged = (backendRows != null && backendRows!.isNotEmpty)
      ? backendRows!
      : (supabaseRows != null && supabaseRows!.isNotEmpty)
          ? supabaseRows!
          : backendRows ?? supabaseRows ?? <Map<String, dynamic>>[];

  if (merged.isNotEmpty) {
    await _persistDirectory(merged);
    return merged;
  }

  if (backendErr != null && supabaseErr != null) {
    throw Exception(
      'Could not load therapists (${backendErr ?? supabaseErr}).',
    );
  }

  return merged;
}

/// Searches therapists by name, profession, or email (no full-directory fetch).
Future<List<Map<String, dynamic>>> searchTherapistsDirectory(
  SupabaseClient supabase,
  String query, {
  int limit = 20,
}) async {
  final trimmed = query.trim();
  if (trimmed.isEmpty) return [];

  final escaped = trimmed.replaceAll('%', '').replaceAll('_', '');
  if (escaped.isEmpty) return [];

  final pattern = '%$escaped%';
  final data = await supabase
      .from('therapists')
      .select(
        'therapist_id, full_name, email, profession, bio, phone, address, years_of_experience, profile_image_url, created_at',
      )
      .or(
        'full_name.ilike.$pattern,profession.ilike.$pattern,email.ilike.$pattern',
      )
      .order('full_name', ascending: true)
      .limit(limit)
      .timeout(_supabaseTimeout);

  return List<Map<String, dynamic>>.from(data);
}
