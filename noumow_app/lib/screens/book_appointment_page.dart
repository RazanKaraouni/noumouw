import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/appointment_model.dart';
import '../models/booking_state.dart';
import '../services/booking_api_service.dart';
import '../services/parent_appointments.dart';
import '../utils/session_join_flow.dart';
import '../utils/auth_headers.dart';
import '../theme/app_colors.dart';

String _formatTimeHm(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  return formatAppointmentWallClockHm12(raw);
}

String _formatDateYmd(String? raw) {
  if (raw == null || raw.isEmpty) return '—';
  final d = DateTime.tryParse(raw);
  if (d == null) return raw;
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

DateTime? _parseYmd(String raw) {
  final parts = raw.trim().split('-');
  if (parts.length < 3) return null;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

bool _isOnOrAfterToday(String dateStr) {
  final d = _parseYmd(dateStr);
  if (d == null) return false;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return !d.isBefore(today);
}

List<String> _futureBookableDates(List<String> dates) =>
    dates.where(_isOnOrAfterToday).toList();

String _monthDayChipLabel(BuildContext context, DateTime d) {
  return DateFormat.MMMd(context.locale.toLanguageTag()).format(d);
}

String _weekdayShort(DateTime d) {
  switch (d.weekday) {
    case DateTime.monday:
      return 'appointment_weekday_mon'.tr();
    case DateTime.tuesday:
      return 'appointment_weekday_tue'.tr();
    case DateTime.wednesday:
      return 'appointment_weekday_wed'.tr();
    case DateTime.thursday:
      return 'appointment_weekday_thu'.tr();
    case DateTime.friday:
      return 'appointment_weekday_fri'.tr();
    case DateTime.saturday:
      return 'appointment_weekday_sat'.tr();
    case DateTime.sunday:
      return 'appointment_weekday_sun'.tr();
    default:
      return '';
  }
}

bool _isPendingReservationStatus(String? rawStatus) {
  final status = (rawStatus ?? '').trim().toLowerCase();
  return status == 'pending' || status == 'reserved' || status == 'requested';
}

bool _canCancelAppointment(String? rawStatus) {
  final status = (rawStatus ?? '').trim().toLowerCase();
  return status == 'pending' ||
      status == 'confirmed' ||
      status == 'reserved' ||
      status == 'requested';
}

bool _hasBookingAuth() => authHeaders().containsKey('Authorization');

String _initials(String name) {
  final p =
      name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
  if (p.isEmpty) return '?';
  if (p.length == 1) return p[0].substring(0, 1).toUpperCase();
  return (p[0].substring(0, 1) + p[1].substring(0, 1)).toUpperCase();
}

/// Step 3 — date strip + time slots for the selected child and therapist.
class BookAppointmentPage extends StatefulWidget {
  const BookAppointmentPage({super.key, required this.bookingState});

  final BookingState bookingState;

  @override
  State<BookAppointmentPage> createState() => _BookAppointmentPageState();
}

class _BookAppointmentPageState extends State<BookAppointmentPage> {
  static const _green = Color(0xFF1D9E75);
  static const _bg = Color(0xFFF7F8F5);
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  final BookingApiService _api = BookingApiService();

  Map<String, dynamic>? get _therapist => widget.bookingState.therapist;

  String get _therapistId => widget.bookingState.therapistId;

  String get _selectedChildId => widget.bookingState.childId;

  String get _selectedChildName => widget.bookingState.childName;

  String _therapistName() {
    final n = (_therapist?['full_name'] ?? '').toString().trim();
    return n.isEmpty ? 'appointment_therapist_default'.tr() : n;
  }

  String _profession() =>
      (_therapist?['profession'] ?? '').toString().trim();

  String _address() => (_therapist?['address'] ?? '').toString().trim();

  String? _imageUrl() {
    final u =
        (_therapist?['profile_image_url'] ?? '').toString().trim();
    return u.isEmpty ? null : u;
  }

  List<String> _datesWithSlots = [];
  String _datesState = 'loading';
  List<Map<String, dynamic>> _slots = [];
  String _slotsState = 'idle';
  String? _selectedDate;
  bool _booking = false;
  List<Map<String, dynamic>> _pendingAppointments = [];
  String _pendingState = 'loading';
  final Set<String> _cancellingAppointmentIds = {};
  String _filterTherapistId = '';
  String _filterChildName = '';
  String _filterDate = '';
  bool _showYourAppointments = false;
  final ScrollController _scrollController = ScrollController();
  final GlobalKey _appointmentsSectionKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _loadPendingAppointments();
    _loadDates();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _openYourAppointments() {
    setState(() => _showYourAppointments = true);
    _loadPendingAppointments();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sectionContext = _appointmentsSectionKey.currentContext;
      if (sectionContext != null && mounted) {
        Scrollable.ensureVisible(
          sectionContext,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  Future<void> _joinZoomSession(Map<String, dynamic> appointment) async {
    await joinZoomSessionWithPayment(context, appointment);
  }

  Future<void> _cancelAppointment(Map<String, dynamic> appointment) async {
    final id = (appointment['appointments_id'] ?? '').toString().trim();
    if (id.isEmpty) return;
    final status = (appointment['status'] ?? '').toString().toLowerCase();
    final isPending = status == 'pending';

    if (!isPending && !isCancellationRequestDayValid(appointment)) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('appointment_cannot_cancel_title'.tr()),
          content: Text('appointment_cannot_cancel_message'.tr()),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('appointment_ok'.tr()),
            ),
          ],
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          isPending
              ? 'appointment_cancel_confirm_pending_title'.tr()
              : 'appointment_cancel_confirm_confirmed_title'.tr(),
        ),
        content: Text(
          'appointment_cancel_confirm_body'.tr(
            namedArgs: {
              'therapist': _appointmentTherapistName(appointment),
              'date': _formatDateYmd(
                appointment['appointment_date']?.toString(),
              ),
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('appointment_keep_appointment'.tr()),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              isPending
                  ? 'appointment_cancel_action'.tr()
                  : 'appointment_request_cancel_action'.tr(),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _cancellingAppointmentIds.add(id));
    try {
      if (isPending) {
        await _api.cancelPendingAppointment(id);
      } else {
        await _api.requestAppointmentCancellation(id);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isPending
                ? 'appointment_cancelled_snack'.tr()
                : 'appointment_cancellation_requested_snack'.tr(),
          ),
        ),
      );
      await _loadPendingAppointments();
      if (_selectedDate != null && _selectedDate!.isNotEmpty) {
        await _loadSlots(_selectedDate!);
      }
    } on BookingApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(sanitizeUserMessage(e.message))),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'appointment_cancel_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _cancellingAppointmentIds.remove(id));
      }
    }
  }

  String _appointmentTherapistId(Map<String, dynamic> a) {
    final t = a['therapists'] as Map<String, dynamic>?;
    return (t?['therapist_id'] ?? a['therapist_id'] ?? '').toString().trim();
  }

  String _appointmentTherapistName(
    Map<String, dynamic> a, {
    String? fallback,
  }) {
    final resolvedFallback =
        fallback ?? 'appointment_therapist_default'.tr();
    final t = a['therapists'] as Map<String, dynamic>?;
    if (t != null) {
      final n = (t['full_name'] ?? '').toString().trim();
      if (n.isNotEmpty) return n;
    }
    final tid = a['therapist_id']?.toString();
    if (tid == _therapistId) return _therapistName();
    return resolvedFallback;
  }

  String _appointmentChildName(Map<String, dynamic> a) {
    final childNameFromApi = (a['child_name'] ?? '').toString().trim();
    if (childNameFromApi.isNotEmpty) return childNameFromApi;

    final notes = (a['notes'] ?? '').toString();
    final childMatch =
        RegExp(r'Child for appointment:\s*(.+?)\s*\(').firstMatch(notes);
    final parsed = childMatch?.group(1)?.trim() ?? '';
    return parsed.isNotEmpty ? parsed : 'appointment_child_default'.tr();
  }

  String _appointmentDateKey(Map<String, dynamic> a) {
    final raw = a['appointment_date']?.toString().trim();
    if (raw != null && raw.isNotEmpty) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
    return '';
  }

  Map<String, String> _therapistFilterOptions() {
    final options = <String, String>{};
    for (final a in _pendingAppointments) {
      final id = _appointmentTherapistId(a);
      if (id.isEmpty) continue;
      options[id] = _appointmentTherapistName(a);
    }
    return options;
  }

  List<String> _childFilterOptions() {
    final names = <String>{};
    for (final a in _pendingAppointments) {
      names.add(_appointmentChildName(a));
    }
    final list = names.toList()..sort();
    return list;
  }

  List<String> _dateFilterOptions() {
    final dates = <String>{};
    for (final a in _pendingAppointments) {
      final d = _appointmentDateKey(a);
      if (d.isNotEmpty) dates.add(d);
    }
    final list = dates.toList()..sort();
    return list;
  }

  List<Map<String, dynamic>> get _filteredPendingAppointments {
    return _pendingAppointments.where((a) {
      if (_filterTherapistId.isNotEmpty &&
          _appointmentTherapistId(a) != _filterTherapistId) {
        return false;
      }
      if (_filterChildName.isNotEmpty &&
          _appointmentChildName(a) != _filterChildName) {
        return false;
      }
      if (_filterDate.isNotEmpty && _appointmentDateKey(a) != _filterDate) {
        return false;
      }
      return true;
    }).toList();
  }

  void _syncAppointmentFilters() {
    final therapists = _therapistFilterOptions();
    if (_filterTherapistId.isNotEmpty &&
        !therapists.containsKey(_filterTherapistId)) {
      _filterTherapistId = '';
    }
    final children = _childFilterOptions();
    if (_filterChildName.isNotEmpty && !children.contains(_filterChildName)) {
      _filterChildName = '';
    }
    final dates = _dateFilterOptions();
    if (_filterDate.isNotEmpty && !dates.contains(_filterDate)) {
      _filterDate = '';
    }
  }

  Widget _appointmentFilterDropdown(
    BuildContext context, {
    required String label,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      value: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        contentPadding: Responsive.padSymmetric(
          context,
          horizontal: 10,
          vertical: 10,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
          borderSide: const BorderSide(color: Color(0xFFE8EAE4)),
        ),
      ),
      items: items,
      onChanged: onChanged,
      style: TextStyle(fontSize: context.rf(12), color: _textPri),
    );
  }

  Widget _appointmentFilters(BuildContext context) {
    final therapists = _therapistFilterOptions();
    final therapistEntries = therapists.entries.toList()
      ..sort((a, b) => a.value.compareTo(b.value));
    final children = _childFilterOptions();
    final dates = _dateFilterOptions();

    final therapistFilter = _appointmentFilterDropdown(
      context,
      label: 'appointment_filter_therapist'.tr(),
      value: _filterTherapistId,
      items: [
        DropdownMenuItem(
          value: '',
          child: Text('appointment_filter_all'.tr()),
        ),
        ...therapistEntries.map(
          (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
        ),
      ],
      onChanged: (v) => setState(() => _filterTherapistId = v ?? ''),
    );
    final childFilter = _appointmentFilterDropdown(
      context,
      label: 'appointment_filter_child'.tr(),
      value: _filterChildName,
      items: [
        DropdownMenuItem(
          value: '',
          child: Text('appointment_filter_all'.tr()),
        ),
        ...children.map(
          (n) => DropdownMenuItem(value: n, child: Text(n)),
        ),
      ],
      onChanged: (v) => setState(() => _filterChildName = v ?? ''),
    );
    final dateFilter = _appointmentFilterDropdown(
      context,
      label: 'appointment_filter_date'.tr(),
      value: _filterDate,
      items: [
        DropdownMenuItem(
          value: '',
          child: Text('appointment_filter_all'.tr()),
        ),
        ...dates.map(
          (d) => DropdownMenuItem(
            value: d,
            child: Text(_formatDateYmd(d)),
          ),
        ),
      ],
      onChanged: (v) => setState(() => _filterDate = v ?? ''),
    );

    if (context.screenWidth < 360) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          therapistFilter,
          SizedBox(height: context.rg(8)),
          childFilter,
          SizedBox(height: context.rg(8)),
          dateFilter,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: therapistFilter),
        SizedBox(width: context.rg(8)),
        Expanded(child: childFilter),
        SizedBox(width: context.rg(8)),
        Expanded(child: dateFilter),
      ],
    );
  }

  Future<void> _loadPendingAppointments() async {
    setState(() => _pendingState = 'loading');
    try {
      if (!_hasBookingAuth()) {
        if (!mounted) return;
        setState(() {
          _pendingAppointments = [];
          _pendingState = 'unauthenticated';
        });
        return;
      }
      final rows = await _api.fetchMyAppointments();
      if (!mounted) return;
      final visible = filterAppointmentsForMobile(rows);
      visible.sort((a, b) {
        final da = _appointmentDateKey(a);
        final db = _appointmentDateKey(b);
        final cmp = da.compareTo(db);
        if (cmp != 0) return cmp;
        final availA = a['availability'] as Map<String, dynamic>?;
        final availB = b['availability'] as Map<String, dynamic>?;
        final ta = (availA?['start_time'] ?? '').toString();
        final tb = (availB?['start_time'] ?? '').toString();
        return ta.compareTo(tb);
      });
      setState(() {
        _pendingAppointments = visible;
        _pendingState = 'success';
        _syncAppointmentFilters();
      });
    } catch (e) {
      debugPrint('load appointments failed: $e');
      if (!mounted) return;
      setState(() => _pendingState = 'error');
    }
  }

  Future<void> _loadDates() async {
    setState(() {
      _datesState = 'loading';
      _slots = [];
      _selectedDate = null;
      _slotsState = 'idle';
    });
    try {
      final list = _futureBookableDates(
        await _api.fetchAvailableDates(_therapistId),
      );
      switch (list.isEmpty) {
        case true:
          if (mounted) {
            setState(() {
              _datesWithSlots = [];
              _datesState = 'success';
              _slotsState = 'success';
            });
          }
          break;
        case false:
          list.sort();
          if (mounted) {
            setState(() {
              _datesWithSlots = list;
              _datesState = 'success';
              _selectedDate = list.first;
            });
            _loadSlots(_selectedDate!);
          }
          break;
      }
    } catch (_) {
      if (mounted) setState(() => _datesState = 'error');
    }
  }

  Future<void> _loadSlots(String date) async {
    setState(() {
      _slotsState = 'loading';
      _slots = [];
    });
    try {
      final rows = await _api.fetchSlotsForDate(
        therapistId: _therapistId,
        slotDate: date,
      );
      if (!mounted) return;
      setState(() {
        _slots = rows;
        _slotsState = 'success';
      });
    } catch (_) {
      if (mounted) setState(() => _slotsState = 'error');
    }
  }

  Future<void> _onSlotChosen(String availabilityId) async {
    if (!_hasBookingAuth()) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('appointment_sign_in_first'.tr())),
      );
      return;
    }
    final selectedChildId = _selectedChildId;
    if (selectedChildId.isEmpty) return;

    final childName = _selectedChildName.isNotEmpty
        ? _selectedChildName
        : 'appointment_child_default'.tr();
    final notes = 'Child for appointment: $childName ($selectedChildId)';

    setState(() => _booking = true);
    try {
      await _api.bookSlot(
        availabilityId,
        notes: notes,
        childrenId: selectedChildId,
      );
      if (!mounted) return;
      setState(() => _booking = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('appointment_request_sent'.tr())),
      );
      await _loadPendingAppointments();
      if (_selectedDate != null && _selectedDate!.isNotEmpty) {
        await _loadSlots(_selectedDate!);
      }
    } on BookingApiException catch (e) {
      if (!mounted) return;
      setState(() => _booking = false);
      final message =
          e.statusCode == 409 ? 'appointment_slot_taken'.tr() : sanitizeUserMessage(e.message);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      if (_selectedDate != null && _selectedDate!.isNotEmpty) {
        await _loadSlots(_selectedDate!);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _booking = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    }
  }

  bool _slotReservedByCurrentUser(String availabilityId) {
    if (availabilityId.isEmpty) return false;
    for (final appointment in _pendingAppointments) {
      final apptAvailabilityId =
          (appointment['availability_id'] ?? '').toString();
      if (apptAvailabilityId != availabilityId) continue;
      final status = (appointment['status'] ?? '').toString().toLowerCase();
      if (_isPendingReservationStatus(status) ||
          status == 'confirmed' ||
          status == 'cancellation_requested') {
        return true;
      }
    }
    return false;
  }

  Widget _datesStrip(BuildContext context) {
    final chipWidth = context.rs(72);
    final stripHeight = context.rs(78);

    switch (_datesState) {
      case 'loading':
        return SizedBox(
            height: context.rs(56),
            child: Center(
                child: SizedBox.square(
                    dimension: context.rs(22),
                    child: const CircularProgressIndicator(strokeWidth: 2))));
      case 'error':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(networkErrorMessage()),
        );
      case 'success':
      default:
        break;
    }
    if (_datesWithSlots.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text('appointment_no_open_days'.tr()),
      );
    }

    return SizedBox(
      height: stripHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: Responsive.padSymmetric(context, horizontal: 4),
        itemCount: _datesWithSlots.length,
        separatorBuilder: (_, __) => SizedBox(width: context.rg(8)),
        itemBuilder: (ctx, i) {
          final ds = _datesWithSlots[i];
          final d = DateTime.tryParse(ds) ?? DateTime.now();
          final sel = _selectedDate == ds;
          final selectedBg = sel ? AppColors.primary : Colors.white;
          final selectedFg = sel ? Colors.white : _textPri;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedDate = ds);
              _loadSlots(ds);
            },
            child: Container(
              width: chipWidth,
              padding: Responsive.padSymmetric(
                context,
                vertical: 10,
                horizontal: 6,
              ),
              decoration: BoxDecoration(
                color: selectedBg,
                borderRadius: BorderRadius.circular(context.rs(12)),
                border: Border.all(
                  color: sel ? AppColors.primary : const Color(0xFFE8EAE4),
                ),
                boxShadow: sel
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.2),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _weekdayShort(d),
                    style: TextStyle(
                        fontSize: context.rf(11),
                        fontWeight: FontWeight.w600,
                        color: selectedFg.withOpacity(sel ? 0.95 : 0.85)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: context.rg(4)),
                  Text(
                    _monthDayChipLabel(context, d),
                    style: TextStyle(
                        fontSize: context.rf(13),
                        fontWeight: FontWeight.w700,
                        color: selectedFg),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _slotsListView(BuildContext context) {
    switch (_slotsState) {
      case 'loading':
        return const Padding(
          padding: EdgeInsets.all(28),
          child: Center(child: CircularProgressIndicator()),
        );
      case 'error':
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Text(networkErrorMessage()),
        );
      case 'idle':
        return const SizedBox.shrink();
      case 'success':
      default:
        break;
    }
    if (_slots.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text('appointment_no_slots'.tr()),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _slots.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final s = _slots[i];
        final id = (s['availability_id'] ?? '').toString();
        final stRaw = (s['start_time'] ?? '').toString();
        final label = _formatTimeHm(stRaw);
        final reservedByUser = _slotReservedByCurrentUser(id);
        final isBooked = s['is_booked'] == true;
        final inactive = label.isEmpty;
        final isTaken = reservedByUser || isBooked;
        final isDisabled = inactive || isTaken;
        final displayLabel = label.isEmpty ? '—' : label;
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: isDisabled
                ? null
                : () {
                    if (!_booking) {
                      _onSlotChosen(id);
                    }
                  },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDisabled
                      ? const Color(0xFFE8EAE4)
                      : _green.withOpacity(0.35),
                ),
              ),
              child: Text(
                displayLabel,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isDisabled ? _textSec : _green,
                  decoration: isTaken && label.isNotEmpty
                      ? TextDecoration.lineThrough
                      : TextDecoration.none,
                  decorationColor: _textSec,
                  decorationThickness: 1.5,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: Text('appointment_title'.tr()),
      ),
      body: Stack(
        children: [
          ResponsiveScrollBody(
            controller: _scrollController,
            padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 8)
                .copyWith(bottom: context.rs(96)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _childContextBanner(context),
                SizedBox(height: context.rg(12)),
                _therapistHeroCard(context),
                SizedBox(height: context.rg(16)),
                _nextSessionSummaryCard(context),
                if (!_showYourAppointments)
                  _viewYourAppointmentsButton(context)
                else
                  KeyedSubtree(
                    key: _appointmentsSectionKey,
                    child: _bookedNotAttendedCard(
                      context,
                      onClose: () => setState(() => _showYourAppointments = false),
                    ),
                  ),
                SizedBox(height: context.rg(22)),
                Text(
                  'appointment_select_date'.tr(),
                  style: TextStyle(
                    fontSize: context.rf(11),
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: Colors.grey.shade700,
                  ),
                ),
                SizedBox(height: context.rg(10)),
                _datesStrip(context),
                SizedBox(height: context.rg(20)),
                Text(
                  'appointment_available_times'.tr(),
                  style: TextStyle(
                    fontSize: context.rf(11),
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: Colors.grey.shade700,
                  ),
                ),
                SizedBox(height: context.rg(12)),
                _slotsListView(context),
              ],
            ),
          ),
          if (_booking)
            const Positioned.fill(
              child: ColoredBox(
                color: Color(0x33000000),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 8)
              .copyWith(bottom: context.rs(16)),
          child: SizedBox(
            width: double.infinity,
            height: context.rs(48),
            child: FilledButton(
              onPressed: _slots.isEmpty || _booking
                  ? null
                  : () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('appointment_tap_slot_hint'.tr()),
                        ),
                      );
                    },
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.35),
              ),
              child: Text('appointment_reserve_slot'.tr(),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _childContextBanner(BuildContext context) {
    return AppCard(
      padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.child_care_outlined, color: AppColors.primary, size: context.rs(20)),
          SizedBox(width: context.rg(10)),
          Expanded(
            child: Text(
              'booking_appointment_for_child'.tr(
                namedArgs: {'child': _selectedChildName},
              ),
              style: TextStyle(
                fontSize: context.rf(13),
                fontWeight: FontWeight.w600,
                color: _textPri,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _therapistHeroCard(BuildContext context) {
    final nm = _therapistName();
    final name = nm.toLowerCase().startsWith('dr')
        ? nm
        : 'appointment_dr_prefix'.tr(namedArgs: {'name': nm});
    final specLine =
        [_profession(), _address()].where((e) => e.isNotEmpty).join(' · ');

    return AppCard(
      padding: Responsive.padAll(context, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _squareAvatar(context, name),
          SizedBox(width: context.rg(12)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Align(
                  alignment: Alignment.topRight,
                  child: Container(
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F7F1),
                      borderRadius: BorderRadius.circular(context.rs(99)),
                    ),
                    child: Text(
                      'appointment_available_badge'.tr(),
                      style: TextStyle(
                        fontSize: context.rf(11),
                        fontWeight: FontWeight.w700,
                        color: _green,
                      ),
                    ),
                  ),
                ),
                Text(
                  name,
                  style: TextStyle(
                    fontSize: context.rf(17),
                    fontWeight: FontWeight.w700,
                    color: _textPri,
                  ),
                ),
                if (specLine.isNotEmpty)
                  Padding(
                    padding: EdgeInsets.only(top: context.rg(4)),
                    child: Text(
                      specLine,
                      style: TextStyle(fontSize: context.rf(13), color: _textSec),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic>? _nextUpcomingAppointment() {
    final now = DateTime.now();
    Map<String, dynamic>? best;
    DateTime? bestDt;

    for (final a in _pendingAppointments) {
      final status = (a['status'] ?? '').toString().toLowerCase();
      if (status == 'cancelled' ||
          status == 'completed' ||
          status == 'rejected') {
        continue;
      }

      final dateKey = _appointmentDateKey(a);
      if (dateKey.isEmpty) continue;

      final avail = a['availability'] as Map<String, dynamic>?;
      final timeRaw = (avail?['start_time'] ?? '').toString();
      DateTime? apptDt;
      try {
        final parts = dateKey.split('-');
        if (parts.length >= 3) {
          var hour = 0;
          var minute = 0;
          if (timeRaw.isNotEmpty) {
            final tp = timeRaw.split(':');
            hour = int.tryParse(tp.first) ?? 0;
            minute = int.tryParse(tp.length > 1 ? tp[1] : '0') ?? 0;
          }
          apptDt = DateTime(
            int.parse(parts[0]),
            int.parse(parts[1]),
            int.parse(parts[2]),
            hour,
            minute,
          );
        }
      } catch (_) {}

      if (apptDt == null || !apptDt.isAfter(now)) continue;
      if (bestDt == null || apptDt.isBefore(bestDt)) {
        best = a;
        bestDt = apptDt;
      }
    }
    return best;
  }

  Widget _nextSessionSummaryCard(BuildContext context) {
    final next = _nextUpcomingAppointment();
    if (next == null || _pendingState != 'success') {
      return const SizedBox.shrink();
    }

    final tn = _appointmentTherapistName(next);
    final childName = _appointmentChildName(next);
    final avail = next['availability'] as Map<String, dynamic>?;
    final tm = _formatTimeHm(avail?['start_time']?.toString());
    final dt = _formatDateYmd(next['appointment_date']?.toString());
    final st = (next['status'] ?? 'pending').toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _green.withOpacity(0.35)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F7F0),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.event_available_rounded,
                    color: _green, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'appointment_next_session_title'.tr(),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: _textPri,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F7F0),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  st.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: _green,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '$dt${tm.isEmpty ? '' : ' · $tm'}',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: _textPri,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'appointment_with_child'.tr(
              namedArgs: {'therapist': tn, 'child': childName},
            ),
            style: const TextStyle(fontSize: 13, color: _textSec),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: _openYourAppointments,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'appointment_manage_appointment'.tr(),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _viewYourAppointmentsButton(BuildContext context) {
    final count = _pendingAppointments.length;
    final subtitle = switch (_pendingState) {
      'loading' => 'appointment_view_loading'.tr(),
      'unauthenticated' => 'appointment_view_sign_in'.tr(),
      'error' => networkErrorMessage(),
      _ when count == 0 => 'appointment_view_none'.tr(),
      _ when count == 1 => 'appointment_view_count_one'.tr(),
      _ => 'appointment_view_count_many'.tr(namedArgs: {'count': '$count'}),
    };

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: _openYourAppointments,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE8EAE4)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.event_note_rounded, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'appointment_view_appointments_title'.tr(),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _textPri,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 12, color: _textSec),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: _textSec),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bookedNotAttendedCard(BuildContext context, {VoidCallback? onClose}) {
    Widget body;
    switch (_pendingState) {
      case 'loading':
        body = const Padding(
          padding: EdgeInsets.all(12),
          child: SizedBox(
            height: 24,
            width: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
        break;
      case 'unauthenticated':
        body = Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('appointment_sign_in_manage'.tr()),
        );
        break;
      case 'error':
        body = Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('appointment_load_list_error'.tr()),
        );
        break;
      case 'success':
      default:
        if (_pendingAppointments.isEmpty) {
          body = Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('appointment_no_appointments'.tr()),
          );
        } else {
          final filtered = _filteredPendingAppointments;
          body = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _appointmentFilters(context),
              const SizedBox(height: 12),
              if (filtered.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('appointment_no_filter_match'.tr()),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const Divider(height: 12),
                  itemBuilder: (_, i) {
              final a = filtered[i];
              final t = a['therapists'] as Map<String, dynamic>?;
              final tn = _appointmentTherapistName(a);
              final therapistRole =
                  (t?['profession'] ?? 'appointment_therapist_default'.tr())
                      .toString()
                      .trim()
                      .isEmpty
                      ? 'appointment_therapist_default'.tr()
                      : (t?['profession'] ?? 'appointment_therapist_default'.tr())
                          .toString()
                          .trim();
              final childName = _appointmentChildName(a);
              final avail = a['availability'] as Map<String, dynamic>?;
              final tm = _formatTimeHm(avail?['start_time']?.toString());
              final dt = _formatDateYmd(a['appointment_date']?.toString());
              final st = (a['status'] ?? 'pending').toString();
              final stLower = st.toLowerCase();
              final appointmentId =
                  (a['appointments_id'] ?? '').toString().trim();
              final isCancelling =
                  _cancellingAppointmentIds.contains(appointmentId);
              final canCancel = _canCancelAppointment(st);
              Color statusBg;
              Color statusFg;
              switch (stLower) {
                case 'confirmed':
                  statusBg = const Color(0xFFE8F7F0);
                  statusFg = _green;
                  break;
                case 'cancellation_requested':
                  statusBg = const Color(0xFFFFF0E0);
                  statusFg = const Color(0xFFC05621);
                  break;
                case 'completed':
                  statusBg = const Color(0xFFFFF4DF);
                  statusFg = const Color(0xFFB7791F);
                  break;
                default:
                  statusBg = const Color(0xFFFFF4DF);
                  statusFg = const Color(0xFFB7791F);
              }
              return Container(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.event_note_rounded,
                            size: 18, color: _green),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            tm.isEmpty
                                ? 'appointment_date_time'.tr(
                                    namedArgs: {'date': dt, 'time': ''},
                                  )
                                : 'appointment_date_time'.tr(
                                    namedArgs: {
                                      'date': dt,
                                      'time': 'appointment_date_time_suffix'
                                          .tr(namedArgs: {'time': tm}),
                                    },
                                  ),
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: statusBg,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            stLower == 'cancellation_requested'
                                ? 'appointment_cancel_pending_badge'.tr()
                                : st.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: statusFg,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'appointment_therapist_name'.tr(namedArgs: {'name': tn}),
                      style: const TextStyle(fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'appointment_therapist_role'
                          .tr(namedArgs: {'role': therapistRole}),
                      style: const TextStyle(fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'appointment_child_name'
                          .tr(namedArgs: {'name': childName}),
                      style: const TextStyle(fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'appointment_status'.tr(
                        namedArgs: {'status': st.toUpperCase()},
                      ),
                      style: const TextStyle(fontSize: 13),
                    ),
                    if (stLower == 'cancellation_requested') ...[
                      const SizedBox(height: 6),
                      Text(
                        'appointment_cancel_wait_therapist'.tr(),
                        style: const TextStyle(fontSize: 12, color: _textSec),
                      ),
                    ],
                    if (isWaitingForTherapistToStart(a)) ...[
                      const SizedBox(height: 10),
                      Text(
                        'appointment_wait_therapist_start'.tr(),
                        style: const TextStyle(fontSize: 12, color: _textSec),
                      ),
                    ],
                    if (canShowZoomJoinButton(a)) ...[
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.icon(
                          onPressed: () => _joinZoomSession(a),
                          icon: const Icon(Icons.videocam_rounded, size: 16),
                          label: Text('appointment_join_zoom'.tr()),
                          style: FilledButton.styleFrom(
                            backgroundColor: _green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            textStyle: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                    if (canCancel) ...[
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton.icon(
                          onPressed: isCancelling
                              ? null
                              : () => _cancelAppointment(a),
                          icon: isCancelling
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.cancel_outlined, size: 16),
                          label: Text(
                            isCancelling
                                ? 'appointment_cancelling'.tr()
                                : (stLower == 'pending'
                                    ? 'appointment_cancel_button'.tr()
                                    : 'appointment_cancel_appointment_button'
                                        .tr()),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFC05621),
                            side: const BorderSide(color: Color(0xFFE8C4A8)),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            textStyle: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
                ),
            ],
          );
        }
        break;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8EAE4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'appointment_your_appointments'.tr(),
                  style:
                      const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
              ),
              if (onClose != null)
                TextButton(
                  onPressed: onClose,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'appointment_hide'.tr(),
                    style:
                        const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }

  Widget _squareAvatar(BuildContext context, String nameForInitials) {
    final url = _imageUrl();
    final avatarSize = context.rs(76);
    return ClipRRect(
      borderRadius: BorderRadius.zero,
      child: Container(
        width: avatarSize,
        height: avatarSize,
        color: AppColors.primary.withOpacity(0.12),
        child: url != null
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                width: avatarSize,
                height: avatarSize,
                fadeInDuration: const Duration(milliseconds: 120),
                placeholder: (_, __) => Container(
                    color: AppColors.primary.withOpacity(0.08),
                    child: const Center(
                        child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2)))),
                errorWidget: (_, __, ___) =>
                    _initialsFallback(context, nameForInitials),
              )
            : _initialsFallback(context, nameForInitials),
      ),
    );
  }

  Widget _initialsFallback(BuildContext context, String name) {
    return Center(
      child: Text(
        _initials(name.replaceFirst(RegExp(r'^Dr\.\s*'), '')),
        style: TextStyle(
          fontSize: context.rf(22),
          fontWeight: FontWeight.w800,
          color: AppColors.primary.withOpacity(0.9),
        ),
      ),
    );
  }
}
