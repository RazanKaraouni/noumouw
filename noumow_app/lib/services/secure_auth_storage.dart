import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Hardware-backed storage for auth tokens (Supabase session + app JWT).
/// "Remember me" persists the Supabase session plus email/password for login
/// prefill — all via encrypted storage on mobile.
///
/// On web, [flutter_secure_storage] is not registered by default in dev runs,
/// so we persist via [SharedPreferences] instead.
class SecureAuthStorage {
  SecureAuthStorage._();

  static final SecureAuthStorage instance = SecureAuthStorage._();

  static const _persistedSessionKey = 'supabase_persisted_session';
  static const _appAuthSessionKey = 'app_auth_session';
  static const _rememberedEmailKey = 'remembered_login_email';
  static const _rememberedPasswordKey = 'remembered_login_password';

  final FlutterSecureStorage? _secureStorage = kIsWeb
      ? null
      : const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
            resetOnError: true,
          ),
        );

  Future<void> savePersistedSession(String sessionString) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_persistedSessionKey, sessionString);
      return;
    }
    await _secureStorage!.write(
      key: _persistedSessionKey,
      value: sessionString,
    );
  }

  Future<String?> readPersistedSession() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_persistedSessionKey);
    }
    return _secureStorage!.read(key: _persistedSessionKey);
  }

  Future<void> clearPersistedSession() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_persistedSessionKey);
      return;
    }
    await _secureStorage!.delete(key: _persistedSessionKey);
  }

  Future<void> saveAppAuthSession(String sessionJson) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_appAuthSessionKey, sessionJson);
      return;
    }
    await _secureStorage!.write(
      key: _appAuthSessionKey,
      value: sessionJson,
    );
  }

  Future<String?> readAppAuthSession() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_appAuthSessionKey);
    }
    return _secureStorage!.read(key: _appAuthSessionKey);
  }

  Future<void> clearAppAuthSession() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_appAuthSessionKey);
      return;
    }
    await _secureStorage!.delete(key: _appAuthSessionKey);
  }

  Future<void> saveRememberedEmail(String email) async {
    await _writePair(_rememberedEmailKey, email.trim());
  }

  Future<void> saveRememberedPassword(String password) async {
    await _writePair(_rememberedPasswordKey, password);
  }

  Future<String?> readRememberedEmail() async {
    final email = await _readPair(_rememberedEmailKey);
    if (email == null || email.isEmpty) return null;
    return email;
  }

  Future<String?> readRememberedPassword() async {
    final password = await _readPair(_rememberedPasswordKey);
    if (password == null || password.isEmpty) return null;
    return password;
  }

  Future<void> clearRememberedEmail() async {
    await _deletePair(_rememberedEmailKey);
    await _deletePair(_rememberedPasswordKey);
  }

  Future<void> _writePair(String key, String value) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
      return;
    }
    await _secureStorage!.write(key: key, value: value);
  }

  Future<String?> _readPair(String key) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    }
    return _secureStorage!.read(key: key);
  }

  Future<void> _deletePair(String key) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
      return;
    }
    await _secureStorage!.delete(key: key);
  }
}
