import 'package:flutter/material.dart';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'offline_cache_service.dart';
import 'secure_auth_storage.dart';

import 'session_manager.dart';



/// Signs out of Supabase and clears active sessions. Remembered login
/// credentials (from "Remember me") are kept so the login form can pre-fill.

class AuthSignOut {

  AuthSignOut._();



  /// Clears secure session storage first so a stale blob cannot be replayed

  /// after [signOut] if the network call fails partway through.

  static Future<void> signOut() async {

    await OfflineCacheService.instance.clearAll();

    await SecureAuthStorage.instance.clearPersistedSession();

    await SessionManager.instance.clearSession();

    await Supabase.instance.client.auth.signOut();

  }



  static void navigateToAuthSplash(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
      '/welcome',
      (route) => false,
    );
  }

  /// Navigates to [AuthSplashScreen] before clearing the session so the caller's
  /// [BuildContext] is still mounted (sign-out rebuilds [RootSessionGate] and
  /// disposes nested screens such as settings).
  static Future<void> signOutAndNavigateToAuthSplash(BuildContext context) async {
    if (!context.mounted) return;
    navigateToAuthSplash(context);
    await signOut();
  }

}

