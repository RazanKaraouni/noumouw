import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Raw env override for the website backend (`website/backend`, no trailing slash).
/// Set with:
/// `flutter run --dart-define=THERAPISTS_API_BASE=http://192.168.1.10:5000`
/// or `THERAPISTS_API_BASE` in `assets/app.env`.
const String therapistsApiBase = String.fromEnvironment('THERAPISTS_API_BASE');

String _trimTrailingSlash(String base) {
  return base.endsWith('/') ? base.substring(0, base.length - 1) : base;
}

bool _isLocalDevHttpHost(String base) {
  final lower = base.toLowerCase();
  return lower.contains('127.0.0.1') ||
      lower.contains('localhost') ||
      lower.contains('10.0.2.2') ||
      lower.contains('192.168.') ||
      lower.startsWith('http://172.');
}

void _assertSecureApiBase(String base) {
  final uri = Uri.tryParse(base);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw StateError('THERAPISTS_API_BASE must be a valid URL: $base');
  }

  if (kReleaseMode && uri.scheme != 'https') {
    throw StateError(
      'THERAPISTS_API_BASE must use HTTPS in release builds. Got: $base',
    );
  }

  if (!kReleaseMode && uri.scheme == 'http' && !_isLocalDevHttpHost(base)) {
    debugPrint(
      '[therapists_api] HTTP is only allowed for local dev hosts in debug builds: $base',
    );
  }
}

/// Resolves a sensible backend base URL per platform when no env override exists.
String resolvedTherapistsApiBase() {
  final envBase = therapistsApiBase.trim();
  if (envBase.isNotEmpty) {
    final base = _trimTrailingSlash(envBase);
    _assertSecureApiBase(base);
    return base;
  }

  final dotenvBase = dotenv.env['THERAPISTS_API_BASE']?.trim() ?? '';
  if (dotenvBase.isNotEmpty) {
    final base = _trimTrailingSlash(dotenvBase);
    _assertSecureApiBase(base);
    return base;
  }

  if (kReleaseMode) {
    throw StateError(
      'THERAPISTS_API_BASE must be set to an HTTPS URL in release builds.',
    );
  }

  // Debug-only fallbacks for local backend (`website/backend`).
  if (kIsWeb) return 'http://127.0.0.1:5000';
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'http://10.0.2.2:5000';
    default:
      return 'http://localhost:5000';
  }
}
