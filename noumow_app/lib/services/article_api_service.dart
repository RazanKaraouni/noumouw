import 'dart:convert';

import 'package:http/http.dart' as http;

import '../utils/api_timeouts.dart';
import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class ArticleApiException implements Exception {
  ArticleApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Fetches article HTML with Word/PDF/TXT content inlined by the backend.
class ArticleApiService {
  ArticleApiService({http.Client? client}) : _client = client ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Future<({String title, String bodyText})> fetchArticleBody(String resourceId) async {
    final id = resourceId.trim();
    if (id.isEmpty) {
      throw ArticleApiException('Missing article id.');
    }

    final res = await _client
        .get(
          Uri.parse('$_root/api/resources/articles/$id/body'),
          headers: authHeaders(json: true),
        )
        .timeout(kExtendedApiTimeout);

    if (res.statusCode != 200) {
      String message = 'Could not load article (${res.statusCode})';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw ArticleApiException(message, statusCode: res.statusCode);
    }

    final decoded = jsonDecode(res.body);
    if (decoded is! Map) {
      throw ArticleApiException('Invalid article response.');
    }

    return (
      title: (decoded['title'] ?? '').toString(),
      bodyText: (decoded['body_text'] ?? '').toString(),
    );
  }
}
