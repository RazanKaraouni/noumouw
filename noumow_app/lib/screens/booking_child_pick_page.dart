import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/booking_state.dart';
import '../services/session_manager.dart';
import '../theme/app_colors.dart';
import '../utils/error_feedback.dart';
import '../widgets/child_profile_avatar.dart';
import '../widgets/therapist_search_dropdown.dart';
import 'book_appointment_page.dart';
import 'create_child_page.dart';

/// Step 1 — choose child, then pick a therapist from a searchable dropdown.
class BookingChildPickPage extends StatefulWidget {
  const BookingChildPickPage({super.key});

  @override
  State<BookingChildPickPage> createState() => _BookingChildPickPageState();
}

class _BookingChildPickPageState extends State<BookingChildPickPage> {
  static const _primary = AppColors.primary;
  static const _green = AppColors.green;
  static const _textPri = AppColors.textPri;
  static const _textSec = AppColors.textSec;
  static const _border = AppColors.border;

  final _supabase = Supabase.instance.client;

  List<Map<String, dynamic>> _children = [];
  Map<String, dynamic>? _selectedChild;
  Map<String, dynamic>? _selectedTherapist;
  String _state = 'loading';

  String? _parentUserId() {
    final supabaseUser = _supabase.auth.currentUser;
    if (supabaseUser != null) return supabaseUser.id;
    return SessionManager.instance.session?.userId;
  }

  String _childId(Map<String, dynamic> child) {
    final raw = child['children_id'] ?? child['child_id'];
    if (raw == null) return '';
    return raw.toString();
  }

  String _childName(Map<String, dynamic> child) {
    final name =
        (child['full_name'] ?? child['name'] ?? '').toString().trim();
    return name.isEmpty ? 'display_children_unnamed'.tr() : name;
  }

  String _childAgeLabel(Map<String, dynamic> child) {
    try {
      final rawDob = (child['date_of_birth'] ?? child['dob'])?.toString();
      if (rawDob == null || rawDob.isEmpty) {
        return 'display_children_age_unknown'.tr();
      }
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      final days = now.difference(dob).inDays;
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      if (months < 0) months = 0;
      if (months < 1) {
        return days == 1
            ? 'display_children_age_one_day'.tr()
            : 'display_children_age_days'.tr(namedArgs: {'count': '$days'});
      }
      if (months < 12) {
        return 'display_children_age_months'
            .tr(namedArgs: {'count': '$months'});
      }
      final y = months ~/ 12;
      final m = months % 12;
      return m == 0
          ? 'display_children_age_years'.tr(namedArgs: {'years': '$y'})
          : 'display_children_age_years_months'
              .tr(namedArgs: {'years': '$y', 'months': '$m'});
    } catch (_) {
      return 'display_children_age_unknown'.tr();
    }
  }

