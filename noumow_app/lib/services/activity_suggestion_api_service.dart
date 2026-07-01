import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/activity_suggestion.dart';
import '../utils/api_timeouts.dart';
import '../utils/auth_headers.dart';
import '../utils/error_feedback.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class ActivitySuggestionApiException implements Exception {
  ActivitySuggestionApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ActivitySuggestionApiService {
  ActivitySuggestionApiService({http.Client? client})
      : _client = client ?? createApiHttpClient();

  final http.Client _client;
  static const Duration _timeout = kExtendedApiTimeout;

  String get _baseUrl => '${resolvedTherapistsApiBase()}/api';

  Future<Map<String, dynamic>> _postJson(
    String path,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('$_baseUrl$path');
    http.Response response;
    try {
      response = await _client
          .post(
            uri,
            headers: authHeaders(json: true),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw ActivitySuggestionApiException(kNetworkErrorKey);
    } on SocketException {
      throw ActivitySuggestionApiException(kNetworkErrorKey);
    } on http.ClientException {
      throw ActivitySuggestionApiException(kNetworkErrorKey);
    }

    Map<String, dynamic>? payload;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) payload = decoded;
    } catch (_) {}

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = payload?['message']?.toString() ??
          'Request failed (${response.statusCode}).';
      throw ActivitySuggestionApiException(sanitizeUserMessage(msg));
    }

    if (payload == null) {
      throw ActivitySuggestionApiException(kErrorOccurredKey);
    }

    return payload;
  }

  Future<String> explainAssignment({
    required int childId,
    required String question,
  }) async {
    final payload = await _postJson('/parent/activities/explain-assignment', {
      'child_id': childId,
      'question': question,
    });
    return payload['explanation']?.toString() ?? '';
  }

  /// General assistant chat — milestones, screening, assignments, domains, etc.
  Future<String> askAssistant({
    required int childId,
    required String question,
  }) async {
    final payload = await _postJson('/parent/activities/chat', {
      'child_id': childId,
      'question': question,
    });
    return payload['answer']?.toString() ?? '';
  }

  Future<ActivitySuggestionResponse> suggestActivity({
    required int childId,
    required String developmentGoal,
    required String mood,
    required String availableTime,
  }) async {
    final payload = await _postJson('/parent/activities/suggest', {
      'child_id': childId,
      'development_goal': developmentGoal,
      'mood': mood,
      'available_time': availableTime,
    });
    return ActivitySuggestionResponse.fromJson(payload);
  }

  void dispose() => _client.close();
}
