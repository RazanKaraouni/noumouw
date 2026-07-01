import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';

import '../screens/resource_video_player_page.dart';
import '../services/article_api_service.dart';
import '../services/offline_cache_service.dart';
import '../services/resource_like_service.dart';
import '../services/resource_save_service.dart';
import '../services/resource_video_cache_service.dart';
import '../utils/cdc_milestone_age_tiers.dart';
import '../utils/milestone_localization.dart';
import '../utils/resource_media_urls.dart';
import '../widgets/article_detail_page.dart' show articleHasMeaningfulBody, articlePlainPreview;
import '../widgets/report_content_button.dart';
import '../widgets/report_content_sheet.dart';

String _therapistNameFromResource(Map<String, dynamic> resource) {
  final therapist = resource['therapists'];
  if (therapist is Map) {
    final name = (therapist['full_name'] ?? '').toString().trim();
    if (name.isNotEmpty) return name;
  }
  return '';
}

const _kAllDomainsFilter = 'all_domains';
const _kAllAgesFilter = 'all_ages';

const _domainFilterValues = <String>[
  _kAllDomainsFilter,
  'cognitive',
  'motor',
  'language',
  'social',
  'autism',
];

bool _resourceMatchesSearch(Map<String, dynamic> resource, String query) {
  final trimmed = query.trim();
  if (trimmed.isEmpty) return true;

  final domain = (resource['domain'] ?? '').toString().trim();
  final body = articlePlainPreview((resource['body_text'] ?? '').toString());
  final therapist = resource['therapists'];
  final therapistProfession = therapist is Map
      ? (therapist['profession'] ?? '').toString().trim()
      : '';

  final haystack = [
    (resource['title'] ?? '').toString(),
    body,
    domain,
    if (domain.isNotEmpty) localizedMilestoneDomain(domain),
    (resource['age_range'] ?? '').toString(),
    (resource['publisher'] ?? '').toString(),
    _therapistNameFromResource(resource),
    therapistProfession,
  ].join(' ').toLowerCase();

  final terms =
      trimmed.toLowerCase().split(RegExp(r'\s+')).where((t) => t.isNotEmpty);
  return terms.every(haystack.contains);
}

bool _resourceMatchesAge(Map<String, dynamic> resource, String selectedAge) {
  if (selectedAge == _kAllAgesFilter) return true;
  return CdcMilestoneAgeTiers.resourceMatchesAgeRangeKey(resource, selectedAge);
}

String _domainFilterLabel(String value) {
  if (value == _kAllDomainsFilter) return 'milestones_all_domains'.tr();
  return localizedMilestoneDomain(value);
}

/// Learn page: all public therapist resources with search and domain filters.
class LearnFromTherapistPage extends StatefulWidget {
  const LearnFromTherapistPage({super.key});

  @override
  State<LearnFromTherapistPage> createState() => _LearnFromTherapistPageState();
}

class _LearnFromTherapistPageState extends State<LearnFromTherapistPage> {
  final _supabase = Supabase.instance.client;
  final _likeService = ResourceLikeService();
  final _saveService = ResourceSaveService();
  final _searchController = TextEditingController();
  static const _learnResourcesCacheKey = 'learn:resources:v1';

  List<Map<String, dynamic>> _resources = [];
  final Map<String, bool> _likedByResourceId = {};
  final Map<String, bool> _savedByResourceId = {};
  String? _likeBusyResourceId;
  String? _saveBusyResourceId;
  String _searchQuery = '';
  String _selectedDomain = _kAllDomainsFilter;
  String _selectedAge = _kAllAgesFilter;
  bool _loading = true;
  String? _err;

