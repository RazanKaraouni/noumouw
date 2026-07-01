import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../providers/signup_controller.dart';
import '../services/auth_service.dart';
import '../services/signup_validator.dart';
import '../widgets/loading_overlay.dart';
import '../widgets/otp_verification_dialog.dart';
import '../theme/app_colors.dart';
import '../widgets/gradient_primary_button.dart';

class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailFieldKey = GlobalKey<FormFieldState<String>>();
  final _emailFocusNode = FocusNode();
  bool _emailValidateOnInteraction = false;
  final _dobFieldKey = GlobalKey<FormFieldState<DateTime?>>();
  bool _dobValidateOnInteraction = false;
  DateTime? _selectedDob;
  final _fullNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();

  late final SignupController _controller;

  @override
  void initState() {
    super.initState();
    _emailFocusNode.addListener(() {
      if (!_emailFocusNode.hasFocus) {
        setState(() => _emailValidateOnInteraction = true);
        _emailFieldKey.currentState?.validate();
      }
    });
    _controller = SignupController(authService: AuthService());
  }

  @override
  void dispose() {
    _emailFocusNode.dispose();
    _fullNameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _confirmPassCtrl.dispose();
    _otpCtrl.dispose();
    _controller.dispose();
    super.dispose();
  }

  String? _localizedSignupError(String? err) {
    if (err == null) return null;
    switch (err) {
      case 'Email is required':
        return 'signup_email_required'.tr();
      case 'Password is required':
        return 'signup_password_required'.tr();
      case 'Confirm password is required':
        return 'signup_confirm_password_required'.tr();
      case 'Date of birth is required':
        return 'signup_dob_required'.tr();
      case 'Date of birth cannot be in the future':
        return 'signup_dob_future'.tr();
      case 'Enter a valid date of birth':
        return 'signup_dob_invalid'.tr();
      case 'OTP is required':
        return 'signup_otp_required'.tr();
      case 'Enter a valid email':
        return 'signup_email_invalid'.tr();
      case '8+ chars, at least 1 uppercase and 1 symbol':
        return 'signup_password_rules'.tr();
      case 'Passwords do not match':
        return 'signup_passwords_mismatch'.tr();
      case 'You must be at least 18 years old to create an account':
        return 'signup_dob_minimum'.tr();
      case 'OTP must be 6 digits':
        return 'signup_otp_invalid'.tr();
      default:
        return err;
    }
  }

  String? _requiredFieldValidator(String? value, String fieldLabelKey) {
    if (value == null || value.trim().isEmpty) {
      return 'signup_field_required'.tr(namedArgs: {'field': fieldLabelKey.tr()});
    }
    return null;
  }

  String? _emailValidator(String? value) {
    if (!_emailValidateOnInteraction) return null;
    return _localizedSignupError(SignupValidator.email(value));
  }

  String? _passwordValidator(String? value) =>
      _localizedSignupError(SignupValidator.password(value));

  String? _confirmPasswordValidator(String? value) =>
      _localizedSignupError(
        SignupValidator.confirmPassword(value, _passCtrl.text),
      );

  String? _dobValidator(DateTime? value) {
    if (!_dobValidateOnInteraction) return null;
    return _localizedSignupError(SignupValidator.dateOfBirth(value));
  }

  DateTime get _maxDob {
    final now = DateTime.now();
    return DateTime(now.year - SignupValidator.minimumAge, now.month, now.day);
  }

  DateTime get _minDob {
    final now = DateTime.now();
    return DateTime(now.year - 120, now.month, now.day);
  }

  String _formatDob(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: _minDob,
      lastDate: _maxDob,
      initialDate: _selectedDob ?? _maxDob,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      _selectedDob = DateTime(picked.year, picked.month, picked.day);
      _dobValidateOnInteraction = true;
    });
    _dobFieldKey.currentState?.didChange(_selectedDob);
    _dobFieldKey.currentState?.validate();
  }

  Future<void> _submit() async {
    setState(() {
      _emailValidateOnInteraction = true;
      _dobValidateOnInteraction = true;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_selectedDob == null) return;

    final ok = await _controller.signup(
      fullName: _fullNameCtrl.text,
      email: _emailCtrl.text,
      password: _passCtrl.text,
      dateOfBirth: _selectedDob!,
      acceptedPrivacyPolicy: true,
    );

    if (!ok || !mounted) return;
    final verified = await _showOtpDialog();
    if (!verified) return;
    if (!context.mounted) return;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => AlertDialog(
        title: Text('signup_account_created_title'.tr()),
        content: Text('signup_account_created_body'.tr()),
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
  }

  Future<bool> _showOtpDialog() async {
    _otpCtrl.clear();
    _controller.setOtpErrorMessage(null);
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (_, __) {
            return OtpVerificationDialog(
              email: _emailCtrl.text.trim(),
              otpController: _otpCtrl,
              errorText: _controller.otpErrorMessage,
              isLoading: _controller.otpLoading,
              onVerify: () async {
                final otpErr = _localizedSignupError(
                  SignupValidator.otp(_otpCtrl.text),
                );
                if (otpErr != null) {
                  _controller.setOtpErrorMessage(otpErr);
                  return;
                }

                final success = await _controller.verifyOtp(
                  email: _emailCtrl.text.trim(),
                  otp: _otpCtrl.text.trim(),
                );
                if (success && dialogCtx.mounted) {
                  Navigator.of(dialogCtx).pop(true);
                }
              },
              onResend: () async {
                await _controller.resendOtp(email: _emailCtrl.text.trim());
              },
            );
          },
        );
      },
    );
    return result == true;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) {
        return LoadingOverlay(
          isLoading: _controller.isLoading,
          child: Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              backgroundColor: Colors.white,
              elevation: 0,
              leading: Navigator.canPop(context)
                  ? IconButton(
                      icon: Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: context.rf(18),
                        color: AppColors.primary,
                      ),
                      onPressed: _controller.isLoading
                          ? null
                          : () => Navigator.pop(context),
                    )
                  : null,
            ),
            body: SafeArea(
              child: ResponsiveScrollBody(
                padding: EdgeInsets.fromLTRB(
                  context.rg(26),
                  0,
                  context.rg(26),
                  context.rg(36),
                ),
                child: AbsorbPointer(
                  absorbing: _controller.isLoading,
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _logoHeader(context),
                        if (_controller.errorMessage != null) ...[
                          _errorBanner(context, _controller.errorMessage!),
                          SizedBox(height: context.rg(16)),
                        ],
                        _field(
                          context,
                          'signup_full_name_hint'.tr(),
                          _fullNameCtrl,
                          validator: (v) => _requiredFieldValidator(
                            v,
                            'signup_full_name_label',
                          ),
                        ),
                        SizedBox(height: context.rg(12)),
                        _label(context, 'signup_email_label'.tr()),
                        _emailField(context),
                        SizedBox(height: context.rg(12)),
                        _label(context, 'signup_dob_label'.tr()),
                        _dobField(context),
                        SizedBox(height: context.rg(12)),
                        _genderSection(context),
                        SizedBox(height: context.rg(12)),
                        _passwordField(context),
                        SizedBox(height: context.rg(12)),
                        _confirmPasswordField(context),
                        SizedBox(height: context.rg(24)),
                        GradientPrimaryButton(
                          label: 'signup_create_account_button'.tr(),
                          onPressed: _submit,
                        ),
                        SizedBox(height: context.rg(20)),
                        Center(
                          child: GestureDetector(
                            onTap: () =>
                                Navigator.pushReplacementNamed(context, '/login'),
                            child: Text.rich(
                              TextSpan(
                                text: 'signup_have_account'.tr(),
                                style: TextStyle(
                                  color: const Color(0xFF6B7280),
                                  fontSize: context.rf(13),
                                ),
                                children: [
                                  TextSpan(
                                    text: 'signup_sign_in_link'.tr(),
                                    style: TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: context.rf(13),
                                    ),
                                  ),
                                ],
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _logoHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'signup_title'.tr(),
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
          'signup_subtitle'.tr(),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: context.rf(13),
            color: const Color(0xFF6B7280),
          ),
        ),
      ],
    );
  }

  Widget _genderSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(context, 'signup_gender_label'.tr()),
        Row(
          children: ['Male', 'Female'].map((g) {
            final selected = _controller.selectedGender == g;
            final label = g == 'Male'
                ? 'signup_gender_male'.tr()
                : 'signup_gender_female'.tr();
            return Expanded(
              child: GestureDetector(
                onTap: () => _controller.setGender(g),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: EdgeInsets.only(
                    right: g == 'Male' ? context.rg(6) : 0,
                    left: g == 'Female' ? context.rg(6) : 0,
                  ),
                  padding: Responsive.padSymmetric(context, vertical: 11),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary : const Color(0xFFF9FAFB),
                    borderRadius: Responsive.radius(context, 10),
                    border: Border.all(
                      color: selected ? AppColors.primary : const Color(0xFFE5E7EB),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        g == 'Male' ? Icons.face_rounded : Icons.face_3_rounded,
                        size: context.rf(16),
                        color: selected
                            ? Colors.white
                            : const Color(0xFF6B7280),
                      ),
                      SizedBox(width: context.rg(6)),
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(13),
                            fontWeight: FontWeight.w500,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF374151),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _emailField(BuildContext context) {
    return TextFormField(
      key: _emailFieldKey,
      controller: _emailCtrl,
      focusNode: _emailFocusNode,
      keyboardType: TextInputType.emailAddress,
      autovalidateMode: AutovalidateMode.disabled,
      validator: _emailValidator,
      style: TextStyle(fontSize: context.rf(14)),
      onChanged: (_) {
        if (_emailValidateOnInteraction) {
          setState(() => _emailValidateOnInteraction = false);
          _emailFieldKey.currentState?.validate();
        }
      },
      decoration: _inputDeco(context, 'signup_email_hint'.tr()),
    );
  }

  Widget _dobField(BuildContext context) {
    return FormField<DateTime?>(
      key: _dobFieldKey,
      initialValue: _selectedDob,
      validator: _dobValidator,
      builder: (state) {
        final errorText = state.errorText;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: _pickDob,
              child: InputDecorator(
                decoration: _inputDeco(context, 'signup_dob_hint'.tr())
                    .copyWith(
                  errorText: errorText,
                  suffixIcon: Icon(
                    Icons.calendar_today_rounded,
                    size: context.rf(18),
                    color: const Color(0xFF9CA3AF),
                  ),
                ),
                child: Text(
                  _selectedDob != null
                      ? _formatDob(_selectedDob!)
                      : 'signup_dob_select'.tr(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(14),
                    color: _selectedDob != null
                        ? const Color(0xFF111827)
                        : const Color(0xFF9CA3AF),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _passwordField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(context, 'signup_password_label'.tr()),
        TextFormField(
          controller: _passCtrl,
          obscureText: _controller.obscurePassword,
          validator: _passwordValidator,
          style: TextStyle(fontSize: context.rf(14)),
          decoration: _inputDeco(context, 'signup_password_hint'.tr()).copyWith(
            suffixIcon: IconButton(
              icon: Icon(
                _controller.obscurePassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: context.rf(18),
                color: const Color(0xFF9CA3AF),
              ),
              onPressed: _controller.togglePasswordVisibility,
            ),
          ),
        ),
      ],
    );
  }

  Widget _confirmPasswordField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(context, 'signup_confirm_password_label'.tr()),
        TextFormField(
          controller: _confirmPassCtrl,
          obscureText: _controller.obscureConfirmPassword,
          validator: _confirmPasswordValidator,
          style: TextStyle(fontSize: context.rf(14)),
          decoration:
              _inputDeco(context, 'signup_confirm_password_hint'.tr()).copyWith(
            suffixIcon: IconButton(
              icon: Icon(
                _controller.obscureConfirmPassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: context.rf(18),
                color: const Color(0xFF9CA3AF),
              ),
              onPressed: _controller.toggleConfirmPasswordVisibility,
            ),
          ),
        ),
      ],
    );
  }

  Widget _field(
    BuildContext context,
    String hint,
    TextEditingController controller, {
    String? Function(String?)? validator,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: TextStyle(fontSize: context.rf(14)),
      validator: validator ??
          (v) => _requiredFieldValidator(v, 'signup_field_generic'),
      decoration: _inputDeco(context, hint),
    );
  }

  Widget _errorBanner(BuildContext context, String error) {
    return Container(
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
            Icons.error_outline_rounded,
            color: const Color(0xFFB91C1C),
            size: context.rf(15),
          ),
          SizedBox(width: context.rg(8)),
          Expanded(
            child: Text(
              error,
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
