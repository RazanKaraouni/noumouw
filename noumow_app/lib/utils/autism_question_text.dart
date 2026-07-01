import 'package:easy_localization/easy_localization.dart';

String localizedAutismQuestionText(int questionNumber, String fallback) {
  final key = 'screening_q${questionNumber}_text';
  final translated = key.tr();
  return translated == key ? fallback : translated;
}

String localizedAutismExampleText(int questionNumber, String fallback) {
  final trimmed = fallback.trim();
  if (trimmed.isEmpty) return '';
  final key = 'screening_q${questionNumber}_example';
  final translated = key.tr();
  return translated == key ? trimmed : translated;
}
