import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/resource_save_service.dart';
import '../theme/app_colors.dart';
import '../utils/resource_media_urls.dart';
import '../widgets/article_detail_page.dart';
import 'resource_video_player_page.dart';

/// Bookmarked Learn resources from account settings.
class SavedResourcesPage extends StatefulWidget {
  const SavedResourcesPage({super.key});

  @override
  State<SavedResourcesPage> createState() => _SavedResourcesPageState();
}

class _SavedResourcesPageState extends State<SavedResourcesPage> {
  final _saveService = ResourceSaveService();

  List<Map<String, dynamic>> _resources = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _saveService.fetchSavedResources();
      if (!mounted) return;
      setState(() {
        _resources = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _resources = [];
        _loading = false;
        _error = userFacingErrorMessage(e);
      });
    }
  }

  Future<void> _unsave(String resourceId) async {
    try {
      await _saveService.toggleSave(resourceId);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('profile_unsave_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)})),
        ),
      );
    }
  }

  IconData _contentTypeIcon(String? contentType) {
    switch (contentType?.toLowerCase()) {
      case 'video':
        return Icons.play_circle_outline_rounded;
      case 'image':
        return Icons.image_outlined;
      case 'article':
      default:
        return Icons.article_outlined;
    }
  }

  String _contentTypeLabel(String? contentType) {
    switch (contentType?.toLowerCase()) {
      case 'video':
        return 'profile_content_video'.tr();
      case 'image':
        return 'profile_content_image'.tr();
      case 'article':
      default:
        return 'profile_content_article'.tr();
    }
  }

  void _openResource(Map<String, dynamic> resource) {
    final contentType =
        (resource['content_type'] ?? '').toString().toLowerCase();
    final title = (resource['title'] ?? '').toString();
    final body = (resource['body_text'] ?? '').toString();
    final resourceId = (resource['resources_id'] ?? '').toString();
    final videoUrl = resolveResourceVideoUrl(resource);
    final imageUrl = resolveResourceImageUrl(resource);
    final attachmentUrl = resolveResourceAttachmentUrl(resource);

    if (shouldOpenResourceAsVideo(resource)) {
      if (videoUrl.isEmpty) return;
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => ResourceVideoPlayerPage(
            url: videoUrl,
            title: title,
            caption: articlePlainPreview(body),
            resourceId: resourceId,
          ),
        ),
      );
      return;
    }

    if (shouldOpenResourceAsArticle(resource)) {
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => ArticleDetailPage(
            title: title.isEmpty ? 'learn_article_fallback'.tr() : title,
            body: body,
            resourceId: resourceId,
            attachmentUrl: attachmentUrl.isEmpty ? null : attachmentUrl,
            imageUrl: imageUrl.isEmpty ? null : imageUrl,
          ),
        ),
      );
      return;
    }

    if (contentType == 'image' || imageUrl.isNotEmpty) {
      if (imageUrl.isEmpty) return;
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
              child: Center(
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
        ),
      );
      return;
    }

    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ArticleDetailPage(
          title: title.isEmpty ? 'learn_article_fallback'.tr() : title,
          body: body,
          resourceId: resourceId,
          attachmentUrl: attachmentUrl.isEmpty ? null : attachmentUrl,
          imageUrl: imageUrl.isEmpty ? null : imageUrl,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text('hub_saved_resources'.tr()),
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: RefreshIndicator(
        color: AppColors.green,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: context.rs(120)),
          const Center(child: CircularProgressIndicator(color: AppColors.green)),
        ],
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: Responsive.padAll(context, 24),
        children: [
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: context.rf(14)),
          ),
          SizedBox(height: context.rg(16)),
          Center(
            child: FilledButton(
              onPressed: _load,
              child: Text('nearby_try_again'.tr()),
            ),
          ),
        ],
      );
    }

    if (_resources.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: Responsive.padAll(context, 24),
        children: [
          AppCard(
            color: AppColors.white,
            borderColor: AppColors.border,
            padding: Responsive.padAll(context, 16),
            child: Row(
              children: [
                Icon(
                  Icons.bookmark_border_rounded,
                  size: context.rs(18),
                  color: AppColors.textSec.withOpacity(0.7),
                ),
                SizedBox(width: context.rg(8)),
                Expanded(
                  child: Text(
                    'profile_saved_empty'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(13),
                      color: AppColors.textSec.withOpacity(0.95),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: Responsive.padSymmetric(
        context,
        horizontal: 16,
        vertical: 8,
      ).copyWith(bottom: context.rs(24)),
      itemCount: _resources.length,
      separatorBuilder: (_, __) => SizedBox(height: context.rg(8)),
      itemBuilder: (context, index) {
        final resource = _resources[index];
        final resourceId = (resource['resources_id'] ?? '').toString();
        final title = (resource['title'] ?? '').toString().trim();
        final contentType = resource['content_type']?.toString();
        final mediaUrl = learnThumbnailUrl(resource) ?? '';
        final bodyText = (resource['body_text'] ?? '').toString().trim();
        final isVideo = contentType?.toLowerCase() == 'video' ||
            isVideoMediaUrl(mediaUrl);
        final cardRadius = context.cardRadius;
        final thumbHeight = context.rs(130);

        return AppCard(
          color: AppColors.white,
          borderColor: AppColors.border,
          padding: EdgeInsets.zero,
          onTap: () => _openResource(resource),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (mediaUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(cardRadius),
                  ),
                  child: Stack(
                    children: [
                      CachedNetworkImage(
                        imageUrl: mediaUrl,
                        height: thumbHeight,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          height: thumbHeight,
                          color: const Color(0xFFF7F8F5),
                          alignment: Alignment.center,
                          child: Icon(
                            _contentTypeIcon(contentType),
                            color: AppColors.textSec,
                            size: context.rs(24),
                          ),
                        ),
                      ),
                      if (isVideo)
                        Positioned.fill(
                          child: Container(
                            color: Colors.black26,
                            child: Center(
                              child: Icon(
                                Icons.play_circle_filled_rounded,
                                color: Colors.white,
                                size: context.rs(40),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              Padding(
                padding: Responsive.padDirectional(
                  context,
                  start: 14,
                  top: 12,
                  end: 8,
                  bottom: 12,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (mediaUrl.isEmpty) ...[
                      Container(
                        width: context.rs(32),
                        height: context.rs(32),
                        decoration: BoxDecoration(
                          color: AppColors.green.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(context.rs(8)),
                        ),
                        child: Icon(
                          _contentTypeIcon(contentType),
                          color: AppColors.green,
                          size: context.rs(16),
                        ),
                      ),
                      SizedBox(width: context.rg(10)),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title.isNotEmpty
                                ? title
                                : _contentTypeLabel(contentType),
                            style: TextStyle(
                              fontSize: context.rf(13),
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPri,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (bodyText.isNotEmpty) ...[
                            SizedBox(height: context.rg(3)),
                            Text(
                              articlePlainPreview(bodyText),
                              style: TextStyle(
                                fontSize: context.rf(11),
                                color: AppColors.textSec.withOpacity(0.95),
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          SizedBox(height: context.rg(4)),
                          Text(
                            _contentTypeLabel(contentType),
                            style: TextStyle(
                              fontSize: context.rf(10),
                              fontWeight: FontWeight.w600,
                              color: AppColors.green.withOpacity(0.9),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'profile_tooltip_unsave'.tr(),
                      icon: Icon(
                        Icons.bookmark_rounded,
                        color: AppColors.green,
                        size: context.rs(18),
                      ),
                      onPressed: resourceId.isEmpty
                          ? null
                          : () => _unsave(resourceId),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