  List<DropdownMenuItem<String>> get _domainDropdownItems => _domainFilterValues
      .map(
        (value) => DropdownMenuItem<String>(
          value: value,
          child: Text(
            _domainFilterLabel(value),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      )
      .toList();

  String get _safeSelectedDomain =>
      _domainFilterValues.contains(_selectedDomain)
          ? _selectedDomain
          : _kAllDomainsFilter;

  List<CdcMilestoneAgeTier> get _ageTiers => CdcMilestoneAgeTiers.all;

  String get _safeSelectedAge {
    if (_selectedAge == _kAllAgesFilter) return _kAllAgesFilter;
    final validKeys = _ageTiers.map((tier) => tier.rangeKey).toSet();
    return validKeys.contains(_selectedAge) ? _selectedAge : _kAllAgesFilter;
  }

  List<DropdownMenuItem<String>> get _ageDropdownItems => [
        DropdownMenuItem<String>(
          value: _kAllAgesFilter,
          child: Text(
            'milestones_all_ages'.tr(),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        ..._ageTiers.map(
          (tier) => DropdownMenuItem<String>(
            value: tier.rangeKey,
            child: Text(
              tier.label,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ];

  List<Map<String, dynamic>> get _filteredResources => _resources
      .where(
        (row) =>
            _resourceMatchesSearch(row, _searchQuery) &&
            _resourceMatchesAge(row, _safeSelectedAge),
      )
      .toList();

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _loadContent();
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final next = _searchController.text;
    if (next == _searchQuery) return;
    setState(() => _searchQuery = next);
  }

  void _clearSearch() {
    _searchController.clear();
    if (_searchQuery.isEmpty) return;
    setState(() => _searchQuery = '');
  }

  Future<List<Map<String, dynamic>>> _attachTherapists(
    List<Map<String, dynamic>> resources,
  ) async {
    if (resources.isEmpty) return resources;

    final therapistIds = resources
        .map((row) => (row['therapist_id'] ?? '').toString().trim())
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
    if (therapistIds.isEmpty) return resources;

    final therapistRows = await _supabase
        .from('therapists')
        .select('therapist_id, full_name, profession')
        .inFilter('therapist_id', therapistIds);

    final byId = <String, Map<String, dynamic>>{};
    for (final row in List<Map<String, dynamic>>.from(therapistRows)) {
      final id = (row['therapist_id'] ?? '').toString();
      if (id.isNotEmpty) byId[id] = row;
    }

    return resources.map((row) {
      final therapistId = (row['therapist_id'] ?? '').toString();
      final therapist = byId[therapistId];
      if (therapist == null) return row;
      return {
        ...row,
        'therapists': {
          'full_name': therapist['full_name'],
          'profession': therapist['profession'],
        },
      };
    }).toList();
  }

  void _onFilterChanged() {
    _loadContent();
  }

  Future<List<Map<String, dynamic>>> _fetchResourceRows({
    required bool publicOnly,
    List<String>? therapistIds,
  }) async {
    var query = _supabase.from('resources').select(
          '*, therapists(full_name, profession)',
        );
    if (publicOnly) {
      query = query.eq('is_public', true);
    } else if (therapistIds != null && therapistIds.isNotEmpty) {
      query = query
          .eq('is_public', false)
          .inFilter('therapist_id', therapistIds);
    } else {
      return const [];
    }

    final domain = _safeSelectedDomain;
    if (domain != _kAllDomainsFilter) {
      query = query.eq('domain', domain);
    }

    final age = _safeSelectedAge;
    if (age != _kAllAgesFilter) {
      final tier = CdcMilestoneAgeTiers.tierForRangeKey(age);
      if (tier != null) {
        query = query.or(
          'age_range.eq.${tier.label},age_range.eq.all,age_range.is.null',
        );
      }
    }

    final rows = await query.order('created_at', ascending: true);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> _loadAllResources() async {
    final user = _supabase.auth.currentUser;
    if (user == null) {
      throw Exception('Not signed in');
    }

    List<String> linkedTherapistIds = const [];
    try {
      final links = await _supabase
          .from('therapist_children')
          .select('therapist_id')
          .eq('parent_id', user.id);
      linkedTherapistIds = List<Map<String, dynamic>>.from(links)
          .map((row) => (row['therapist_id'] ?? '').toString().trim())
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
    } catch (_) {
      linkedTherapistIds = const [];
    }

    List<Map<String, dynamic>> publicRows;
    List<Map<String, dynamic>> privateRows;
    try {
      publicRows = await _fetchResourceRows(publicOnly: true);
      privateRows = linkedTherapistIds.isEmpty
          ? const []
          : await _fetchResourceRows(
              publicOnly: false,
              therapistIds: linkedTherapistIds,
            );
    } catch (_) {
      var publicQuery = _supabase
          .from('resources')
          .select()
          .eq('is_public', true);
      var privateQuery = linkedTherapistIds.isEmpty
          ? null
          : _supabase
              .from('resources')
              .select()
              .eq('is_public', false)
              .inFilter('therapist_id', linkedTherapistIds);

      final domain = _safeSelectedDomain;
      if (domain != _kAllDomainsFilter) {
        publicQuery = publicQuery.eq('domain', domain);
        privateQuery = privateQuery?.eq('domain', domain);
      }

      final age = _safeSelectedAge;
      if (age != _kAllAgesFilter) {
        final tier = CdcMilestoneAgeTiers.tierForRangeKey(age);
        if (tier != null) {
          final ageOr =
              'age_range.eq.${tier.label},age_range.eq.all,age_range.is.null';
          publicQuery = publicQuery.or(ageOr);
          privateQuery = privateQuery?.or(ageOr);
        }
      }

      final publicFallback = await publicQuery.order('created_at', ascending: true);
      publicRows = List<Map<String, dynamic>>.from(publicFallback);

      if (linkedTherapistIds.isEmpty || privateQuery == null) {
        privateRows = const [];
      } else {
        final privateFallback =
            await privateQuery.order('created_at', ascending: true);
        privateRows = List<Map<String, dynamic>>.from(privateFallback);
      }

      publicRows = await _attachTherapists(publicRows);
      privateRows = await _attachTherapists(privateRows);
    }

    final byId = <String, Map<String, dynamic>>{};
    for (final row in [...publicRows, ...privateRows]) {
      final id = (row['resources_id'] ?? '').toString();
      if (id.isNotEmpty) byId[id] = row;
    }

    final merged = byId.values
        .where((row) => _resourceMatchesAge(row, _safeSelectedAge))
        .toList()
      ..sort((a, b) {
        final aAt = DateTime.tryParse((a['created_at'] ?? '').toString());
        final bAt = DateTime.tryParse((b['created_at'] ?? '').toString());
        if (aAt == null && bAt == null) return 0;
        if (aAt == null) return 1;
        if (bAt == null) return -1;
        return aAt.compareTo(bAt);
      });
    return merged;
  }

  Future<void> _loadContent() async {
    final cached = await OfflineCacheService.instance
        .readJson<List<dynamic>>(_learnResourcesCacheKey);
    final hadCache = cached != null && cached.isNotEmpty;
    if (hadCache && mounted) {
      setState(() {
        _resources = cached
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
        _err = null;
      });
      _prefetchVideos(_resources);
      _syncEngagement();
    } else {
      setState(() {
        _loading = true;
        _err = null;
      });
    }

    try {
      final resources = await _loadAllResources();
      if (!mounted) return;
      await OfflineCacheService.instance
          .saveJson(_learnResourcesCacheKey, resources);
      setState(() {
        _resources = resources;
        _loading = false;
        _err = null;
      });
      _prefetchVideos(resources);
      await _syncEngagement();
    } catch (e) {
      if (!mounted) return;
      if (hadCache) {
        setState(() {
          _loading = false;
          _err = null;
        });
      } else {
        setState(() {
          _err = userFacingErrorMessage(e);
          _loading = false;
        });
      }
    }
  }

  void _prefetchVideos(List<Map<String, dynamic>> resources) {
    ResourceVideoCacheService.instance.prefetchResources(resources);
  }

  Iterable<String> get _loadedResourceIds sync* {
    for (final row in _resources) {
      final id = (row['resources_id'] ?? '').toString().trim();
      if (id.isNotEmpty) yield id;
    }
  }

  Future<void> _syncEngagement() async {
    final ids = _loadedResourceIds.toList();
    if (ids.isEmpty || !mounted) return;
    try {
      final results = await Future.wait([
        _likeService.fetchLikes(ids),
        _saveService.fetchSaves(ids),
      ]);
      if (!mounted) return;
      setState(() {
        _likedByResourceId
          ..clear()
          ..addAll(Map<String, bool>.from(results[0]));
        _savedByResourceId
          ..clear()
          ..addAll(Map<String, bool>.from(results[1]));
      });
    } catch (_) {
      // Engagement state is optional; cards still work without it.
    }
  }

  Future<void> _openVideoPlayer(Map<String, dynamic> resource) async {
    final mediaUrl = resolveResourceVideoUrl(resource);
    if (mediaUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('learn_invalid_video'.tr())),
      );
      return;
    }

    final resourceId = (resource['resources_id'] ?? '').toString().trim();
    final cache = ResourceVideoCacheService.instance;
    if (cache.isCacheableUrl(mediaUrl)) {
      final alreadyCached = await cache.cachedFile(
        mediaUrl,
        resourceId: resourceId.isEmpty ? null : resourceId,
      );
      if (alreadyCached == null) {
        if (!mounted) return;
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => PopScope(
            canPop: false,
            child: AlertDialog(
              content: Row(
                children: [
                  const CircularProgressIndicator(),
                  SizedBox(width: context.rg(16)),
                  Expanded(child: Text('learn_video_preparing'.tr())),
                ],
              ),
            ),
          ),
        );
        await cache.ensureCached(
          mediaUrl,
          resourceId: resourceId.isEmpty ? null : resourceId,
        );
        if (mounted) Navigator.of(context, rootNavigator: true).pop();
      }
    }

    if (!mounted) return;
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ResourceVideoPlayerPage(
          url: mediaUrl,
          title: (resource['title'] ?? '').toString(),
          caption: articlePlainPreview(
            (resource['body_text'] ?? '').toString(),
          ),
          resourceId: resourceId,
        ),
      ),
    );
  }

  void _openImageViewer(Map<String, dynamic> resource) {
    final mediaUrl = resolveResourceImageUrl(resource);
    final title = (resource['title'] ?? '').toString().trim();
    if (mediaUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('learn_no_image_url'.tr())),
      );
      return;
    }
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog.fullscreen(
        child: Scaffold(
          appBar: AppBar(
            title: Text(
              title.isEmpty ? 'learn_image_fallback'.tr() : title,
            ),
          ),
          body: InteractiveViewer(
            minScale: 0.5,
            maxScale: 4,
            child: Center(
              child: CachedNetworkImage(
                imageUrl: mediaUrl,
                fit: BoxFit.contain,
                errorWidget: (_, __, ___) => Padding(
                  padding: Responsive.padAll(ctx, 24),
                  child: Text(
                    networkErrorMessage(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(ctx).colorScheme.error,
                      fontSize: ctx.rf(14),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _toggleLike(String resourceId) async {
    if (_likeBusyResourceId != null) return;
    setState(() => _likeBusyResourceId = resourceId);
    try {
      final liked = await _likeService.toggleLike(resourceId);
      if (!mounted) return;
      setState(() => _likedByResourceId[resourceId] = liked);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            liked ? 'learn_liked_snack'.tr() : 'learn_unliked_snack'.tr(),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _likeBusyResourceId = null);
    }
  }

  Future<void> _toggleSave(String resourceId) async {
    if (_saveBusyResourceId != null) return;
    setState(() => _saveBusyResourceId = resourceId);
    try {
      final saved = await _saveService.toggleSave(resourceId);
      if (!mounted) return;
      setState(() => _savedByResourceId[resourceId] = saved);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            saved ? 'learn_saved_snack'.tr() : 'learn_unsaved_snack'.tr(),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _saveBusyResourceId = null);
    }
  }

  Widget _buildResourceCard(Map<String, dynamic> resource) {
    final resourceId = (resource['resources_id'] ?? '').toString();
    final isLiked = _likedByResourceId[resourceId] == true;
    final isSaved = _savedByResourceId[resourceId] == true;
    final likeBusy = _likeBusyResourceId == resourceId;
    final saveBusy = _saveBusyResourceId == resourceId;
    void onLike() => _toggleLike(resourceId);
    void onSave() => _toggleSave(resourceId);
    final contentType = (resource['content_type'] ?? '').toString();

    switch (contentType) {
      case 'video':
        return _LearnVideoCard(
          resource: resource,
          isLiked: isLiked,
          isSaved: isSaved,
          likeBusy: likeBusy,
          saveBusy: saveBusy,
          onLike: onLike,
          onSave: onSave,
          onPlay: () => _openVideoPlayer(resource),
        );
      case 'article':
        return _LearnArticleCard(
          resource: resource,
          isLiked: isLiked,
          isSaved: isSaved,
          likeBusy: likeBusy,
          saveBusy: saveBusy,
          onLike: onLike,
          onSave: onSave,
        );
      case 'image':
        if (resolveResourceVideoUrl(resource).isNotEmpty &&
            resolveResourceImageUrl(resource).isEmpty) {
          return const SizedBox.shrink();
        }
        return _LearnImageCard(
          resource: resource,
          isLiked: isLiked,
          isSaved: isSaved,
          likeBusy: likeBusy,
          saveBusy: saveBusy,
          onLike: onLike,
          onSave: onSave,
          onView: () => _openImageViewer(resource),
        );
      case 'resource':
        final body = (resource['body_text'] ?? '').toString();
        final hasBody = articleHasMeaningfulBody(body);
        final hasAttachment =
            resolveResourceAttachmentUrl(resource).isNotEmpty;
        final videoUrl = resolveResourceVideoUrl(resource);
        final imageUrl = resolveResourceImageUrl(resource);

        if (hasBody || hasAttachment) {
          return _LearnArticleCard(
            resource: resource,
            isLiked: isLiked,
            isSaved: isSaved,
            likeBusy: likeBusy,
            saveBusy: saveBusy,
            onLike: onLike,
            onSave: onSave,
          );
        }
        if (videoUrl.isNotEmpty) {
          return _LearnVideoCard(
            resource: resource,
            isLiked: isLiked,
            isSaved: isSaved,
            likeBusy: likeBusy,
            saveBusy: saveBusy,
            onLike: onLike,
            onSave: onSave,
            onPlay: () => _openVideoPlayer(resource),
          );
        }
        if (imageUrl.isNotEmpty) {
          return _LearnImageCard(
            resource: resource,
            isLiked: isLiked,
            isSaved: isSaved,
            likeBusy: likeBusy,
            saveBusy: saveBusy,
            onLike: onLike,
            onSave: onSave,
            onView: () => _openImageViewer(resource),
          );
        }
        return const SizedBox.shrink();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildResourcesSection() {
    final results = _filteredResources;
    if (results.isEmpty) {
      return _LearnEmptyCard(
        icon: Icons.search_off_rounded,
        message: _resources.isEmpty
            ? 'learn_no_content'.tr()
            : 'learn_filter_no_results'.tr(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _LearnSectionHeader(
          label: 'learn_search_results_count'.tr(
            namedArgs: {'count': '${results.length}'},
          ),
        ),
        for (var i = 0; i < results.length; i++) ...[
          if (i > 0) SizedBox(height: context.rg(12)),
          _buildResourceCard(results[i]),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('learn_title'.tr())),
      body: RefreshIndicator(
        onRefresh: _loadContent,
        child: _loading
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: context.rs(120)),
                  const Center(child: CircularProgressIndicator()),
                ],
              )
            : _err != null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: context.pagePadding,
                    children: [
                      Text(
                        _err!,
                        style: TextStyle(
                          color: Colors.red,
                          fontSize: context.rf(14),
                        ),
                      ),
                    ],
                  )
                : ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(
                      context.rs(16),
                      context.rs(12),
                      context.rs(16),
                      MediaQuery.paddingOf(context).bottom + context.rs(24),
                    ),
                    children: [
                      _LearnSearchBar(
                        controller: _searchController,
                        showClear: _searchQuery.trim().isNotEmpty,
                        onClear: _clearSearch,
                      ),
                      SizedBox(height: context.rg(12)),
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              value: _safeSelectedDomain,
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
                              items: _domainDropdownItems,
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => _selectedDomain = value);
                                _onFilterChanged();
                              },
                            ),
                          ),
                          SizedBox(width: context.rg(10)),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              value: _safeSelectedAge,
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
                              items: _ageDropdownItems,
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => _selectedAge = value);
                                _onFilterChanged();
                              },
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: context.rg(16)),
                      _buildResourcesSection(),
                    ],
                  ),
      ),
    );
  }
}

