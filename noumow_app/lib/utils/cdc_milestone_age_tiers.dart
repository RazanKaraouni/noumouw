import 'resource_age_range.dart';

/// CDC Developmental Milestones — age checkpoint bands (some overlap by design).
class CdcMilestoneAgeTier {
  const CdcMilestoneAgeTier({
    required this.label,
    required this.minMonths,
    required this.maxMonths,
  });

  final String label;
  final int minMonths;
  final int maxMonths;

  String get rangeKey => '$minMonths-$maxMonths';
}

class CdcMilestoneAgeTiers {
  CdcMilestoneAgeTiers._();

  static const List<CdcMilestoneAgeTier> all = [
    CdcMilestoneAgeTier(label: 'by 2 Months', minMonths: 0, maxMonths: 2),
    CdcMilestoneAgeTier(label: 'by 4 Months', minMonths: 2, maxMonths: 4),
    CdcMilestoneAgeTier(label: 'by 6 Months', minMonths: 4, maxMonths: 6),
    CdcMilestoneAgeTier(label: 'by 9 Months', minMonths: 6, maxMonths: 9),
    CdcMilestoneAgeTier(label: 'by 12 Months', minMonths: 9, maxMonths: 12),
    CdcMilestoneAgeTier(label: 'by 18 Months', minMonths: 12, maxMonths: 18),
    CdcMilestoneAgeTier(label: 'by 2 Years', minMonths: 12, maxMonths: 24),
    CdcMilestoneAgeTier(label: 'by 30 Months', minMonths: 24, maxMonths: 30),
    CdcMilestoneAgeTier(label: 'by 3 Years', minMonths: 30, maxMonths: 36),
    CdcMilestoneAgeTier(label: 'by 4 Years', minMonths: 36, maxMonths: 48),
    CdcMilestoneAgeTier(label: 'by 5 Years', minMonths: 48, maxMonths: 60),
  ];

  static const Map<String, String> _legacyLabels = {
    '2 Months': 'by 2 Months',
    '4 Months': 'by 4 Months',
    '6 Months': 'by 6 Months',
    '9 Months': 'by 9 Months',
    '1 Year': 'by 12 Months',
    '12 Months': 'by 12 Months',
    'by 1 Year': 'by 12 Months',
    '15 Months': 'by 18 Months',
    'by 15 Months': 'by 18 Months',
    '18 Months': 'by 18 Months',
    '2 Years': 'by 2 Years',
    '30 Months': 'by 30 Months',
    '3 Years': 'by 3 Years',
    '4 Years': 'by 4 Years',
    '5 Years': 'by 5 Years',
  };

