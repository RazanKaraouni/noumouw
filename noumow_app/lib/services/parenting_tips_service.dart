import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/parenting_tip.dart';
import '../utils/cdc_milestone_age_tiers.dart';

/// Approved parenting tips from Supabase `parenting_tips` (no website API).
class ParentingTipsService {
  ParentingTipsService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  Future<List<ParentingTip>> fetchApprovedTips() async {
    final rows = await _supabase
        .from('parenting_tips')
        .select()
        .eq('status', 'approved')
        .order('approved_at', ascending: false)
        .timeout(const Duration(seconds: 15));

    return List<Map<String, dynamic>>.from(rows)
        .map(ParentingTip.fromJson)
        .where((t) => t.tipId.isNotEmpty)
        .toList();
  }

  /// Tips suited to the tracked child's age; falls back when none match.
  List<ParentingTip> filterTipsForChildAge(
    List<ParentingTip> tips, {
    int? ageMonths,
  }) {
    if (ageMonths == null) return tips;
    final matched =
        tips.where((t) => tipMatchesAgeMonths(t.ageRange, ageMonths)).toList();
    if (matched.isNotEmpty) return matched;
    final general =
        tips.where((t) => t.ageRange == null || t.ageRange!.trim().isEmpty).toList();
    return general.isNotEmpty ? general : tips;
  }

  ParentingTip? pickTodayTip(List<ParentingTip> tips, {int? ageMonths}) {
    final pool =
        tips.where((t) => tipMatchesAgeMonths(t.ageRange, ageMonths)).toList();
    final candidates = pool.isNotEmpty ? pool : tips;
    if (candidates.isEmpty) return null;

    final today = DateTime.now();
    final dateKey =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final ageBucket = (ageMonths ?? 0) ~/ 12;
    var hash = 0;
    final seed = '$dateKey:$ageBucket';
    for (var i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.codeUnitAt(i)) & 0xFFFFFFFF;
    }
    return candidates[hash % candidates.length];
  }
}

bool tipMatchesAgeMonths(String? ageRange, int? ageMonths) {
  if (ageMonths == null) return true;
  final label = (ageRange ?? '').trim();
  if (label.isEmpty) return true;

  final tier = CdcMilestoneAgeTiers.tierForAgeLabel(label);
  if (tier != null) {
    return CdcMilestoneAgeTiers.childAgeInTier(ageMonths, tier);
  }

  final parsed = parseAgeRangeMonths(ageRange);
  if (parsed == null) return false;
  return ageMonths >= parsed.$1 && ageMonths <= parsed.$2;
}

/// Parses min/max months from strings like "2-5 years", "0-12 months", "3-5".
(int minMonths, int maxMonths)? parseAgeRangeMonths(String? ageRange) {
  final text = (ageRange ?? '').toLowerCase();
  final nums = RegExp(r'\d+')
      .allMatches(text)
      .map((m) => int.tryParse(m.group(0) ?? ''))
      .whereType<int>()
      .toList();
  if (nums.isEmpty) return null;

  var min = nums[0];
  var max = nums.length > 1 ? nums[1] : min;
  if (min > max) {
    final t = min;
    min = max;
    max = t;
  }

  final isYears = text.contains('year') || text.contains('yr');
  final isMonths = text.contains('month') || text.contains('mo');
  final multiplier = isYears ? 12 : (isMonths || max > 18 ? 1 : 12);
  return (min * multiplier, max * multiplier);
}
