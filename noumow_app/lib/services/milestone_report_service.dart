import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:easy_localization/easy_localization.dart';

import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class MilestoneReportService {
  MilestoneReportService({http.Client? client})
      : _client = client ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Uri _uri(String childId) => Uri.parse('$_root/api/reports/$childId');

  Future<Map<String, dynamic>> fetchReport(String childId) async {
    final response = await _client.get(
      _uri(childId),
      headers: authHeaders(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MilestoneReportException(
        response.statusCode,
        _extractError(response.body, 'milestone_report_load_error'.tr()),
      );
    }
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw const MilestoneReportException(500, 'Unexpected report response.');
  }

  String _extractError(String body, String fallback) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message']?.toString();
        if (message != null && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return fallback;
  }
}

class MilestoneReportException implements Exception {
  const MilestoneReportException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}