  /// Maps stored/API text to canonical CDC label when possible.
  static String normalizeAgeLabel(String? value) {
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) return '';
    return _legacyLabels[raw] ?? raw;
  }

  /// Activity / library windows: (min, max] with min=0 inclusive on the lower bound.
  static bool childAgeInTier(int ageMonths, CdcMilestoneAgeTier tier) {
    final age = ageMonths < 0 ? 0 : ageMonths;
    return age <= tier.maxMonths &&
        (tier.minMonths == 0 || age > tier.minMonths);
  }

  /// CDC questionnaire band for the child's current checkpoint.
  /// e.g. 1 month → "by 2 Months", 24 months → "by 2 Years".
  static CdcMilestoneAgeTier? tierForChildAge(int ageMonths) {
    final age = ageMonths < 0 ? 0 : ageMonths;
    for (final tier in all) {
      if (tier.maxMonths >= age) return tier;
    }
    return all.last;
  }

  static CdcMilestoneAgeTier? tierForBounds(int minMonths, int maxMonths) {
    for (final tier in all) {
      if (tier.minMonths == minMonths && tier.maxMonths == maxMonths) {
        return tier;
      }
    }
    return null;
  }

  static CdcMilestoneAgeTier? tierForRangeKey(String? rangeKey) {
    final raw = rangeKey?.trim() ?? '';
    if (raw.isEmpty) return null;
    final parts = raw.split('-');
    if (parts.length != 2) return null;
    final min = int.tryParse(parts[0].trim());
    final max = int.tryParse(parts[1].trim());
    if (min == null || max == null) return null;
    return tierForBounds(min, max);
  }

  static CdcMilestoneAgeTier? tierForAgeLabel(String? value) {
    final label = normalizeAgeLabel(value);
    if (label.isEmpty) return null;
    for (final tier in all) {
      if (tier.label == label) return tier;
    }
    return null;
  }

  static String labelForBounds(int minMonths, int maxMonths) {
    return tierForBounds(minMonths, maxMonths)?.label ?? 'by $maxMonths Months';
  }

  static String displayRange(int minMonths, int maxMonths) =>
      labelForBounds(minMonths, maxMonths);

  /// Canonical label for a catalog row (bounds → CDC tier → stored age_range).
  static String labelForMilestoneRow(Map<String, dynamic> row) {
    final stored = normalizeAgeLabel(row['age_range'] as String?);
    if (stored.isNotEmpty) {
      final fromStored = tierForAgeLabel(stored);
      if (fromStored != null) return fromStored.label;
      return stored;
    }
    final min = (row['age_months_min'] as num?)?.toInt() ?? 0;
    final max = (row['age_months_max'] as num?)?.toInt() ?? 0;
    return labelForBounds(min, max);
  }

  /// Resolves a catalog row to a CDC tier (age_range label, then bounds / checkpoint).
  static CdcMilestoneAgeTier? tierForMilestoneRow(Map<String, dynamic> row) {
    final fromLabel = tierForAgeLabel(row['age_range'] as String?);
    if (fromLabel != null) return fromLabel;

    final min = (row['age_months_min'] as num?)?.toInt();
    final max = (row['age_months_max'] as num?)?.toInt();
    if (min != null && max != null) {
      final exact = tierForBounds(min, max);
      if (exact != null) return exact;
      if (min == max) {
        for (final tier in all) {
          if (tier.maxMonths == max) return tier;
        }
      }
      for (final tier in all) {
        if (tier.maxMonths == max) return tier;
      }
      // Legacy catalog rows (e.g. 2–3, 4–5, 6–8) use the checkpoint month as min.
      for (final tier in all) {
        if (tier.maxMonths == min) return tier;
      }
    }
    return null;
  }

  static String? rangeKeyForMilestoneRow(Map<String, dynamic> row) =>
      tierForMilestoneRow(row)?.rangeKey;

  static bool rowMatchesTier(Map<String, dynamic> row, CdcMilestoneAgeTier tier) {
    final rowTier = tierForMilestoneRow(row);
    if (rowTier == null) return false;
    return rowTier.rangeKey == tier.rangeKey;
  }

  static bool rowMatchesRangeKey(Map<String, dynamic> row, String rangeKey) =>
      rangeKeyForMilestoneRow(row) == rangeKey;

  /// Whether a learn/resource row suits the child's age in months.
  static bool resourceMatchesChildAgeMonths(
    Map<String, dynamic> resource,
    int ageMonths,
  ) {
    final raw = (resource['age_range'] ?? '').toString().trim();
    if (raw.isEmpty || raw.toLowerCase() == 'all') return true;

    final tier = tierForChildAge(ageMonths);
    if (tier != null && resourceMatchesAgeRangeKey(resource, tier.label)) {
      return true;
    }

    final shorthand = ResourceAgeRange.parseShorthand(raw);
    if (shorthand != null) {
      final age = ageMonths < 0 ? 0 : ageMonths;
      return age >= shorthand.$1 && age <= shorthand.$2;
    }

    return false;
  }

  /// Learn resources store [age_range] as a CDC label (e.g. "by 4 Months") or "all".
  static bool resourceMatchesAgeRangeKey(
    Map<String, dynamic> resource,
    String selectedAgeKey,
  ) {
    if (selectedAgeKey == 'All ages') return true;

    final selectedTier = tierForRangeKey(selectedAgeKey);
    if (selectedTier == null) return true;

    final raw = (resource['age_range'] ?? '').toString().trim();
    if (raw.isEmpty || raw.toLowerCase() == 'all') return true;

    final resourceTier = tierForAgeLabel(raw);
    if (resourceTier != null) {
      return resourceTier.rangeKey == selectedTier.rangeKey;
    }

    final shorthand = ResourceAgeRange.parseShorthand(raw);
    if (shorthand != null) {
      return ResourceAgeRange.overlapsMonths(
        resourceMin: shorthand.$1,
        resourceMax: shorthand.$2,
        filterMin: selectedTier.minMonths,
        filterMax: selectedTier.maxMonths,
      );
    }

    return false;
  }
}
