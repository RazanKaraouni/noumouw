import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/auth_service.dart';
import '../utils/error_feedback.dart';
import '../services/signup_validator.dart';
import '../theme/app_colors.dart';
import '../widgets/otp_verification_dialog.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _authService = AuthService();

  bool _isSendingCode = false;
  bool _isResetting = false;
  bool _otpVerified = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _otpLoading = false;
  String? _error;
  String? _otpErrorMessage;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  String? _localizedError(String? raw) {
    if (raw == null) return null;
    switch (raw) {
      case 'Email is required':
        return 'login_email_required'.tr();
      case 'Enter a valid email':
        return 'login_email_invalid'.tr();
      case 'Password is required':
        return 'login_password_required'.tr();
      case 'Confirm password is required':
        return 'forgot_password_confirm_required'.tr();
      case '8+ chars, at least 1 uppercase and 1 symbol':
        return 'signup_password_rules'.tr();
      case 'Passwords do not match':
        return 'signup_passwords_mismatch'.tr();
      case 'OTP is required':
        return 'forgot_password_otp_required'.tr();
      case 'OTP must be 6 digits':
        return 'forgot_password_otp_invalid'.tr();
      default:
        return raw;
    }
  }

  Future<void> _sendCode() async {
    final emailErr = _localizedError(SignupValidator.email(_emailCtrl.text));
    if (emailErr != null) {
      setState(() => _error = emailErr);
      return;
    }

    setState(() {
      _isSendingCode = true;
      _error = null;
      _otpVerified = false;
    });

    try {
      await _authService.forgotPassword(email: _emailCtrl.text.trim());
      if (!mounted) return;
      final verified = await _showOtpDialog();
      if (verified && mounted) {
        setState(() => _otpVerified = true);
      }
    } on AuthException catch (e) {
      setState(() => _error = sanitizeUserMessage(e.message));
    } catch (e) {
      setState(() => _error = userFacingErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isSendingCode = false);
    }
  }

  Future<bool> _showOtpDialog() async {
    _otpCtrl.clear();
    setState(() => _otpErrorMessage = null);

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (_, setDialogState) {
            return OtpVerificationDialog(
              email: _emailCtrl.text.trim(),
              otpController: _otpCtrl,
              errorText: _otpErrorMessage,
              isLoading: _otpLoading,
              onVerify: () async {
                final otpErr = _localizedError(
                  SignupValidator.otp(_otpCtrl.text),
                );
                if (otpErr != null) {
                  setDialogState(() => _otpErrorMessage = otpErr);
                  setState(() => _otpErrorMessage = otpErr);
                  return;
                }

                setDialogState(() {
                  _otpLoading = true;
                  _otpErrorMessage = null;
                });
                setState(() {
                  _otpLoading = true;
                  _otpErrorMessage = null;
                });

                try {
                  await _authService.confirmResetOtp(
                    email: _emailCtrl.text.trim(),
                    otpCode: _otpCtrl.text.trim(),
                  );
                  if (dialogCtx.mounted) {
                    Navigator.of(dialogCtx).pop(true);
                  }
                } on AuthException catch (e) {
                  setDialogState(() => _otpErrorMessage = sanitizeUserMessage(e.message));
                  setState(() => _otpErrorMessage = sanitizeUserMessage(e.message));
                } finally {
                  setDialogState(() => _otpLoading = false);
                  if (mounted) setState(() => _otpLoading = false);
                }
              },
              onResend: () async {
                setDialogState(() {
                  _otpLoading = true;
                  _otpErrorMessage = null;
                });
                setState(() {
                  _otpLoading = true;
                  _otpErrorMessage = null;
                });

                try {
                  await _authService.resendResetOtp(
                    email: _emailCtrl.text.trim(),
                  );
                  setDialogState(
                    () => _otpErrorMessage = 'forgot_password_otp_resent'.tr(),
                  );
                  setState(
                    () => _otpErrorMessage = 'forgot_password_otp_resent'.tr(),
                  );
                } on AuthException catch (e) {
                  setDialogState(() => _otpErrorMessage = sanitizeUserMessage(e.message));
                  setState(() => _otpErrorMessage = sanitizeUserMessage(e.message));
                } finally {
                  setDialogState(() => _otpLoading = false);
                  if (mounted) setState(() => _otpLoading = false);
                }
              },
            );
          },
        );
      },
    );

    return result == true;
  }

  Future<void> _resetPassword() async {
    if (!_otpVerified) {
      setState(() => _error = 'forgot_password_verify_otp_first'.tr());
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isResetting = true;
      _error = null;
    });

    try {
      await _authService.resetPassword(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogCtx) => AlertDialog(
          title: Text('forgot_password_success_title'.tr()),
          content: Text('forgot_password_success_body'.tr()),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: Text('signup_ok'.tr()),
            ),
          ],
        ),
      );

      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/login');
    } on AuthException catch (e) {
      setState(() => _error = sanitizeUserMessage(e.message));
    } catch (e) {
      setState(() => _error = userFacingErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isResetting = false);
    }
  }

  bool get _isBusy => _isSendingCode || _isResetting;

  Widget _logoIcon(BuildContext context) {
    final size = context.rs(52);
    return SizedBox(
      height: size,
      width: size,
      child: ClipRect(
        child: Align(
          alignment: Alignment.topCenter,
          heightFactor: 0.58,
          child: Image.asset(
            'assets/images/logo.png',
            fit: BoxFit.contain,
            alignment: Alignment.topCenter,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.logoBg,
      appBar: AppBar(
        backgroundColor: AppColors.logoBg,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            size: context.rf(18),
            color: AppColors.primary,
          ),
          onPressed: _isBusy ? null : () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: ResponsiveScrollBody(
          padding: Responsive.padSymmetric(
            context,
            horizontal: 26,
            vertical: 36,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _logoIcon(context),
                SizedBox(height: context.rg(28)),
                Text(
                  'forgot_password_title'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(22),
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                    letterSpacing: -0.3,
                  ),
                ),
                SizedBox(height: context.rg(4)),
                Text(
                  'forgot_password_subtitle'.tr(),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(13),
                    color: const Color(0xFF6B7280),
                  ),
                ),
                SizedBox(height: context.rg(28)),
                if (_error != null) ...[
                  Container(
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 14,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5F5),
                      border: Border.all(color: const Color(0xFFFECACA)),
                      borderRadius: Responsive.radius(context, 10),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.error_outline,
                          color: const Color(0xFFB91C1C),
                          size: context.rf(15),
                        ),
                        SizedBox(width: context.rg(8)),
                        Expanded(
                          child: Text(
                            _error!,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: const Color(0xFFB91C1C),
                              fontSize: context.rf(13),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: context.rg(20)),
                ],
                _label(context, 'login_email_label'.tr()),
                TextFormField(
                  controller: _emailCtrl,
                  enabled: !_isBusy,
                  keyboardType: TextInputType.emailAddress,
                  style: TextStyle(fontSize: context.rf(14)),
                  decoration: _inputDeco(context, 'login_email_hint'.tr()),
                  validator: (v) => _localizedError(SignupValidator.email(v)),
                ),
                SizedBox(height: context.rg(16)),
                SizedBox(
                  width: double.infinity,
                  height: context.rs(48),
                  child: OutlinedButton(
                    onPressed: _isBusy ? null : _sendCode,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(
                        borderRadius: Responsive.radius(context, 12),
                      ),
                    ),
                    child: _isSendingCode
                        ? SizedBox(
                            width: context.rs(18),
                            height: context.rs(18),
                            child: const CircularProgressIndicator(
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            _otpVerified
                                ? 'forgot_password_resend_code'.tr()
                                : 'forgot_password_send_code'.tr(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: context.rf(14),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                if (_otpVerified) ...[
                  SizedBox(height: context.rg(24)),
                  _label(context, 'login_password_label'.tr()),
                  TextFormField(
                    controller: _passwordCtrl,
                    enabled: !_isBusy,
                    obscureText: _obscurePassword,
                    style: TextStyle(fontSize: context.rf(14)),
                    decoration:
                        _inputDeco(context, 'forgot_password_new_hint'.tr())
                            .copyWith(
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          size: context.rf(18),
                          color: const Color(0xFF9CA3AF),
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                    validator: (v) =>
                        _localizedError(SignupValidator.password(v)),
                  ),
                  SizedBox(height: context.rg(18)),
                  _label(context, 'signup_confirm_password_label'.tr()),
                  TextFormField(
                    controller: _confirmPasswordCtrl,
                    enabled: !_isBusy,
                    obscureText: _obscureConfirmPassword,
                    style: TextStyle(fontSize: context.rf(14)),
                    decoration: _inputDeco(
                      context,
                      'signup_confirm_password_hint'.tr(),
                    ).copyWith(
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          size: context.rf(18),
                          color: const Color(0xFF9CA3AF),
                        ),
                        onPressed: () => setState(
                          () => _obscureConfirmPassword =
                              !_obscureConfirmPassword,
                        ),
                      ),
                    ),
                    validator: (v) => _localizedError(
                      SignupValidator.confirmPassword(
                        v,
                        _passwordCtrl.text,
                      ),
                    ),
                  ),
                  SizedBox(height: context.rg(20)),
                  SizedBox(
                    width: double.infinity,
                    height: context.rs(50),
                    child: ElevatedButton(
                      onPressed: _isBusy ? null : _resetPassword,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor:
                            AppColors.primary.withOpacity(0.6),
                        shape: RoundedRectangleBorder(
                          borderRadius: Responsive.radius(context, 12),
                        ),
                        elevation: 0,
                      ),
                      child: _isResetting
                          ? SizedBox(
                              width: context.rs(18),
                              height: context.rs(18),
                              child: const CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'forgot_password_reset_button'.tr(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: context.rf(15),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(BuildContext context, String text) => Padding(
        padding: EdgeInsets.only(bottom: context.rg(6)),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w500,
            color: const Color(0xFF374151),
          ),
        ),
      );

  InputDecoration _inputDeco(BuildContext context, String hint) =>
      InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: const Color(0xFF9CA3AF),
          fontSize: context.rf(14),
        ),
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        contentPadding: Responsive.padSymmetric(
          context,
          horizontal: 14,
          vertical: 13,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: Responsive.radius(context, 10),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: Responsive.radius(context, 10),
          borderSide: BorderSide(
            color: AppColors.primary,
            width: context.rs(1.5),
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: Responsive.radius(context, 10),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: Responsive.radius(context, 10),
          borderSide: BorderSide(
            color: const Color(0xFFEF4444),
            width: context.rs(1.5),
          ),
        ),
        errorStyle: TextStyle(
          fontSize: context.rf(11),
          color: const Color(0xFFB91C1C),
        ),
      );
}
