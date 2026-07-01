/// Parent appointment with optional Zoom fields from `/api/booking/appointments`.
class Appointment {
  Appointment({
    required this.raw,
    this.appointmentsId,
    this.status,
    this.appointmentDate,
    this.zoomJoinUrl,
    this.zoomPassword,
    this.zoomStartUrl,
    this.zoomMeetingId,
    this.isStarted = false,
  });

  final Map<String, dynamic> raw;
  final String? appointmentsId;
  final String? status;
  final String? appointmentDate;
  final String? zoomJoinUrl;
  final String? zoomPassword;
  final String? zoomStartUrl;
  final String? zoomMeetingId;
  final bool isStarted;

  factory Appointment.fromMap(Map<String, dynamic> source) {
    final map = normalizeAppointmentMap(source);
    String? pickString(String a, String b) {
      final v = map[a] ?? map[b];
      final s = v?.toString().trim();
      return (s == null || s.isEmpty) ? null : s;
    }

    return Appointment(
      raw: map,
      appointmentsId: pickString('appointments_id', 'appointment_id'),
      status: map['status']?.toString(),
      appointmentDate: map['appointment_date']?.toString(),
      zoomJoinUrl: pickString('zoomJoinUrl', 'zoom_join_url'),
      zoomPassword: pickString('zoomPassword', 'zoom_password'),
      zoomStartUrl: pickString('zoomStartUrl', 'zoom_start_url'),
      zoomMeetingId: pickString('zoomMeetingId', 'zoom_meeting_id'),
      isStarted: map['is_started'] == true || map['isStarted'] == true,
    );
  }

  bool canJoinZoomSession() {
    final s = (status ?? '').toLowerCase().trim();
    if (s != 'confirmed') return false;
    final url = zoomJoinUrl;
    return url != null && url.isNotEmpty;
  }

  DateTime? get sessionStart => _appointmentStartDateTime(raw);

  DateTime? get sessionEnd => _appointmentEndDateTime(raw);

  /// Minutes until session start (negative = started).
  int? get minutesUntilStart {
    final start = sessionStart;
    if (start == null) return null;
    return start.difference(DateTime.now()).inMinutes;
  }

  /// Join enabled from 15 minutes before until 30 minutes after start.
  bool get isZoomJoinWindowOpen {
    final minutes = minutesUntilStart;
    if (minutes == null) return false;
    return minutes <= 15 && minutes >= -30;
  }

  /// Confirmed appointment with a Zoom link once the therapist has started
  /// the live session.
  bool get canShowZoomJoinButton => canJoinZoomSession() && isStarted;

  /// In the join time window but waiting for the therapist to start.
  bool get isWaitingForTherapistToStart =>
      canJoinZoomSession() && isZoomJoinWindowOpen && !isStarted;
}

// —— Map helpers (backward compatible) ——

String? appointmentZoomJoinUrl(Map<String, dynamic> map) =>
    Appointment.fromMap(map).zoomJoinUrl;

String? appointmentZoomPassword(Map<String, dynamic> map) =>
    Appointment.fromMap(map).zoomPassword;

String? appointmentZoomStartUrl(Map<String, dynamic> map) =>
    Appointment.fromMap(map).zoomStartUrl;

String? appointmentZoomMeetingId(Map<String, dynamic> map) =>
    Appointment.fromMap(map).zoomMeetingId;

Map<String, dynamic> normalizeAppointmentMap(Map<String, dynamic> source) {
  final map = Map<String, dynamic>.from(source);
  map.remove('video_room_id');
  return map;
}

bool canJoinZoomSession(Map<String, dynamic> appointment) =>
    Appointment.fromMap(appointment).canJoinZoomSession();

bool canShowZoomJoinButton(Map<String, dynamic> appointment) =>
    Appointment.fromMap(appointment).canShowZoomJoinButton;

int? minutesUntilSessionStart(Map<String, dynamic> appointment) =>
    Appointment.fromMap(appointment).minutesUntilStart;

