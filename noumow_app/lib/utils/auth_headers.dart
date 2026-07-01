import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/session_manager.dart';

Map<String, String> authHeaders({bool json = false}) {
  final headers = <String, String>{
    if (json) 'Content-Type': 'application/json',
  };

  // Prefer Supabase session when signed in (login path); fall back to app JWT (signup OTP).
  final supabaseToken =
      Supabase.instance.client.auth.currentSession?.accessToken;
  if (supabaseToken != null && supabaseToken.trim().isNotEmpty) {
    headers['Authorization'] = 'Bearer $supabaseToken';
    return headers;
  }

  final fromSession = SessionManager.instance.authHeaders();
  final sessionAuth = fromSession['Authorization']?.trim();
  if (sessionAuth != null && sessionAuth.isNotEmpty) {
    headers['Authorization'] = sessionAuth;
  }
  return headers;
}
