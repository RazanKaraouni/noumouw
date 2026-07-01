import '../models/appointment_model.dart';

/// Statuses that mean the booking will not occur (deleted rows never reach the client).
bool isTerminalAppointmentStatus(String? raw) {
  final s = (raw ?? '').toString().toLowerCase().trim();
  return s == 'cancelled' || s == 'canceled' || s == 'deleted';
}

bool isCompletedAppointmentStatus(String? raw) {
  return (raw ?? '').toString().toLowerCase().trim() == 'completed';
}

DateTime _localToday([DateTime? now]) {
  final clock = now ?? DateTime.now();
  return DateTime(clock.year, clock.month, clock.day);
}

/// Calendar day of the appointment (local midnight), from appointment_date or availability.
DateTime? appointmentCalendarDay(Map<String, dynamic> a) {
  final rawDate = a['appointment_date']?.toString().trim();
  if (rawDate != null && rawDate.isNotEmpty) {
    final datePart = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    final parsed = DateTime.tryParse('${datePart}T00:00:00');
    if (parsed != null) return DateTime(parsed.year, parsed.month, parsed.day);
  }

  final start = appointmentStartDateTime(a);
  if (start != null) {
    return DateTime(start.year, start.month, start.day);
  }
  return null;
}

/// True when the appointment falls on today's local calendar date.
bool isAppointmentToday(Map<String, dynamic> a, [DateTime? now]) {
  final day = appointmentCalendarDay(a);
  if (day == null) return false;
  final today = _localToday(now);
  return day.year == today.year && day.month == today.month && day.day == today.day;
}

/// Cancellation must be requested strictly before the appointment calendar day.
bool isCancellationRequestDayValid(Map<String, dynamic> a, [DateTime? now]) {
  final appointmentDay = appointmentCalendarDay(a);
  if (appointmentDay == null) return true;

  final clock = now ?? DateTime.now();
  final today = DateTime(clock.year, clock.month, clock.day);
  return today.isBefore(appointmentDay);
}

const String cancellationTooLateMessage =
    'The cancellation request day must be before the appointment day by at least one day.';

bool _hasAvailabilityStartTime(Map<String, dynamic> a) {
  final availability = a['availability'];
  if (availability is! Map) return false;
  final rawStart = availability['start_time'];
  return rawStart != null && rawStart.toString().trim().isNotEmpty;
}

/// Hide cancelled/deleted appointments whose start time is already in the past.
bool shouldHidePastTerminalAppointment(Map<String, dynamic> a) {
  if (!isTerminalAppointmentStatus(a['status']?.toString())) return false;
  final start = appointmentStartDateTime(a);
  if (start == null) return false;
  return start.isBefore(DateTime.now());
}

/// Parent-visible appointments: upcoming bookings (used by home/dashboard, not booking list).
bool shouldShowUpcomingAppointment(Map<String, dynamic> a) {
  if (isCompletedAppointmentStatus(a['status']?.toString())) return false;
  if (shouldHidePastTerminalAppointment(a)) return false;

  final now = DateTime.now();
  if (!_hasAvailabilityStartTime(a)) {
    final day = appointmentCalendarDay(a);
    if (day != null) {
      final today = DateTime(now.year, now.month, now.day);
      return !today.isAfter(day);
    }
    return true;
  }

  final start = appointmentStartDateTime(a);
  if (start != null && !start.isAfter(now)) return false;

  return true;
}

/// Active statuses shown on Book Appointment (matches therapist appointments list).
bool isActiveAppointmentStatus(String? raw) {
  final status = (raw ?? '').toString().toLowerCase().trim();
  if (isCompletedAppointmentStatus(status)) return false;
  if (isTerminalAppointmentStatus(status)) return false;
  return status.isNotEmpty;
}

/// Parent booking page: all active appointments (pending, confirmed, etc.), including past dates.
List<Map<String, dynamic>> filterAppointmentsForMobile(
  Iterable<Map<String, dynamic>> rows,
) {
  return rows
      .where((a) {
        final status = (a['status'] ?? '').toString().toLowerCase().trim();
        if (!isActiveAppointmentStatus(status)) {
          return isTerminalAppointmentStatus(status) &&
              !shouldHidePastTerminalAppointment(a);
        }
        return true;
      })
      .map((a) => normalizeAppointmentMap(Map<String, dynamic>.from(a)))
      .toList();
}
