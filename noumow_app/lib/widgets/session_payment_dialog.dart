import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/session_payment_service.dart';
import '../theme/app_colors.dart';
import '../utils/appointment_display_utils.dart';

/// Payment dialog before or after a session. Returns true when payment succeeded.
Future<bool> showSessionPaymentDialog(
  BuildContext context, {
  required Map<String, dynamic> appointment,
  bool isPreJoin = false,
}) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => SessionPaymentDialog(
      appointment: appointment,
      isPreJoin: isPreJoin,
    ),
  ).then((value) => value == true);
}

class SessionPaymentDialog extends StatefulWidget {
  const SessionPaymentDialog({
    super.key,
    required this.appointment,
    this.isPreJoin = false,
  });

  final Map<String, dynamic> appointment;
  final bool isPreJoin;

  @override
  State<SessionPaymentDialog> createState() => _SessionPaymentDialogState();
}

class _SessionPaymentDialogState extends State<SessionPaymentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _cardNumberCtrl = TextEditingController();
  final _expiryCtrl = TextEditingController();
  final _cvvCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();

  String? _amountError;
  bool _submitting = false;

  @override
  void dispose() {
    _cardNumberCtrl.dispose();
    _expiryCtrl.dispose();
    _cvvCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  String get _appointmentId =>
      (widget.appointment['appointments_id'] ??
              widget.appointment['appointment_id'] ??
              '')
          .toString()
          .trim();

  String get _feeLabel =>
      '\$${SessionPaymentService.sessionFeeUsd.toStringAsFixed(0)}';

  bool get _canPay {
    if (_submitting) return false;
    if (!SessionPaymentService.amountMatchesFee(_amountCtrl.text)) {
      return false;
    }
    final digits = _cardNumberCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 13) return false;
    if (!_expiryPattern.hasMatch(_expiryCtrl.text.trim())) return false;
    if (_cvvCtrl.text.trim().length < 3) return false;
    return true;
  }

  static final _expiryPattern = RegExp(r'^(0[1-9]|1[0-2])\/\d{2}$');

  void _validateAmount() {
    setState(() {
      if (_amountCtrl.text.trim().isEmpty) {
        _amountError = null;
      } else if (!SessionPaymentService.amountMatchesFee(_amountCtrl.text)) {
        _amountError = 'session_payment_amount_mismatch'.tr(
          namedArgs: {'amount': _feeLabel},
        );
      } else {
        _amountError = null;
      }
    });
  }

  Future<void> _submitPayment() async {
    if (!_formKey.currentState!.validate()) return;
    _validateAmount();
    if (_amountError != null || !_canPay) return;

    setState(() => _submitting = true);
    try {
      await SessionPaymentService.instance.markPaid(_appointmentId);
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop(true);
      messenger.showSnackBar(
        SnackBar(content: Text('session_payment_success'.tr())),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final therapistName = appointmentTherapistName(widget.appointment);

    return AlertDialog(
      insetPadding: Responsive.padSymmetric(context, horizontal: 20),
      title: Text(
        widget.isPreJoin
            ? 'session_payment_prejoin_title'.tr()
            : 'session_payment_title'.tr(),
        style: TextStyle(fontSize: context.rf(18)),
      ),
      content: SizedBox(
        width: context.screenWidth - context.rs(40),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.isPreJoin
                      ? 'session_payment_prejoin_body'.tr(
                          namedArgs: {
                            'amount': _feeLabel,
                            'therapist': therapistName,
                          },
                        )
                      : 'session_payment_body'.tr(
                          namedArgs: {
                            'amount': _feeLabel,
                            'therapist': therapistName,
                          },
                        ),
                  style: TextStyle(
                    fontSize: context.rf(14),
                    color: AppColors.textSec,
                  ),
                ),
                SizedBox(height: context.rg(12)),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(
                    horizontal: context.rs(12),
                    vertical: context.rs(10),
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.warningBg,
                    borderRadius: BorderRadius.circular(context.rs(10)),
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.payments_outlined,
                        color: AppColors.warningText,
                        size: context.rf(20),
                      ),
                      SizedBox(width: context.rs(8)),
                      Expanded(
                        child: Text(
                          'session_payment_amount_due'.tr(
                            namedArgs: {'amount': _feeLabel},
                          ),
                          style: TextStyle(
                            fontSize: context.rf(14),
                            fontWeight: FontWeight.w700,
                            color: AppColors.warningText,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: context.rg(16)),
                TextFormField(
                  controller: _cardNumberCtrl,
                  decoration: InputDecoration(
                    labelText: 'session_payment_card_number'.tr(),
                    border: const OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(19),
                    _CardNumberFormatter(),
                  ],
                  onChanged: (_) => setState(() {}),
                  validator: (v) {
                    final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                    if (digits.length < 13) {
                      return 'session_payment_card_invalid'.tr();
                    }
                    return null;
                  },
                ),
                SizedBox(height: context.rg(12)),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _expiryCtrl,
                        decoration: InputDecoration(
                          labelText: 'session_payment_expiry'.tr(),
                          hintText: 'MM/YY',
                          border: const OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(4),
                          _ExpiryFormatter(),
                        ],
                        onChanged: (_) => setState(() {}),
                        validator: (v) {
                          if (!_expiryPattern.hasMatch((v ?? '').trim())) {
                            return 'session_payment_expiry_invalid'.tr();
                          }
                          return null;
                        },
                      ),
                    ),
                    SizedBox(width: context.rs(12)),
                    Expanded(
                      child: TextFormField(
                        controller: _cvvCtrl,
                        decoration: InputDecoration(
                          labelText: 'session_payment_cvv'.tr(),
                          border: const OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                        obscureText: true,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(4),
                        ],
                        onChanged: (_) => setState(() {}),
                        validator: (v) {
                          if ((v ?? '').trim().length < 3) {
                            return 'session_payment_cvv_invalid'.tr();
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                SizedBox(height: context.rg(12)),
                TextFormField(
                  controller: _amountCtrl,
                  decoration: InputDecoration(
                    labelText: 'session_payment_amount_label'.tr(
                      namedArgs: {'amount': _feeLabel},
                    ),
                    hintText: _feeLabel,
                    border: const OutlineInputBorder(),
                    errorText: _amountError,
                    prefixText: '\$ ',
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  onChanged: (_) => _validateAmount(),
                  validator: (v) {
                    if (!SessionPaymentService.amountMatchesFee(v ?? '')) {
                      return 'session_payment_amount_mismatch'.tr(
                        namedArgs: {'amount': _feeLabel},
                      );
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        FilledButton(
          onPressed: _canPay ? _submitPayment : null,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.green,
            foregroundColor: AppColors.white,
            disabledBackgroundColor: AppColors.border,
          ),
          child: _submitting
              ? SizedBox(
                  width: context.rs(18),
                  height: context.rs(18),
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  widget.isPreJoin
                      ? 'session_payment_pay_and_join'.tr(
                          namedArgs: {'amount': _feeLabel},
                        )
                      : 'session_payment_pay'.tr(namedArgs: {'amount': _feeLabel}),
                  style: TextStyle(fontSize: context.rf(14)),
                ),
        ),
      ],
    );
  }
}

class _CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

class _ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return const TextEditingValue(text: '');
    }
    if (digits.length <= 2) {
      return TextEditingValue(
        text: digits,
        selection: TextSelection.collapsed(offset: digits.length),
      );
    }
    final text = '${digits.substring(0, 2)}/${digits.substring(2)}';
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
