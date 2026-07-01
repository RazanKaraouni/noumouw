import 'package:easy_localization/easy_localization.dart';

import '../models/appointment_model.dart';

String appointmentTherapistName(
  Map<String, dynamic> appointment, {
  String? fallback,
}) {
  final resolvedFallback =
      fallback ?? 'appointment_therapist_default'.tr();
  final therapist = appointment['therapists'] as Map<String, dynamic>?;
  if (therapist != null) {
    final name = (therapist['full_name'] ?? '').toString().trim();
    if (name.isNotEmpty) return name;
  }
  return resolvedFallback;
}

String appointmentTherapistRole(Map<String, dynamic> appointment) {
  final therapist = appointment['therapists'] as Map<String, dynamic>?;
  final role = (therapist?['profession'] ?? '').toString().trim();
  if (role.isEmpty) return 'appointment_therapist_default'.tr();
  return role;
}

String formatRelativeSessionDay(DateTime? start) {
  if (start == null) return '—';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final sessionDay = DateTime(start.year, start.month, start.day);
  final diff = sessionDay.difference(today).inDays;
  if (diff == 0) return 'home_upcoming_today'.tr();
  if (diff == 1) return 'home_upcoming_tomorrow'.tr();
  return '${start.year}-${start.month.toString().padLeft(2, '0')}-${start.day.toString().padLeft(2, '0')}';
}

String formatSessionHm(DateTime? dt) {
  if (dt == null) return '—';
  final h = dt.hour;
  final m = dt.minute.toString().padLeft(2, '0');
  final ap = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12;
  if (h12 == 0) h12 = 12;
  return '$h12:$m $ap';
}

DateTime? sessionTimeFromAppointment(
  Map<String, dynamic> appointment, {
  required bool isEnd,
}) {
  return isEnd
      ? appointmentEndDateTime(appointment)
      : appointmentStartDateTime(appointment);
}
