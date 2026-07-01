import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_progress_controller.dart';
import '../services/milestone_catalog_service.dart';
import '../utils/cdc_milestone_age_tiers.dart';

class HomeProgressSummary {
  const HomeProgressSummary({
    required this.hasChild,
    this.childName,
    this.childGender,
    this.profileImageUrl,
    this.percent = 0,
  });

  final bool hasChild;
  final String? childName;
  final String? childGender;
  final String? profileImageUrl;
  final double percent;
}

class HomeProgressSummaryService {
  HomeProgressSummaryService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  Future<HomeProgressSummary> load() async {
    final user = _supabase.auth.currentUser;
    if (user == null) {
      return const HomeProgressSummary(hasChild: false);
    }

    final children = await _supabase
        .from('children')
        .select(
          'children_id, child_id, full_name, date_of_birth, gender, profile_image_url',
        )
        .eq('parent_id', user.id)
        .order('created_at', ascending: true)
        .timeout(const Duration(seconds: 8));

    final rows = List<Map<String, dynamic>>.from(children);
    if (rows.isEmpty) {
      return const HomeProgressSummary(hasChild: false);
    }

    final child = rows.first;
    final childName = ChildProgressController.nameOf(child);
    final childGender = child['gender']?.toString();
    final profileImageUrl =
        (child['profile_image_url'] ?? '').toString().trim();
    final childrenId = ChildProgressController.idOf(child);
    if (childrenId == null) {
      return HomeProgressSummary(
        hasChild: true,
        childName: childName,
        childGender: childGender,
        profileImageUrl: profileImageUrl.isEmpty ? null : profileImageUrl,
      );
    }

    final ageMonths = ChildProgressController.ageMonthsOf(child);
    final tier = CdcMilestoneAgeTiers.tierForChildAge(ageMonths);
    if (tier == null) {
      return HomeProgressSummary(
        hasChild: true,
        childName: childName,
        childGender: childGender,
        profileImageUrl: profileImageUrl.isEmpty ? null : profileImageUrl,
      );
    }

    final catalog = await MilestoneCatalogService.instance.fetchCatalog();
    final tierMilestones = catalog
        .where((row) => CdcMilestoneAgeTiers.rowMatchesTier(row, tier))
        .toList();
    if (tierMilestones.isEmpty) {
      return HomeProgressSummary(
        hasChild: true,
        childName: childName,
        childGender: childGender,
        profileImageUrl: profileImageUrl.isEmpty ? null : profileImageUrl,
      );
    }

    final childrenIdInt = int.tryParse(childrenId) ??
        (child['children_id'] is num
            ? (child['children_id'] as num).toInt()
            : null);
    if (childrenIdInt == null) {
      return HomeProgressSummary(
        hasChild: true,
        childName: childName,
        childGender: childGender,
        profileImageUrl: profileImageUrl.isEmpty ? null : profileImageUrl,
      );
    }

    final progressRows = await _supabase
        .from('child_milestones')
        .select(
          'milestone_title,milestone_category,target_age_months,is_completed',
        )
        .eq('child_id', childrenIdInt)
        .timeout(const Duration(seconds: 8));

    final mastered = MilestoneCatalogService.masteredByMilestoneId(
      catalog: tierMilestones,
      progressRows: List<Map<String, dynamic>>.from(progressRows),
    );

    final total = tierMilestones.length;
    final completed =
        mastered.values.where((completed) => completed == true).length;
    final percent = total == 0 ? 0.0 : (completed / total) * 100;

    return HomeProgressSummary(
      hasChild: true,
      childName: childName,
      childGender: childGender,
      profileImageUrl: profileImageUrl.isEmpty ? null : profileImageUrl,
      percent: percent,
    );
  }
}
