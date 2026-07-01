import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import '../utils/community_age_category.dart';
import '../utils/community_developmental_category.dart';
import '../utils/error_feedback.dart';
import '../widgets/community_create_post_sheet.dart';
import '../widgets/community_disclaimer_banner.dart';
import '../widgets/community_post_card.dart';
import '../widgets/community_post_actions_sheet.dart';
import '../widgets/community_share_with_specialist.dart';
import 'booking_child_pick_page.dart';
import 'community_post_detail_page.dart';

enum _FeedScope { mine, others }

const _kFeedPageSize = 15;

/// Peer support feed — warm, non-clinical parent community.
class CommunityFeedPage extends StatefulWidget {
  const CommunityFeedPage({super.key});

  @override
  State<CommunityFeedPage> createState() => _CommunityFeedPageState();
}

class _CommunityFeedPageState extends State<CommunityFeedPage>
    with SingleTickerProviderStateMixin {
  final _api = CommunityApiService();
  late final TabController _tabController;

  String _selectedAgeKey = CommunityAgeCategory.all;
  String _selectedCategoryKey = CommunityDevelopmentalCategory.all;
  int _feedReloadToken = 0;
  int _activeTabIndex = 0;

  bool get _hasActiveFilters =>
      _selectedAgeKey != CommunityAgeCategory.all ||
      _selectedCategoryKey != CommunityDevelopmentalCategory.all;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    if (_activeTabIndex != _tabController.index) {
      setState(() => _activeTabIndex = _tabController.index);
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _reloadFeeds() {
    setState(() => _feedReloadToken++);
  }

  void _clearFilters() {
    setState(() {
      _selectedAgeKey = CommunityAgeCategory.all;
      _selectedCategoryKey = CommunityDevelopmentalCategory.all;
    });
    _reloadFeeds();
  }

  void _openBookAppointment() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const BookingChildPickPage(),
      ),
    );
  }

  Future<void> _openCreatePost() async {
    final created = await showCommunityCreatePostSheet(context);
    if (created == true) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('community_post_shared'.tr())),
      );
      _tabController.animateTo(0);
      _reloadFeeds();
    }
  }

  void _onAgeFilterSelected(String key) {
    if (_selectedAgeKey == key) return;
    setState(() => _selectedAgeKey = key);
    _reloadFeeds();
  }

  void _onCategoryFilterSelected(String key) {
    if (_selectedCategoryKey == key) return;
    setState(() => _selectedCategoryKey = key);
    _reloadFeeds();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text('community_hub_peer_support_title'.tr()),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.green,
          unselectedLabelColor: AppColors.textSec,
          indicatorColor: AppColors.green,
          tabs: [
            Tab(text: 'community_my_posts'.tr()),
            Tab(text: 'community_others_posts'.tr()),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 8)
              .copyWith(bottom: context.rs(8)),
          child: SizedBox(
            width: double.infinity,
            height: context.rs(48),
            child: FilledButton.icon(
              onPressed: _openCreatePost,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.green,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(context.rs(14)),
                ),
              ),
              icon: const Icon(Icons.edit_rounded),
              label: Text('community_share'.tr()),
            ),
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const CommunityDisclaimerBanner(),
          _FilterSection(
            selectedAgeKey: _selectedAgeKey,
            selectedCategoryKey: _selectedCategoryKey,
            onAgeSelected: _onAgeFilterSelected,
            onCategorySelected: _onCategoryFilterSelected,
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _CommunityPostFeedTab(
                  key: ValueKey('mine-$_feedReloadToken'),
                  scope: _FeedScope.mine,
                  isActive: _activeTabIndex == 0,
                  api: _api,
                  selectedAgeKey: _selectedAgeKey,
                  selectedCategoryKey: _selectedCategoryKey,
                  hasActiveFilters: _hasActiveFilters,
                  onClearFilters: _clearFilters,
                  onCreatePost: _openCreatePost,
                  onBookAppointment: _openBookAppointment,
                ),
                _CommunityPostFeedTab(
                  key: ValueKey('others-$_feedReloadToken'),
                  scope: _FeedScope.others,
                  isActive: _activeTabIndex == 1,
                  api: _api,
                  selectedAgeKey: _selectedAgeKey,
                  selectedCategoryKey: _selectedCategoryKey,
                  hasActiveFilters: _hasActiveFilters,
                  onClearFilters: _clearFilters,
                  onCreatePost: _openCreatePost,
                  onBookAppointment: _openBookAppointment,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CommunityPostFeedTab extends StatefulWidget {
  const _CommunityPostFeedTab({
    super.key,
    required this.scope,
    required this.isActive,
    required this.api,
    required this.selectedAgeKey,
    required this.selectedCategoryKey,
    required this.hasActiveFilters,
    required this.onClearFilters,
    required this.onCreatePost,
    required this.onBookAppointment,
  });

  final _FeedScope scope;
  final bool isActive;
  final CommunityApiService api;
  final String selectedAgeKey;
  final String selectedCategoryKey;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;
  final VoidCallback onCreatePost;
  final VoidCallback onBookAppointment;

  @override
  State<_CommunityPostFeedTab> createState() => _CommunityPostFeedTabState();
}

class _CommunityPostFeedTabState extends State<_CommunityPostFeedTab>
    with AutomaticKeepAliveClientMixin {
  final _scrollController = ScrollController();

  final List<CommunityPost> _posts = [];
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  bool _hasLoaded = false;
  int _offset = 0;
  String? _error;

  bool get _isMine => widget.scope == _FeedScope.mine;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadIfActive();
  }

  @override
  void didUpdateWidget(covariant _CommunityPostFeedTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !_hasLoaded && !_loading) {
      _loadIfActive();
    }
  }

  void _loadIfActive() {
    if (!widget.isActive || _hasLoaded || _loading) return;
    _loadInitial();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
      _offset = 0;
      _hasMore = true;
      _posts.clear();
    });

    try {
      final batch = await _fetchBatch(offset: 0);
      if (!mounted) return;
      setState(() {
        _posts.addAll(batch);
        _offset = batch.length;
        _hasMore = batch.length >= _kFeedPageSize;
        _loading = false;
        _hasLoaded = true;
      });
    } on CommunityApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = sanitizeUserMessage(e.message);
        _loading = false;
        _hasLoaded = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingErrorMessage(e);
        _loading = false;
        _hasLoaded = true;
      });
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final batch = await _fetchBatch(offset: _offset);
      if (!mounted) return;
      setState(() {
        _posts.addAll(batch);
        _offset += batch.length;
        _hasMore = batch.length >= _kFeedPageSize;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  Future<List<CommunityPost>> _fetchBatch({required int offset}) async {
    final ageCategory = CommunityAgeCategory.apiValue(widget.selectedAgeKey);
    final developmentalCategory =
        CommunityDevelopmentalCategory.apiValue(widget.selectedCategoryKey);

    if (_isMine) {
      return widget.api.fetchMyPosts(
        limit: _kFeedPageSize,
        offset: offset,
        ageCategory: ageCategory,
        developmentalCategory: developmentalCategory,
      );
    }

    return widget.api.fetchFeed(
      limit: _kFeedPageSize,
      offset: offset,
      ageCategory: ageCategory,
      developmentalCategory: developmentalCategory,
      excludeSelf: true,
    );
  }

  void _updatePostInList(CommunityPost updated) {
    final i = _posts.indexWhere((p) => p.id == updated.id);
    if (i >= 0) {
      setState(() => _posts[i] = updated);
    }
  }

  Future<void> _toggleLike(CommunityPost post) async {
    HapticFeedback.lightImpact();
    final wasLiked = post.isLiked;
    final prevCount = post.likeCount;
    setState(() {
      post.isLiked = !wasLiked;
      post.likeCount += wasLiked ? -1 : 1;
    });
    try {
      final liked = await widget.api.toggleLike(post.id);
      if (!mounted) return;
      setState(() => post.isLiked = liked);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        post.isLiked = wasLiked;
        post.likeCount = prevCount;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('community_like_error'.tr())),
      );
    }
  }

  Future<void> _toggleSave(CommunityPost post) async {
    HapticFeedback.selectionClick();
    final wasSaved = post.isSaved;
    setState(() => post.isSaved = !wasSaved);
    try {
      final saved = await widget.api.toggleSave(post.id);
      if (!mounted) return;
      setState(() => post.isSaved = saved);
      if (saved) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('community_saved_later'.tr())),
        );
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => post.isSaved = wasSaved);
    }
  }

  void _openPostDetail(CommunityPost post) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CommunityPostDetailPage(
          post: post,
          onPostUpdated: _updatePostInList,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (!widget.isActive && !_hasLoaded) {
      return const SizedBox.shrink();
    }

    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.green),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: context.pagePadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              SizedBox(height: context.rg(16)),
              FilledButton(
                onPressed: _loadInitial,
                child: Text('community_try_again'.tr()),
              ),
            ],
          ),
        ),
      );
    }

    if (_posts.isEmpty) {
      return _EmptyFeedState(
        isMine: _isMine,
        hasActiveFilters: widget.hasActiveFilters,
        onClearFilters: widget.onClearFilters,
        onCreatePost: widget.onCreatePost,
      );
    }

    return RefreshIndicator(
      color: AppColors.green,
      onRefresh: _loadInitial,
      child: ListView.builder(
        controller: _scrollController,
        padding: Responsive.padDirectional(
          context,
          start: 16,
          top: 8,
          end: 16,
          bottom: 16,
        ),
        itemCount: _posts.length + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _posts.length) {
            return Padding(
              padding: Responsive.padAll(context, 16),
              child: const Center(
                child: CircularProgressIndicator(color: AppColors.green),
              ),
            );
          }

          final post = _posts[index];
          return Padding(
            padding: EdgeInsetsDirectional.only(bottom: context.rg(12)),
            child: CommunityPostCard(
              post: post,
              onTap: () => _openPostDetail(post),
              onLike: () => _toggleLike(post),
              onSave: () => _toggleSave(post),
              onComment: () => _openPostDetail(post),
              onShareWithSpecialist: () =>
                  shareCommunityPostWithSpecialist(context, post),
              onMore: () => showCommunityPostActionsSheet(
                context,
                postId: post.id,
                authorUserId: post.userId,
                onBlocked: _loadInitial,
              ),
              onBookAppointment: widget.onBookAppointment,
            ),
          );
        },
      ),
    );
  }
}

