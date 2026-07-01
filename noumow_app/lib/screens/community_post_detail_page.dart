import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/community_author_badge.dart';
import '../widgets/community_post_actions_sheet.dart';
import '../widgets/community_share_with_specialist.dart';
import '../widgets/report_content_sheet.dart';
import '../widgets/community_post_card.dart';
import 'booking_child_pick_page.dart';

class CommunityPostDetailPage extends StatefulWidget {
  const CommunityPostDetailPage({
    super.key,
    required this.post,
    this.onPostUpdated,
  });

  final CommunityPost post;
  final ValueChanged<CommunityPost>? onPostUpdated;

  @override
  State<CommunityPostDetailPage> createState() => _CommunityPostDetailPageState();
}

class _CommunityPostDetailPageState extends State<CommunityPostDetailPage> {
  final _api = CommunityApiService();
  final _commentController = TextEditingController();
  late CommunityPost _post;

  List<CommunityComment> _comments = [];
  bool _loadingComments = true;
  bool _sendingComment = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _post = widget.post;
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() {
      _loadingComments = true;
      _error = null;
    });
    try {
      final list = await _api.fetchComments(_post.id);
      if (!mounted) return;
      setState(() {
        _comments = list;
        if (list.any((c) => c.author.role == CommunityAuthorRole.specialist)) {
          _post.specialistResponded = true;
        }
        _loadingComments = false;
      });
    } on CommunityApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = sanitizeUserMessage(e.message);
        _loadingComments = false;
      });
    }
  }

  void _openBookAppointment() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const BookingChildPickPage(),
      ),
    );
  }

  Future<void> _toggleLike() async {
    HapticFeedback.lightImpact();
    final wasLiked = _post.isLiked;
    final prevCount = _post.likeCount;
    setState(() {
      _post.isLiked = !wasLiked;
      _post.likeCount += wasLiked ? -1 : 1;
    });
    try {
      final liked = await _api.toggleLike(_post.id);
      if (!mounted) return;
      setState(() => _post.isLiked = liked);
      widget.onPostUpdated?.call(_post);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _post.isLiked = wasLiked;
        _post.likeCount = prevCount;
      });
    }
  }

  Future<void> _toggleSave() async {
    HapticFeedback.selectionClick();
    final wasSaved = _post.isSaved;
    setState(() => _post.isSaved = !wasSaved);
    try {
      final saved = await _api.toggleSave(_post.id);
      if (!mounted) return;
      setState(() => _post.isSaved = saved);
      widget.onPostUpdated?.call(_post);
    } catch (_) {
      if (!mounted) return;
      setState(() => _post.isSaved = wasSaved);
    }
  }

  Future<void> _sendComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() => _sendingComment = true);
    try {
      final comment = await _api.addComment(postId: _post.id, content: text);
      if (!mounted) return;
      _commentController.clear();
      setState(() {
        _comments = [..._comments, comment];
        _sendingComment = false;
      });
    } on CommunityApiException catch (e) {
      if (!mounted) return;
      setState(() => _sendingComment = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(sanitizeUserMessage(e.message))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text('community_detail_title'.tr()),
        actions: [
          IconButton(
            icon: const Icon(Icons.forward_to_inbox_outlined),
            tooltip: 'community_detail_share_tooltip'.tr(),
            onPressed: () => shareCommunityPostWithSpecialist(context, _post),
          ),
          IconButton(
            icon: const Icon(Icons.more_horiz_rounded),
            onPressed: () => showCommunityPostActionsSheet(
              context,
              postId: _post.id,
              authorUserId: _post.userId,
              onBlocked: () => Navigator.pop(context),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: Responsive.padDirectional(context, start: 16, end: 16, bottom: 16),
              children: [
                CommunityPostCard(
                  post: _post,
                  enableTap: false,
                  onTap: () {},
                  onLike: _toggleLike,
                  onSave: _toggleSave,
                  onComment: () {},
                  onShareWithSpecialist: () =>
                      shareCommunityPostWithSpecialist(context, _post),
                  onMore: () => showCommunityPostActionsSheet(
                    context,
                    postId: _post.id,
                    authorUserId: _post.userId,
                    onBlocked: () => Navigator.pop(context),
                  ),
                  onBookAppointment: _openBookAppointment,
                ),
                SizedBox(height: context.rg(16)),
                Text(
                  'community_detail_comments'.tr(
                    namedArgs: {'count': '${_comments.length}'},
                  ),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: context.rf(16),
                  ),
                ),
                SizedBox(height: context.rg(8)),
                if (_loadingComments)
                  Padding(
                    padding: Responsive.padAll(context, 24),
                    child: const Center(child: CircularProgressIndicator()),
                  )
                else if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.redAccent))
                else if (_comments.isEmpty)
                  Padding(
                    padding: Responsive.padSymmetric(context, vertical: 24),
                    child: Text(
                      'community_detail_empty_comments'.tr(),
                      style: TextStyle(color: AppColors.textSec.withOpacity(0.9)),
                    ),
                  )
                else
                  ..._comments.map(
                    (c) => _CommentTile(
                      comment: c,
                      onReport: () => showReportContentSheet(
                        context,
                        targetType: ReportTargetType.comment,
                        targetId: c.id,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: Responsive.padDirectional(context, start: 12, top: 8, end: 12, bottom: 12),
              decoration: const BoxDecoration(
                color: AppColors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      decoration: InputDecoration(
                        hintText: 'community_detail_comment_hint'.tr(),
                        filled: true,
                        fillColor: const Color(0xFFFBFAF7),
                        contentPadding: Responsive.padSymmetric(
                          context,
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(context.rs(24)),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(context.rs(24)),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: context.rg(8)),
                  IconButton.filled(
                    onPressed: _sendingComment ? null : _sendComment,
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.green,
                      minimumSize: Size(context.rs(48), context.rs(48)),
                    ),
                    icon: _sendingComment
                        ? SizedBox(
                            width: context.rs(20),
                            height: context.rs(20),
                            child: const CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(Icons.send_rounded, size: context.rs(20)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, required this.onReport});

  final CommunityComment comment;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final author = comment.author;

    return AppCard(
      margin: EdgeInsetsDirectional.only(bottom: context.rg(10)),
      padding: Responsive.padAll(context, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: context.rs(16),
            backgroundColor: const Color(0xFFE6F3EF),
            backgroundImage: author.resolvedProfileImageUrl != null
                ? CachedNetworkImageProvider(author.resolvedProfileImageUrl!)
                : null,
            child: author.resolvedProfileImageUrl == null
                ? Icon(
                    Icons.person_rounded,
                    size: context.rs(16),
                    color: AppColors.primary,
                  )
                : null,
          ),
          SizedBox(width: context.rg(10)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: context.rg(6),
                  runSpacing: context.rg(4),
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      author.resolvedDisplayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: context.rf(13),
                      ),
                    ),
                    CommunityAuthorBadge(role: author.role),
                  ],
                ),
                SizedBox(height: context.rg(4)),
                Text(
                  comment.content,
                  style: TextStyle(height: 1.4, fontSize: context.rf(14)),
                ),
              ],
            ),
          ),
          SizedBox(
            width: context.rs(48),
            height: context.rs(48),
            child: IconButton(
              icon: Icon(Icons.more_horiz, size: context.rs(20)),
              tooltip: 'community_detail_report_comment'.tr(),
              onPressed: onReport,
            ),
          ),
        ],
      ),
    );
  }
}
