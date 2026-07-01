import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/article_api_service.dart';
import '../widgets/report_content_button.dart';
import '../widgets/report_content_sheet.dart';

String articlePlainPreview(String htmlOrText) {
  if (htmlOrText.trim().isEmpty) return '';
  final noTags = htmlOrText.replaceAll(RegExp(r'<[^>]*>'), ' ');
  return noTags
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

bool _isDocumentAttachment(String? url) {
  final u = (url ?? '').trim().toLowerCase();
  if (u.isEmpty) return false;
  return u.endsWith('.docx') ||
      u.endsWith('.doc') ||
      u.endsWith('.pdf') ||
      u.endsWith('.txt');
}

bool articleHasMeaningfulBody(String body) =>
    articlePlainPreview(body).length >= 120;

Future<void> _openDocumentUrl(BuildContext context, String url) async {
  final uri = Uri.tryParse(url.trim());
  if (uri == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(networkErrorMessage())),
    );
    return;
  }
  final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(networkErrorMessage())),
    );
  }
}

/// Article reader: loads full HTML from the API when a Word/PDF attachment exists.
class ArticleDetailPage extends StatefulWidget {
  const ArticleDetailPage({
    super.key,
    required this.title,
    required this.body,
    this.resourceId,
    this.attachmentUrl,
    this.imageUrl,
  });

  final String title;
  final String body;
  final String? resourceId;
  final String? attachmentUrl;
  final String? imageUrl;

  @override
  State<ArticleDetailPage> createState() => _ArticleDetailPageState();
}

class _ArticleDetailPageState extends State<ArticleDetailPage> {
  final _api = ArticleApiService();
  final _supabase = Supabase.instance.client;
  String _title = '';
  String _body = '';
  bool _loading = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _title = widget.title;
    _body = widget.body;
    _maybeFetchInlinedBody();
  }

  bool get _shouldFetchFromApi {
    final id = (widget.resourceId ?? '').trim();
    if (id.isEmpty) return false;
    if (_isDocumentAttachment(widget.attachmentUrl)) return true;
    final plain = articlePlainPreview(widget.body);
    return plain.length < 120;
  }

  String get _heroImageUrl => (widget.imageUrl ?? '').trim();

  Future<({String title, String bodyText})?> _fetchBodyFromDatabase(
    String resourceId,
  ) async {
    final row = await _supabase
        .from('resources')
        .select('title, body_text')
        .eq('resources_id', resourceId)
        .maybeSingle();
    if (row == null) return null;

    final bodyText = (row['body_text'] ?? '').toString();
    if (articlePlainPreview(bodyText).length < 120) return null;

    return (
      title: (row['title'] ?? '').toString(),
      bodyText: bodyText,
    );
  }

  Future<void> _maybeFetchInlinedBody() async {
    if (!_shouldFetchFromApi) return;
    final id = widget.resourceId!.trim();
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final fromDb = await _fetchBodyFromDatabase(id);
      if (fromDb != null) {
        if (!mounted) return;
        setState(() {
          _title =
              fromDb.title.isNotEmpty ? fromDb.title : widget.title;
          _body = fromDb.bodyText;
          _loading = false;
        });
        return;
      }

      final result = await _api.fetchArticleBody(id);
      if (!mounted) return;
      setState(() {
        _title = result.title.isNotEmpty ? result.title : widget.title;
        _body = result.bodyText;
        _loading = false;
      });
    } on ArticleApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = sanitizeUserMessage(e.message);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = userFacingErrorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final id = (widget.resourceId ?? '').trim();
    final displayBody = _body.trim().isEmpty ? widget.body : _body;
    final displayTitle = _title.trim().isEmpty ? widget.title : _title;
    final attachmentUrl = (widget.attachmentUrl ?? '').trim();
    final hasDocument = _isDocumentAttachment(attachmentUrl);
    final hasMeaningfulBody = articleHasMeaningfulBody(displayBody);

    return Scaffold(
      appBar: AppBar(
        title: Text('widget_article_detail_title'.tr()),
        actions: [
          if (id.isNotEmpty)
            ReportContentButton(
              targetType: ReportTargetType.resource,
              targetId: id,
            ),
        ],
      ),
      body: Padding(
        padding: context.pagePadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              displayTitle.isEmpty
                  ? 'widget_article_untitled'.tr()
                  : displayTitle,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: context.rf(22),
                  ),
            ),
            SizedBox(height: context.rg(12)),
            if (_loading)
              const Expanded(
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              if (_loadError != null)
                Padding(
                  padding: EdgeInsets.only(bottom: context.rg(8)),
                  child: Text(
                    _loadError!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                      fontSize: context.rf(13),
                    ),
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_heroImageUrl.isNotEmpty) ...[
                        ClipRRect(
                          borderRadius:
                              BorderRadius.circular(context.rs(10)),
                          child: CachedNetworkImage(
                            imageUrl: _heroImageUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            fadeInDuration:
                                const Duration(milliseconds: 120),
                            placeholder: (_, __) => const AspectRatio(
                              aspectRatio: 16 / 9,
                              child: Center(
                                child: CircularProgressIndicator(),
                              ),
                            ),
                            errorWidget: (_, __, ___) => const SizedBox.shrink(),
                          ),
                        ),
                        SizedBox(height: context.rg(16)),
                      ],
                      if (hasMeaningfulBody)
                        HtmlWidget(displayBody)
                      else if (hasDocument)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'learn_article_pdf_hint'.tr(),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    height: 1.45,
                                    fontSize: context.rf(14),
                                  ),
                            ),
                            SizedBox(height: context.rg(16)),
                            FilledButton.icon(
                              onPressed: () =>
                                  _openDocumentUrl(context, attachmentUrl),
                              icon: const Icon(Icons.picture_as_pdf_outlined),
                              label: Text('learn_open_pdf'.tr()),
                            ),
                          ],
                        )
                      else
                        Text(
                          'widget_article_no_content'.tr(),
                          style: TextStyle(fontSize: context.rf(14)),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
