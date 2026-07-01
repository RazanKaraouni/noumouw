import 'dart:io';

const importLine = "import 'package:noumouw_parent/utils/error_feedback.dart';";

final replacements = <MapEntry<RegExp, String>>[
  MapEntry(RegExp(r"_error = e\.toString\(\);"), "_error = userFacingErrorMessage(e);"),
  MapEntry(
    RegExp(r"_error = e\.toString\(\)\.replaceFirst\('Exception: ', ''\);"),
    "_error = userFacingErrorMessage(e);",
  ),
  MapEntry(
    RegExp(r"setState\(\(\) => _error = e\.toString\(\)\);"),
    "setState(() => _error = userFacingErrorMessage(e));",
  ),
  MapEntry(
    RegExp(r"namedArgs: \{'error': '\$e'\}"),
    "namedArgs: {'error': userFacingErrorMessage(e)}",
  ),
  MapEntry(
    RegExp(
      r"SnackBar\(content: Text\(e\.toString\(\)\.replaceFirst\('Exception: ', ''\)\)\)",
    ),
    "SnackBar(content: Text(userFacingErrorMessage(e)))",
  ),
  MapEntry(
    RegExp(r"SnackBar\(content: Text\(e\.toString\(\)\)\)"),
    "SnackBar(content: Text(userFacingErrorMessage(e)))",
  ),
  MapEntry(
    RegExp(r"\? e\.toString\(\)\.replaceFirst\('Exception: ', ''\)"),
    "? userFacingErrorMessage(e)",
  ),
  MapEntry(RegExp(r"_err = e\.toString\(\);"), "_err = userFacingErrorMessage(e);"),
  MapEntry(RegExp(r"_loadError = e\.toString\(\);"), "_loadError = userFacingErrorMessage(e);"),
  MapEntry(RegExp(r"_roomError = e\.toString\(\);"), "_roomError = userFacingErrorMessage(e);"),
  MapEntry(
    RegExp(r"if \(_rows\.isEmpty\) _err = e\.toString\(\);"),
    "if (_rows.isEmpty) _err = userFacingErrorMessage(e);",
  ),
];

String addImport(String content) {
  if (content.contains('error_feedback.dart')) return content;
  const marker = "import 'package:flutter/material.dart';";
  if (content.contains(marker)) {
    return content.replaceFirst(marker, "$marker\n$importLine;");
  }
  final match = RegExp(r"import '[^']+';").firstMatch(content);
  if (match != null) {
    return content.replaceRange(match.end, match.end, "\n$importLine;");
  }
  return "$importLine;\n$content";
}

void main() {
  final libDir = Directory('lib');
  final updated = <String>[];
  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    var text = entity.readAsStringSync();
    final original = text;
    for (final entry in replacements) {
      text = text.replaceAll(entry.key, entry.value);
    }
    if (text != original) {
      text = addImport(text);
      entity.writeAsStringSync(text);
      updated.add(entity.path);
    }
  }
  stdout.writeln('Updated ${updated.length} files');
  for (final path in updated) {
    stdout.writeln(path);
  }
}
