import 'dart:convert';

/// Safely inspects condition patterns to discover if a telehealth card is active
bool isAppointmentSessionLive(Map<String, dynamic> appointment) {
  // Check the explicit live flag activated from the therapist's terminal view
  final bool therapistStarted = appointment['is_started'] == true;
  
  // Safely grab structural text fields
  final String joinUrl = (appointment['zoom_join_url'] ?? appointment['zoomJoinUrl'] ?? '').toString().trim();
  if (joinUrl.isEmpty) return false;

  return therapistStarted;
}

DateTime? appointmentStartDateTime(Map<String, dynamic> appointment) {
  final rawDate = appointment['appointment_date']?.toString().trim();
  if (rawDate == null || rawDate.isEmpty) return null;
  
  final avail = appointment['availability'] as Map<String, dynamic>?;
  final rawTime = avail?['start_time']?.toString().trim();
  if (rawTime == null || rawTime.isEmpty) {
    return DateTime.tryParse(rawDate);
  }
  
  try {
    final cleanDate = rawDate.split('T').first;
    final cleanTime = rawTime.contains('T') ? rawTime.split('T').last : rawTime;
    return DateTime.parse('${cleanDate}T$cleanTime');
  } catch (_) {
    return DateTime.tryParse(rawDate);
  }
}

String? appointmentZoomJoinUrl(Map<String, dynamic> appointment) {
  final s = (appointment['zoom_join_url'] ?? appointment['zoomJoinUrl'] ?? '').toString().trim();
  return s.isEmpty ? null : s;
}

String formatAppointmentWallClockHm12(String rawTime) {
  if (rawTime.isEmpty) return '';
  try {
    final t = rawTime.contains('T') ? rawTime.split('T').last : rawTime;
    final parts = t.split(':');
    if (parts.length < 2) return rawTime;
    int hour = int.parse(parts[0]);
    int minute = int.parse(parts[1]);
    final ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour == 0) hour = 12;
    final minStr = minute.toString().padLeft(2, '0');
    return '$hour:$minStr $ampm';
  } catch (_) {
    return rawTime;
  }
}

bool isCancellationRequestDayValid(Map<String, dynamic> appointment) {
  final start = appointmentStartDateTime(appointment);
  if (start == null) return false;
  final now = DateTime.now();
  return start.difference(now).inHours >= 24;
}

const String cancellationTooLateMessage = 
    'Appointments cannot be altered within 24 hours of execution windows. Please touch base directly with the clinical front office infrastructure.';