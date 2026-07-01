import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import 'community_author_badge.dart';

/// Reusable peer-support post card with accessible action targets.
class CommunityPostCard extends StatelessWidget {
  const CommunityPostCard({
    super.key,
    required this.post,
    required this.onTap,
    required this.onLike,
    required this.onSave,
    required this.onComment,
    required this.onShareWithSpecialist,
    required this.onMore,
    this.onBookAppointment,
    this.enableTap = true,
  });

  final CommunityPost post;
  final VoidCallback onTap;
  final VoidCallback onLike;
  final VoidCallback onSave;
  final VoidCallback onComment;
  final VoidCallback onShareWithSpecialist;
  final VoidCallback onMore;
  final VoidCallback? onBookAppointment;
  final bool enableTap;

  @override
  Widget build(BuildContext context) {
    final author = post.author;
    final imageUrl = post.imageUrl;
    final profileUrl = author.resolvedProfileImageUrl;

    final radius = context.rs(18);

    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(radius),
      child: InkWell(
        onTap: enableTap ? onTap : null,
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: AppColors.border),
            boxShadow: Responsive.cardShadow(
              context,
              color: AppColors.primary,
              opacity: 0.06,
              blur: 12,
              offsetY: 4,
            ),
          ),
          padding: Responsive.padAll(context, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: context.rs(20),
                    backgroundColor: const Color(0xFFE6F3EF),
                    backgroundImage: profileUrl != null
                        ? CachedNetworkImageProvider(profileUrl)
                        : null,
                    child: profileUrl == null
                        ? Icon(
                            author.isAnonymous
                                ? Icons.visibility_off_rounded
                                : Icons.person_rounded,
                            size: context.rs(20),
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
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              author.resolvedDisplayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: context.rf(14),
                              ),
                            ),
                            CommunityAuthorBadge(role: author.role),
                          ],
                        ),
                        if (post.ageBadgeLabel.isNotEmpty) ...[
                          SizedBox(height: context.rg(4)),
                          _AgeTierBadge(label: post.ageBadgeLabel),
                        ],
                      ],
                    ),
                  ),
                  _CardIconButton(
                    icon: Icons.more_horiz_rounded,
                    tooltip: 'community_card_more_options'.tr(),
                    onPressed: onMore,
                  ),
                ],
              ),
              if (post.developmentalCategoryLabel != null ||
                  (post.localeTag?.trim().isNotEmpty ?? false)) ...[
                SizedBox(height: context.rg(8)),
                Wrap(
                  spacing: context.rg(6),
                  runSpacing: context.rg(6),
                  children: [
                    if (post.developmentalCategoryLabel != null)
                      _MetaTagChip(
                        icon: Icons.label_outline_rounded,
                        label: post.developmentalCategoryLabel!,
                      ),
                    if (post.localeTag?.trim().isNotEmpty ?? false)
                      _MetaTagChip(
                        icon: Icons.location_on_outlined,
                        label: post.localeTag!.trim(),
                      ),
                  ],
                ),
              ],
              SizedBox(height: context.rg(10)),
              Text(
                post.content,
                maxLines: enableTap ? 6 : null,
                overflow: enableTap ? TextOverflow.ellipsis : null,
                style: TextStyle(height: 1.45, fontSize: context.rf(15)),
              ),
              if (imageUrl != null && imageUrl.isNotEmpty) ...[
                SizedBox(height: context.rg(10)),
                ClipRRect(
                  borderRadius: BorderRadius.circular(context.rs(14)),
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    height: enableTap ? context.rs(160) : null,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
              ],
              if (post.hashtags.isNotEmpty) ...[
                SizedBox(height: context.rg(8)),
                Wrap(
                  spacing: context.rg(6),
                  children: post.hashtags
                      .map(
                        (t) => Text(
                          '#$t',
                          style: TextStyle(
                            color: AppColors.green,
                            fontSize: context.rf(12),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      )
                      .toList(),
                ),
              ],
              if (post.specialistResponded) ...[
                SizedBox(height: context.rg(10)),
                const _SpecialistRespondedBadge(),
              ] else if (post.showNoRepliesYet && onBookAppointment != null) ...[
                SizedBox(height: context.rg(10)),
                _NoRepliesYetLink(onTap: onBookAppointment!),
              ],
              SizedBox(height: context.rg(4)),
              Row(
                children: [
                  _CardActionButton(
                    icon: post.isLiked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    label: '${post.likeCount}',
                    tooltip: 'community_card_like'.tr(),
                    active: post.isLiked,
                    activeColor: const Color(0xFFE07A6A),
                    onPressed: onLike,
                  ),
                  _CardActionButton(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: '${post.commentCount}',
                    tooltip: 'community_card_comment'.tr(),
                    onPressed: onComment,
                  ),
                  _CardActionButton(
                    icon: post.isSaved
                        ? Icons.bookmark
                        : Icons.bookmark_border_rounded,
                    label: post.isSaved
                        ? 'community_card_saved'.tr()
                        : 'community_card_save'.tr(),
                    tooltip: 'community_card_save_later'.tr(),
                    active: post.isSaved,
                    activeColor: AppColors.primary,
                    onPressed: onSave,
                  ),
                  _CardIconButton(
                    icon: Icons.forward_to_inbox_outlined,
                    tooltip: 'community_card_share_specialist'.tr(),
                    onPressed: onShareWithSpecialist,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SpecialistRespondedBadge extends StatelessWidget {
  const _SpecialistRespondedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: Responsive.padSymmetric(context, horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFE6F3EF),
        borderRadius: BorderRadius.circular(context.rs(999)),
        border: Border.all(color: AppColors.primary.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_rounded, size: context.rs(14), color: AppColors.primary),
          SizedBox(width: context.rg(5)),
          Text(
            'community_badge_specialist_responded'.tr(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.rf(11),
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoRepliesYetLink extends StatelessWidget {
  const _NoRepliesYetLink({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Text(
        'community_no_replies_yet'.tr(),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: context.rf(12),
          fontWeight: FontWeight.w500,
          color: AppColors.textSec.withOpacity(0.85),
          decoration: TextDecoration.underline,
          decorationColor: AppColors.textSec.withOpacity(0.5),
        ),
      ),
    );
  }
}

class _AgeTierBadge extends StatelessWidget {
  const _AgeTierBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: Responsive.padSymmetric(context, horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.ageTierBg,
        borderRadius: BorderRadius.circular(context.rs(8)),
        border: Border.all(color: AppColors.ageTierBorder),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: context.rf(11),
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
          letterSpacing: 0.15,
        ),
      ),
    );
  }
}

class _MetaTagChip extends StatelessWidget {
  const _MetaTagChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: Responsive.padSymmetric(context, horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFBFAF7),
        borderRadius: BorderRadius.circular(context.rs(8)),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: context.rs(13), color: AppColors.textSec),
          SizedBox(width: context.rg(4)),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(11),
                color: AppColors.textSec.withOpacity(0.95),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CardActionButton extends StatelessWidget {
  const _CardActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    required this.tooltip,
    this.active = false,
    this.activeColor = AppColors.green,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final String tooltip;
  final bool active;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: SizedBox(
        width: context.rs(48),
        height: context.rs(48),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(context.rs(24)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: context.rs(20),
                color: active ? activeColor : AppColors.textSec,
              ),
              if (label.isNotEmpty)
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(10),
                    color: active ? activeColor : AppColors.textSec,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CardIconButton extends StatelessWidget {
  const _CardIconButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: SizedBox(
        width: context.rs(48),
        height: context.rs(48),
        child: IconButton(
          icon: Icon(icon, size: context.rs(22)),
          color: AppColors.textSec,
          tooltip: tooltip,
          onPressed: onPressed,
          padding: EdgeInsets.zero,
        ),
      ),
    );
  }
}
