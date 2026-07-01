import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/booking_state.dart';
import '../theme/app_colors.dart';
import '../utils/error_feedback.dart';
import '../widgets/therapist_search_dropdown.dart';
import 'book_appointment_page.dart';

/// Step 2 — pick a therapist from a searchable dropdown before choosing a slot.
class BookingTherapistPickPage extends StatefulWidget {
  const BookingTherapistPickPage({
    super.key,
    required this.bookingState,
  });

  final BookingState bookingState;

  @override
  State<BookingTherapistPickPage> createState() =>
      _BookingTherapistPickPageState();
}

class _BookingTherapistPickPageState extends State<BookingTherapistPickPage> {
  Map<String, dynamic>? _selectedTherapist;

  void _openBookingDetails() {
    final therapist = _selectedTherapist;
    if (therapist == null) return;
    try {
      final nextState = widget.bookingState.copyWith(therapist: therapist);
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => BookAppointmentPage(bookingState: nextState),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      showErrorOccurredSnackBar(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: Text('booking_therapist_pick_title'.tr())),
      body: ResponsiveScrollBody(
        padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 12)
            .copyWith(bottom: context.rs(28)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.child_care_outlined,
                      color: AppColors.primary, size: context.rs(20)),
                  SizedBox(width: context.rg(10)),
                  Expanded(
                    child: Text(
                      'booking_therapist_for_child'.tr(
                        namedArgs: {'child': widget.bookingState.childName},
                      ),
                      style: TextStyle(
                        fontSize: context.rf(13),
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPri,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: context.rg(20)),
            TherapistSearchDropdown(
              selectedTherapist: _selectedTherapist,
              onChanged: (therapist) {
                setState(() => _selectedTherapist = therapist);
              },
            ),
            SizedBox(height: context.rg(24)),
            FilledButton(
              onPressed: _selectedTherapist != null ? _openBookingDetails : null,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.35),
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
        ),
      ),
    );
  }
}
