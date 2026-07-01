import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Encrypted JSON cache for offline reads that may contain PII (children,
/// appointments, parent names, therapist directory rows).
///
/// Team: evaluate whether each offline cache is still necessary for UX; until
/// then, [clearAll] runs on logout so PII does not persist after sign-out.
class OfflineCacheService {
  OfflineCacheService._();

  static final OfflineCacheService instance = OfflineCacheService._();

  static const _prefix = 'offline_cache_v1:';
  static const _keysIndexKey = '${_prefix}__key_index__';

  final FlutterSecureStorage? _secureStorage = kIsWeb
      ? null
      : const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
            resetOnError: true,
          ),
        );

  String _k(String key) => '$_prefix$key';

  Future<Set<String>> _readKeyIndex() async {
    final raw = await _readRaw(_keysIndexKey);
    if (raw == null || raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return {};
      return decoded.map((e) => e.toString()).toSet();
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeKeyIndex(Set<String> keys) async {
    await _writeRaw(_keysIndexKey, jsonEncode(keys.toList()..sort()));
  }

  Future<void> _trackKey(String logicalKey) async {
    final keys = await _readKeyIndex()..add(logicalKey);
    await _writeKeyIndex(keys);
  }

  Future<void> _writeRaw(String storageKey, String value) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(storageKey, value);
      return;
    }
    await _secureStorage!.write(key: storageKey, value: value);
  }

  Future<String?> _readRaw(String storageKey) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(storageKey);
    }
    return _secureStorage!.read(key: storageKey);
  }

  Future<void> _deleteRaw(String storageKey) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(storageKey);
      return;
    }
    await _secureStorage!.delete(key: storageKey);
  }

  Future<void> saveJson(String key, Object value) async {
    await _trackKey(key);
    await _writeRaw(_k(key), jsonEncode(value));
  }

  Future<T?> readJson<T>(String key) async {
    final raw = await _readRaw(_k(key));
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as T;
    } catch (_) {
      return null;
    }
  }

  /// Removes all offline cache entries (call on logout).
  Future<void> clearAll() async {
    final keys = await _readKeyIndex();
    for (final logicalKey in keys) {
      await _deleteRaw(_k(logicalKey));
    }
    await _deleteRaw(_keysIndexKey);

    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final legacy = prefs
          .getKeys()
          .where((k) => k.startsWith(_prefix))
          .toList();
      for (final legacyKey in legacy) {
        await prefs.remove(legacyKey);
      }
    }
  }
}
