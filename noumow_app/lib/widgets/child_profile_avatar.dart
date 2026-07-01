import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:noumouw_parent/utils/responsive.dart';

import '../services/child_profile_image_service.dart';
import '../theme/app_colors.dart';

/// Gender-based colors and icon when no custom profile photo is set.
class ChildGenderProfile {
  const ChildGenderProfile._();

  static bool isFemale(String? gender) => gender == 'Female';

  static Color backgroundColor(String? gender) =>
      isFemale(gender) ? const Color(0xFFFCE7F3) : const Color(0xFFE1F5EE);

  static Color iconColor(String? gender) =>
      isFemale(gender) ? const Color(0xFFDB2777) : AppColors.green;

  static Color borderColor(String? gender) => isFemale(gender)
      ? const Color(0xFFF9A8D4).withOpacity(0.55)
      : AppColors.green.withOpacity(0.25);

  static IconData icon(String? gender) =>
      isFemale(gender) ? Icons.face_3_rounded : Icons.face_rounded;
}

/// Circular child photo, or a gender-based placeholder when no image is set.
/// Signed URLs expire in 1 hour. Do not cache these URLs long-term.
class ChildProfileAvatar extends StatefulWidget {
  const ChildProfileAvatar({
    super.key,
    this.imageUrl,
    this.gender,
    this.size = 56,
  });

  final String? imageUrl;
  final String? gender;
  final double size;

  @override
  State<ChildProfileAvatar> createState() => _ChildProfileAvatarState();
}

class _ChildProfileAvatarState extends State<ChildProfileAvatar> {
  final _imageService = ChildProfileImageService();
  String? _displayUrl;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _resolveUrl();
  }

  @override
  void didUpdateWidget(covariant ChildProfileAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl) {
      _resolveUrl();
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _resolveUrl() async {
    _refreshTimer?.cancel();
    final stored = widget.imageUrl?.trim();
    if (stored == null || stored.isEmpty) {
      if (mounted) setState(() => _displayUrl = null);
      return;
    }

    final signed = await _imageService.resolveDisplayUrl(stored);
    if (!mounted) return;
    setState(() => _displayUrl = signed);

    // Refresh before the 1-hour signed URL expires.
    _refreshTimer = Timer(const Duration(minutes: 50), _resolveUrl);
  }

  Widget _placeholder(double scaledSize) {
    return Container(
      width: scaledSize,
      height: scaledSize,
      decoration: BoxDecoration(
        color: ChildGenderProfile.backgroundColor(widget.gender),
        shape: BoxShape.circle,
        border: Border.all(color: ChildGenderProfile.borderColor(widget.gender)),
      ),
      child: Icon(
        ChildGenderProfile.icon(widget.gender),
        color: ChildGenderProfile.iconColor(widget.gender),
        size: scaledSize * 0.46,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scaledSize = context.rs(widget.size);
    final url = _displayUrl?.trim();
    if (url == null || url.isEmpty) {
      return _placeholder(scaledSize);
    }

    return Container(
      width: scaledSize,
      height: scaledSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ChildGenderProfile.borderColor(widget.gender)),
      ),
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: url,
          width: scaledSize,
          height: scaledSize,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) {
            _resolveUrl();
            return _placeholder(scaledSize);
          },
          placeholder: (_, __) => Container(
            color: ChildGenderProfile.backgroundColor(widget.gender),
            child: Center(
              child: SizedBox(
                width: scaledSize * 0.35,
                height: scaledSize * 0.35,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: ChildGenderProfile.iconColor(widget.gender),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
