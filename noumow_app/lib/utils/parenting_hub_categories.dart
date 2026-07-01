import '../models/parenting_tip.dart';

class ParentingHubCategory {
  const ParentingHubCategory({
    required this.id,
    required this.labelKey,
    required this.tipCategories,
    required this.iconName,
  });

  final String id;
  final String labelKey;
  final List<String> tipCategories;
  final String iconName;
}

const parentingHubCategories = <ParentingHubCategory>[
  ParentingHubCategory(
    id: 'child_development',
    labelKey: 'tips_hub_cat_child_development',
    tipCategories: ['general'],
    iconName: 'child_care',
  ),
  ParentingHubCategory(
    id: 'emotional_wellbeing',
    labelKey: 'tips_hub_cat_emotional',
    tipCategories: ['emotional_regulation'],
    iconName: 'favorite',
  ),
  ParentingHubCategory(
    id: 'behavior_guidance',
    labelKey: 'tips_hub_cat_behavior',
    tipCategories: ['general', 'communication'],
    iconName: 'psychology',
  ),
  ParentingHubCategory(
    id: 'sleep',
    labelKey: 'tips_hub_cat_sleep',
    tipCategories: ['routines'],
    iconName: 'bedtime',
  ),
  ParentingHubCategory(
    id: 'autism_support',
    labelKey: 'tips_hub_cat_autism',
    tipCategories: [],
    iconName: 'diversity_3',
  ),
  ParentingHubCategory(
    id: 'screen_time',
    labelKey: 'tips_hub_cat_screen_time',
    tipCategories: [],
    iconName: 'devices',
  ),
  ParentingHubCategory(
    id: 'positive_discipline',
    labelKey: 'tips_hub_cat_discipline',
    tipCategories: ['communication', 'emotional_regulation'],
    iconName: 'handshake',
  ),
  ParentingHubCategory(
    id: 'social_skills',
    labelKey: 'tips_hub_cat_social',
    tipCategories: ['communication'],
    iconName: 'groups',
  ),
  ParentingHubCategory(
    id: 'parent_self_care',
    labelKey: 'tips_hub_cat_self_care',
    tipCategories: ['general'],
    iconName: 'spa',
  ),
];

ParentingHubCategory? hubCategoryById(String? id) {
  if (id == null || id.isEmpty) return null;
  for (final cat in parentingHubCategories) {
    if (cat.id == id) return cat;
  }
  return null;
}

bool tipMatchesHubCategory(ParentingTip tip, ParentingHubCategory category) {
  if (tip.category == category.id) return true;
  if (category.tipCategories.isEmpty) return false;
  return category.tipCategories.contains(tip.category);
}

List<ParentingTip> filterTipsByHubCategory(
  List<ParentingTip> tips,
  String? categoryId,
) {
  if (categoryId == null) return tips;
  final category = hubCategoryById(categoryId);
  if (category == null) return tips;
  return tips.where((t) => tipMatchesHubCategory(t, category)).toList();
}
