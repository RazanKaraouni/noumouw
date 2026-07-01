import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'autism_report_view_page.dart';
import 'create_child_page.dart';
import 'milestone_report_screen.dart';
import '../utils/error_feedback.dart';
import '../theme/app_colors.dart';

/// Hub to open milestone and autism reports for every child on one screen.
class ViewAllReportsPage extends StatefulWidget {
  const ViewAllReportsPage({super.key});

  @override
  State<ViewAllReportsPage> createState() => _ViewAllReportsPageState();
}

class _ViewAllReportsPageState extends State<ViewAllReportsPage> {
  final _supabase = Supabase.instance.client;

  List<Map<String, dynamic>> _children = [];
  Set<String> _childIdsWithMilestones = {};
  bool _loading = true;

  static const _green = Color(0xFF1D9E75);
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE8EAE4);
  static const _white = Colors.white;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
    });
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        if (mounted) {
          setState(() {
            _children = [];
            _childIdsWithMilestones = {};
            _loading = false;
          });
        }
        return;
      }
      final data = await _supabase
          .from('children')
          .select()
          .eq('parent_id', user.id)
          .order('created_at', ascending: true);

      final children = List<Map<String, dynamic>>.from(data);
      final ids = <String>[];
      for (final c in children) {
        final id = (c['children_id'] ?? c['child_id'])?.toString();
        if (id != null && id.isNotEmpty) ids.add(id);
      }

      final withMilestones = <String>{};
      if (ids.isNotEmpty) {
        final rows = await _supabase
            .from('child_milestones')
            .select('child_id')
            .inFilter('child_id', ids);
        for (final raw in List<Map<String, dynamic>>.from(rows)) {
          final cid = raw['child_id']?.toString();
          if (cid != null && cid.isNotEmpty) withMilestones.add(cid);
        }
      }

      if (!mounted) return;
      setState(() {
        _children = children;
        _childIdsWithMilestones = withMilestones;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      showErrorSnackBar(context, e);
    }
  }

  String _childName(Map<String, dynamic> child) =>
      (child['full_name'] ?? child['name'] ?? 'reports_child_default'.tr())
          .toString();

  String _childId(Map<String, dynamic> child) =>
      (child['children_id'] ?? child['child_id']).toString();

  String _childAgeLabel(Map<String, dynamic> child) {
    try {
      final rawDob = (child['date_of_birth'] ?? child['dob']) as String?;
      if (rawDob == null || rawDob.isEmpty) return 'reports_age_zero'.tr();
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      months = months < 0 ? 0 : months;
      final days = now.difference(dob).inDays;
      if (months < 1) {
        return days == 1
            ? 'reports_age_one_day'.tr()
            : 'reports_age_days'.tr(namedArgs: {'count': '$days'});
      }
      if (months < 12) {
        return 'reports_age_months'.tr(namedArgs: {'count': '$months'});
      }
      final y = months ~/ 12;
      final m = months % 12;
      return m == 0
          ? 'reports_age_years'.tr(namedArgs: {'years': '$y'})
          : 'reports_age_years_months'
              .tr(namedArgs: {'years': '$y', 'months': '$m'});
    } catch (_) {
      return 'reports_age_zero'.tr();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8F5),
      appBar: AppBar(
        title: Text('reports_title'.tr()),
        backgroundColor: _white,
        foregroundColor: _textPri,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: _border),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _green))
          : RefreshIndicator(
              color: _green,
              onRefresh: _load,
              child: _children.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: context.pagePadding,
                      children: [
                        Text(
                          'reports_empty_hint'.tr(),
                          style: TextStyle(
                            fontSize: context.rf(14),
                            color: _textSec.withOpacity(0.95),
                          ),
                        ),
                        SizedBox(height: context.rg(16)),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final ok = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(builder: (_) => const CreateChildPage()),
                            );
                            if (ok == true) _load();
                          },
                          icon: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.primary),
                          label: Text(
                            'home_nav_add_child'.tr(),
                            style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary),
                          ),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                            side: const BorderSide(color: _border),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.only(
                        top: context.rg(8),
                        bottom: context.rg(32),
                      ),
                      itemCount: _children.length,
                      itemBuilder: (context, i) {
                        final child = _children[i];
                        final childId = _childId(child);
                        final name = _childName(child);
                        final age = _childAgeLabel(child);
                        final hasMilestones =
                            childId.isNotEmpty && _childIdsWithMilestones.contains(childId);

                        return Padding(
                          padding: Responsive.padDirectional(
                            context,
                            start: 24,
                            top: 12,
                            end: 24,
                          ),
                          child: AppCard(
                            padding: Responsive.padAll(context, 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  style: TextStyle(
                                    fontSize: context.rf(16),
                                    fontWeight: FontWeight.w700,
                                    color: _textPri,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  age,
                                  style: TextStyle(
                                    fontSize: context.rf(12),
                                    color: _textSec,
                                  ),
                                ),
                                SizedBox(height: context.rg(12)),
                                OutlinedButton.icon(
                                  onPressed: !hasMilestones
                                      ? null
                                      : () {
                                          Navigator.push<void>(
                                            context,
                                            MaterialPageRoute<void>(
                                              builder: (_) => MilestoneReportScreen(
                                                childId: childId,
                                                childName: name,
                                                childAgeLabel: age,
                                              ),
                                            ),
                                          );
                                        },
                                  icon: const Icon(Icons.summarize_outlined, size: 18),
                                  label: Text('reports_progress_button'.tr()),
                                ),
                                if (!hasMilestones)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Text(
                                      'reports_unlock_hint'.tr(),
                                      style: TextStyle(fontSize: 11, color: _textSec.withOpacity(0.95)),
                                    ),
                                  ),
                                const SizedBox(height: 8),
                                OutlinedButton.icon(
                                  onPressed: childId.isEmpty
                                      ? null
                                      : () {
                                          Navigator.push<void>(
                                            context,
                                            MaterialPageRoute<void>(
                                              builder: (_) => AutismReportViewPage(
                                                childId: childId,
                                                childName: name,
                                              ),
                                            ),
                                          );
                                        },
                                  icon: const Icon(Icons.assignment_turned_in_outlined, size: 18),
                                  label: Text('reports_autism_button'.tr()),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