class _LearnSectionHeader extends StatelessWidget {
  const _LearnSectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: context.rg(12)),
      child: Text(
        label.toUpperCase(),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: context.rf(11),
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
          color: Colors.grey.shade700,
        ),
      ),
    );
  }
}

class _LearnSearchBar extends StatelessWidget {
  const _LearnSearchBar({
    required this.controller,
    required this.showClear,
    required this.onClear,
  });

  final TextEditingController controller;
  final bool showClear;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return TextField(
      controller: controller,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'learn_search_hint'.tr(),
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: showClear
            ? IconButton(
                tooltip: 'learn_search_clear'.tr(),
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded),
              )
            : null,
        filled: true,
        fillColor: scheme.surfaceVariant.withOpacity(0.45),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(12)),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(12)),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(12)),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        contentPadding: Responsive.padSymmetric(
          context,
          horizontal: 4,
          vertical: 12,
        ),
      ),
    );
  }
}

class _LearnEmptyCard extends StatelessWidget {
  const _LearnEmptyCard({
    required this.icon,
    required this.message,
  });

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: Responsive.padAll(context, 20),
      child: Row(
        children: [
          Icon(
            icon,
            color: Theme.of(context).colorScheme.primary,
            size: context.rs(24),
          ),
          SizedBox(width: context.rg(12)),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: context.rf(14),
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withOpacity(0.7),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LearnVideoCard extends StatelessWidget {
  const _LearnVideoCard({
    required this.resource,
    required this.isLiked,
    required this.isSaved,
    required this.likeBusy,
    required this.saveBusy,
    required this.onLike,
    required this.onSave,
    required this.onPlay,
  });

  final Map<String, dynamic> resource;
  final bool isLiked;
  final bool isSaved;
  final bool likeBusy;
  final bool saveBusy;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    final title = (resource['title'] ?? '').toString();
    final caption = articlePlainPreview(
      (resource['body_text'] ?? '').toString(),
    );
    final resourceId = (resource['resources_id'] ?? '').toString();

    return _LearnExpandableResourceCard(
      title: title,
      fallbackTitle: 'learn_video_fallback'.tr(),
      therapistName: _therapistNameFromResource(resource),
      thumbnailUrl: learnThumbnailUrl(resource),
      thumbnailIsVideo: learnThumbnailIsVideo(resource),
      description: caption,
      resourceId: resourceId,
      emptyMessage: 'learn_video_empty'.tr(),
      isLiked: isLiked,
      isSaved: isSaved,
      likeBusy: likeBusy,
      saveBusy: saveBusy,
      onLike: onLike,
      onSave: onSave,
      onThumbnailTap: onPlay,
      mediaAction: FilledButton.icon(
        onPressed: onPlay,
        icon: const Icon(Icons.play_arrow_rounded),
        label: Text('learn_play_video'.tr()),
      ),
    );
  }
}

class _LearnArticleCard extends StatefulWidget {
  const _LearnArticleCard({
    required this.resource,
    required this.isLiked,
    required this.isSaved,
    required this.likeBusy,
    required this.saveBusy,
    required this.onLike,
    required this.onSave,
  });

  final Map<String, dynamic> resource;
  final bool isLiked;
  final bool isSaved;
  final bool likeBusy;
  final bool saveBusy;
  final VoidCallback onLike;
  final VoidCallback onSave;

  @override
  State<_LearnArticleCard> createState() => _LearnArticleCardState();
}

class _LearnArticleCardState extends State<_LearnArticleCard> {
  final _api = ArticleApiService();
  String _body = '';
  bool _loading = false;
  bool _fetchStarted = false;

  @override
  void initState() {
    super.initState();
    _body = (widget.resource['body_text'] ?? '').toString();
    if (_needsRemoteBody) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fetchBodyIfNeeded());
    }
  }

