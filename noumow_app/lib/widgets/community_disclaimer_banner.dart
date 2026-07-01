import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_colors.dart';

const _kDismissKey = 'community_feed_disclaimer_dismissed';

/// Persistent clinical disclaimer for the peer-support feed.
class CommunityDisclaimerBanner extends StatefulWidget {
  const CommunityDisclaimerBanner({super.key});

  @override
  State<CommunityDisclaimerBanner> createState() =>
      _CommunityDisclaimerBannerState();
}

class _CommunityDisclaimerBannerState extends State<CommunityDisclaimerBanner> {
  bool _visible = true;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadDismissState();
  }

  Future<void> _loadDismissState() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _visible = !(prefs.getBool(_kDismissKey) ?? false);
      _loaded = true;
    });
  }

  Future<void> _dismiss() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kDismissKey, true);
    if (!mounted) return;
    setState(() => _visible = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || !_visible) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: Responsive.padDirectional(context, start: 16, top: 8, end: 16, bottom: 4),
      padding: Responsive.padDirectional(context, start: 14, top: 12, end: 8, bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5EDE6),
        borderRadius: BorderRadius.circular(context.rs(14)),
        border: Border.all(color: const Color(0xFFE8D5C4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: context.rs(20),
            color: AppColors.textSec.withOpacity(0.95),
          ),
          SizedBox(width: context.rg(10)),
          Expanded(
            child: Text(
              'community_disclaimer_message'.tr(),
              style: TextStyle(
                fontSize: context.rf(12.5),
                height: 1.45,
                color: AppColors.textPri.withOpacity(0.88),
              ),
            ),
          ),
          SizedBox(
            width: context.rs(48),
            height: context.rs(48),
            child: IconButton(
              tooltip: 'community_disclaimer_dismiss'.tr(),
              onPressed: _dismiss,
              icon: Icon(
                Icons.close_rounded,
                size: context.rs(18),
                color: AppColors.textSec.withOpacity(0.85),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
