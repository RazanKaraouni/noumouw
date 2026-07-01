import 'package:flutter/foundation.dart';

import '../models/parenting_tip.dart';
import '../services/parenting_tips_service.dart';
import '../utils/error_feedback.dart';
import '../utils/parenting_hub_categories.dart';

enum ParentingHubStatus { loading, loaded, error }

class ParentingHubNotifier extends ChangeNotifier {
  ParentingHubNotifier({
    ParentingTipsService? tipsService,
    this.ageMonths,
  }) : _tipsService = tipsService ?? ParentingTipsService();

  final ParentingTipsService _tipsService;
  int? ageMonths;

  ParentingHubStatus status = ParentingHubStatus.loading;
  List<ParentingTip> tips = const [];
  ParentingTip? todayTip;
  String? errorMessage;

  Future<void> load({int? childAgeMonths}) async {
    if (childAgeMonths != null) ageMonths = childAgeMonths;
    status = ParentingHubStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      tips = await _fetchTips();
      todayTip = _tipsService.pickTodayTip(tips, ageMonths: ageMonths);
      status = ParentingHubStatus.loaded;
    } catch (e) {
      status = ParentingHubStatus.error;
      errorMessage = userFacingErrorMessage(e);
      tips = const [];
      todayTip = null;
    }

    notifyListeners();
  }

  Future<void> refresh({int? childAgeMonths}) async {
    tips = const [];
    todayTip = null;
    await load(childAgeMonths: childAgeMonths);
  }

  List<ParentingTip> tipsForCategory(String? categoryId) {
    return filterTipsByHubCategory(tips, categoryId);
  }

  Future<List<ParentingTip>> _fetchTips() async {
    final all = await _tipsService.fetchApprovedTips();
    return _tipsService.filterTipsForChildAge(all, ageMonths: ageMonths);
  }
}
