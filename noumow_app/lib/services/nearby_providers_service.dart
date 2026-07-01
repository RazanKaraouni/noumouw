import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/nearby_provider.dart';
import '../utils/api_timeouts.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class NearbyProvidersException implements Exception {
  NearbyProvidersException(this.statusCode, this.body);

  final int statusCode;
  final String body;

  @override
  String toString() => 'NearbyProvidersException($statusCode): $body';
}

/// Fetches clinics and therapists near a GPS coordinate from the Node API.
class NearbyProvidersService {
  NearbyProvidersService({http.Client? httpClient})
      : _client = httpClient ?? createApiHttpClient();

  final http.Client _client;

  String get _root => resolvedTherapistsApiBase();

  Future<NearbyProvidersResult> fetchNearby({
    required double lat,
    required double lng,
    double radiusKm = 25,
  }) async {
    final uri = Uri.parse('$_root/api/nearby-providers').replace(
      queryParameters: {
        'lat': lat.toString(),
        'lng': lng.toString(),
        'radiusKm': radiusKm.toString(),
      },
    );

    final timeout = kStandardApiTimeout;
    Object? lastError;

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final res = await _client.get(uri).timeout(timeout);
        if (res.statusCode != 200) {
          throw NearbyProvidersException(res.statusCode, res.body);
        }

        final decoded = jsonDecode(res.body) as Map<String, dynamic>;
        return NearbyProvidersResult.fromJson(decoded);
      } on Exception catch (e) {
        lastError = e;
        if (attempt == 0) {
          await Future<void>.delayed(const Duration(seconds: 1));
        }
      }
    }

    throw lastError ?? Exception('Failed to load nearby providers');
  }
}
