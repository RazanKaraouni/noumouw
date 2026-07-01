import 'package:easy_localization/easy_localization.dart';

/// Builds milestone questionnaire prompts from milestone titles.
///
/// - Uses `easy_localization` so the "question shell" is translated.
/// - If the title is already non-English (e.g. Arabic), we avoid English-only
///   grammar tweaks and just inject the title into the template.
String formatMilestoneQuestion(String title) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return 'milestones_question_fallback'.tr();

  final containsArabic = RegExp(r'[\u0600-\u06FF]').hasMatch(trimmed);
  final clause = containsArabic
      ? trimmed
      : _stripLeadingThirdPersonVerb(
          _neutralizeChildPronouns(trimmed.toLowerCase()),
        );

  return 'milestones_question_template'.tr(namedArgs: {'clause': clause});
}

String _neutralizeChildPronouns(String text) {
  return text
      .replaceAll(RegExp(r'\bher\b'), 'their')
      .replaceAll(RegExp(r'\bhis\b'), 'their')
      .replaceAll(RegExp(r'\bhim\b'), 'them');
}

String _stripLeadingThirdPersonVerb(String clause) {
  if (clause.isEmpty) return clause;
  final words = clause.split(RegExp(r'\s+'));
  if (words.isEmpty) return clause;
  words[0] = _toBaseVerb(words[0]);
  return words.join(' ');
}

String _toBaseVerb(String word) {
  const irregular = <String, String>{
    'goes': 'go',
    'does': 'do',
    'has': 'have',
    'is': 'be',
    'says': 'say',
    'runs': 'run',
  };
  if (irregular.containsKey(word)) return irregular[word]!;

  if (word.endsWith('ies') && word.length > 3) {
    return '${word.substring(0, word.length - 3)}y';
  }
  if (word.endsWith('es') && word.length > 3) {
    final stem = word.substring(0, word.length - 2);
    if (stem.endsWith('s') ||
        stem.endsWith('x') ||
        stem.endsWith('z') ||
        stem.endsWith('ch') ||
        stem.endsWith('sh')) {
      return stem;
    }
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    return word.substring(0, word.length - 1);
  }
  return word;
}
