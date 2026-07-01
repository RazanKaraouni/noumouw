import 'package:flutter/foundation.dart';

/// Standard API SLA — matches backend `API_SLA_MS` (2 seconds) in release.
/// Local dev over USB/LAN is slower; allow more time in debug builds.
Duration get kStandardApiTimeout =>
    kDebugMode ? const Duration(seconds: 15) : const Duration(seconds: 2);

/// Long-running routes: AI assistant, article/PDF body, file uploads.
const Duration kExtendedApiTimeout = Duration(seconds: 30);
