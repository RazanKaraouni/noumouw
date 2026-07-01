import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:video_player/video_player.dart';

import '../services/resource_like_service.dart';
import '../services/resource_video_cache_service.dart';
import '../widgets/article_detail_page.dart' show articlePlainPreview;
import '../widgets/report_content_button.dart';
import '../widgets/report_content_sheet.dart';

/// Plays a network video inside the app (therapist resource `media_url`).
class ResourceVideoPlayerPage extends StatefulWidget {
  const ResourceVideoPlayerPage({
    super.key,
    required this.url, //awal ma tenfata7 el page bkon 3enda video as link
    this.title,
    this.caption,
    this.resourceId,
  });

  final String url;
  final String? title;
  final String? caption;
  final String? resourceId;

  @override
  State<ResourceVideoPlayerPage> createState() =>
      _ResourceVideoPlayerPageState();
}

class _ResourceVideoPlayerPageState extends State<ResourceVideoPlayerPage> {
  final _likeService = ResourceLikeService();

  VideoPlayerController? _controller;
  bool _ready = false;
  String? _error;
  bool _liked = false;
  bool _likeBusy = false;

  @override
  void initState() {
    super.initState();
    _loadLikeState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    final uri = Uri.tryParse(widget.url.trim());
    if (uri == null || !uri.hasScheme) {
      if (!mounted) return;
      setState(() => _error = 'resource_video_invalid_address'.tr());
      return;
    }

    final c = await ResourceVideoCacheService.instance.createController(
      widget.url,
      resourceId: widget.resourceId,
    );
    if (c == null) {
      if (!mounted) return;
      setState(() => _error = 'resource_video_invalid_address'.tr());
      return;
    }

    c
      ..setLooping(false)
      ..addListener(_onTick);
    _controller = c;

    try {
      await c.initialize();
      if (!mounted) return;
      setState(() => _ready = true);
      await c.play();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = networkErrorMessage());
    }
  }

  void _onTick() {
    final c = _controller;
    if (c == null) return;
    if (c.value.hasError && mounted) {
      setState(() {
        _error =
            c.value.errorDescription ?? 'resource_video_playback_error'.tr();
      });
    }
  }

  Future<void> _loadLikeState() async {
    final id = (widget.resourceId ?? '').trim();
    if (id.isEmpty) return;
    try {
      final likes = await _likeService.fetchLikes([id]);
      if (!mounted) return;
      setState(() => _liked = likes[id] == true);
    } catch (_) {}
  }

  Future<void> _toggleLike() async {
    final id = (widget.resourceId ?? '').trim();
    if (id.isEmpty || _likeBusy) return;
    setState(() => _likeBusy = true);
    try {
      final liked = await _likeService.toggleLike(id);
      if (!mounted) return;
      setState(() => _liked = liked);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            liked ? 'learn_saved_snack'.tr() : 'learn_unsaved_snack'.tr(),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFacingErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _likeBusy = false);
    }
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null || !_ready) return;
    setState(() {
      if (c.value.isPlaying) {
        c.pause();
      } else {
        c.play();
      }
    });
  }

  @override
  void dispose() {
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = (widget.title ?? '').trim().isEmpty
        ? 'resource_video_default_title'.tr()
        : widget.title!.trim();
    final cap = articlePlainPreview((widget.caption ?? '').trim());
    final c = _controller;

    final resourceId = (widget.resourceId ?? '').trim();

    return Scaffold(
      appBar: AppBar(
        title: Text('resource_video_appbar_title'.tr()),
        actions: [
          if (resourceId.isNotEmpty)
            IconButton(
              tooltip: _liked
                  ? 'learn_unsave_tooltip'.tr()
                  : 'learn_save_tooltip'.tr(),
              onPressed: _likeBusy ? null : _toggleLike,
              icon: _likeBusy
                  ? SizedBox(
                      width: context.rs(20),
                      height: context.rs(20),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    )
                  : Icon(
                      _liked
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      color: _liked
                          ? Theme.of(context).colorScheme.error
                          : null,
                    ),
            ),
          if (resourceId.isNotEmpty)
            ReportContentButton(
              targetType: ReportTargetType.resource,
              targetId: resourceId,
            ),
        ],
      ),
      body: SafeArea(
        child: _error != null
            ? Center(
                child: Padding(
                  padding: Responsive.padAll(context, 24),
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                      fontSize: context.rf(14),
                    ),
                  ),
                ),
              )
            : ResponsiveScrollBody(
                padding: Responsive.padSymmetric(
                  context,
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: !_ready || c == null
                          ? Padding(
                              padding: Responsive.padSymmetric(
                                context,
                                vertical: 48,
                              ),
                              child: const CircularProgressIndicator(),
                            )
                          : AspectRatio(
                              aspectRatio: c.value.aspectRatio == 0
                                  ? 16 / 9
                                  : c.value.aspectRatio,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(
                                  context.rs(14),
                                ),
                                child: VideoPlayer(c),
                              ),
                            ),
                    ),
                    if (_ready && c != null) ...[
                      SizedBox(height: context.rg(8)),
                      VideoProgressIndicator(
                        c,
                        allowScrubbing: true,
                        colors: VideoProgressColors(
                          playedColor:
                              Theme.of(context).colorScheme.primary,
                          bufferedColor: Theme.of(context)
                              .colorScheme
                              .primaryContainer,
                          backgroundColor: Theme.of(context).dividerColor,
                        ),
                      ),
                    ],
                    SizedBox(height: context.rg(14)),
                    Text(
                      title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            fontSize: context.rf(16),
                          ),
                    ),
                    SizedBox(height: context.rg(6)),
                    Text(
                      cap.isEmpty
                          ? 'resource_video_no_caption'.tr()
                          : cap,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            height: 1.45,
                            fontSize: context.rf(14),
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withOpacity(0.75),
                          ),
                    ),
                    SizedBox(height: context.rg(8)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: !_ready || c == null
                              ? null
                              : () => c.seekTo(Duration.zero),
                          icon: Icon(
                            Icons.replay_rounded,
                            size: context.rs(28),
                          ),
                        ),
                        IconButton(
                          onPressed:
                              !_ready || c == null ? null : _togglePlay,
                          icon: Icon(
                            _ready && c != null && c.value.isPlaying
                                ? Icons.pause_circle_filled_rounded
                                : Icons.play_circle_filled_rounded,
                            size: context.rs(48),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: context.rg(12)),
                  ],
                ),
              ),
      ),
    );
  }
}
