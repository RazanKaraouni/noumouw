import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/secure_auth_storage.dart';
import '../services/session_manager.dart';
import '../theme/app_colors.dart';
import '../widgets/gradient_primary_button.dart';
import 'login_page.dart';
import 'root_session_gate.dart';
import 'signup_page.dart';

/// Cold-start gate: auto-login when a session exists; otherwise branded entry.
class AuthSplashScreen extends StatefulWidget {
  const AuthSplashScreen({super.key, this.skipSessionCheck = false});

  /// When true (e.g. after logout), show Sign Up / Login immediately.
  final bool skipSessionCheck;

  @override
  State<AuthSplashScreen> createState() => _AuthSplashScreenState();
}

class _AuthSplashScreenState extends State<AuthSplashScreen> {
  late bool _checkingSession;

  @override
  void initState() {
    super.initState();
    _checkingSession = !widget.skipSessionCheck;
    if (!widget.skipSessionCheck) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
    }
  }

  Future<void> _initialize() async {
    try {
      await SessionManager.instance
          .init()
          .timeout(const Duration(seconds: 10));
    } catch (_) {}

    final recovered = await _tryRecoverPersistedSession();
    if (!mounted) return;

    if (recovered ||
        SessionManager.instance.hasValidSession ||
        Supabase.instance.client.auth.currentSession != null) {
      _openApp();
      return;
    }

    if (mounted) setState(() => _checkingSession = false);
  }

  Future<bool> _tryRecoverPersistedSession() async {
    try {
      final stored = await SecureAuthStorage.instance
          .readPersistedSession()
          .timeout(const Duration(seconds: 8));
      if (stored == null || stored.trim().isEmpty) return false;

      final response = await Supabase.instance.client.auth
          .recoverSession(stored)
          .timeout(const Duration(seconds: 12));
      if (response.session != null) return true;

      await SecureAuthStorage.instance.clearPersistedSession();
    } catch (_) {
      await SecureAuthStorage.instance.clearPersistedSession();
    }
    return false;
  }

  void _openApp() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const RootSessionGate()),
    );
  }

  void _openSignup() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const SignupPage()),
    );
  }

  void _openLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const LoginPage()),
    );
  }

  static const _splashBackgroundAsset = 'assets/images/logoversion7.png';

  static const _brandGradient = LinearGradient(
    colors: [AppColors.primary, AppColors.green],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  Widget _gradientText(
    String text, {
    required TextStyle style,
    TextAlign textAlign = TextAlign.center,
    int? maxLines,
  }) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => _brandGradient.createShader(bounds),
      child: Text(
        text,
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: style.copyWith(color: AppColors.white),
      ),
    );
  }

  Widget _gradientButton({
    required BuildContext context,
    required String label,
    required VoidCallback onPressed,
  }) {
    return GradientPrimaryButton(
      label: label,
      onPressed: onPressed,
      height: 52,
      radius: 14,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            _splashBackgroundAsset,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),
          SafeArea(
            child: _checkingSession
                ? _buildSessionCheck(context)
                : _buildEntry(context),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionCheck(BuildContext context) {
    return const Center(
      child: SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          color: AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildEntry(BuildContext context) {
    return Padding(
      padding: Responsive.padSymmetric(context, horizontal: 28),
      child: Column(
        children: [
          SizedBox(height: context.rg(68)),
          _gradientText(
            'NOUMOUW',
            maxLines: 1,
            style: TextStyle(
              fontSize: context.rf(18),
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          _gradientText(
            'splash_summary'.tr(),
            maxLines: 5,
            style: TextStyle(
              fontSize: context.rf(12),
              height: 1.55,
              fontWeight: FontWeight.w400,
            ),
          ),
          SizedBox(height: context.rg(10)),
          _gradientText(
            'welcome_built_for_lebanon'.tr(),
            maxLines: 2,
            style: TextStyle(
              fontSize: context.rf(12),
              letterSpacing: 0.4,
              fontWeight: FontWeight.w400,
            ),
          ),
          SizedBox(height: context.rg(24)),
          _gradientButton(
            context: context,
            label: 'splash_sign_up'.tr(),
            onPressed: _openSignup,
          ),
          SizedBox(height: context.rg(12)),
          _gradientButton(
            context: context,
            label: 'splash_login'.tr(),
            onPressed: _openLogin,
          ),
          SizedBox(height: context.rg(28)),
        ],
      ),
    );
  }
}
