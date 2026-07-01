import 'dart:convert';

import 'package:http/http.dart' as http;

import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

/// User-facing content flags (resource, post, comment, tip).
class ModerationReportService {
  ModerationReportService({http.Client? client})
      : _client = client ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Future<Map<String, dynamic>> submitReport({
    required String targetType,
    required String reason,
    String? resourceId,
    String? postId,
    String? commentId,
    String? tipId,
  }) async {
    final body = <String, dynamic>{
      'target_type': targetType,
      'reason': reason.trim(),
    };
    if (resourceId != null) body['resource_id'] = resourceId;
    if (postId != null) body['post_id'] = postId;
    if (commentId != null) body['comment_id'] = commentId;
    if (tipId != null) body['tip_id'] = tipId;

    final response = await _client.post(
      Uri.parse('$_root/api/reports/submit'),
      headers: authHeaders(json: true),
      body: jsonEncode(body),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ModerationReportException(
        response.statusCode,
        _extractError(response.body, 'Could not submit report.'),
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw const ModerationReportException(500, 'Unexpected report response.');
  }

  String _extractError(String body, String fallback) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final err = decoded['error']?.toString();
        if (err != null && err.trim().isNotEmpty) return err;
        final message = decoded['message']?.toString();
        if (message != null && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return fallback;
  }
}

class ModerationReportException implements Exception {
  const ModerationReportException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ModerationReportException($statusCode): $message';
}
