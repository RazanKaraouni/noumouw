import 'package:flutter/foundation.dart';

import 'booking_api_service.dart';
import 'offline_cache_service.dart';

/// Tracks session fees and whether the parent paid before joining Zoom.
/// Appointment identifiers are stored in encrypted offline cache (not SharedPreferences).
class SessionPaymentService {
  SessionPaymentService._();

  static final SessionPaymentService instance = SessionPaymentService._();

  static const double sessionFeeUsd = 25.0;

  static const _joinedAppointmentKey = 'session_payment:joined_appointment_id';
  static const _paidIdsKey = 'session_payment:paid_appointment_ids';

  static bool amountMatchesFee(String raw) {
    final cleaned = raw.replaceAll(RegExp(r'[^\d.]'), '');
    final value = double.tryParse(cleaned);
    if (value == null) return false;
    return (value - sessionFeeUsd).abs() < 0.01;
  }

  Future<void> markJoinedSession(String appointmentId) async {
    final id = appointmentId.trim();
    if (id.isEmpty) return;
    await OfflineCacheService.instance.saveJson(_joinedAppointmentKey, id);
    debugPrint('[SessionPayment] joined session: $id');
  }

  Future<String?> joinedAppointmentId() async {
    final id = await OfflineCacheService.instance.readJson<String>(
      _joinedAppointmentKey,
    );
    final trimmed = id?.trim();
    return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  }

  Future<Set<String>> _paidIds() async {
    final list = await OfflineCacheService.instance.readJson<List<dynamic>>(
      _paidIdsKey,
    );
    if (list == null) return {};
    return list.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toSet();
  }

  Future<bool> isPaid(
    String appointmentId, {
    BookingApiService? bookingApi,
  }) async {
    final id = appointmentId.trim();
    if (id.isEmpty) return false;

    final api = bookingApi ?? BookingApiService();
    try {
      if (await api.fetchPaymentIsPaid(id)) {
        await _cachePaidLocally(id);
        return true;
      }
    } catch (e, st) {
      debugPrint('[SessionPayment] isPaid API failed: $e\n$st');
    }

    final paid = await _paidIds();
    return paid.contains(id);
  }

  Future<void> _cachePaidLocally(String appointmentId) async {
    final id = appointmentId.trim();
    if (id.isEmpty) return;
    final paid = await _paidIds()..add(id);
    await OfflineCacheService.instance.saveJson(_paidIdsKey, paid.toList());
    final joined = await joinedAppointmentId();
    if (joined == id) {
      await OfflineCacheService.instance.saveJson(_joinedAppointmentKey, '');
    }
  }

  Future<void> markPaid(
    String appointmentId, {
    BookingApiService? bookingApi,
  }) async {
    final id = appointmentId.trim();
    if (id.isEmpty) return;
    final api = bookingApi ?? BookingApiService();
    await api.submitSessionPayment(id, amount: sessionFeeUsd);
    await _cachePaidLocally(id);
  }
}
