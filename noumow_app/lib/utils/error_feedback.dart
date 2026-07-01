import 'dart:async';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

/// Translation key for generic infrastructure failures (DB, backend).
const String kErrorOccurredKey = 'error_occurred';

/// Translation key for network connectivity failures.
const String kNetworkErrorKey = 'network_error';

/// Localized message shown for all network connectivity failures.
String networkErrorMessage() => kNetworkErrorKey.tr();

/// True when [text] looks like a technical/server error that must not be shown.
bool isTechnicalErrorText(String text) {
  final msg = text.trim().toLowerCase();
  if (msg.isEmpty) return true;

  if (RegExp(r'https?://').hasMatch(msg)) return true;
  if (RegExp(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b').hasMatch(msg)) {
    return true;
  }

  const patterns = [
    'socketexception',
    'timeoutexception',
    'clientexception',
    'formatexception',
    'handshakeexception',
    'future not completed',
    'future was not completed',
    'timed out',
    'timeout',
    'time out',
    'connection refused',
    'connection reset',
    'connection timed out',
    'connection failed',
    'failed host lookup',
    'network is unreachable',
    'no address associated with hostname',
    'postgrest',
    'postgres',
    'postgresql',
    'sqlstate',
    'sql error',
    'syntax error',
    'database',
    'backend',
    'errno',
    'cannot reach',
    'network error',
    'connection error',
    'failed to fetch',
    'could not connect',
    'request failed',
    'status code',
    'statuscode',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'unexpected character',
    'jsondecode',
    'json decode',
    'stack trace',
    'at #',
    'socket',
    'unreachable',
    'port 5000',
    'localhost',
    'handshake',
    'certificate',
    'xmlhttprequest',
    'os error',
    'host lookup',
    'server is not running',
    'backend is not running',
    'not running on port',
    'supabase.co',
    'rest/v1',
    'rpc/',
    'pgrst',
    'violates foreign key',
    'violates unique',
    'duplicate key',
    'relation ',
    'column ',
    'null value',
  ];

  if (patterns.any(msg.contains)) return true;
  if (RegExp(r'\w+exception\b', caseSensitive: false).hasMatch(msg)) return true;
  if (text.trim().length > 180) return true;
  if (text.contains('{') && text.contains('}')) return true;

  return false;
}

/// True when [text] describes a network/connectivity problem.
bool isNetworkErrorText(String text) {
  final msg = text.trim().toLowerCase();
  if (msg.isEmpty) return false;

  const patterns = [
    'socketexception',
    'timeoutexception',
    'clientexception',
    'handshakeexception',
    'future not completed',
    'future was not completed',
    'timed out',
    'timeout',
    'time out',
    'connection refused',
    'connection reset',
    'connection timed out',
    'connection failed',
    'failed host lookup',
    'network is unreachable',
    'no address associated with hostname',
    'network error',
    'connection error',
    'failed to fetch',
    'could not connect',
    'cannot reach',
    'no internet',
    'offline',
    'socket',
    'unreachable',
    'host lookup',
    'handshake',
    'certificate',
    'xmlhttprequest',
    'os error',
    'errno',
  ];

  return patterns.any(msg.contains);
}

/// Returns true for network/connectivity failures.
bool isNetworkError(Object error) {
  if (error is SocketException) return true;
  if (error is TimeoutException) return true;
  if (error is http.ClientException) return true;
  if (error is AuthRetryableFetchException) return true;

  final raw = _rawErrorText(error);
  if (isNetworkErrorText(raw)) return true;
  return isNetworkErrorText(error.toString());
}

/// Returns true for database, backend, or network connectivity failures.
bool isInfrastructureError(Object error) {
  if (error is SocketException) return true;
  if (error is TimeoutException) return true;
  if (error is http.ClientException) return true;
  if (error is AuthRetryableFetchException) return true;

  if (error is PostgrestException) {
    return isTechnicalErrorText(
      '${error.message} ${error.details ?? ''} ${error.hint ?? ''}',
    );
  }

  if (error is StorageException) {
    return isTechnicalErrorText(error.message);
  }

  return isTechnicalErrorText(error.toString());
}

String _rawErrorText(Object error) {
  if (error is String) return error;

  try {
    final dynamic value = error;
    final message = value.message;
    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }
  } catch (_) {}

  return error.toString().replaceFirst('Exception: ', '').trim();
}

/// Sanitizes any message before showing it in the UI.
String sanitizeUserMessage(String? message) {
  final text = (message ?? '').trim();
  if (text == kNetworkErrorKey) return networkErrorMessage();
  if (text == kErrorOccurredKey) return kErrorOccurredKey.tr();
  if (text.isEmpty || isTechnicalErrorText(text)) {
    if (isNetworkErrorText(text)) return networkErrorMessage();
    return kErrorOccurredKey.tr();
  }
  return text;
}

/// Maps an exception to a user-facing message.
/// Never returns SQL, URLs, timeouts, or other technical details.
String userFacingErrorMessage(Object error) {
  if (isNetworkError(error)) return networkErrorMessage();
  if (isInfrastructureError(error)) return kErrorOccurredKey.tr();
  return sanitizeUserMessage(_rawErrorText(error));
}

void showNetworkErrorSnackBar(BuildContext context) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          networkErrorMessage(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ),
    );
}

void showErrorOccurredSnackBar(BuildContext context) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          kErrorOccurredKey.tr(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ),
    );
}

void showErrorSnackBar(BuildContext context, Object error) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          userFacingErrorMessage(error),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ),
    );
}
