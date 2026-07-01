import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:noumouw_parent/services/offline_cache_service.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import '../models/appointment_model.dart';
import '../services/booking_api_service.dart';
import '../utils/auth_headers.dart';
import '../utils/error_feedback.dart';
import '../utils/session_join_flow.dart';
import 'booking_child_pick_page.dart';
import 'autism_screening_page.dart';
import 'create_child_page.dart';
import 'learn_from_therapist_page.dart';
import 'milestones_page.dart';
import 'nearby_map_page.dart';
import 'view_all_therapists.dart';
import 'family_profile_hub_screen.dart';
import 'ai_assistant_screen.dart';
import 'community_hub_page.dart';
import 'therapist_chat_page.dart';
import 'tips/tips_screen.dart';
import '../theme/app_colors.dart';
import '../services/child_progress_controller.dart';
import '../services/fcm_service.dart';
import '../services/notification_realtime_service.dart';
import '../utils/session_join_flow.dart';
import '../widgets/home/home_action_grid.dart';
import '../widgets/home/home_header.dart';
import '../widgets/home/home_learn_support_section.dart';
import '../widgets/home/home_upcoming_session_card.dart';

enum HomeTab { home, assistant, profile }

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with TickerProviderStateMixin, WidgetsBindingObserver {
  final _supabase = Supabase.instance.client;
  static const _homeFirstNameCacheKey = 'home:full_name_first_token';
  static const _kDefaultFirstName = 'Parent';

  /// Bumps when a child is saved from [CreateChildPage] so [FamilyProfileHubScreen]
  /// reloads (IndexedStack keeps it alive).
  final ValueNotifier<int> _profileChildrenRefresh = ValueNotifier<int>(0);

  /// Single source of truth for the active child across all tabs and flows.
  final _childProgress = ChildProgressController();

  String _firstName = _kDefaultFirstName;
  bool _userNameLoading = true;
  HomeTab _tab = HomeTab.home;
  Map<String, dynamic>? _nextSession;
  bool _sessionsLoading = true;
  final BookingApiService _bookingApi = BookingApiService();
  bool _createChildOverlayOpen = false;
  Map<String, dynamic>? _createChildOverlayInitial;

  late AnimationController _fadeController;
  late Animation<double> _fadeAnim;
  late AnimationController _shimmerController;
  late Animation<double> _shimmerAnim;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeIn);
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _shimmerAnim =
        Tween<double>(begin: 0.35, end: 0.65).animate(_shimmerController);
    _loadUser();
    _loadUpcomingSessions();
    _profileChildrenRefresh.addListener(_onProfileChildrenRefresh);
    unawaited(_childProgress.loadChildren());
    unawaited(FcmService.instance.syncTokenWithBackend());
    NotificationRealtimeService.instance.ensureConnected();
    NotificationRealtimeService.instance.addListener(_onRealtimeNotification);
  }

  void _onProfileChildrenRefresh() {
    unawaited(_childProgress.loadChildren());
  }

  void _onRealtimeNotification() {
    if (!mounted) return;
    final latest = NotificationRealtimeService.instance.history.isNotEmpty
        ? NotificationRealtimeService.instance.history.first
        : null;
    final type = (latest?['type'] ?? '').toString();
    if (type == 'meeting_started' || type == 'appointment_confirmed') {
      _loadUpcomingSessions();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadUpcomingSessions();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    NotificationRealtimeService.instance.removeListener(_onRealtimeNotification);
    _profileChildrenRefresh.removeListener(_onProfileChildrenRefresh);
    _profileChildrenRefresh.dispose();
    _childProgress.dispose();
    _fadeController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadUser() async {
    final cachedName = await OfflineCacheService.instance
        .readJson<String>(_homeFirstNameCacheKey);
    if (cachedName != null && cachedName.trim().isNotEmpty && mounted) {
      setState(() {
        _firstName = cachedName;
        _userNameLoading = false;
      });
    }

    try {
      final user = _supabase.auth.currentUser;
      if (user != null) {
        final parent = await _supabase
            .from('parents')
            .select('full_name')
            .eq('user_id', user.id)
            .maybeSingle();

        final raw = parent?['full_name'] ??
            user.userMetadata?['full_name'] ??
            user.email ??
            _kDefaultFirstName;

        final resolvedName = raw.toString().split(' ').first;
        if (mounted) {
          setState(() => _firstName = resolvedName);
        }
        await OfflineCacheService.instance
            .saveJson(_homeFirstNameCacheKey, resolvedName);
      }
    } catch (e, st) {
      debugPrint('HomePage._loadUser: $e\n$st');
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) {
        setState(() => _userNameLoading = false);
        if (mounted) _fadeController.forward();
      }
    }
  }

  Future<void> _refreshHome() async {
    await Future.wait([
      _loadUser(),
      _loadUpcomingSessions(),
    ]);
  }

  Future<void> _loadUpcomingSessions() async {
    if (!authHeaders().containsKey('Authorization')) {
      if (mounted) {
        setState(() {
          _nextSession = null;
          _sessionsLoading = false;
        });
      }
      return;
    }
    if (mounted) setState(() => _sessionsLoading = true);
    try {
      final rows = await _bookingApi.fetchMyAppointments();
      final cutoff = DateTime.now().subtract(const Duration(hours: 1));
      final upcoming = rows.where((a) {
        final status = (a['status'] ?? '').toString().toLowerCase().trim();
        if (!['confirmed', 'pending'].contains(status)) return false;
        final start = appointmentStartDateTime(a);
        if (start != null) return start.isAfter(cutoff);
        return true;
      }).toList();
      int statusRank(String? raw) {
        final s = (raw ?? '').toLowerCase().trim();
        if (s == 'confirmed') return 0;
        if (s == 'pending') return 1;
        return 2;
      }
      upcoming.sort((a, b) {
        final aStarted =
            a['is_started'] == true || a['isStarted'] == true;
        final bStarted =
            b['is_started'] == true || b['isStarted'] == true;
        if (aStarted != bStarted) return aStarted ? -1 : 1;
        final ra = statusRank(a['status']?.toString());
        final rb = statusRank(b['status']?.toString());
        if (ra != rb) return ra.compareTo(rb);
        final sa = appointmentStartDateTime(a) ?? DateTime.utc(2100);
        final sb = appointmentStartDateTime(b) ?? DateTime.utc(2100);
        return sa.compareTo(sb);
      });
      if (!mounted) return;
      setState(() {
        _nextSession = upcoming.isEmpty ? null : upcoming.first;
        _sessionsLoading = false;
      });
    } catch (e, st) {
      debugPrint('HomePage._loadUpcomingSessions: $e\n$st');
      if (!mounted) return;
      showErrorSnackBar(context, e);
      setState(() {
        _nextSession = null;
        _sessionsLoading = false;
      });
    }
  }

  Future<void> _openZoomJoin(Map<String, dynamic> appointment) async {
    await joinZoomSessionWithPayment(context, appointment);
  }

  void _openCreateChildOverlay({Map<String, dynamic>? initialChild}) {
    setState(() {
      _createChildOverlayOpen = true;
      _createChildOverlayInitial = initialChild;
    });
  }

  void _closeCreateChildOverlay(bool saved) {
    setState(() {
      _createChildOverlayOpen = false;
      _createChildOverlayInitial = null;
    });
    if (saved) {
      _profileChildrenRefresh.value++;
    }
  }

  void _selectTab(HomeTab tab) {
    setState(() {
      _tab = tab;
      _createChildOverlayOpen = false;
      _createChildOverlayInitial = null;
    });
    if (tab == HomeTab.profile) {
      _profileChildrenRefresh.value++;
    }
  }

  void _openChatWithTherapist({
    required String therapistId,
    required String roomId,
  }) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => TherapistChatPage(
          therapistId: therapistId,
          roomId: roomId,
        ),
      ),
    );
  }

  void _openBookAppointment() {
    try {
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => const BookingChildPickPage(),
        ),
      ).then((_) {
        if (mounted) _loadUpcomingSessions();
      });
    } catch (e) {
      if (!mounted) return;
      showErrorOccurredSnackBar(context);
    }
  }

  void _showNoUpcomingSessionDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('home_upcoming_session_title'.tr()),
        content: Text('home_upcoming_no_session'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('home_dialog_close'.tr()),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _openBookAppointment();
            },
            child: Text('home_book_appointment_title'.tr()),
          ),
        ],
      ),
    );
  }

  void _openCommunity() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const CommunityHubPage(),
      ),
    );
  }

  void _openParentingTips() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => TipsScreen(childProgress: _childProgress),
      ),
    );
  }

  void _openMilestonesGuide() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const MilestonesPage(),
      ),
    );
  }

  Widget _buildHeaderNamePlaceholder() {
    return AnimatedBuilder(
      animation: _shimmerAnim,
      builder: (context, _) => Row(
        children: [
          Flexible(
            child: Text(
              'home_hello_prefix'.tr(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(14),
                fontWeight: FontWeight.w700,
                color: AppColors.textPri,
              ),
            ),
          ),
          Container(
            width: context.rs(90),
            height: context.rs(16),
            decoration: BoxDecoration(
              color: AppColors.border.withOpacity(_shimmerAnim.value),
              borderRadius: BorderRadius.circular(context.rs(6)),
            ),
          ),
        ],
      ),
    );
  }

  void _openLearn() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const LearnFromTherapistPage(),
      ),
    );
  }

  void _openAutismScreening() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => AutismScreeningPage(childProgress: _childProgress),
      ),
    );
  }

  void _openViewAllTherapists() {
    Navigator.push<Map<String, String>?>(
      context,
      MaterialPageRoute<Map<String, String>?>(
        builder: (_) => const ViewAllTherapistsPage(),
      ),
    ).then((result) {
      if (!mounted || result == null) return;
      final therapistId = result['therapistId']?.trim();
      final roomId = result['roomId']?.trim();
      if (therapistId == null ||
          therapistId.isEmpty ||
          roomId == null ||
          roomId.isEmpty) {
        return;
      }
      _openChatWithTherapist(
        therapistId: therapistId,
        roomId: roomId,
      );
    });
  }

  void _openNearbyMap() {
    Navigator.push<Map<String, String>?>(
      context,
      MaterialPageRoute<Map<String, String>?>(
        builder: (_) => const NearbyMapPage(),
      ),
    ).then((result) {
      if (!mounted || result == null) return;
      final therapistId = result['therapistId']?.trim();
      final roomId = result['roomId']?.trim();
      if (therapistId == null ||
          therapistId.isEmpty ||
          roomId == null ||
          roomId.isEmpty) {
        return;
      }
      _openChatWithTherapist(
        therapistId: therapistId,
        roomId: roomId,
      );
    });
  }

  Widget _buildUpcomingSessionSection() {
    if (_sessionsLoading) {
      return const HomeUpcomingSessionLoading();
    }
    final session = _nextSession;
    return HomeUpcomingSessionCard(
      appointment: session,
      onJoin: session == null ? null : () => _openZoomJoin(session),
      onEmptyTap: _showNoUpcomingSessionDialog,
    );
  }

  Widget _buildHomeTab() {
    return RefreshIndicator(
      color: AppColors.green,
      onRefresh: _refreshHome,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedBuilder(
              animation: _shimmerAnim,
              builder: (context, _) => HomeHeader(
                displayName: _firstName == _kDefaultFirstName
                    ? 'home_parent_default'.tr()
                    : _firstName,
                showNameSkeleton:
                    _userNameLoading && _firstName == _kDefaultFirstName,
                onLocaleChanged: () {
                  if (mounted) setState(() {});
                },
                namePlaceholder: _buildHeaderNamePlaceholder(),
              ),
            ),
            _buildUpcomingSessionSection(),
            HomeActionGrid(
              onTherapists: _openViewAllTherapists,
              onNearby: _openNearbyMap,
            ),
            HomeLearnSupportSection(
              onEducate: _openLearn,
              onTips: _openParentingTips,
              onMilestones: _openMilestonesGuide,
              onAutismScreening: _openAutismScreening,
            ),
            SizedBox(height: context.rs(8)),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavItem(
    BuildContext context, {
    IconData? icon,
    String? iconAsset,
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    assert(icon != null || iconAsset != null);
    final color = selected ? AppColors.green : AppColors.textSec;
    final iconSize = context.rf(22);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(context.rs(12)),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: context.rs(4)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (iconAsset != null)
                Image.asset(
                  iconAsset,
                  width: iconSize,
                  height: iconSize,
                  color: color,
                  colorBlendMode: BlendMode.srcIn,
                )
              else
                Icon(icon!, color: color, size: iconSize),
              if (selected) ...[
                SizedBox(height: context.rs(4)),
                Container(
                  width: context.rs(20),
                  height: context.rs(3),
                  decoration: BoxDecoration(
                    color: AppColors.green,
                    borderRadius: BorderRadius.circular(context.rs(2)),
                  ),
                ),
              ] else
                SizedBox(height: context.rs(7)),
              SizedBox(height: context.rs(2)),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: context.rf(10),
                  fontWeight: FontWeight.w500,
                  height: 1.15,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: Color(0xFFEAECE6))),
      ),
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: context.rs(4),
            vertical: context.rs(6),
          ),
          child: Row(
            children: [
              _buildBottomNavItem(
                context,
                iconAsset:
                    'assets/images/home_50dp_1F1F1F_FILL0_wght400_GRAD0_opsz48.png',
                label: 'home_nav_home'.tr(),
                selected: _tab == HomeTab.home,
                onTap: () => _selectTab(HomeTab.home),
              ),
              _buildBottomNavItem(
                context,
                iconAsset:
                    'assets/images/calendar_check_50dp_1F1F1F_FILL0_wght400_GRAD0_opsz48.png',
                label: 'home_nav_book'.tr(),
                selected: false,
                onTap: _openBookAppointment,
              ),
              _buildBottomNavItem(
                context,
                icon: Icons.smart_toy_rounded,
                label: 'home_nav_assistant'.tr(),
                selected: _tab == HomeTab.assistant,
                onTap: () => _selectTab(HomeTab.assistant),
              ),
              _buildBottomNavItem(
                context,
                iconAsset:
                    'assets/images/groups_2_50dp_1F1F1F_FILL0_wght400_GRAD0_opsz48.png',
                label: 'home_nav_community'.tr(),
                selected: false,
                onTap: _openCommunity,
              ),
              _buildBottomNavItem(
                context,
                iconAsset:
                    'assets/images/child_care_50dp_1F1F1F_FILL0_wght400_GRAD0_opsz48.png',
                label: 'home_nav_profile'.tr(),
                selected: _tab == HomeTab.profile || _createChildOverlayOpen,
                onTap: () => _selectTab(HomeTab.profile),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      bottomNavigationBar: _buildBottomNav(),
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            FadeTransition(
              opacity: _fadeAnim,
              child: IndexedStack(
                index: _tab.index,
                children: [
                  _buildHomeTab(),
                  AIAssistantChatScreen(childProgress: _childProgress),
                  FamilyProfileHubScreen(
                    childProgress: _childProgress,
                    childrenListRefresh: _profileChildrenRefresh,
                    openCreateChildOverlay: _openCreateChildOverlay,
                  ),
                ],
              ),
            ),
            if (_createChildOverlayOpen)
              Positioned.fill(
                child: Material(
                  color: AppColors.bg,
                  child: CreateChildPage(
                    key: ValueKey<Object?>(
                      _createChildOverlayInitial?['children_id'] ??
                          _createChildOverlayInitial?['child_id'] ??
                          'new',
                    ),
                    initialChild: _createChildOverlayInitial,
                    onEmbeddedClose: _closeCreateChildOverlay,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
