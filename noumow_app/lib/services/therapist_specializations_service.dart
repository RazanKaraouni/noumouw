import 'dart:convert';

import 'package:http/http.dart' as http;

import '../utils/api_timeouts.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';

class TherapistSpecialization {
  const TherapistSpecialization({
    required this.id,
    required this.name,
    this.description,
  });

  final int id;
  final String name;
  final String? description;

  factory TherapistSpecialization.fromJson(Map<String, dynamic> json) {
    return TherapistSpecialization(
      id: (json['specialization_id'] as num).toInt(),
      name: (json['specialization_name'] ?? '').toString(),
      description: json['description']?.toString(),
    );
  }
}

class TherapistSpecializationsService {
  TherapistSpecializationsService({http.Client? client})
      : _client = client ?? createApiHttpClient();

  final http.Client _client;
  static Duration get _timeout => kStandardApiTimeout;

  Future<List<TherapistSpecialization>> fetchAll() async {
    final uri = Uri.parse('${resolvedTherapistsApiBase()}/api/specializations');
    final response =
        await _client.get(uri).timeout(_timeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Unable to load specializations.');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) return [];

    return decoded
        .whereType<Map<String, dynamic>>()
        .map(TherapistSpecialization.fromJson)
        .where((s) => s.name.trim().isNotEmpty)
        .toList();
  }
}
