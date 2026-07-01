import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/services/milestone_catalog_service.dart';
import 'package:noumouw_parent/utils/cdc_milestone_age_tiers.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';

// ── Model ─────────────────────────────────────────────────────────────────
class Milestone {
  final String id;
  final String title;
  final String domain;    // e.g. "Motor", "Language", "Social", "Cognitive"
  final String ageRange;  // e.g. "12–18 months"

  Milestone({
    required this.id,
    required this.title,
    required this.domain,
    required this.ageRange,
  });

  factory Milestone.fromMap(Map<String, dynamic> m) => Milestone(
        id: (m['milestones_id'] ?? '').toString(),
        title: m['title'] ?? '',
        domain: m['domain'] ?? 'General',
        ageRange: CdcMilestoneAgeTiers.labelForMilestoneRow(m),
      );
}

// ── Screen ────────────────────────────────────────────────────────────────
class MilestonesScreen extends StatefulWidget {
  final String childName;
  final String childAge;

  const MilestonesScreen({
    super.key,
    required this.childName,
    required this.childAge,
  });

  @override
  State<MilestonesScreen> createState() => _MilestonesScreenState();
}

class _MilestonesScreenState extends State<MilestonesScreen>
    with SingleTickerProviderStateMixin {
  List<Milestone> _milestones = [];
  bool _isLoading = true;
  String? _error;
  String _selectedDomain = 'All';

  late AnimationController _fadeController;
  late Animation<double> _fadeAnim;

  static const _domainColors = {
    'All':       Color(0xFFF1EFE8),
    'Motor':     Color(0xFFE1F5EE),
    'Language':  Color(0xFFE6F1FB),
    'Social':    Color(0xFFFAEEDA),
    'Cognitive': Color(0xFFFBEAF0),
  };

  static const _domainTextColors = {
    'All':       Color(0xFF5F5E5A),
    'Motor':     Color(0xFF0F6E56),
    'Language':  Color(0xFF185FA5),
    'Social':    Color(0xFF854F0B),
    'Cognitive': Color(0xFF993556),
  };

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _fadeController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _fadeAnim =
        CurvedAnimation(parent: _fadeController, curve: Curves.easeIn);
    _fetchMilestones();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  // ── Supabase fetch ────────────────────────────────────────────────────
  Future<void> _fetchMilestones() async {
    final cached = await MilestoneCatalogService.instance.readCached();
    if (cached != null && cached.isNotEmpty && mounted) {
      setState(() {
        _milestones = cached.map((m) => Milestone.fromMap(m)).toList();
        _isLoading = false;
        _error = null;
      });
      _fadeController.forward(from: 0);
    } else {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final data = await MilestoneCatalogService.instance.fetchCatalog();
      setState(() {
        _milestones = data
            .map((m) => Milestone.fromMap(m))
            .toList();
        _isLoading = false;
      });
      _fadeController.forward(from: 0);
    } catch (e) {
      setState(() {
        _error = kErrorOccurredKey.tr();
        _isLoading = false;
      });
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────
  List<String> get _domains {
    final d = _milestones.map((m) => m.domain).toSet().toList()..sort();
    return ['All', ...d];
  }

  List<Milestone> get _filtered => _selectedDomain == 'All'
      ? _milestones
      : _milestones.where((m) => m.domain == _selectedDomain).toList();

  // ── Build ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8F5),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildAppBar(),
            if (!_isLoading && _error == null) _buildDomainTabs(),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  // ── App bar ───────────────────────────────────────────────────────────
  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFFE8EAE4), width: 0.8),
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded,
                  size: 16, color: Color(0xFF1A1A18)),
            ),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Milestones',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1A18))),
              Text('${widget.childName} · ${widget.childAge}',
                  style: const TextStyle(
                      fontSize: 11, color: Color(0xFF888880))),
            ],
          ),
          const Spacer(),
          GestureDetector(
            onTap: _fetchMilestones,
            child: const Icon(Icons.refresh_rounded,
                size: 20, color: Color(0xFF888880)),
          ),
        ],
      ),
    );
  }

  // ── Domain filter tabs ────────────────────────────────────────────────
  Widget _buildDomainTabs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 0, 0),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _domains.map((d) {
            final isActive = _selectedDomain == d;
            final bg = isActive
                ? (_domainColors[d] ?? const Color(0xFFE1F5EE))
                : Colors.white;
            final fg = isActive
                ? (_domainTextColors[d] ?? const Color(0xFF0F6E56))
                : const Color(0xFF888880);
            return GestureDetector(
              onTap: () => setState(() => _selectedDomain = d),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: isActive
                          ? Colors.transparent
                          : const Color(0xFFE8EAE4),
                      width: 0.8),
                ),
                child: Text(d,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: fg)),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ── Body ──────────────────────────────────────────────────────────────
  Widget _buildBody() {
    if (_isLoading) return _buildLoading();
    if (_error != null) return _buildError();
    if (_filtered.isEmpty) return _buildEmpty();

    return FadeTransition(
      opacity: _fadeAnim,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 30),
        itemCount: _filtered.length,
        itemBuilder: (context, i) =>
            _buildMilestoneCard(_filtered[i], i),
      ),
    );
  }

  // ── Milestone card (read-only) ────────────────────────────────────────
  Widget _buildMilestoneCard(Milestone m, int index) {
    final domainColor =
        _domainColors[m.domain] ?? const Color(0xFFE1F5EE);
    final domainText =
        _domainTextColors[m.domain] ?? const Color(0xFF0F6E56);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 280 + index * 35),
      curve: Curves.easeOut,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 10 * (1 - value)),
          child: child,
        ),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border:
              Border.all(color: const Color(0xFFE8EAE4), width: 0.8),
        ),
        child: Row(
          children: [
            // Domain color dot
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: domainText,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            // Title + age range
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    m.title,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF1A1A18)),
                  ),
                  if (m.ageRange.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(m.ageRange,
                        style: const TextStyle(
                            fontSize: 10, color: Color(0xFF888880))),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Domain badge
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: domainColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(m.domain,
                  style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                      color: domainText)),
            ),
          ],
        ),
      ),
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────
  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(
          color: Color(0xFF1D9E75), strokeWidth: 2),
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('⚠️', style: TextStyle(fontSize: 36)),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, color: Color(0xFF888880))),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _fetchMilestones,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 24, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1D9E75),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text('Retry',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('📋', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            Text(
              _selectedDomain == 'All'
                  ? 'No milestones found.'
                  : 'No milestones in $_selectedDomain.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 13, color: Color(0xFF888880)),
            ),
          ],
        ),
      ),
    );
  }
}