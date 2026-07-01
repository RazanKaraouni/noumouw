import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/auth_session.dart';
import 'secure_auth_storage.dart';

class SessionManager extends ChangeNotifier {
  SessionManager._();
  static final SessionManager instance = SessionManager._();

  static const _legacySessionKey = 'app_auth_session';
  AuthSession? _session;

  AuthSession? get session => _session;
  bool get hasValidSession => _session != null && !_session!.isExpired;

  Future<void> init() async {
    var raw = await SecureAuthStorage.instance.readAppAuthSession();

    // One-time migration from SharedPreferences (pre-secure-storage builds).
    if (raw == null || raw.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      raw = prefs.getString(_legacySessionKey);
      if (raw != null && raw.isNotEmpty) {
        await SecureAuthStorage.instance.saveAppAuthSession(raw);
        await prefs.remove(_legacySessionKey);
      }
    }

    if (raw == null || raw.isEmpty) return;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is Map<String, dynamic>) {
        final restored = AuthSession.fromJson(parsed);
        if (restored.token.isNotEmpty && !restored.isExpired) {
          _session = restored;
        } else {
          await clearSession();
        }
      }
    } catch (_) {
      await clearSession();
    }
  }

  Future<void> saveSession(AuthSession session) async {
    _session = session;
    await SecureAuthStorage.instance.saveAppAuthSession(
      jsonEncode(session.toJson()),
    );
    notifyListeners();
  }

  Future<void> clearSession() async {
    _session = null;
    await SecureAuthStorage.instance.clearAppAuthSession();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacySessionKey);
    notifyListeners();
  }

  Map<String, String> authHeaders() {
    if (!hasValidSession) return const {};
    return _session!.authHeaders;
  }
}
