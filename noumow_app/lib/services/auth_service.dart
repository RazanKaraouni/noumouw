import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/auth_session.dart';
import '../models/signup_request.dart';
import '../utils/auth_headers.dart';
import '../utils/therapists_api.dart';
import 'api_http_client.dart';
import 'session_manager.dart';

class AuthService {
  AuthService({http.Client? client}) : _client = client ?? createApiHttpClient();

  final http.Client _client;
  static const Duration _timeout = Duration(seconds: 15);

  String get _baseUrl => '${resolvedTherapistsApiBase()}/api';

  Future<void> signup(SignupRequest request) async {
    final response = await _post('/signup', request.toJson());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _friendlyMessage(_extractMessage(response, 'Sign up failed.')));
    }
  }

  Future<AuthSession?> verifyOtp({
    required String email,
    required String otpCode,
    required String role,
  }) async {
    final response = await _post('/verify', {
      'email': email.trim(),
      'otp_code': otpCode.trim(),
      'role': role,
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _friendlyMessage(_extractMessage(response, 'Invalid OTP')));
    }

    final payload = _decodeMap(response.body);
    final sessionPayload = payload?['session'];
    if (sessionPayload is Map<String, dynamic>) {
      final token = sessionPayload['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        final session = AuthSession(
          token: token,
          email: email.trim().toLowerCase(),
          role: role,
        );
        await SessionManager.instance.saveSession(session);
        return session;
      }
    }
    return null;
  }

  Future<void> resendOtp({
    required String email,
    required String role,
  }) async {
    final response = await _post('/resend-otp', {
      'email': email.trim(),
      'role': role,
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _friendlyMessage(_extractMessage(response, 'Could not resend OTP.')));
    }
  }

  Future<void> forgotPassword({required String email}) async {
    final response = await _post('/forgot-password', {
      'email': email.trim().toLowerCase(),
      'role': 'parent',
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(_friendlyMessage(
          _extractMessage(response, 'Could not send reset code.')));
    }
  }

  Future<void> confirmResetOtp({
    required String email,
    required String otpCode,
  }) async {
    final response = await _post('/confirm-reset-otp', {
      'email': email.trim().toLowerCase(),
      'otp_code': otpCode.trim(),
      'role': 'parent',
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _friendlyMessage(_extractMessage(response, 'Invalid OTP')));
    }
  }

  Future<void> resendResetOtp({required String email}) async {
    final response = await _post('/resend-reset-otp', {
      'email': email.trim().toLowerCase(),
      'role': 'parent',
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _friendlyMessage(_extractMessage(response, 'Could not resend OTP.')));
    }
  }

  Future<void> resetPassword({
    required String email,
    required String password,
  }) async {
    final response = await _post('/reset-password', {
      'email': email.trim().toLowerCase(),
      'password': password,
      'role': 'parent',
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(_friendlyMessage(
          _extractMessage(response, 'Could not reset password.')));
    }
  }

  /// LAN fallback when the phone cannot reach Supabase directly (local dev).
  Future<Map<String, dynamic>> parentLogin({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse('$_baseUrl/auth/parent-login'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email.trim().toLowerCase(),
              'password': password,
            }),
          )
          .timeout(_timeout);

      if (response.statusCode == 401) {
        throw const AuthException('Invalid email or password.');
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(_friendlyMessage(
            _extractMessage(response, 'Sign in failed. Please try again.')));
      }

      final payload = _decodeMap(response.body);
      final sessionPayload = payload?['session'];
      if (sessionPayload is! Map<String, dynamic>) {
        throw const AuthException('Sign in failed. Please try again.');
      }
      final accessToken = sessionPayload['access_token']?.toString() ?? '';
      final refreshToken = sessionPayload['refresh_token']?.toString() ?? '';
      if (accessToken.isEmpty || refreshToken.isEmpty) {
        throw const AuthException('Sign in failed. Please try again.');
      }
      return sessionPayload;
    } on AuthException {
      rethrow;
    } on TimeoutException {
      throw const AuthException('Server is taking too long. Please try again.');
    } catch (_) {
      throw const AuthException(
          'Cannot connect to server right now. Please try again soon.');
    }
  }

  Future<http.Response> _post(String path, Map<String, dynamic> body) async {
    try {
      return await _client
          .post(
            Uri.parse('$_baseUrl$path'),
            headers: authHeaders(json: true),
            body: jsonEncode(body),
          )
          .timeout(_timeout);
    } on TimeoutException {
      throw const AuthException('Server is taking too long. Please try again.');
    } catch (_) {
      throw const AuthException(
          'Cannot connect to server right now. Please try again soon.');
    }
  }

  String _extractMessage(http.Response response, String fallback) {
    final payload = _decodeMap(response.body);
    if (payload != null) {
      final msg = payload['message'];
      if (msg is String && msg.trim().isNotEmpty) return msg;
    }
    return fallback;
  }

  Map<String, dynamic>? _decodeMap(String body) {
    try {
      final payload = jsonDecode(body);
      if (payload is Map<String, dynamic>) return payload;
    } catch (_) {}
    return null;
  }

  String _friendlyMessage(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('rate limit') || lower.contains('too many')) {
      return 'Too many attempts. Please wait 1-2 minutes and try again.';
    }
    if (lower.contains('smtp') || lower.contains('failed to send otp')) {
      return 'We cannot send the verification code right now. Please try later.';
    }
    if (lower.contains('temporarily unavailable') ||
        lower.contains('verify_any_otp')) {
      return 'Verification is temporarily unavailable. Please try again shortly.';
    }
    if (lower.contains('already verified')) {
      return 'This email is already verified. Please sign in.';
    }
    return raw;
  }
}

class AuthException implements Exception {
  const AuthException(this.message);
  final String message;

  @override
  String toString() => message;
}
