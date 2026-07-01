import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../providers/submit_tip_provider.dart';
import '../../services/session_manager.dart';
import '../../theme/app_colors.dart';
import '../../utils/error_feedback.dart';
import '../../utils/parenting_hub_categories.dart';
import '../../utils/tip_age_range.dart';

class SubmitTipScreen extends StatefulWidget {
  const SubmitTipScreen({super.key});

  @override
  State<SubmitTipScreen> createState() => _SubmitTipScreenState();
}

class _SubmitTipScreenState extends State<SubmitTipScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  late final SubmitTipNotifier _notifier;

  String? _category;
  final _ageRangeCtrl = TextEditingController();


  @override
  void initState() {
    super.initState();
    _notifier = SubmitTipNotifier();
    _notifier.addListener(_onNotifierChanged);
  }

  @override
  void dispose() {
    _notifier.removeListener(_onNotifierChanged);
    _notifier.dispose();
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _ageRangeCtrl.dispose();
    super.dispose();
  }

  void _onNotifierChanged() {
    if (!mounted) return;

    if (_notifier.status == SubmitTipStatus.success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('tips_submit_success'.tr())),
      );
      _notifier.reset();
      return;
    }

    if (_notifier.status == SubmitTipStatus.error) {
      final message = _notifier.errorMessage ?? kErrorOccurredKey.tr();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      _notifier.reset();
    }
  }

  bool get _isSignedIn {
    final supabaseSession = Supabase.instance.client.auth.currentSession;
    return supabaseSession != null || SessionManager.instance.hasValidSession;
  }

  void _onSubmit() {
    if (_notifier.status == SubmitTipStatus.submitting) return;
    if (!_isSignedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('tips_submit_sign_in_required'.tr())),
      );
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    _notifier.submit(
      title: _titleCtrl.text,
      content: _contentCtrl.text,
      category: _category!,
      ageRange: _ageRangeCtrl.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text('tips_submit_screen_title'.tr()),
      ),
      body: ListenableBuilder(
        listenable: _notifier,
        builder: (context, _) {
          final submitting = _notifier.status == SubmitTipStatus.submitting;

          return ResponsiveScrollBody(
            padding: Responsive.padDirectional(context, start: 20, top: 8, end: 20, bottom: 24),
            child: Form(
              key: _formKey,
              autovalidateMode: AutovalidateMode.disabled,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'tips_submit_pending_note'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(13),
                      color: AppColors.textSec.withOpacity(0.9),
                      height: 1.4,
                    ),
                  ),
                  SizedBox(height: context.rg(16)),
                  TextFormField(
                    controller: _titleCtrl,
                    maxLength: 100,
                    enabled: !submitting,
                    decoration: InputDecoration(
                      labelText: 'tips_form_title_label'.tr(),
                      hintText: 'tips_form_title_hint'.tr(),
                      filled: true,
                      fillColor: AppColors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'tips_validation_title_required'.tr();
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: context.rg(16)),
                  DropdownButtonFormField<String>(
                    value: _category,
                    decoration: InputDecoration(
                      labelText: 'tips_form_category_label'.tr(),
                      filled: true,
                      fillColor: AppColors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    items: parentingHubCategories
                        .map(
                          (category) => DropdownMenuItem<String>(
                            value: category.id,
                            child: Text(category.labelKey.tr()),
                          ),
                        )
                        .toList(),
                    onChanged: submitting
                        ? null
                        : (value) => setState(() => _category = value),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'tips_validation_category_required'.tr();
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: context.rg(16)),
                  TextFormField(
                    controller: _ageRangeCtrl,
                    maxLength: tipAgeRangeMaxLength,
                    enabled: !submitting,
                    decoration: InputDecoration(
                      labelText: 'tips_form_age_range_label'.tr(),
                      hintText: 'tips_form_age_range_hint'.tr(),
                      filled: true,
                      fillColor: AppColors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    validator: (value) {
                      final errorKey = validateTipAgeRange(value);
                      return errorKey?.tr();
                    },
                  ),
                  SizedBox(height: context.rg(16)),
                  TextFormField(
                    controller: _contentCtrl,
                    minLines: 4,
                    maxLines: 10,
                    maxLength: 1000,
                    enabled: !submitting,
                    decoration: InputDecoration(
                      labelText: 'tips_form_content_label'.tr(),
                      hintText: 'tips_form_content_hint'.tr(),
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: AppColors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(12)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.isEmpty) {
                        return 'tips_validation_content_short'.tr();
                      }
                      if (text.length < 50) {
                        return 'tips_validation_content_short'.tr();
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: context.rg(24)),
                  SizedBox(
                    width: double.infinity,
                    height: context.rs(48),
                    child: FilledButton(
                      onPressed: submitting ? null : _onSubmit,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.green,
                        disabledBackgroundColor:
                            AppColors.green.withOpacity(0.55),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(context.rs(12)),
                        ),
                      ),
                      child: submitting
                          ? SizedBox(
                              width: context.rs(22),
                              height: context.rs(22),
                              child: const CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Text('tips_submit_button'.tr()),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
