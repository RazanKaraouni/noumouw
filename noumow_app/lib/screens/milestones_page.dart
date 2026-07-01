import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/milestone_catalog_service.dart';
import '../utils/error_feedback.dart';
import '../utils/cdc_milestone_age_tiers.dart';

class MilestonesPage extends StatefulWidget {
  const MilestonesPage({super.key});

  @override
  State<MilestonesPage> createState() => _MilestonesPageState();
}

class _MilestonesPageState extends State<MilestonesPage> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;
  String _selectedDomain = 'All domains';

  /// `All ages` or a CDC tier [rangeKey] (e.g. `9-12`).
  String _selectedAge = 'All ages';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool forceRefresh = false}) async {
    if (!mounted) return;

    if (!forceRefresh) {
      final cached = await MilestoneCatalogService.instance.readCached();
      if (cached != null && cached.isNotEmpty && mounted) {
        setState(() {
          _rows = cached;
          _loading = false;
          _error = null;
        });
      } else {
        setState(() {
          _loading = true;
          _error = null;
        });
      }
    } else if (_rows.isEmpty) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final data = await MilestoneCatalogService.instance.fetchCatalog();

      if (!mounted) return;
      setState(() {
        _rows = data;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (_rows.isEmpty) {
        setState(() => _error = userFacingErrorMessage(e));
      }
      setState(() => _loading = false);
    }
  }

  List<String> get _domains {
    final values = _rows
        .map((m) => (m['domain'] ?? '').toString().trim())
        .where((d) => d.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return ['All domains', ...values];
  }

  /// Same 12 CDC bands as the admin dashboard (always shown).
  List<CdcMilestoneAgeTier> get _dashboardAgeTiers => CdcMilestoneAgeTiers.all;

  /// All values for the age dropdown: sentinel + one per CDC tier.
  List<DropdownMenuItem<String>> _ageDropdownItems(BuildContext context) {
    return [
      DropdownMenuItem<String>(
        value: 'All ages',
        child: Text(
          'milestones_all_ages'.tr(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      ..._dashboardAgeTiers.map((tier) {
        return DropdownMenuItem<String>(
          value: tier.rangeKey,
          child: Text(
            tier.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        );
      }),
    ];
  }

  bool _rowMatchesFilters(Map<String, dynamic> m) {
    final domain = (m['domain'] ?? '').toString();
    final domainOk =
        _selectedDomain == 'All domains' || domain == _selectedDomain;
    if (!domainOk) return false;
    if (_selectedAge == 'All ages') return true;
    return CdcMilestoneAgeTiers.rowMatchesRangeKey(m, _selectedAge);
  }

  List<Map<String, dynamic>> get _filteredRows =>
      _rows.where(_rowMatchesFilters).toList();

  List<Map<String, dynamic>> _rowsForTier(CdcMilestoneAgeTier tier) {
    return _filteredRows
        .where((m) => CdcMilestoneAgeTiers.rowMatchesTier(m, tier))
        .toList();
  }

  List<Map<String, dynamic>> get _otherAgeRows {
    final known = _dashboardAgeTiers.map((t) => t.rangeKey).toSet();
    return _filteredRows.where((m) {
      final key = CdcMilestoneAgeTiers.rangeKeyForMilestoneRow(m);
      return key == null || !known.contains(key);
    }).toList();
  }

  Widget _milestoneTile(BuildContext context, Map<String, dynamic> m) {
    final ageLabel = CdcMilestoneAgeTiers.labelForMilestoneRow(m);

    return AppCard(
      margin: EdgeInsets.only(bottom: context.rg(8)),
      padding: EdgeInsets.zero,
      child: ListTile(
        title: Text(
          (m['title'] ?? '').toString(),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${(m['domain'] ?? 'general')} • $ageLabel\n'
          '${(m['description'] ?? '').toString()}',
          maxLines: 4,
          overflow: TextOverflow.ellipsis,
        ),
        isThreeLine: true,
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Padding(
      padding: Responsive.padDirectional(
        context,
        start: 16,
        top: 16,
        end: 16,
        bottom: 8,
      ),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: context.rf(11),
          fontWeight: FontWeight.w600,
          letterSpacing: 0.08,
          color: const Color(0xFF888880),
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _buildGroupedList(BuildContext context) {
    final sections = <Widget>[];
    for (final tier in _dashboardAgeTiers) {
      final items = _rowsForTier(tier);
      if (items.isEmpty) continue;
      sections.add(_sectionHeader(context, tier.label));
      for (final m in items) {
        sections.add(Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16),
          child: _milestoneTile(context, m),
        ));
      }
    }

    final other = _otherAgeRows;
    if (other.isNotEmpty) {
      sections.add(_sectionHeader(context, 'milestones_other_age_ranges'.tr()));
      for (final m in other) {
        sections.add(Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16),
          child: _milestoneTile(context, m),
        ));
      }
    }

    if (sections.isEmpty) {
      return Center(child: Text('milestones_no_match'.tr()));
    }

    return ListView(
      padding: EdgeInsets.only(bottom: context.scrollBottomInset),
      children: sections,
    );
  }

  Widget _buildFlatList(BuildContext context, List<Map<String, dynamic>> filtered) {
    if (filtered.isEmpty) {
      return Center(child: Text('milestones_no_match'.tr()));
    }
    return ListView.builder(
      padding: EdgeInsets.fromLTRB(
        context.rs(16),
        context.rs(12),
        context.rs(16),
        context.scrollBottomInset,
      ),
      itemCount: filtered.length,
      itemBuilder: (context, i) => _milestoneTile(context, filtered[i]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredRows;

    // Ensure the current _selectedAge value is valid for the dropdown.
    final validAgeValues = <String>{
      'All ages',
      ..._dashboardAgeTiers.map((t) => t.rangeKey),
    };
    final safeSelectedAge =
        validAgeValues.contains(_selectedAge) ? _selectedAge : 'All ages';

    return Scaffold(
      appBar: AppBar(
        title: Text('milestones_title'.tr()),
        actions: [
          IconButton(
            onPressed: () => _load(forceRefresh: true),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                    Padding(
                      padding: Responsive.padDirectional(
                        context,
                        start: 16,
                        top: 12,
                        end: 16,
                        bottom: 8,
                      ),
                      child: Row(
                        children: [
                          // Domain dropdown
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              value: _domains.contains(_selectedDomain)
                                  ? _selectedDomain
                                  : 'All domains',
                              isExpanded: true,
                              decoration: InputDecoration(
                                labelText: 'milestones_domain_label'.tr(),
                                border: const OutlineInputBorder(),
                                contentPadding: Responsive.padSymmetric(
                                  context,
                                  horizontal: 12,
                                  vertical: 12,
                                ),
                              ),
                              items: _domains
                                  .map(
                                    (d) => DropdownMenuItem<String>(
                                      value: d,
                                      child: Text(
                                        d == 'All domains'
                                            ? 'milestones_all_domains'.tr()
                                            : d,
                                        overflow: TextOverflow.ellipsis,
                                        maxLines: 1,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => _selectedDomain = value);
                              },
                            ),
                          ),
                          SizedBox(width: context.rg(10)),
                          // Age range dropdown
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              value: safeSelectedAge,
                              isExpanded: true,
                              decoration: InputDecoration(
                                labelText: 'milestones_age_range_label'.tr(),
                                border: const OutlineInputBorder(),
                                contentPadding: Responsive.padSymmetric(
                                  context,
                                  horizontal: 12,
                                  vertical: 12,
                                ),
                              ),
                              items: _ageDropdownItems(context),
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => _selectedAge = value);
                              },
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── List ─────────────────────────────────────────────
                    Expanded(
                      child: _selectedAge == 'All ages'
                          ? _buildGroupedList(context)
                          : _buildFlatList(context, filtered),
                    ),
                  ],
                ),
      ),
    );
  }
}