  Future<void> _loadChildren() async {
    setState(() => _state = 'loading');
    try {
      final parentId = _parentUserId();
      if (parentId == null || parentId.isEmpty) {
        if (!mounted) return;
        setState(() {
          _children = [];
          _selectedChild = null;
          _selectedTherapist = null;
          _state = 'unauthenticated';
        });
        return;
      }

      final data = await _supabase
          .from('children')
          .select()
          .eq('parent_id', parentId)
          .order('created_at', ascending: true);
      final children = List<Map<String, dynamic>>.from(data);

      if (!mounted) return;
      Map<String, dynamic>? preservedChild;
      if (_selectedChild != null) {
        final selectedId = _childId(_selectedChild!);
        for (final child in children) {
          if (_childId(child) == selectedId) {
            preservedChild = child;
            break;
          }
        }
      }

      setState(() {
        _children = children;
        _selectedChild = preservedChild;
        if (preservedChild == null) _selectedTherapist = null;
        _state = 'success';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _state = 'error');
      showErrorSnackBar(context, e);
    }
  }

  void _selectChild(Map<String, dynamic> child) {
    final sameChild = _selectedChild != null &&
        _childId(_selectedChild!) == _childId(child);
    setState(() {
      _selectedChild = child;
      if (!sameChild) _selectedTherapist = null;
    });
  }

  void _continueToBooking() {
    final child = _selectedChild;
    final therapist = _selectedTherapist;
    if (child == null || therapist == null) return;

    final childId = _childId(child);
    if (childId.isEmpty) return;

    final bookingState = BookingState(
      childId: childId,
      childName: _childName(child),
      therapist: therapist,
    );

    try {
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => BookAppointmentPage(bookingState: bookingState),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorOccurredSnackBar(context);
    }
  }

  Future<void> _openAddChild() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const CreateChildPage()),
    );
    if (created == true) await _loadChildren();
  }

  @override
  void initState() {
    super.initState();
    _loadChildren();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text('home_book_appointment_title'.tr()),
      ),
      body: RefreshIndicator(
        onRefresh: _loadChildren,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    switch (_state) {
      case 'loading':
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 120),
            Center(child: CircularProgressIndicator()),
          ],
        );
      case 'error':
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 80),
            const Icon(Icons.cloud_off_outlined, size: 48, color: Colors.grey),
            const SizedBox(height: 16),
            Text(networkErrorMessage(), textAlign: TextAlign.center),
            TextButton(
              onPressed: _loadChildren,
              child: Text('booking_pick_retry'.tr()),
            ),
          ],
        );
      case 'unauthenticated':
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 80),
            Text('appointment_sign_in_first'.tr(), textAlign: TextAlign.center),
          ],
        );
      case 'success':
      default:
        break;
    }

    if (_children.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 48),
          Icon(Icons.child_care_outlined,
              size: 56, color: _primary.withOpacity(0.7)),
          const SizedBox(height: 20),
          Text(
            'booking_child_empty_prompt'.tr(),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: _textPri,
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: FilledButton.icon(
              onPressed: _openAddChild,
              icon: const Icon(Icons.add),
              label: Text('booking_child_add_button'.tr()),
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ),
        ],
      );
    }

    return ResponsiveScrollBody(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 12)
          .copyWith(bottom: context.rs(28)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'booking_child_question'.tr(),
            style: TextStyle(
              fontSize: context.rf(18),
              fontWeight: FontWeight.w700,
              color: _textPri,
            ),
          ),
          SizedBox(height: context.rg(6)),
          Text(
            'booking_child_question_hint'.tr(),
            style: TextStyle(fontSize: context.rf(13), color: _textSec),
          ),
          SizedBox(height: context.rg(16)),
          ..._children.map(_childCard),
          if (_selectedChild != null) ...[
            SizedBox(height: context.rg(20)),
            _selectedChildBanner(),
            SizedBox(height: context.rg(16)),
            TherapistSearchDropdown(
              selectedTherapist: _selectedTherapist,
              onChanged: (therapist) {
                setState(() => _selectedTherapist = therapist);
              },
            ),
            SizedBox(height: context.rg(24)),
            FilledButton(
              onPressed:
                  _selectedTherapist != null ? _continueToBooking : null,
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                disabledBackgroundColor: _primary.withOpacity(0.35),
                padding: Responsive.padSymmetric(context, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(context.rs(12)),
                ),
              ),
              child: Text(
                'booking_therapist_continue'.tr(),
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: context.rf(15),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _selectedChildBanner() {
    final child = _selectedChild!;
    return AppCard(
      padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.child_care_outlined, color: _primary, size: context.rs(20)),
          SizedBox(width: context.rg(10)),
          Expanded(
            child: Text(
              'booking_therapist_for_child'.tr(
                namedArgs: {'child': _childName(child)},
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

  Widget _childCard(Map<String, dynamic> child) {
    final id = _childId(child);
    final selected =
        _selectedChild != null && _childId(_selectedChild!) == id;
    return Padding(
      padding: EdgeInsets.only(bottom: context.rg(10)),
      child: Material(
        color: selected ? const Color(0xFFE1F5EE) : AppColors.white,
        borderRadius: BorderRadius.circular(context.rs(14)),
        child: InkWell(
          borderRadius: BorderRadius.circular(context.rs(14)),
          onTap: () => _selectChild(child),
          child: Container(
            padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(context.rs(14)),
              border: Border.all(
                color: selected ? _green : _border,
                width: selected ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                ChildProfileAvatar(
                  imageUrl: (child['profile_image_url'] ?? '').toString(),
                  gender: child['gender']?.toString(),
                  size: 44,
                ),
                SizedBox(width: context.rg(12)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _childName(child),
                        style: TextStyle(
                          fontSize: context.rf(15),
                          fontWeight: FontWeight.w600,
                          color: _textPri,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: context.rg(2)),
                      Text(
                        _childAgeLabel(child),
                        style: TextStyle(fontSize: context.rf(12), color: _textSec),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.chevron_right_rounded,
                  color: selected ? _green : _textSec,
                  size: context.rs(22),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