// ── Filter section ────────────────────────────────────────────────────────────

class _FilterSection extends StatelessWidget {
  const _FilterSection({
    required this.selectedAgeKey,
    required this.selectedCategoryKey,
    required this.onAgeSelected,
    required this.onCategorySelected,
  });

  final String selectedAgeKey;
  final String selectedCategoryKey;
  final ValueChanged<String> onAgeSelected;
  final ValueChanged<String> onCategorySelected;

  @override
  Widget build(BuildContext context) {
    const ageKeys = CommunityAgeCategory.filterKeys;
    const categoryKeys = CommunityDevelopmentalCategory.filterKeys;

    final safeAge =
        ageKeys.contains(selectedAgeKey) ? selectedAgeKey : ageKeys.first;
    final safeCategory = categoryKeys.contains(selectedCategoryKey)
        ? selectedCategoryKey
        : categoryKeys.first;

    return Padding(
      padding: Responsive.padDirectional(
        context,
        start: 16,
        top: 8,
        end: 16,
        bottom: 4,
      ),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              value: safeAge,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'community_age_group'.tr(),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(10)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(10)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                contentPadding: Responsive.padSymmetric(
                  context,
                  horizontal: 12,
                  vertical: 10,
                ),
                filled: true,
                fillColor: AppColors.white,
              ),
              items: ageKeys
                  .map(
                    (key) => DropdownMenuItem<String>(
                      value: key,
                      child: Text(
                        CommunityAgeCategory.label(key),
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: context.rf(13)),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) onAgeSelected(value);
              },
            ),
          ),
          SizedBox(width: context.rg(10)),
          Expanded(
            child: DropdownButtonFormField<String>(
              value: safeCategory,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'community_topic'.tr(),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(10)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(10)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                contentPadding: Responsive.padSymmetric(
                  context,
                  horizontal: 12,
                  vertical: 10,
                ),
                filled: true,
                fillColor: AppColors.white,
              ),
              items: categoryKeys
                  .map(
                    (key) => DropdownMenuItem<String>(
                      value: key,
                      child: Text(
                        CommunityDevelopmentalCategory.label(key),
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: context.rf(13)),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) onCategorySelected(value);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyFeedState extends StatelessWidget {
  const _EmptyFeedState({
    required this.isMine,
    required this.hasActiveFilters,
    required this.onClearFilters,
    required this.onCreatePost,
  });

  final bool isMine;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;
  final VoidCallback onCreatePost;

  @override
  Widget build(BuildContext context) {
    if (!isMine && !hasActiveFilters) {
      return Center(
        child: Text(
          'community_empty_title'.tr(),
          style: TextStyle(
            fontSize: context.rf(18),
            fontWeight: FontWeight.w600,
            color: AppColors.textSec,
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    final title = hasActiveFilters
        ? 'community_empty_filtered_title'.tr()
        : 'community_empty_my_posts_title'.tr();

    final subtitle = hasActiveFilters
        ? 'community_empty_filtered_subtitle'.tr()
        : 'community_empty_my_posts_subtitle'.tr();

    return Center(
      child: Padding(
        padding: Responsive.padAll(context, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              hasActiveFilters
                  ? Icons.filter_alt_off_outlined
                  : Icons.post_add_outlined,
              size: context.rs(56),
              color: AppColors.textSec.withOpacity(0.5),
            ),
            SizedBox(height: context.rg(16)),
            Text(
              title,
              style: TextStyle(
                fontSize: context.rf(18),
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: context.rg(8)),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSec.withOpacity(0.95)),
            ),
            SizedBox(height: context.rg(20)),
            if (hasActiveFilters)
              OutlinedButton(
                onPressed: onClearFilters,
                child: Text('community_clear_filters'.tr()),
              )
            else
              FilledButton(
                onPressed: onCreatePost,
                style:
                    FilledButton.styleFrom(backgroundColor: AppColors.green),
                child: Text('community_share'.tr()),
              ),
          ],
        ),
      ),
    );
  }
}
