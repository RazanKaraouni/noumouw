import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../models/parenting_tip.dart';
import '../../providers/parenting_hub_provider.dart';
import '../../services/child_progress_controller.dart';
import '../../theme/app_colors.dart';
import '../../utils/error_feedback.dart';
import '../../widgets/tip_card.dart';
import '../../widgets/tips/category_grid.dart';
import '../../widgets/tips/today_tip_hero.dart';
import 'tip_detail_sheet.dart';

class TipsScreen extends StatefulWidget {
  const TipsScreen({super.key, required this.childProgress});

  final ChildProgressController childProgress;

  @override
  State<TipsScreen> createState() => _TipsScreenState();
}

class _TipsScreenState extends State<TipsScreen> with TickerProviderStateMixin {
  late final ParentingHubNotifier _notifier;
  late final AnimationController _shimmerController;
  late final Animation<double> _shimmerAnim;

  String? _selectedHubCategory;
  String? _lastTrackedChildId;

  @override
  void initState() {
    super.initState();
    _lastTrackedChildId =
        ChildProgressController.idOf(widget.childProgress.activeChild);
    widget.childProgress.addListener(_onActiveChildChanged);
    _notifier = ParentingHubNotifier();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _shimmerAnim =
        Tween<double>(begin: 0.35, end: 0.65).animate(_shimmerController);
    unawaited(_loadTips());
  }

  @override
  void dispose() {
    widget.childProgress.removeListener(_onActiveChildChanged);
    _shimmerController.dispose();
    _notifier.dispose();
    super.dispose();
  }

  void _onActiveChildChanged() {
    if (!mounted) return;
    final childId =
        ChildProgressController.idOf(widget.childProgress.activeChild);
    if (childId == _lastTrackedChildId) return;
    _lastTrackedChildId = childId;
    unawaited(_loadTips(refresh: true));
  }

  int? get _trackingChildAgeMonths {
    final child = widget.childProgress.activeChild;
    if (child == null) return null;
    return ChildProgressController.ageMonthsOf(child);
  }

  Future<void> _loadTips({bool refresh = false}) async {
    final ageMonths = _trackingChildAgeMonths;
    if (refresh) {
      await _notifier.refresh(childAgeMonths: ageMonths);
    } else {
      await _notifier.load(childAgeMonths: ageMonths);
    }
  }

  List<ParentingTip> get _filteredTips =>
      _notifier.tipsForCategory(_selectedHubCategory);

  String _t(BuildContext context, String key) => context.tr(key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text(_t(context, 'tips_title')),
      ),
      body: ListenableBuilder(
        listenable: _notifier,
        builder: (ctx, _) => _buildBody(ctx),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_notifier.status) {
      case ParentingHubStatus.loading:
        return _buildLoadingSkeleton(context);
      case ParentingHubStatus.error:
        return _buildErrorState(context);
      case ParentingHubStatus.loaded:
        return RefreshIndicator(
          color: AppColors.green,
          onRefresh: () => _loadTips(refresh: true),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: Responsive.padDirectional(context, start: 16, top: 8, end: 16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    TodayTipHero(
                      tip: _notifier.todayTip,
                      onTap: _notifier.todayTip == null
                          ? null
                          : () => showTipDetailSheet(context, _notifier.todayTip!),
                    ),
                    SizedBox(height: context.rg(20)),
                    ParentingCategoryDropdown(
                      selectedCategoryId: _selectedHubCategory,
                      onCategorySelected: (id) =>
                          setState(() => _selectedHubCategory = id),
                    ),
                    SizedBox(height: context.rg(20)),
                    Text(
                      _t(context, 'tips_hub_all_tips_title'),
                      style: TextStyle(
                        fontSize: context.rf(16),
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                    SizedBox(height: context.rg(10)),
                  ]),
                ),
              ),
              if (_filteredTips.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _buildEmptyTipsState(context),
                )
              else
                SliverPadding(
                  padding: EdgeInsetsDirectional.fromSTEB(
                    context.rs(16),
                    0,
                    context.rs(16),
                    MediaQuery.paddingOf(context).bottom + context.rs(24),
                  ),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final tip = _filteredTips[index];
                        return Padding(
                          padding: EdgeInsetsDirectional.only(bottom: context.rg(12)),
                          child: TipCard(
                            tip: tip,
                            onTap: () => showTipDetailSheet(context, tip),
                          ),
                        );
                      },
                      childCount: _filteredTips.length,
                    ),
                  ),
                ),
            ],
          ),
        );
    }
  }

  Widget _buildLoadingSkeleton(BuildContext context) {
    return AnimatedBuilder(
      animation: _shimmerAnim,
      builder: (context, _) => ListView(
        padding: EdgeInsetsDirectional.fromSTEB(
          context.rs(16),
          context.rs(8),
          context.rs(16),
          MediaQuery.paddingOf(context).bottom + context.rs(24),
        ),
        children: [
          const TodayTipHero(loading: true, tip: null),
          SizedBox(height: context.rg(20)),
          ...List.generate(3, (_) => Padding(
                padding: EdgeInsetsDirectional.only(bottom: context.rg(12)),
                child: Container(
                  height: context.rs(100),
                  decoration: BoxDecoration(
                    color: AppColors.border.withOpacity(_shimmerAnim.value),
                    borderRadius: BorderRadius.circular(context.rs(16)),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildEmptyTipsState(BuildContext context) {
    return Padding(
      padding: Responsive.padAll(context, 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.lightbulb_outline_rounded,
            size: context.rs(48),
            color: AppColors.textSec.withOpacity(0.45),
          ),
          SizedBox(height: context.rg(12)),
          Text(
            _selectedHubCategory == null
                ? _t(context, 'tips_empty')
                : _t(context, 'tips_hub_category_empty'),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: context.rf(15),
              fontWeight: FontWeight.w600,
              color: AppColors.textSec.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return Center(
      child: Padding(
        padding: Responsive.padAll(context, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _notifier.errorMessage ?? _t(context, kErrorOccurredKey),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: context.rf(15),
                color: AppColors.textSec.withOpacity(0.95),
              ),
            ),
            SizedBox(height: context.rg(16)),
            TextButton(
              onPressed: () => _loadTips(),
              child: Text(_t(context, 'assignments_retry')),
            ),
          ],
        ),
      ),
    );
  }
}