  bool get _hasMeaningfulBody => articleHasMeaningfulBody(_body);

  bool get _hasPdfAttachment {
    final media =
        resolveResourceAttachmentUrl(widget.resource).toLowerCase();
    return media.endsWith('.pdf');
  }

  bool get _needsRemoteBody {
    if (_hasPdfAttachment) return false;
    final id = (widget.resource['resources_id'] ?? '').toString().trim();
    if (id.isEmpty) return false;
    if (_hasMeaningfulBody) return false;
    final media =
        resolveResourceAttachmentUrl(widget.resource).toLowerCase();
    return media.endsWith('.docx') ||
        media.endsWith('.doc') ||
        media.endsWith('.txt');
  }

  Future<void> _fetchBodyIfNeeded() async {
    if (!_needsRemoteBody || _fetchStarted) return;
    _fetchStarted = true;
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final id = (widget.resource['resources_id'] ?? '').toString().trim();
      final result = await _api.fetchArticleBody(id);
      if (!mounted) return;
      setState(() {
        _body = result.bodyText;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = (widget.resource['title'] ?? '').toString();
    final resourceId = (widget.resource['resources_id'] ?? '').toString();

    return _LearnExpandableResourceCard(
      title: title,
      fallbackTitle: 'learn_article_fallback'.tr(),
      therapistName: _therapistNameFromResource(widget.resource),
      thumbnailUrl: learnThumbnailUrl(widget.resource),
      thumbnailIsVideo: learnThumbnailIsVideo(widget.resource),
      description: _hasMeaningfulBody ? _body : '',
      resourceId: resourceId,
      renderDescriptionAsHtml: true,
      emptyMessage: _loading
          ? 'learn_article_loading'.tr()
          : _hasPdfAttachment
              ? 'learn_article_pdf_hint'.tr()
              : 'learn_article_empty'.tr(),
      isLiked: widget.isLiked,
      isSaved: widget.isSaved,
      likeBusy: widget.likeBusy,
      saveBusy: widget.saveBusy,
      onLike: widget.onLike,
      onSave: widget.onSave,
      onExpansionChanged: (expanded) {
        if (expanded) _fetchBodyIfNeeded();
      },
      belowDescription: _loading
          ? Padding(
              padding: EdgeInsets.only(top: context.rg(8)),
              child: const Center(child: CircularProgressIndicator()),
            )
          : null,
    );
  }
}

/// Tap-to-expand card for Learn resources (title, flag, description).
class _LearnSquareMediaThumbnail extends StatelessWidget {
  const _LearnSquareMediaThumbnail({
    required this.mediaUrl,
    required this.isVideo,
    this.resourceId,
  });

  final String mediaUrl;
  final bool isVideo;
  final String? resourceId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final size = context.rs(72);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(context.rs(10)),
        border: Border.all(color: scheme.outline),
        color: scheme.surfaceVariant.withOpacity(0.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: isVideo
          ? _LearnVideoThumbnailPreview(
              mediaUrl: mediaUrl,
              resourceId: resourceId,
            )
          : CachedNetworkImage(
              imageUrl: mediaUrl,
              fit: BoxFit.cover,
              width: size,
              height: size,
              fadeInDuration: const Duration(milliseconds: 120),
              placeholder: (_, __) => Center(
                child: SizedBox(
                  width: context.rs(20),
                  height: context.rs(20),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: scheme.primary,
                  ),
                ),
              ),
              errorWidget: (_, __, ___) => Icon(
                Icons.broken_image_outlined,
                size: context.rs(24),
                color: scheme.onSurface.withOpacity(0.45),
              ),
            ),
    );
  }
}

