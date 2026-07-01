import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/appointment_model.dart';
import '../services/session_payment_service.dart';
import '../widgets/session_payment_dialog.dart';

/// Validates join window, collects session payment if needed, then opens Zoom.
Future<void> joinZoomSessionWithPayment(
  BuildContext context,
  Map<String, dynamic> appointment,
) async {
  final model = Appointment.fromMap(appointment);
  if (!model.isStarted) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('appointment_wait_therapist_start'.tr())),
    );
    return;
  }

  final joinUrl = model.zoomJoinUrl;
  if (joinUrl == null) return;

  final uri = Uri.tryParse(joinUrl);
  if (uri == null) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('appointment_zoom_open_error'.tr())),
    );
    return;
  }

  final appointmentId = model.appointmentsId?.trim() ?? '';
  if (appointmentId.isEmpty) return;

  if (!await SessionPaymentService.instance.isPaid(appointmentId)) {
    if (!context.mounted) return;
    final paid = await showSessionPaymentDialog(
      context,
      appointment: appointment,
      isPreJoin: true,
    );
    if (!paid || !context.mounted) return;
  }

  final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!launched && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('appointment_zoom_open_error'.tr())),
    );
  }
}
