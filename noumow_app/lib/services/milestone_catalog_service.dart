import 'package:noumouw_parent/services/offline_cache_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Shared CDC milestone catalog fetch with offline cache and slim columns.
class MilestoneCatalogService {
  MilestoneCatalogService._();

  static final MilestoneCatalogService instance = MilestoneCatalogService._();

  static const cacheKey = 'milestones:catalog:v1';

  static const selectColumns =
      'milestones_id,title,description,domain,age_months_min,age_months_max,age_range';

  Future<List<Map<String, dynamic>>?> readCached() async {
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    if (cached == null || cached.isEmpty) return null;
    return cached.map((m) => Map<String, dynamic>.from(m as Map)).toList();
  }

  /// Fetches from Supabase, updates cache, and returns fresh rows.
  Future<List<Map<String, dynamic>>> fetchCatalog() async {
    final data = await Supabase.instance.client
        .from('milestones')
        .select(selectColumns)
        .order('age_months_min', ascending: true)
        .timeout(const Duration(seconds: 8));

    final rows = List<Map<String, dynamic>>.from(data);
    await OfflineCacheService.instance.saveJson(cacheKey, rows);
    return rows;
  }

  /// Match key aligned with backend `childMilestoneProgressService`.
  static String progressMatchKey({
    required String title,
    required String category,
    required Object? targetAgeMonths,
  }) {
    return [
      title.trim().toLowerCase(),
      category.trim().toLowerCase(),
      targetAgeMonths?.toString() ?? '',
    ].join('\u0000');
  }

  /// Builds milestone id → mastered from child progress rows.
  static Map<String, bool> masteredByMilestoneId({
    required List<Map<String, dynamic>> catalog,
    required List<Map<String, dynamic>> progressRows,
  }) {
    final completedKeys = <String>{};
    for (final raw in progressRows) {
      if (raw['is_completed'] != true) continue;
      completedKeys.add(
        progressMatchKey(
          title: (raw['milestone_title'] ?? '').toString(),
          category: (raw['milestone_category'] ?? '').toString(),
          targetAgeMonths: raw['target_age_months'],
        ),
      );
    }

    final next = <String, bool>{};
    for (final catalogRow in catalog) {
      final id = catalogRow['milestones_id']?.toString();
      if (id == null || id.isEmpty) continue;
      final key = progressMatchKey(
        title: (catalogRow['title'] ?? '').toString(),
        category: (catalogRow['domain'] ?? '').toString(),
        targetAgeMonths: catalogRow['age_months_max'],
      );
      if (completedKeys.contains(key)) next[id] = true;
    }
    return next;
  }

  static Object childIdForQuery(String childId) {
    final parsed = int.tryParse(childId);
    return parsed ?? childId;
  }
}
