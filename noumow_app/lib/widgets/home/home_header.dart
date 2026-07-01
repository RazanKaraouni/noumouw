import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../theme/app_colors.dart';
import '../notification_bell.dart';

class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.displayName,
    required this.showNameSkeleton,
    this.onLocaleChanged,
    this.namePlaceholder,
  });

  final String displayName;
  final bool showNameSkeleton;
  final VoidCallback? onLocaleChanged;
  final Widget? namePlaceholder;

  @override
  Widget build(BuildContext context) {
    final isArabic = context.locale.languageCode == 'ar';

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        context.rs(16),
        context.rs(4),
        context.rs(12),
        0,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                showNameSkeleton
                    ? (namePlaceholder ?? const SizedBox.shrink())
                    : Text(
                        'home_hello_name'
                            .tr(namedArgs: {'name': displayName}),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: context.rf(14),
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPri,
                        ),
                      ),
                SizedBox(height: context.rs(2)),
                Text(
                  'home_greeting_subtitle'.tr(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(11),
                    color: AppColors.textSec.withOpacity(0.95),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: context.rs(8)),
          _HeaderActions(
            isArabic: isArabic,
            onLocaleChanged: onLocaleChanged,
          ),
        ],
      ),
    );
  }
}

class _HeaderActions extends StatelessWidget {
  const _HeaderActions({
    required this.isArabic,
    this.onLocaleChanged,
  });

  final bool isArabic;
  final VoidCallback? onLocaleChanged;

  @override
  Widget build(BuildContext context) {
    final shellDecoration = BoxDecoration(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(context.rs(8)),
      border: Border.all(color: AppColors.border),
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          decoration: shellDecoration,
          child: const NotificationBell(compact: true),
        ),
        SizedBox(width: context.rs(6)),
        _LangToggle(
          isArabic: isArabic,
          onLocaleChanged: onLocaleChanged,
        ),
      ],
    );
  }
}

class _LangToggle extends StatelessWidget {
  const _LangToggle({
    required this.isArabic,
    this.onLocaleChanged,
  });

  final bool isArabic;
  final VoidCallback? onLocaleChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(context.rs(8)),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _LangChip(
            label: 'home_lang_en'.tr(),
            selected: !isArabic,
            locale: const Locale('en'),
            onLocaleChanged: onLocaleChanged,
          ),
          _LangChip(
            label: 'home_lang_ar'.tr(),
            selected: isArabic,
            locale: const Locale('ar'),
            onLocaleChanged: onLocaleChanged,
          ),
        ],
      ),
    );
  }
}

class _LangChip extends StatelessWidget {
  const _LangChip({
    required this.label,
    required this.selected,
    required this.locale,
    this.onLocaleChanged,
  });

  final String label;
  final bool selected;
  final Locale locale;
  final VoidCallback? onLocaleChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        await context.setLocale(locale);
        onLocaleChanged?.call();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: context.rs(5),
          vertical: context.rs(3),
        ),
        decoration: BoxDecoration(
          color: selected ? AppColors.green : Colors.transparent,
          borderRadius: BorderRadius.circular(context.rs(6)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: context.rf(10),
            fontWeight: FontWeight.w600,
            color: selected ? AppColors.white : AppColors.textSec,
          ),
        ),
      ),
    );
  }
}
