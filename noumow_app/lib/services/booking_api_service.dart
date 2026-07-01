import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/appointment_model.dart';
import '../utils/auth_headers.dart';
import '../utils/api_timeouts.dart';
import '../utils/error_feedback.dart';
import '../utils/therapists_api.dart';
import 'offline_cache_service.dart';

import 'api_http_client.dart';

/// Parent booking against the dashboard Node API (uses Supabase session JWT).
class BookingApiService {
  BookingApiService({http.Client? httpClient})
      : _client = httpClient ?? createApiHttpClient();

  final http.Client _client;

  String get _root {
    return resolvedTherapistsApiBase();
  }

  Uri _u(String path, [Map<String, String>? query]) {
    return Uri.parse('$_root$path').replace(queryParameters: query);
  }

  Map<String, String> _jsonHeaders() => authHeaders(json: true);

  Future<List<String>> fetchAllAvailableDates() async {
    const cacheKey = 'booking:dates:all';
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    final uri = _u('/api/booking/available-dates-all');
    try {
      final res = await _client.get(uri).timeout(kStandardApiTimeout);
      switch (res.statusCode) {
        case 200:
          final list = jsonDecode(res.body) as List<dynamic>;
          await OfflineCacheService.instance.saveJson(cacheKey, list);
          return list.map((e) => e.toString()).toList();
        default:
          if (cached != null) {
            return cached.map((e) => e.toString()).toList();
          }
          throw BookingApiException(res.statusCode, res.body);
      }
    } catch (_) {
      if (cached != null) {
        return cached.map((e) => e.toString()).toList();
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchAllSlotsForDate({
    required String slotDate,
  }) async {
    final cacheKey = 'booking:slots:all:$slotDate';
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    final uri = _u('/api/booking/availability-all', {'date': slotDate});
    try {
      final res = await _client.get(uri).timeout(kStandardApiTimeout);
      switch (res.statusCode) {
        case 200:
          final list = jsonDecode(res.body) as List<dynamic>;
          await OfflineCacheService.instance.saveJson(cacheKey, list);
          return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        default:
          if (cached != null) {
            return cached
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          }
          throw BookingApiException(res.statusCode, res.body);
      }
    } catch (_) {
      if (cached != null) {
        return cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      rethrow;
    }
  }

  Future<List<String>> fetchAvailableDates(String therapistId) async {
    final cacheKey = 'booking:dates:$therapistId';
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    final today = DateTime.now();
    final from =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final uri = _u('/api/booking/available-dates', {
      'therapist_id': therapistId,
      'from': from,
    });
    try {
      final res = await _client.get(uri).timeout(kStandardApiTimeout);
      switch (res.statusCode) {
        case 200:
          final list = jsonDecode(res.body) as List<dynamic>;
          await OfflineCacheService.instance.saveJson(cacheKey, list);
          return list.map((e) => e.toString()).toList();
        default:
          if (cached != null) {
            return cached.map((e) => e.toString()).toList();
          }
          throw BookingApiException(res.statusCode, res.body);
      }
    } catch (_) {
      if (cached != null) {
        return cached.map((e) => e.toString()).toList();
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchSlotsForDate({
    required String therapistId,
    required String slotDate,
  }) async {
    final cacheKey = 'booking:slots:$therapistId:$slotDate';
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    final uri = _u('/api/booking/availability', {
      'therapist_id': therapistId,
      'date': slotDate,
    });
    try {
      final res = await _client.get(uri).timeout(kStandardApiTimeout);
      switch (res.statusCode) {
        case 200:
          final list = jsonDecode(res.body) as List<dynamic>;
          await OfflineCacheService.instance.saveJson(cacheKey, list);
          return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        default:
          if (cached != null) {
            return cached
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          }
          throw BookingApiException(res.statusCode, res.body);
      }
    } catch (_) {
      if (cached != null) {
        return cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchMyAppointments() async {
    final headers = _jsonHeaders();
    if (!headers.containsKey('Authorization')) {
      return [];
    }
    final res = await _client
        .get(_u('/api/booking/appointments'), headers: headers)
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        final list = jsonDecode(res.body) as List<dynamic>;
        return list
            .map((e) => normalizeAppointmentMap(Map<String, dynamic>.from(e as Map)))
            .toList();
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }

  /// Includes completed appointments (excluded from [fetchMyAppointments]).
  Future<Map<String, dynamic>?> fetchAppointmentById(String appointmentsId) async {
    final id = appointmentsId.trim();
    if (id.isEmpty) return null;
    final headers = _jsonHeaders();
    if (!headers.containsKey('Authorization')) return null;
    final res = await _client
        .get(_u('/api/booking/appointments/$id'), headers: headers)
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        return normalizeAppointmentMap(
          Map<String, dynamic>.from(jsonDecode(res.body) as Map),
        );
      case 404:
        return null;
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }

  /// Parent cancels a **pending** appointment immediately (status → cancelled).
  Future<void> cancelPendingAppointment(String appointmentsId) async {
    final id = appointmentsId.trim();
    if (id.isEmpty) {
      throw BookingApiException(400, 'appointments_id is required.');
    }
    final headers = _jsonHeaders();
    final auth = headers['Authorization']?.trim() ?? '';
    if (auth.isEmpty || !auth.startsWith('Bearer ')) {
      throw BookingApiException(401, 'Sign in required.');
    }
    final res = await _client
        .patch(
          _u('/api/booking/appointments/$id'),
          headers: headers,
          body: jsonEncode({'status': 'cancelled'}),
        )
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        return;
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }

  Future<void> requestAppointmentCancellation(String appointmentsId) async {
    final id = appointmentsId.trim();
    if (id.isEmpty) {
      throw BookingApiException(400, 'appointments_id is required.');
    }
    if (!_jsonHeaders().containsKey('Authorization')) {
      throw BookingApiException(401, 'Sign in required.');
    }
    final res = await _client
        .patch(
          _u('/api/booking/appointments/$id/cancel-request'),
          headers: _jsonHeaders(),
        )
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        return;
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }

  Future<bool> fetchPaymentIsPaid(String appointmentId) async {
    final status = await fetchPaymentStatus(appointmentId);
    return status?['is_paid'] == true;
  }

  Future<Map<String, dynamic>?> fetchPaymentStatus(String appointmentId) async {
    final id = appointmentId.trim();
    if (id.isEmpty) return null;
    if (!_jsonHeaders().containsKey('Authorization')) return null;
    final res = await _client
        .get(_u('/api/booking/payments/$id'), headers: _jsonHeaders())
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
      case 404:
        return null;
      default:
        return null;
    }
  }

  Future<void> submitSessionPayment(
    String appointmentId, {
    required double amount,
  }) async {
    final id = appointmentId.trim();
    if (id.isEmpty) {
      throw BookingApiException(400, 'appointments_id is required.');
    }
    if (!_jsonHeaders().containsKey('Authorization')) {
      throw BookingApiException(401, 'Sign in required.');
    }
    final res = await _client
        .post(
          _u('/api/booking/payments/$id/pay'),
          headers: _jsonHeaders(),
          body: jsonEncode({'amount': amount}),
        )
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 200:
        return;
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }

  Future<String> bookSlot(
    String availabilityId, {
    String? notes,
    String? childrenId,
  }) async {
    if (!_jsonHeaders().containsKey('Authorization')) {
      throw BookingApiException(401, 'Sign in required.');
    }
    final childId = childrenId?.trim() ?? '';
    if (childId.isEmpty) {
      throw BookingApiException(400, 'child_id is required.');
    }
    final res = await _client
        .post(
          _u('/api/booking/appointments'),
          headers: _jsonHeaders(),
          body: jsonEncode({
            'availability_id': availabilityId,
            'child_id': childId,
            'children_id': childId,
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          }),
        )
        .timeout(kStandardApiTimeout);
    switch (res.statusCode) {
      case 201:
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        return (map['appointments_id'] ?? map['appointment_id'] ?? '')
            .toString();
      default:
        throw BookingApiException(res.statusCode, res.body);
    }
  }
}

class BookingApiException implements Exception {
  BookingApiException(this.statusCode, this.body);
  final int statusCode;
  final String body;

  String get message {
    try {
      final m = jsonDecode(body);
      if (m is Map && m['message'] != null) {
        return sanitizeUserMessage(m['message'].toString());
      }
    } catch (_) {}
    final fallback = body.isEmpty ? 'Request failed ($statusCode)' : body;
    return sanitizeUserMessage(fallback);
  }

  @override
  String toString() => message;
}
