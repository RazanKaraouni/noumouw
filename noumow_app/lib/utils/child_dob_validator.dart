/// Date-of-birth rules for the add/edit child form.
class ChildDobValidator {
  ChildDobValidator._();

  /// Earliest selectable year in the DOB picker (only future years are capped).
  static const int pickerMinYear = 1900;

  static DateTime _todayDate() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  static DateTime normalize(DateTime value) {
    return DateTime(value.year, value.month, value.day);
  }

  static DateTime get maxDob => _todayDate();

  static DateTime get minDob => DateTime(pickerMinYear, 1, 1);

  /// Sensible default when opening the picker (about 1 year old).
  static DateTime get defaultPickerDate {
    final today = _todayDate();
    final candidate = DateTime(today.year - 1, today.month, today.day);
    if (candidate.isAfter(maxDob)) return maxDob;
    return candidate;
  }

  static DateTime clampToRange(DateTime value) {
    final date = normalize(value);
    if (date.isAfter(maxDob)) return maxDob;
    return date;
  }

  /// Returns error codes mapped to existing translation keys on [CreateChildPage].
  static String? validate(DateTime? dob) {
    if (dob == null) return 'required';
    final dobDate = normalize(dob);
    if (dobDate.isAfter(maxDob)) return 'future';
    return null;
  }
}
