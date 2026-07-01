import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/community_api_service.dart';
import '../theme/app_colors.dart';
import '../utils/community_age_category.dart';
import '../utils/community_developmental_category.dart';

Future<bool?> showCommunityCreatePostSheet(BuildContext context) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(context.rs(24))),
    ),
    builder: (ctx) => const _CommunityCreatePostSheet(),
  );
}

class _CommunityCreatePostSheet extends StatefulWidget {
  const _CommunityCreatePostSheet();

  @override
  State<_CommunityCreatePostSheet> createState() =>
      _CommunityCreatePostSheetState();
}

class _CommunityCreatePostSheetState extends State<_CommunityCreatePostSheet> {
  final _api = CommunityApiService();
  final _contentController = TextEditingController();
  final _localeController = TextEditingController();

  String _ageKey = CommunityAgeCategory.createPickerKeys.first;
  String? _developmentalKey;
  bool _anonymous = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _contentController.dispose();
    _localeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      setState(() => _error = 'community_create_error_empty'.tr());
      return;
    }

    final ageCategory = CommunityAgeCategory.apiValue(_ageKey);
    if (ageCategory == null) {
      setState(() => _error = 'community_create_error_age'.tr());
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _api.createPost(
        content: content,
        ageCategory: ageCategory,
        developmentalCategory: _developmentalKey,
        localeTag: _localeController.text.trim(),
        isAnonymous: _anonymous,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on CommunityApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = sanitizeUserMessage(e.message);
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingErrorMessage(e);
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        context.rs(20),
        context.rs(16),
        context.rs(20),
        bottomInset + safeBottom + context.rs(24),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: context.rs(40),
                height: context.rs(4),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(context.rs(2)),
                ),
              ),
            ),
            SizedBox(height: context.rg(16)),
            Text(
              'community_create_title'.tr(),
              style: TextStyle(
                fontSize: context.rf(20),
                fontWeight: FontWeight.w700,
                color: AppColors.textPri,
              ),
            ),
            SizedBox(height: context.rg(4)),
            Text(
              'community_create_subtitle'.tr(),
              style: TextStyle(
                fontSize: context.rf(13),
                color: AppColors.textSec.withOpacity(0.95),
              ),
            ),
            SizedBox(height: context.rg(20)),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                'community_create_post_anonymously'.tr(),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text('community_create_anonymous_subtitle'.tr()),
              value: _anonymous,
              activeColor: AppColors.green,
              onChanged:
                  _submitting ? null : (v) => setState(() => _anonymous = v),
            ),
            SizedBox(height: context.rg(8)),
            DropdownButtonFormField<String>(
              value: _ageKey,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'community_create_age_group'.tr(),
                filled: true,
                fillColor: const Color(0xFFFBFAF7),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                contentPadding: Responsive.padSymmetric(
                  context,
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
              items: CommunityAgeCategory.createPickerKeys
                  .map(
                    (key) => DropdownMenuItem<String>(
                      value: key,
                      child: Text(
                        CommunityAgeCategory.label(key),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: _submitting
                  ? null
                  : (value) {
                      if (value != null) setState(() => _ageKey = value);
                    },
            ),
            SizedBox(height: context.rg(16)),
            DropdownButtonFormField<String?>(
              value: _developmentalKey,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'community_create_topic_optional'.tr(),
                filled: true,
                fillColor: const Color(0xFFFBFAF7),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                contentPadding: Responsive.padSymmetric(
                  context,
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
              items: [
                DropdownMenuItem<String?>(
                  value: null,
                  child: Text('community_create_topic_none'.tr()),
                ),
                ...CommunityDevelopmentalCategory.createPickerKeys.map(
                  (key) => DropdownMenuItem<String?>(
                    value: key,
                    child: Text(
                      CommunityDevelopmentalCategory.label(key),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _developmentalKey = value),
            ),
            SizedBox(height: context.rg(16)),
            TextField(
              controller: _localeController,
              decoration: InputDecoration(
                hintText: 'community_create_locale_hint'.tr(),
                prefixIcon: Icon(Icons.location_on_outlined, size: context.rs(22)),
                filled: true,
                fillColor: const Color(0xFFFBFAF7),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
            SizedBox(height: context.rg(12)),
            TextField(
              controller: _contentController,
              maxLines: 5,
              minLines: 3,
              decoration: InputDecoration(
                hintText: 'community_create_content_hint'.tr(),
                filled: true,
                fillColor: const Color(0xFFFBFAF7),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(context.rs(16)),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
            if (_error != null) ...[
              SizedBox(height: context.rg(12)),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            SizedBox(height: context.rg(16)),
            AppCard(
              color: const Color(0xFFF5EDE6),
              borderColor: const Color(0xFFF5EDE6),
              padding: Responsive.padAll(context, 12),
              child: Text(
                'community_create_disclaimer'.tr(),
                style: TextStyle(
                  fontSize: context.rf(12),
                  height: 1.45,
                  color: AppColors.textSec.withOpacity(0.95),
                ),
              ),
            ),
            SizedBox(height: context.rg(20)),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.green,
                padding: Responsive.padSymmetric(context, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(context.rs(14)),
                ),
              ),
              child: _submitting
                  ? SizedBox(
                      height: context.rs(22),
                      width: context.rs(22),
                      child: const CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text('community_create_submit'.tr()),
            ),
          ],
        ),
      ),
    );
  }
}