class _LearnVideoThumbnailPreview extends StatefulWidget {
  const _LearnVideoThumbnailPreview({
    required this.mediaUrl,
    this.resourceId,
  });

  final String mediaUrl;
  final String? resourceId;

  @override
  State<_LearnVideoThumbnailPreview> createState() =>
      _LearnVideoThumbnailPreviewState();
}

class _LearnVideoThumbnailPreviewState extends State<_LearnVideoThumbnailPreview> {
  VideoPlayerController? _controller;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _initController();
  }

  Future<void> _initController() async {
    final c = await ResourceVideoCacheService.instance.createController(
      widget.mediaUrl,
      resourceId: widget.resourceId,
    );
    if (c == null || !mounted) return;

    _controller = c;
    try {
      await c.initialize();
      if (!mounted) return;
      await c.pause();
      setState(() => _ready = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _ready = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final c = _controller;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (_ready && c != null)
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: c.value.size.width,
              height: c.value.size.height,
              child: VideoPlayer(c),
            ),
          )
        else
          ColoredBox(color: scheme.surfaceVariant),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withOpacity(0.08),
                Colors.black.withOpacity(0.35),
              ],
            ),
          ),
        ),
        Center(
          child: Icon(
            Icons.play_circle_fill_rounded,
            size: context.rs(30),
            color: Colors.white.withOpacity(0.92),
          ),
        ),
      ],
    );
  }
}

