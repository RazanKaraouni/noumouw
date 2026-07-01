import 'package:flutter/foundation.dart';

import '../models/parenting_tip.dart';
import '../services/parenting_tips_service.dart';
import '../utils/error_feedback.dart';

enum TipsStatus { loading, loaded, error }

class TipsNotifier extends ChangeNotifier {
  TipsNotifier({ParentingTipsService? tipsService})
      : _tipsService = tipsService ?? ParentingTipsService();

  final ParentingTipsService _tipsService;

  TipsStatus status = TipsStatus.loading;
  List<ParentingTip> tips = const [];
  String? errorMessage;

  Future<void> fetchTips() async {
    status = TipsStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      tips = await _tipsService.fetchApprovedTips();
      status = TipsStatus.loaded;
    } catch (e) {
      status = TipsStatus.error;
      errorMessage = userFacingErrorMessage(e);
      tips = const [];
    }

    notifyListeners();
  }

  Future<void> refresh() async {
    tips = const [];
    await fetchTips();
  }
}
