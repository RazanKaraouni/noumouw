import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Serializable session blob for [GoTrueClient.recoverSession].
extension SessionPersistence on Session {
  String get persistSessionString => jsonEncode(this.toJson());
}