/// Tap-to-expand card for Learn resources (title, flag, description).
class _LearnExpandableResourceCard extends StatefulWidget {
  const _LearnExpandableResourceCard({
    required this.title,
    required this.fallbackTitle,
    required this.therapistName,
    this.thumbnailUrl,
    this.thumbnailIsVideo = false,
    required this.description,
    required this.resourceId,
    this.renderDescriptionAsHtml = false,
    required this.emptyMessage,
    this.belowDescription,
    this.isLiked = false,
    this.isSaved = false,
    this.likeBusy = false,
    this.saveBusy = false,
    this.onLike,
    this.onSave,
    this.onExpansionChanged,
    this.onThumbnailTap,
    this.mediaAction,
  });

  final String title;
  final String fallbackTitle;
  final String therapistName;
  final String? thumbnailUrl;
  final bool thumbnailIsVideo;
  final String description;
  final String resourceId;
  final bool renderDescriptionAsHtml;
  final String emptyMessage;
  final bool isLiked;
  final bool isSaved;
  final bool likeBusy;
  final bool saveBusy;
  final VoidCallback? onLike;
  final VoidCallback? onSave;
  final ValueChanged<bool>? onExpansionChanged;
  final VoidCallback? onThumbnailTap;
  final Widget? mediaAction;

  /// Shown only when expanded (e.g. image preview).
  final Widget? belowDescription;

  @override
  State<_LearnExpandableResourceCard> createState() =>
      _LearnExpandableResourceCardState();
}

