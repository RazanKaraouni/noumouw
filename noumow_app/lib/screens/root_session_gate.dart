import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/fcm_service.dart';
import '../services/notification_realtime_service.dart';
import '../services/session_manager.dart';
import 'auth_splash_screen.dart';
import 'home_page.dart';

/// Chooses welcome or parent home from the current session.
class RootSessionGate extends StatefulWidget {
  const RootSessionGate({super.key});

  @override
  State<RootSessionGate> createState() => _RootSessionGateState();
}

class _RootSessionGateState extends State<RootSessionGate> {
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
      unawaited(FcmService.instance.syncTokenWithBackend());
      NotificationRealtimeService.instance.ensureConnected();
    });
    SessionManager.instance.addListener(_onSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(FcmService.instance.syncTokenWithBackend());
      NotificationRealtimeService.instance.ensureConnected();
    });
  }

  void _onSessionChanged() {
    if (mounted) setState(() {});
    unawaited(FcmService.instance.syncTokenWithBackend());
    NotificationRealtimeService.instance.ensureConnected();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    SessionManager.instance.removeListener(_onSessionChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = Supabase.instance.client.auth.currentSession;
    final jwtSession = SessionManager.instance.hasValidSession;

    if (session == null && !jwtSession) {
      return const AuthSplashScreen(skipSessionCheck: true);
    }
    if (session == null && jwtSession) {
      return const HomePage();
    }

    return const HomePage();
  }
}
