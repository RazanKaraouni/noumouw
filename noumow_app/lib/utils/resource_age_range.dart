/// Parses resource [age_range] values from the DB (CDC labels and shorthand).
class ResourceAgeRange {
  ResourceAgeRange._();

  /// e.g. `0-6m`, `6-12m`, `12-18m`, `18-24m`, `2-3y`, `3-4y`, `4-5y`, `5y+`
  static (int minMonths, int maxMonths)? parseShorthand(String? value) {
    final raw = (value ?? '').trim().toLowerCase();
    if (raw.isEmpty || raw == 'all') return null;

    if (raw.endsWith('y+')) {
      final minYears = int.tryParse(raw.replaceAll(RegExp(r'[^0-9]'), ''));
      if (minYears != null) return (minYears * 12, 120);
    }

    final months = RegExp(r'^(\d+)-(\d+)m$').firstMatch(raw);
    if (months != null) {
      return (int.parse(months.group(1)!), int.parse(months.group(2)!));
    }

    final years = RegExp(r'^(\d+)-(\d+)y$').firstMatch(raw);
    if (years != null) {
      final min = int.parse(years.group(1)!);
      final max = int.parse(years.group(2)!);
      return (min * 12, max * 12);
    }

    return null;
  }

  static bool overlapsMonths({
    required int resourceMin,
    required int resourceMax,
    required int filterMin,
    required int filterMax,
  }) {
    return resourceMin < filterMax && resourceMax > filterMin;
  }
}