class _LearnExpandableResourceCardState
    extends State<_LearnExpandableResourceCard> {
  static const _animationDuration = Duration(milliseconds: 300);
  static const _animationCurve = Curves.easeInOut;
  static const _collapsedBodyMaxLines = 2;

  bool _isExpanded = false;

  void _toggleExpanded() {
    setState(() => _isExpanded = !_isExpanded);
    widget.onExpansionChanged?.call(_isExpanded);
  }

  @override
  Widget build(BuildContext context) {
    final displayTitle =
        widget.title.trim().isEmpty ? widget.fallbackTitle : widget.title.trim();
    final body = widget.description.trim();
    final preview = articlePlainPreview(widget.description);
    final hasDescription = body.isNotEmpty || preview.isNotEmpty;
    final plainBody = preview.isEmpty ? body : preview;
    final scheme = Theme.of(context).colorScheme;
    final mutedBodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: scheme.onSurface.withOpacity(0.75),
          height: 1.45,
        );
    final emptyStyle = TextStyle(color: scheme.onSurface.withOpacity(0.7));

    return AppCard(
      color: scheme.surface,
      padding: EdgeInsets.zero,
      child: AnimatedSize(
        duration: _animationDuration,
        curve: _animationCurve,
        alignment: Alignment.topCenter,
        clipBehavior: Clip.hardEdge,
        child: Padding(
          padding: Responsive.padAll(context, 16),
          child: _isExpanded
              ? _buildExpandedBody(
                  displayTitle: displayTitle,
                  body: body,
                  plainBody: plainBody,
                  preview: preview,
                  hasDescription: hasDescription,
                  mutedBodyStyle: mutedBodyStyle,
                  emptyStyle: emptyStyle,
                )
              : _buildCollapsedBody(
                  displayTitle: displayTitle,
                  body: body,
                  plainBody: plainBody,
                  preview: preview,
                  hasDescription: hasDescription,
                  mutedBodyStyle: mutedBodyStyle,
                  emptyStyle: emptyStyle,
                ),
        ),
      ),
    );
  }

  static ButtonStyle _compactIconButtonStyle(BuildContext context) =>
      IconButton.styleFrom(
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: Responsive.padAll(context, 4),
        minimumSize: Size(context.rs(32), context.rs(32)),
        visualDensity: VisualDensity.compact,
      );

  Widget _buildTitleRow(String displayTitle, {required bool expanded}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            displayTitle,
            maxLines: expanded ? null : 3,
            softWrap: true,
            overflow:
                expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.rf(16),
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
          ),
        ),
        if (widget.resourceId.trim().isNotEmpty && widget.onLike != null)
          _LearnLikeButton(
            isLiked: widget.isLiked,
            busy: widget.likeBusy,
            onPressed: widget.onLike!,
            compact: !expanded,
          ),
        if (widget.resourceId.trim().isNotEmpty && widget.onSave != null)
          _LearnSaveButton(
            isSaved: widget.isSaved,
            busy: widget.saveBusy,
            onPressed: widget.onSave!,
            compact: !expanded,
          ),
        if (widget.resourceId.trim().isNotEmpty)
          ReportContentButton(
            targetType: ReportTargetType.resource,
            targetId: widget.resourceId,
            iconButtonStyle:
                expanded ? null : _compactIconButtonStyle(context),
          ),
      ],
    );
  }

  Widget _buildAuthorLine(ColorScheme scheme) {
    final name = widget.therapistName.trim().isEmpty
        ? 'therapists_default_name'.tr()
        : widget.therapistName.trim();
    return Text(
      name,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: context.rf(13),
        fontWeight: FontWeight.w500,
        color: scheme.onSurface.withOpacity(0.6),
        height: 1.3,
      ),
    );
  }

  Widget? _buildThumbnail() {
    final url = widget.thumbnailUrl?.trim();
    if (url == null || url.isEmpty) return null;
    return _LearnSquareMediaThumbnail(
      mediaUrl: url,
      isVideo: widget.thumbnailIsVideo,
      resourceId: widget.resourceId,
    );
  }

  Widget _buildExpandableTapTarget({required Widget child}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _toggleExpanded,
        borderRadius: BorderRadius.circular(context.rs(8)),
        child: child,
      ),
    );
  }

  Widget? _buildExpandedHeroImage() {
    final url = widget.thumbnailUrl?.trim();
    if (url == null || url.isEmpty || widget.thumbnailIsVideo) return null;

    final scheme = Theme.of(context).colorScheme;
    Widget image = ClipRRect(
      borderRadius: BorderRadius.circular(context.rs(10)),
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        width: double.infinity,
        fadeInDuration: const Duration(milliseconds: 120),
        placeholder: (_, __) => const AspectRatio(
          aspectRatio: 16 / 9,
          child: Center(child: CircularProgressIndicator()),
        ),
        errorWidget: (_, __, ___) => Padding(
          padding: Responsive.padAll(context, 16),
          child: Text(
            networkErrorMessage(),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: scheme.error,
              fontSize: context.rf(13),
            ),
          ),
        ),
      ),
    );

    if (widget.onThumbnailTap != null) {
      image = GestureDetector(
        onTap: widget.onThumbnailTap,
        child: image,
      );
    }

    return Padding(
      padding: EdgeInsets.only(top: context.rg(12)),
      child: image,
    );
  }

  Widget? _buildMediaAction() {
    final action = widget.mediaAction;
    if (action == null) return null;
    return Padding(
      padding: EdgeInsets.only(top: context.rg(10)),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: action,
      ),
    );
  }

  Widget _buildTextColumn({
    required String displayTitle,
    required String body,
    required String plainBody,
    required String preview,
    required bool hasDescription,
    required TextStyle? mutedBodyStyle,
    required TextStyle emptyStyle,
    required bool expanded,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildTitleRow(displayTitle, expanded: expanded),
        SizedBox(height: context.rg(4)),
        _buildAuthorLine(Theme.of(context).colorScheme),
        SizedBox(height: context.rg(8)),
        _buildDescription(
          body: body,
          plainBody: plainBody,
          preview: preview,
          hasDescription: hasDescription,
          mutedBodyStyle: mutedBodyStyle?.copyWith(
            height: expanded ? 1.45 : 1.3,
          ),
          emptyStyle: emptyStyle,
          expanded: expanded,
        ),
      ],
    );
  }

  Widget? _buildThumbnailTapTarget() {
    final thumbnail = _buildThumbnail();
    if (thumbnail == null) return null;
    if (widget.onThumbnailTap == null) return thumbnail;
    return GestureDetector(
      onTap: widget.onThumbnailTap,
      behavior: HitTestBehavior.opaque,
      child: thumbnail,
    );
  }

  Widget _wrapWithThumbnail(Widget content) {
    final thumbnail = _buildThumbnailTapTarget();
    if (thumbnail == null) return content;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        thumbnail,
        SizedBox(width: context.rg(12)),
        Expanded(child: content),
      ],
    );
  }

  /// Intrinsic height preview — avoids squeezing content into a fixed box.
  Widget _buildCollapsedBody({
    required String displayTitle,
    required String body,
    required String plainBody,
    required String preview,
    required bool hasDescription,
    required TextStyle? mutedBodyStyle,
    required TextStyle emptyStyle,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _wrapWithThumbnail(
          _buildExpandableTapTarget(
            child: _buildTextColumn(
              displayTitle: displayTitle,
              body: body,
              plainBody: plainBody,
              preview: preview,
              hasDescription: hasDescription,
              mutedBodyStyle: mutedBodyStyle,
              emptyStyle: emptyStyle,
              expanded: false,
            ),
          ),
        ),
        if (widget.mediaAction != null) _buildMediaAction()!,
      ],
    );
  }

  Widget _buildExpandedBody({
    required String displayTitle,
    required String body,
    required String plainBody,
    required String preview,
    required bool hasDescription,
    required TextStyle? mutedBodyStyle,
    required TextStyle emptyStyle,
  }) {
    final heroImage = _buildExpandedHeroImage();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildExpandableTapTarget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTitleRow(displayTitle, expanded: true),
              SizedBox(height: context.rg(4)),
              _buildAuthorLine(Theme.of(context).colorScheme),
              if (heroImage != null) heroImage,
              if (hasDescription) ...[
                SizedBox(height: context.rg(8)),
                _buildDescription(
                  body: body,
                  plainBody: plainBody,
                  preview: preview,
                  hasDescription: hasDescription,
                  mutedBodyStyle: mutedBodyStyle,
                  emptyStyle: emptyStyle,
                  expanded: true,
                ),
              ],
            ],
          ),
        ),
        if (widget.mediaAction != null) _buildMediaAction()!,
        if (widget.belowDescription != null) ...[
          SizedBox(height: context.rg(12)),
          widget.belowDescription!,
        ],
      ],
    );
  }

  Widget _buildDescription({
    required String body,
    required String plainBody,
    required String preview,
    required bool hasDescription,
    required TextStyle? mutedBodyStyle,
    required TextStyle emptyStyle,
    required bool expanded,
  }) {
    if (!hasDescription) {
      return Text(
        widget.emptyMessage,
        maxLines: expanded ? null : 1,
        overflow: expanded ? TextOverflow.visible : TextOverflow.ellipsis,
        style: emptyStyle,
      );
    }

    if (expanded) {
      if (widget.renderDescriptionAsHtml) {
        return HtmlWidget(body.isEmpty ? preview : body);
      }
      return Text(
        plainBody,
        style: mutedBodyStyle,
      );
    }

    return Text(
      plainBody,
      maxLines: _collapsedBodyMaxLines,
      overflow: TextOverflow.ellipsis,
      style: mutedBodyStyle,
    );
  }
}

