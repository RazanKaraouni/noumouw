import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';
import 'otp_digit_input.dart';

class OtpVerificationDialog extends StatelessWidget {
  const OtpVerificationDialog({
    super.key,
    required this.email,
    required this.otpController,
    required this.errorText,
    required this.isLoading,
    required this.onVerify,
    required this.onResend,
  });

  final String email;
  final TextEditingController otpController;
  final String? errorText;
  final bool isLoading;
  final VoidCallback onVerify;
  final VoidCallback onResend;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      insetPadding: Responsive.padSymmetric(context, horizontal: 20),
      title: Text(
        'otp_title'.tr(),
        style: TextStyle(fontSize: context.rf(18)),
      ),
      content: SizedBox(
        width: context.screenWidth - context.rs(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'otp_prompt'.tr(namedArgs: {'email': email}),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: context.rf(14)),
            ),
            SizedBox(height: context.rg(16)),
            OtpDigitInput(
              controller: otpController,
              enabled: !isLoading,
              errorText: errorText,
              onCompleted: isLoading ? null : onVerify,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: isLoading ? null : () => Navigator.of(context).pop(false),
          child: Text(
            'otp_cancel'.tr(),
            style: TextStyle(fontSize: context.rf(14)),
          ),
        ),
        TextButton(
          onPressed: isLoading ? null : onResend,
          child: Text(
            'otp_resend'.tr(),
            style: TextStyle(fontSize: context.rf(14)),
          ),
        ),
        ElevatedButton(
          onPressed: isLoading ? null : onVerify,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: Responsive.padSymmetric(
              context,
              horizontal: 16,
              vertical: 10,
            ),
          ),
          child: isLoading
              ? SizedBox(
                  width: context.rs(16),
                  height: context.rs(16),
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  'otp_verify'.tr(),
                  style: TextStyle(fontSize: context.rf(14)),
                ),
        ),
      ],
    );
  }
}
