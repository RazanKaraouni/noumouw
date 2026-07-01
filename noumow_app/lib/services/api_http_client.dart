import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Shared HTTP client for Nomou API calls.
/// Pinning via http_certificate_pinning was removed — it caused native Android crashes on launch.
/// Release HTTPS pinning can be re-added with dart:io + package:crypto when needed.
http.Client createApiHttpClient() {
  return http.Client();
}