class _LearnLikeButton extends StatelessWidget {
  const _LearnLikeButton({
    required this.isLiked,
    required this.busy,
    required this.onPressed,
    this.compact = false,
  });

  final bool isLiked;
  final bool busy;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: isLiked ? 'learn_unlike_tooltip'.tr() : 'learn_like_tooltip'.tr(),
      onPressed: busy ? null : onPressed,
      style: compact
          ? _LearnExpandableResourceCardState._compactIconButtonStyle(context)
          : null,
      icon: busy
          ? SizedBox(
              width: context.rs(20),
              height: context.rs(20),
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: scheme.primary,
              ),
            )
          : Icon(
              isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              color: isLiked
                  ? scheme.error
                  : scheme.onSurface.withOpacity(0.55),
            ),
    );
  }
}

class _LearnSaveButton extends StatelessWidget {
  const _LearnSaveButton({
    required this.isSaved,
    required this.busy,
    required this.onPressed,
    this.compact = false,
  });

  final bool isSaved;
  final bool busy;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: isSaved ? 'learn_unsave_tooltip'.tr() : 'learn_save_tooltip'.tr(),
      onPressed: busy ? null : onPressed,
      style: compact
          ? _LearnExpandableResourceCardState._compactIconButtonStyle(context)
          : null,
      icon: busy
          ? SizedBox(
              width: context.rs(20),
              height: context.rs(20),
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: scheme.primary,
              ),
            )
          : Icon(
              isSaved
                  ? Icons.bookmark_rounded
                  : Icons.bookmark_border_rounded,
              color: isSaved
                  ? scheme.primary
                  : scheme.onSurface.withOpacity(0.55),
            ),
    );
  }
}

class _LearnImageCard extends StatelessWidget {
  const _LearnImageCard({
    required this.resource,
    required this.isLiked,
    required this.isSaved,
    required this.likeBusy,
    required this.saveBusy,
    required this.onLike,
    required this.onSave,
    required this.onView,
  });

  final Map<String, dynamic> resource;
  final bool isLiked;
  final bool isSaved;
  final bool likeBusy;
  final bool saveBusy;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final title = (resource['title'] ?? '').toString();
    final caption = articlePlainPreview(
      (resource['body_text'] ?? '').toString(),
    );
    final resourceId = (resource['resources_id'] ?? '').toString();

    return _LearnExpandableResourceCard(
      title: title,
      fallbackTitle: 'learn_image_fallback'.tr(),
      therapistName: _therapistNameFromResource(resource),
      thumbnailUrl: learnThumbnailUrl(resource),
      thumbnailIsVideo: learnThumbnailIsVideo(resource),
      description: caption,
      resourceId: resourceId,
      emptyMessage: 'learn_image_empty'.tr(),
      isLiked: isLiked,
      isSaved: isSaved,
      likeBusy: likeBusy,
      saveBusy: saveBusy,
      onLike: onLike,
      onSave: onSave,
      onThumbnailTap: onView,
      mediaAction: OutlinedButton.icon(
        onPressed: onView,
        icon: const Icon(Icons.photo_outlined),
        label: Text('learn_view_image'.tr()),
      ),
    );
  }
}
