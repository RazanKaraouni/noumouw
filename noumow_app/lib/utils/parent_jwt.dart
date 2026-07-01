import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/session_manager.dart';

/// Bearer token for Node API + Socket.io (Supabase or app JWT session).
String? resolveParentJwt() {
  if (SessionManager.instance.hasValidSession) {
    final sessionToken = SessionManager.instance.session?.token.trim();
    if (sessionToken != null && sessionToken.isNotEmpty) {
      return sessionToken;
    }
  }
  return Supabase.instance.client.auth.currentSession?.accessToken;
}
