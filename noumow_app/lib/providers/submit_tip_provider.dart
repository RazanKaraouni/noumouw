import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../utils/auth_headers.dart';
import '../utils/error_feedback.dart';
import '../utils/therapists_api.dart';
import '../services/api_http_client.dart';
enum SubmitTipStatus { idle, submitting, success, error }

class SubmitTipNotifier extends ChangeNotifier {
  SubmitTipNotifier({http.Client? client}) : _client = client ?? createApiHttpClient();

  final http.Client _client;

  SubmitTipStatus status = SubmitTipStatus.idle;
  String? errorMessage;

  String get _root => resolvedTherapistsApiBase();

  Future<void> submit({
    required String title,
    required String content,
    required String category,
    String ageRange = 'all',
  }) async {
    status = SubmitTipStatus.submitting;
    errorMessage = null;
    notifyListeners();

    try {
      final headers = authHeaders(json: true);
      if (!headers.containsKey('Authorization')) {
        throw Exception('Please sign in first.');
      }

      final res = await _client
          .post(
            Uri.parse('$_root/api/tips'),
            headers: headers,
            body: jsonEncode({
              'title': title.trim(),
              'content': content.trim(),
              'category': category,
              'submitted_by_role': 'parent',
              'age_range': ageRange.trim(),
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (res.statusCode != 200 && res.statusCode != 201) {
        throw Exception(_parseErrorMessage(res));
      }

      status = SubmitTipStatus.success;
    } catch (e) {
      status = SubmitTipStatus.error;
      errorMessage = userFacingErrorMessage(e);
    }

    notifyListeners();
  }

  void reset() {
    status = SubmitTipStatus.idle;
    errorMessage = null;
    notifyListeners();
  }

  String _parseErrorMessage(http.Response res) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map && decoded['message'] is String) {
        return decoded['message'] as String;
      }
    } catch (_) {}
    return 'Could not submit tip (${res.statusCode}).';
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }
}
