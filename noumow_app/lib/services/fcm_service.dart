import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';
import 'session_manager.dart';

const AndroidNotificationChannel _androidChannel = AndroidNotificationChannel(
  'noumouw_push',
  'Notifications',
  description: 'Session, assignment, and activity alerts',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
);

/// Background FCM handler (app terminated / background). Must be top-level.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint(
    '[FCM] background message: ${message.notification?.title} — ${message.data}',
  );
}

/// FCM device token for push notifications.
class FcmService {
  FcmService._();

  static final FcmService instance = FcmService._();

  final http.Client _client = createApiHttpClient();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  String? deviceToken;

  final Set<String> _recentAlertKeys = {};
  bool _localNotificationsReady = false;

  Future<void> init() async {
    try {
      await _initLocalNotifications();
    } catch (e, st) {
      debugPrint('[FCM] local notifications init failed: $e\n$st');
    }

    await _requestPushPermission();

    final messaging = FirebaseMessaging.instance;
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    deviceToken = await messaging.getToken();
    debugPrint('[FCM] device token: $deviceToken');

    FirebaseMessaging.onMessage.listen((message) async {
      debugPrint('[FCM] foreground title: ${message.notification?.title}');
      debugPrint('[FCM] foreground body: ${message.notification?.body}');
      await _showForegroundNotification(message);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('[FCM] opened from notification data: ${message.data}');
    });

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[FCM] initial message data: ${initialMessage.data}');
    }

    messaging.onTokenRefresh.listen(_onTokenChanged);

    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (data.session != null) {
        unawaited(_sendTokenToBackend(deviceToken));
      }
    });

    SessionManager.instance.addListener(_onAppSessionChanged);

    await _sendTokenToBackend(deviceToken);
  }

  void _onAppSessionChanged() {
    if (SessionManager.instance.hasValidSession ||
        Supabase.instance.client.auth.currentSession != null) {
      unawaited(_sendTokenToBackend(deviceToken));
    }
  }

  Future<void> _requestPushPermission() async {
    if (defaultTargetPlatform == TargetPlatform.android) {
      final status = await Permission.notification.status;
      if (!status.isGranted) {
        final result = await Permission.notification.request();
        debugPrint('[FCM] Android notification permission: $result');
      }
      return;
    }

    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[FCM] iOS notification permission: ${settings.authorizationStatus}');
  }

  Future<void> _initLocalNotifications() async {
    if (_localNotificationsReady) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _localNotifications.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );

    final androidPlugin =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_androidChannel);
    _localNotificationsReady = true;
  }

  Future<void> _ensureLocalNotificationsReady() async {
    if (_localNotificationsReady) return;
    try {
      await _initLocalNotifications();
    } catch (e, st) {
      debugPrint('[FCM] local notifications init failed: $e\n$st');
      rethrow;
    }
  }

  /// Shows a system notification while the app is in the foreground.
  ///
  /// [dedupeKey] avoids duplicate banners when the same alert arrives via FCM
  /// and the realtime socket within a few seconds.
  Future<void> showAlert({
    required String title,
    required String body,
    String? dedupeKey,
  }) async {
    final trimmedTitle = title.trim();
    final trimmedBody = body.trim();
    if (trimmedTitle.isEmpty && trimmedBody.isEmpty) return;

    final key = dedupeKey?.trim();
    if (key != null && key.isNotEmpty) {
      if (_recentAlertKeys.contains(key)) return;
      _recentAlertKeys.add(key);
      Future<void>.delayed(const Duration(seconds: 8), () {
        _recentAlertKeys.remove(key);
      });
    }

    try {
      await _requestPushPermission();
      await _ensureLocalNotificationsReady();

      final id = (key ?? '$trimmedTitle|$trimmedBody').hashCode & 0x7fffffff;
      await _localNotifications.show(
        id,
        trimmedTitle.isEmpty ? null : trimmedTitle,
        trimmedBody.isEmpty ? null : trimmedBody,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _androidChannel.id,
            _androidChannel.name,
            channelDescription: _androidChannel.description,
            importance: Importance.max,
            priority: Priority.high,
            playSound: true,
            enableVibration: true,
            visibility: NotificationVisibility.public,
            ticker: trimmedTitle.isEmpty ? trimmedBody : trimmedTitle,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );
    } catch (e, st) {
      debugPrint('[FCM] showAlert failed: $e\n$st');
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final data = message.data;
    final title = message.notification?.title ?? data['title'];
    final body =
        message.notification?.body ?? data['body'] ?? data['message'];
    final notificationId = (data['notificationId'] ?? '').trim();
    final dedupeKey = notificationId.isNotEmpty
        ? 'n:$notificationId'
        : (message.messageId != null ? 'fcm:${message.messageId}' : null);

    await showAlert(
      title: title ?? '',
      body: body ?? '',
      dedupeKey: dedupeKey,
    );
  }

  Future<void> _onTokenChanged(String token) async {
    deviceToken = token;
    debugPrint('[FCM] token changed: $token');
    await _sendTokenToBackend(token);
  }

  Future<void> syncTokenWithBackend() async {
    await _sendTokenToBackend(deviceToken);
  }

  Future<void> _sendTokenToBackend(String? token) async {
    if (token == null || token.isEmpty) return;

    final headers = authHeaders(json: true);
    if (!headers.containsKey('Authorization')) {
      debugPrint('[FCM] skip token sync — not signed in');
      return;
    }

    final platform = _platformName();

    // Primary: backend API uses service role (avoids Supabase RLS upsert issues).
    final savedViaApi = await _saveTokenViaApi(token, platform);
    if (savedViaApi) return;

    // Fallback when the phone cannot reach the dev API (production / offline LAN).
    final userId = Supabase.instance.client.auth.currentSession?.user.id;
    if (userId != null) {
      await _saveTokenToSupabase(
        userId: userId,
        token: token,
        platform: platform,
      );
    }
  }

  String _platformName() {
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => 'android',
      TargetPlatform.iOS => 'ios',
      _ => 'web',
    };
  }

  /// Primary path: Supabase is reachable from the phone even when LAN API is not.
  Future<bool> _saveTokenToSupabase({
    required String userId,
    required String token,
    required String platform,
  }) async {
    try {
      await Supabase.instance.client.from('device_tokens').upsert(
        {
          'user_id': userId,
          'token': token,
          'platform': platform,
        },
        onConflict: 'token',
      );
      debugPrint('[FCM] token saved to Supabase');
      return true;
    } catch (e, st) {
      debugPrint('[FCM] Supabase token save failed: $e\n$st');
      return false;
    }
  }

  Future<bool> _saveTokenViaApi(String token, String platform) async {
    final headers = authHeaders(json: true);
    if (!headers.containsKey('Authorization')) return false;

    try {
      final res = await _client
          .post(
            Uri.parse('${resolvedTherapistsApiBase()}/api/save-token'),
            headers: headers,
            body: jsonEncode({
              'token': token,
              'platform': platform,
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (res.statusCode >= 200 && res.statusCode < 300) {
        debugPrint('[FCM] token registered with backend API');
        return true;
      }

      debugPrint(
        '[FCM] backend API token register failed (${res.statusCode}): ${res.body}',
      );
    } catch (e) {
      debugPrint('[FCM] backend API unreachable: $e');
    }
    return false;
  }
}
