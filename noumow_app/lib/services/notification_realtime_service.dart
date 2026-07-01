import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../utils/parent_jwt.dart';
import 'fcm_service.dart';
import 'notification_api_service.dart';
import 'realtime_socket_service.dart';

/// App-wide notification counter and socket listener.
///
/// [notificationCount] starts at 0; each `new-notification` socket event adds 1.
class NotificationRealtimeService extends ChangeNotifier {
  NotificationRealtimeService._();

  static final NotificationRealtimeService instance =
      NotificationRealtimeService._();

  int notificationCount = 0;
  final List<Map<String, dynamic>> history = [];

  io.Socket? _socket;
  final _api = NotificationApiService();
  bool _bootstrapping = false;
  String? _activeToken;

  /// Idempotent: loads history and keeps one socket open for real-time alerts.
  Future<void> ensureConnected() async {
    if (_bootstrapping) return;
    final token = resolveParentJwt();
    if (token == null || token.isEmpty) return;

    if (_socket != null && _activeToken == token) {
      if (_socket!.connected) return;
    }

    _bootstrapping = true;
    try {
      try {
        final rows = await _api.fetchMine();
        history
          ..clear()
          ..addAll(rows);
        notifyListeners();
      } catch (e) {
        debugPrint('[NotificationRealtime] history load: $e');
      }

      _attachSocket(token);
    } finally {
      _bootstrapping = false;
    }
  }

  void _attachSocket(String token) {
    _activeToken = token;
    if (_socket != null) {
      _socket!.off('new-notification');
      _socket!.off('reconnect');
      _socket!.dispose();
      _socket = null;
    }

    void bindListeners(io.Socket socket) {
      socket.off('new-notification');
      socket.on('new-notification', _onNewNotification);
      debugPrint('[NotificationRealtime] listening for new-notification');
    }

    _socket = createAuthenticatedSocket(
      jwtToken: token,
      onReady: bindListeners,
    );
    bindListeners(_socket!);
    _socket!.on('reconnect', (_) => bindListeners(_socket!));
  }

  void _onNewNotification(dynamic raw) {
    try {
      final map = _parseNotification(raw);
      if (map == null) return;
      notificationCount += 1;
      history.insert(0, map);
      if (history.length > 50) {
        history.removeRange(50, history.length);
      }
      notifyListeners();
      unawaited(_showPushAlert(map));
      debugPrint(
        '[NotificationRealtime] new-notification (#$notificationCount): ${map['title']}',
      );
    } catch (e) {
      debugPrint('[NotificationRealtime] parse error: $e');
    }
  }

  Future<void> _showPushAlert(Map<String, dynamic> map) async {
    final title = (map['title'] ?? '').toString();
    final body = (map['message'] ?? map['body'] ?? '').toString();
    final id = (map['id'] ?? '').toString().trim();
    final dedupeKey = id.isNotEmpty
        ? 'n:$id'
        : 'rt:${map['type']}:$title:${map['timestamp']}';

    await FcmService.instance.showAlert(
      title: title,
      body: body,
      dedupeKey: dedupeKey,
    );
  }

  Map<String, dynamic>? _parseNotification(dynamic raw) {
    if (raw is Map) {
      return Map<String, dynamic>.from(raw);
    }
    if (raw is String) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    }
    return null;
  }

  /// Hides the badge when the user opens the list (count was viewed).
  void markViewed() {
    if (notificationCount == 0) return;
    notificationCount = 0;
    notifyListeners();
  }

  Future<bool> clearAll() async {
    try {
      await _api.clearMine();
      history.clear();
      notificationCount = 0;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[NotificationRealtime] clear failed: $e');
      return false;
    }
  }

  void disconnect() {
    _socket?.off('new-notification');
    _socket?.dispose();
    _socket = null;
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
