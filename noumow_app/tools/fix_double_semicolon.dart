import 'dart:io';

void main() {
  for (final entity in Directory('lib').listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    final text = entity.readAsStringSync();
    final fixed = text.replaceAll(
      "error_feedback.dart';;",
      "error_feedback.dart';",
    );
    if (fixed != text) {
      entity.writeAsStringSync(fixed);
      stdout.writeln(entity.path);
    }
  }
}