bool isZoomJoinWindowOpen(Map<String, dynamic> appointment) =>
    Appointment.fromMap(appointment).isZoomJoinWindowOpen;

bool isWaitingForTherapistToStart(Map<String, dynamic> appointment) =>
    Appointment.fromMap(appointment).isWaitingForTherapistToStart;

DateTime? appointmentStartDateTime(Map<String, dynamic> a) =>
    _appointmentStartDateTime(a);

DateTime? appointmentEndDateTime(Map<String, dynamic> a) =>
    _appointmentEndDateTime(a);

/// Matches Node backend `hm()`: `new Date(raw).toISOString().slice(11, 16)`.
String? appointmentTimeHm24(dynamic raw) {
  if (raw == null) return null;
  final text = raw.toString().trim();
  if (text.isEmpty) return null;
  final parsed = DateTime.tryParse(text);
  if (parsed != null) {
    final utc = parsed.toUtc();
    final h = utc.hour.toString().padLeft(2, '0');
    final m = utc.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
  if (text.length >= 16) return text.substring(11, 16);
  final parts = text.split(':');
  if (parts.length >= 2) {
    final h = (int.tryParse(parts[0]) ?? 0).toString().padLeft(2, '0');
    final m = parts[1].padLeft(2, '0');
    return '$h:$m';
  }
  return null;
}

String formatAppointmentWallClockHm12(dynamic raw) {
  final hm24 = appointmentTimeHm24(raw);
  if (hm24 == null || hm24.isEmpty) return '—';
  final parts = hm24.split(':');
  if (parts.length < 2) return hm24;
  var h = int.tryParse(parts[0]) ?? 0;
  final m = parts[1].padLeft(2, '0');
  final ap = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12;
  if (h12 == 0) h12 = 12;
  return '$h12:$m $ap';
}

String? _appointmentDateYmd(Map<String, dynamic> a) {
  final rawDate = a['appointment_date']?.toString().trim();
  if (rawDate == null || rawDate.isEmpty) return null;
  return rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
}

/// Local [DateTime] using appointment calendar day + UTC wall-clock time from
/// availability (same semantics as therapist dashboard / backend `hm()`).
DateTime? parseAppointmentWallClock(
  dynamic raw, {
  String? appointmentDateYmd,
}) {
  if (raw == null) return null;
  final text = raw.toString().trim();
  if (text.isEmpty) return null;
  final parsed = DateTime.tryParse(text);
  if (parsed == null) return null;
  final utc = parsed.toUtc();

  final dateRaw = appointmentDateYmd?.trim();
  if (dateRaw != null && dateRaw.length >= 10) {
    return DateTime(
      int.parse(dateRaw.substring(0, 4)),
      int.parse(dateRaw.substring(5, 7)),
      int.parse(dateRaw.substring(8, 10)),
      utc.hour,
      utc.minute,
      utc.second,
      utc.millisecond,
    );
  }
  return DateTime(
    utc.year,
    utc.month,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second,
    utc.millisecond,
  );
}

DateTime? _appointmentStartDateTime(Map<String, dynamic> a) {
  final datePart = _appointmentDateYmd(a);
  final availability = a['availability'];
  if (availability is Map) {
    final wallStart = parseAppointmentWallClock(
      availability['start_time'],
      appointmentDateYmd: datePart,
    );
    if (wallStart != null) return wallStart;
  }
  if (datePart == null) return null;
  return parseAppointmentWallClock(
    '${datePart}T00:00:00',
    appointmentDateYmd: datePart,
  );
}

DateTime? _appointmentEndDateTime(Map<String, dynamic> a) {
  final datePart = _appointmentDateYmd(a);
  final availability = a['availability'];
  if (availability is Map) {
    final wallEnd = parseAppointmentWallClock(
      availability['end_time'],
      appointmentDateYmd: datePart,
    );
    if (wallEnd != null) return wallEnd;
  }
  final start = _appointmentStartDateTime(a);
  return start?.add(const Duration(hours: 1));
}
