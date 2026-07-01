import 'dart:convert';

import 'package:http/http.dart' as http;

import '../utils/api_timeouts.dart';
import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class NotificationApiService {
  NotificationApiService({http.Client? client}) : _client = client ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Future<List<Map<String, dynamic>>> fetchMine() async {
    final res = await _client
        .get(
          Uri.parse('$_root/api/notifications/mine'),
          headers: authHeaders(json: true),
        )
        .timeout(kStandardApiTimeout);
    if (res.statusCode != 200) {
      throw Exception('Notifications failed (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Marks notifications as cleared in the database (rows are kept).
  Future<int> clearMine({List<String>? ids}) async {
    final body = ids != null && ids.isNotEmpty ? jsonEncode({'ids': ids}) : '{}';
    final res = await _client
        .post(
          Uri.parse('$_root/api/notifications/clear'),
          headers: authHeaders(json: true),
          body: body,
        )
        .timeout(kStandardApiTimeout);
    if (res.statusCode != 200) {
      throw Exception('Clear notifications failed (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is Map && decoded['cleared'] is int) {
      return decoded['cleared'] as int;
    }
    if (decoded is Map && decoded['cleared'] is num) {
      return (decoded['cleared'] as num).toInt();
    }
    return 0;
  }
}
