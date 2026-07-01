import 'dart:io';

void main() {
  for (final entity in Directory('lib').listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    if (entity.path.contains('error_feedback.dart')) continue;
    var text = entity.readAsStringSync();
    final original = text;

    const pairs = [
      ('_error = e.message;', '_error = sanitizeUserMessage(e.message);'),
      ('_loadError = e.message;', '_loadError = sanitizeUserMessage(e.message);'),
      ('_err = e.message;', '_err = sanitizeUserMessage(e.message);'),
      ("setState(() => _error = e.message);", "setState(() => _error = sanitizeUserMessage(e.message));"),
      ('setState(() => _otpErrorMessage = e.message);', 'setState(() => _otpErrorMessage = sanitizeUserMessage(e.message));'),
      ('setDialogState(() => _otpErrorMessage = e.message);', 'setDialogState(() => _otpErrorMessage = sanitizeUserMessage(e.message));'),
      ('errorMessage = e.message;', 'errorMessage = sanitizeUserMessage(e.message);'),
      ('otpErrorMessage = e.message;', 'otpErrorMessage = sanitizeUserMessage(e.message);'),
      ('_addAssistantMessage(e.message);', '_addAssistantMessage(sanitizeUserMessage(e.message));'),
      ('SnackBar(content: Text(e.message))', 'SnackBar(content: Text(sanitizeUserMessage(e.message)))'),
      ("SnackBar(content: Text('\$e'))", 'SnackBar(content: Text(userFacingErrorMessage(e)))'),
      (
        "e.statusCode == 409 ? 'appointment_slot_taken'.tr() : e.message;",
        "e.statusCode == 409 ? 'appointment_slot_taken'.tr() : sanitizeUserMessage(e.message);",
      ),
    ];

    for (final pair in pairs) {
      text = text.replaceAll(pair.$1, pair.$2);
    }

    if (text != original) {
      if (!text.contains('error_feedback.dart')) {
        const marker = "import 'package:flutter/material.dart';";
        if (text.contains(marker)) {
          text = text.replaceFirst(
            marker,
            "$marker\nimport 'package:noumouw_parent/utils/error_feedback.dart';",
          );
        }
      }
      entity.writeAsStringSync(text);
      stdout.writeln(entity.path);
    }
  }
}
