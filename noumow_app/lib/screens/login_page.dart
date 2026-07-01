import 'dart:async';
import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/fcm_service.dart';
import '../services/auth_service.dart' as backend_auth;
import '../services/secure_auth_storage.dart';
import '../theme/app_colors.dart';
import '../utils/error_feedback.dart';
import '../widgets/gradient_primary_button.dart';
import '../utils/session_persistence.dart';
import '../utils/therapists_api.dart';
import 'post_login_video_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => LoginPageState();
}

class LoginPageState extends State<LoginPage> {
  final _formKey         = GlobalKey<FormState>();
  final _emailCtrl       = TextEditingController();
  final _passwordCtrl    = TextEditingController();
  bool _obscurePassword  = true;
  bool _rememberMe       = false;
  bool _isLoading        = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRememberedLogin();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRememberedLogin() async {
    final storage = SecureAuthStorage.instance;
    final results = await Future.wait([
      storage.readRememberedEmail(),
      storage.readRememberedPassword(),
    ]);
    final email = results[0];
    final password = results[1];
    if (!mounted || email == null) return;
    setState(() {
      _emailCtrl.text = email;
      if (password != null) _passwordCtrl.text = password;
      _rememberMe = true;
    });
  }

  Future<void> _handleSignIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      await _signInWithSupabase(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      await _completeSignIn();
    } on AuthException catch (e) {
      debugPrint('[Login] Supabase auth error: ${e.message}');
      if (isNetworkError(e) && _canUseBackendFallback()) {
        await _tryBackendFallback(e);
      } else {
        setState(() => _error = sanitizeUserMessage(e.message));
      }
    } on backend_auth.AuthException catch (e) {
      debugPrint('[Login] Backend auth error: ${e.message}');
      setState(() => _error = sanitizeUserMessage(e.message));
    } catch (e) {
      debugPrint('[Login] Sign-in error: $e');
      if (isNetworkError(e) && _canUseBackendFallback()) {
        await _tryBackendFallback(e);
      } else {
        setState(() => _error = userFacingErrorMessage(e));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _tryBackendFallback(Object originalError) async {
    debugPrint(
      '[Login] Supabase unreachable; trying backend at ${resolvedTherapistsApiBase()}',
    );
    try {
      await _signInViaBackendFallback();
    } catch (fallbackErr) {
      debugPrint('[Login] Backend fallback failed: $fallbackErr');
      if (!mounted) return;
      setState(() => _error = userFacingErrorMessage(fallbackErr));
    }
  }

  /// Local dev: allow LAN backend fallback when Supabase is unreachable from the phone.
  bool _canUseBackendFallback() {
    if (!kDebugMode) return false;
    final base = resolvedTherapistsApiBase().toLowerCase();
    return base.contains('192.168.') ||
        base.contains('10.0.2.2') ||
        base.contains('127.0.0.1') ||
        base.contains('localhost');
  }

  Future<void> _completeSignIn() async {
    await _persistRememberMe();
    if (!mounted) return;
    unawaited(FcmService.instance.syncTokenWithBackend());
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => const PostLoginVideoPage(),
      ),
    );
  }

  Future<void> _signInWithSupabase({
    required String email,
    required String password,
  }) async {
    await Supabase.instance.client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<void> _signInViaBackendFallback() async {
    final sessionPayload = await backend_auth.AuthService().parentLogin(
      email: _emailCtrl.text.trim(),
      password: _passwordCtrl.text,
    );
    await Supabase.instance.client.auth.recoverSession(
      jsonEncode(sessionPayload),
    );
    await _completeSignIn();
  }

  Future<void> _persistRememberMe() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return;
    if (_rememberMe) {
      await SecureAuthStorage.instance.savePersistedSession(
        session.persistSessionString,
      );
      await SecureAuthStorage.instance.saveRememberedEmail(
        _emailCtrl.text,
      );
      await SecureAuthStorage.instance.saveRememberedPassword(
        _passwordCtrl.text,
      );
    } else {
      await SecureAuthStorage.instance.clearPersistedSession();
      await SecureAuthStorage.instance.clearRememberedEmail();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: Icon(Icons.arrow_back_ios_new_rounded,
                    size: context.rf(18), color: AppColors.primary),
                onPressed: () => Navigator.pop(context),
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
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height -
                  MediaQuery.paddingOf(context).vertical -
                  kToolbarHeight,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                Text(
                  'login_welcome_back'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: context.rf(22),
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                    letterSpacing: -0.3,
                  ),
                ),
                SizedBox(height: context.rg(4)),
                Text(
                  'login_sign_in_subtitle'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
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
                  keyboardType: TextInputType.emailAddress,
                  style: TextStyle(fontSize: context.rf(14)),
                  decoration: _inputDeco(context, 'login_email_hint'.tr()),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'login_email_required'.tr();
                    }
                    if (!v.contains('@') || !v.contains('.')) {
                      return 'login_email_invalid'.tr();
                    }
                    return null;
                  },
                ),
                SizedBox(height: context.rg(18)),
                _label(context, 'login_password_label'.tr()),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscurePassword,
                  style: TextStyle(fontSize: context.rf(14)),
                  decoration: _inputDeco(context, 'login_password_hint'.tr())
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
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'login_password_required'.tr();
                    }
                    return null;
                  },
                ),
                Row(
                  children: [
                    SizedBox(
                      height: context.rs(24),
                      width: context.rs(24),
                      child: Checkbox(
                        value: _rememberMe,
                        onChanged: _isLoading
                            ? null
                            : (value) => setState(
                                  () => _rememberMe = value ?? false,
                                ),
                        activeColor: AppColors.primary,
                        side: const BorderSide(color: Color(0xFFD1D5DB)),
                        materialTapTargetSize:
                            MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                    SizedBox(width: context.rg(8)),
                    Expanded(
                      child: GestureDetector(
                        onTap: _isLoading
                            ? null
                            : () => setState(
                                  () => _rememberMe = !_rememberMe,
                                ),
                        child: Text(
                          'login_remember_me'.tr(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(13),
                            color: const Color(0xFF374151),
                          ),
                        ),
                      ),
                    ),
                    Flexible(
                      child: GestureDetector(
                        onTap: _isLoading
                            ? null
                            : () => Navigator.pushNamed(
                                  context,
                                  '/forgot-password',
                                ),
                        child: Text(
                          'login_forgot_password'.tr(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.end,
                          style: TextStyle(
                            fontSize: context.rf(13),
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: context.rg(20)),
                GradientPrimaryButton(
                  label: 'login_sign_in_button'.tr(),
                  onPressed: _isLoading ? null : _handleSignIn,
                  isLoading: _isLoading,
                ),
                SizedBox(height: context.rg(22)),
                Center(
                  child: GestureDetector(
                    onTap: () =>
                        Navigator.pushReplacementNamed(context, '/signup'),
                    child: Text.rich(
                      TextSpan(
                        text: 'login_no_account'.tr(),
                        style: TextStyle(
                          color: const Color(0xFF6B7280),
                          fontSize: context.rf(13),
                        ),
                        children: [
                          TextSpan(
                            text: 'login_sign_up_link'.tr(),
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
    );
  }

  Widget _label(BuildContext context, String text) => Padding(
        padding: EdgeInsets.only(bottom: context.rg(6)),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
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
