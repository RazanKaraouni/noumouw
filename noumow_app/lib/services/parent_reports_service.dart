import 'dart:convert';

import 'package:http/http.dart' as http;

import '../utils/api_timeouts.dart';
import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class ParentReportsService {
  ParentReportsService({http.Client? client}) : _client = client ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Future<List<Map<String, dynamic>>> fetchReportHistory() async {
    final res = await _client
        .get(
          Uri.parse('$_root/api/reports/history'),
          headers: authHeaders(json: true),
        )
        .timeout(kStandardApiTimeout);

    if (res.statusCode != 200) {
      String message = 'Could not load reports (${res.statusCode})';
      try {
        final body = jsonDecode(res.body);
        if (body is Map && body['message'] is String) {
          message = body['message'] as String;
        }
      } catch (_) {}
      throw Exception(message);
    }

    final decoded = jsonDecode(res.body);
    if (decoded is! Map) return [];
    final rows = decoded['reports'];
    if (rows is! List) return [];
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
