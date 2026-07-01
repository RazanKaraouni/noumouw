import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:noumouw_parent/services/offline_cache_service.dart';

import '../widgets/article_detail_page.dart';
import '../widgets/report_content_button.dart';
import '../widgets/report_content_sheet.dart';
import 'resource_video_player_page.dart';

/// Thumbnail for video rows: [media_url] as cover image with a play affordance.
class _VideoListThumbnail extends StatelessWidget {
  const _VideoListThumbnail({required this.mediaUrl});

  final String mediaUrl;

  @override
  Widget build(BuildContext context) {
    final fallbackColor =
        Theme.of(context).colorScheme.primaryContainer;
    final size = context.rs(64);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: fallbackColor,
        borderRadius: BorderRadius.circular(context.rs(10)),
        image: mediaUrl.isNotEmpty
            ? DecorationImage(
                image: NetworkImage(mediaUrl),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: Center(
        child: Icon(
          Icons.play_arrow_rounded,
          color: Colors.white,
          size: context.rs(28),
          shadows: [
            Shadow(
              color: Colors.black54,
              blurRadius: context.rs(6),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lists therapist resources from Supabase table `resources`.
/// Ensure a policy allows parents to read rows, e.g.:
/// `create policy "resources_select_auth" on public.resources for select to authenticated using (true);`
class ReadResourcePage extends StatefulWidget {
  const ReadResourcePage({super.key});

  @override
  State<ReadResourcePage> createState() => _ReadResourcePageState();
}

class _ReadResourcePageState extends State<ReadResourcePage> {
  final _supabase = Supabase.instance.client;
  static const _resourcesCacheKey = 'resources:list';
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cached = await OfflineCacheService.instance.readJson<List<dynamic>>(_resourcesCacheKey);
    if (cached != null && cached.isNotEmpty && mounted) {
      setState(() {
        _rows = cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
        _err = null;
      });
    } else {
      setState(() {
        _loading = true;
        _err = null;
      });
    }

    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        throw Exception('Not signed in');
      }

      final links = await _supabase
          .from('therapist_children')
          .select('therapist_id')
          .eq('parent_id', user.id);
      final therapistIds = links
          .map((row) => (row['therapist_id'] ?? '').toString())
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();

      if (therapistIds.isEmpty) {
        if (!mounted) return;
        setState(() {
          _rows = [];
          _loading = false;
        });
        return;
      }

      final data = await _supabase
          .from('resources')
          .select()
          .eq('is_public', false)
          .inFilter('therapist_id', therapistIds)
          .order('created_at', ascending: false);
      await OfflineCacheService.instance.saveJson(_resourcesCacheKey, data);
      if (!mounted) return;
      setState(() {
        _rows = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _err = userFacingErrorMessage(e);
        _loading = false;
      });
    }
  }

  void _openVideoInApp(
    String title,
    String mediaUrl,
    String caption, {
    String? resourceId,
  }) {
    if (mediaUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('resources_no_video_url'.tr())),
      );
      return;
    }
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ResourceVideoPlayerPage(
          url: mediaUrl,
          title: title,
          caption: caption.isEmpty ? null : caption,
          resourceId: resourceId,
        ),
      ),
    );
  }

  void _showArticle(
    String title,
    String body, {
    String? resourceId,
    String? attachmentUrl,
  }) {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ArticleDetailPage(
          title: title,
          body: body,
          resourceId: resourceId,
          attachmentUrl: attachmentUrl,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('resources_title'.tr())),
      body: RefreshIndicator(
        onRefresh: _load,
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
                : _rows.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: context.pagePadding,
                        children: [
                          Text(
                            'resources_empty'.tr(),
                            style: TextStyle(fontSize: context.rf(14)),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: Responsive.padSymmetric(
                          context,
                          horizontal: 8,
                          vertical: 8,
                        ),
                        itemCount: _rows.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final r = _rows[i];
                          final resourceId = (r['resources_id'] ?? '').toString();
                          final title = (r['title'] ?? '').toString();
                          final type = (r['content_type'] ?? '').toString();
                          final body = (r['body_text'] ?? '').toString();
                          final media = (r['media_url'] ?? '').toString();
                          return ListTile(
                            leading: type == 'video'
                                ? _VideoListThumbnail(mediaUrl: media)
                                : Icon(
                                    Icons.article_outlined,
                                    size: context.rs(24),
                                  ),
                            title: Text(
                              title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              type == 'video'
                                  ? 'resources_video_subtitle'.tr()
                                  : type,
                              style: TextStyle(fontSize: context.rf(12)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: resourceId.isEmpty
                                ? null
                                : ReportContentButton(
                                    targetType: ReportTargetType.resource,
                                    targetId: resourceId,
                                  ),
                            onTap: () {
                              if (type == 'video') {
                                _openVideoInApp(
                                  title,
                                  media,
                                  body,
                                  resourceId: resourceId.isEmpty ? null : resourceId,
                                );
                              } else {
                                _showArticle(
                                  title,
                                  body,
                                  resourceId:
                                      resourceId.isEmpty ? null : resourceId,
                                  attachmentUrl: media.isEmpty ? null : media,
                                );
                              }
                            },
                          );
                        },
                      ),
      ),
    );
  }
}
