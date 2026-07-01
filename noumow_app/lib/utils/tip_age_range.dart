const tipAgeRangeMaxLength = 50;

bool tipAgeRangeIncludesNumber(String value) {
  return RegExp(r'\d').hasMatch(value.trim());
}

String? validateTipAgeRange(String? value) {
  final ageRange = value?.trim() ?? '';
  if (ageRange.isEmpty) return 'tips_validation_age_range_required';
  if (ageRange.length > tipAgeRangeMaxLength) {
    return 'tips_validation_age_range_too_long';
  }
  if (!tipAgeRangeIncludesNumber(ageRange)) {
    return 'tips_validation_age_range_number';
  }
  return null;
}

String formatTipAgeRange(String? ageRange) {
  final label = ageRange?.trim();
  if (label == null || label.isEmpty) return '';
  return label;
}
