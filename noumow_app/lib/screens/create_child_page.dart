import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:image_picker/image_picker.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_profile_image_service.dart';
import '../utils/child_dob_validator.dart';
import '../widgets/child_profile_avatar.dart';
import '../theme/app_colors.dart';

class CreateChildPage extends StatefulWidget {
  final Map<String, dynamic>? initialChild;

  /// Shown above the form (e.g. post-onboarding setup prompt).
  final String? headerMessage;

  /// After a successful save, replace the route stack with [HomePage].
  final bool navigateToHomeAfterSave;

  /// When non-null, back and successful save invoke this instead of
  /// [Navigator.pop] (e.g. when shown as an overlay inside [HomePage] so the
  /// bottom navigation bar stays visible).
  final void Function(bool saved)? onEmbeddedClose;

  const CreateChildPage({
    super.key,
    this.initialChild,
    this.headerMessage,
    this.navigateToHomeAfterSave = false,
    this.onEmbeddedClose,
  });

  @override
  State<CreateChildPage> createState() => _CreateChildPageState();
}

class _CreateChildPageState extends State<CreateChildPage> {
  final _supabase = Supabase.instance.client;
  final _imageService = ChildProfileImageService();
  final _imagePicker = ImagePicker();
  final _formKey = GlobalKey<FormState>();
  final _dobFieldKey = GlobalKey<FormFieldState<DateTime?>>();
  final _fullNameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  DateTime? _dob;
  String _gender = 'Male';
  bool _loading = false;
  String? _error;
  XFile? _pickedImage;
  String? _existingImageUrl;
  bool get _isEdit => widget.initialChild != null;

  static const _bg = Color(0xFFF7F8F5);
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE5E7EB);

  @override
  void initState() {
    super.initState();
    final child = widget.initialChild;
    if (child == null) return;
    _fullNameCtrl.text = (child['full_name'] ?? '').toString();
    _gender = (child['gender'] ?? 'Male').toString();
    final dobRaw = child['date_of_birth']?.toString();
    if (dobRaw != null && dobRaw.isNotEmpty) {
      final parsed = DateTime.tryParse(dobRaw);
      if (parsed != null) {
        _dob = ChildDobValidator.clampToRange(parsed);
      }
    }
    _notesCtrl.text = (child['notes'] ?? '').toString();
    final imageUrl = (child['profile_image_url'] ?? '').toString().trim();
    _existingImageUrl = imageUrl.isEmpty ? null : imageUrl;
  }

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  dynamic _childId(Map<String, dynamic> child) =>
      child['children_id'] ?? child['child_id'];

  String _friendlySaveError(Object error) {
    if (error is PostgrestException) {
      final dbCode = (error.code ?? '').trim();
      final fullText =
          '${error.message} ${error.details ?? ''} ${error.hint ?? ''}'
              .toLowerCase();

      if (dbCode == '23503' ||
          fullText.contains('children_parent_id_fkey') ||
          fullText.contains('parent_id') && fullText.contains('users')) {
        return 'create_child_error_account_setup'.tr();
      }

      if (dbCode == '23505' || fullText.contains('duplicate key')) {
        return 'create_child_error_duplicate'.tr();
      }
    }

    if (isNetworkError(error)) {
      return networkErrorMessage();
    }

    if (isInfrastructureError(error)) {
      return kErrorOccurredKey.tr();
    }

    return 'create_child_error_save'.tr();
  }

  String? _localizedDobError(String? code) {
    switch (code) {
      case 'required':
        return 'create_child_dob_required'.tr();
      case 'future':
        return 'create_child_dob_future'.tr();
      default:
        return null;
    }
  }

  String? _dobValidator(DateTime? value) {
    final code = ChildDobValidator.validate(value);
    if (code == null) return null;
    return _localizedDobError(code);
  }

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: ChildDobValidator.minDob,
      lastDate: ChildDobValidator.maxDob,
      initialDate: _dob != null
          ? ChildDobValidator.clampToRange(_dob!)
          : ChildDobValidator.defaultPickerDate,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    final normalized = ChildDobValidator.normalize(picked);
    setState(() => _dob = normalized);
    _dobFieldKey.currentState?.didChange(normalized);
    _dobFieldKey.currentState?.validate();
  }

  Future<void> _pickProfilePhoto() async {
    try {
      final picked = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      setState(() => _pickedImage = picked);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'create_child_photo_error'.tr());
    }
  }

  int? _parseChildrenId(dynamic raw) {
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '');
  }

  Future<String?> _resolveProfileImageUrl({
    required String parentId,
    required int childrenId,
  }) async {
    if (_pickedImage == null) {
      return _existingImageUrl;
    }
    try {
      return await _imageService.upload(
        parentId: parentId,
        childrenId: childrenId,
        file: _pickedImage!,
      );
    } catch (_) {
      throw Exception('create_child_error_photo_upload'.tr());
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_dob == null) {
      setState(() => _error = 'create_child_dob_required'.tr());
      return;
    }
    final dobError = ChildDobValidator.validate(_dob);
    if (dobError != null) {
      setState(() => _error = _localizedDobError(dobError));
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        setState(() => _error = 'create_child_error_login'.tr());
        return;
      }
      final payload = {
        'parent_id': user.id,
        'full_name': _fullNameCtrl.text.trim(),
        'date_of_birth':
            '${_dob!.year}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}',
        'gender': _gender,
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      };
      if (_isEdit) {
        final childId = _childId(widget.initialChild!);
        final childrenId = _parseChildrenId(childId);
        if (childrenId == null) {
          throw Exception('Missing child id for update.');
        }
        String? profileImageUrl = _existingImageUrl;
        if (_pickedImage != null) {
          profileImageUrl = await _resolveProfileImageUrl(
            parentId: user.id,
            childrenId: childrenId,
          );
        }
        await _supabase
            .from('children')
            .update({
              ...payload,
              if (profileImageUrl != null) 'profile_image_url': profileImageUrl,
            })
            .eq('children_id', childrenId)
            .eq('parent_id', user.id);
      } else {
        final inserted = await _supabase
            .from('children')
            .insert(payload)
            .select('children_id')
            .single();
        final childrenId = _parseChildrenId(inserted['children_id']);
        if (childrenId != null && _pickedImage != null) {
          final profileImageUrl = await _resolveProfileImageUrl(
            parentId: user.id,
            childrenId: childrenId,
          );
          await _supabase
              .from('children')
              .update({'profile_image_url': profileImageUrl})
              .eq('children_id', childrenId)
              .eq('parent_id', user.id);
        }
      }
      if (!mounted) return;
      final embedded = widget.onEmbeddedClose;
      if (embedded != null) {
        embedded(true);
      } else if (widget.navigateToHomeAfterSave) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _error = _friendlySaveError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  // Returns age as days (if < 30 days), months (if < 12 months), or years+months
  String _ageLabel(DateTime dob) {
    final now = DateTime.now();
    final days = now.difference(dob).inDays;
    int months = (now.year - dob.year) * 12 + (now.month - dob.month);
    if (now.day < dob.day) months--;
    if (months < 0) months = 0;
    if (months < 1) {
      return days == 1
          ? 'create_child_age_one_day'.tr()
          : 'create_child_age_days'.tr(namedArgs: {'count': '$days'});
    }
    if (months < 12) {
      return 'create_child_age_months'.tr(namedArgs: {'count': '$months'});
    }
    final y = months ~/ 12;
    final m = months % 12;
    return m == 0
        ? 'create_child_age_years'.tr(namedArgs: {'years': '$y'})
        : 'create_child_age_years_months'
            .tr(namedArgs: {'years': '$y', 'months': '$m'});
  }

  @override
  Widget build(BuildContext context) {
    final blockBack = widget.navigateToHomeAfterSave;

    return WillPopScope(
      onWillPop: () async => !blockBack,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: !blockBack,
        leading: blockBack
            ? null
            : IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              size: 18, color: AppColors.primary),
          onPressed: () {
            final embedded = widget.onEmbeddedClose;
            if (embedded != null) {
              embedded(false);
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
            (_isEdit ? 'create_child_edit_title' : 'create_child_add_title')
                .tr(),
            style: const TextStyle(
                fontSize: 17, fontWeight: FontWeight.w600, color: _textPri)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ResponsiveScrollBody(
          padding: Responsive.padDirectional(
            context,
            start: 20,
            top: 6,
            end: 20,
            bottom: MediaQuery.paddingOf(context).bottom +
                context.rs(widget.onEmbeddedClose != null ? 80 : 24),
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.headerMessage != null &&
                    widget.headerMessage!.trim().isNotEmpty) ...[
                  Text(
                    widget.headerMessage!.trim(),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _textPri,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                // ── Avatar preview ──────────────────────────────────
                Center(
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: _loading ? null : _pickProfilePhoto,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            _buildProfilePhotoPreview(),
                            Positioned(
                              right: -2,
                              bottom: -2,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(
                                  Icons.photo_camera_rounded,
                                  color: Colors.white,
                                  size: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        (_pickedImage != null || _existingImageUrl != null)
                            ? 'create_child_photo_change'.tr()
                            : 'create_child_photo_add'.tr(),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'create_child_photo_hint'.tr(),
                        style: const TextStyle(fontSize: 12, color: _textSec),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Error ───────────────────────────────────────────
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5F5),
                      border: Border.all(color: const Color(0xFFFECACA)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Icon(Icons.error_outline_rounded,
                          color: Color(0xFFB91C1C), size: 15),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_error!,
                            style: const TextStyle(
                                color: Color(0xFFB91C1C), fontSize: 13)),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Name ────────────────────────────────────────────
                _requiredLabel('create_child_full_name_label'.tr()),
                TextFormField(
                  controller: _fullNameCtrl,
                  style: const TextStyle(fontSize: 14),
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'create_child_full_name_required'.tr()
                      : null,
                  decoration: _inputDeco('create_child_full_name_hint'.tr()),
                ),
                const SizedBox(height: 14),

                // ── Gender ──────────────────────────────────────────
                _label('create_child_gender_label'.tr()),
                Row(
                  children: ['Male', 'Female'].map((g) {
                    final selected = _gender == g;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _gender = g),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          margin: EdgeInsetsDirectional.only(
                            end: g == 'Male' ? 8 : 0,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: selected ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: selected ? AppColors.primary : _border),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                g == 'Male'
                                    ? Icons.face_rounded
                                    : Icons.face_3_rounded,
                                size: 16,
                                color: selected ? Colors.white : _textSec,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                  g == 'Male'
                                      ? 'create_child_gender_male'.tr()
                                      : 'create_child_gender_female'.tr(),
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color:
                                          selected ? Colors.white : _textSec)),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),

                // ── Date of birth ────────────────────────────────────
                _requiredLabel('create_child_dob_label'.tr()),
                FormField<DateTime?>(
                  key: _dobFieldKey,
                  initialValue: _dob,
                  validator: _dobValidator,
                  builder: (state) {
                    final errorText = state.errorText;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        GestureDetector(
                          onTap: _pickDob,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 13),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: errorText != null
                                    ? const Color(0xFFEF4444)
                                    : _border,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.calendar_today_rounded,
                                  size: 16,
                                  color: _dob != null ? AppColors.primary : _textSec,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  _dob != null
                                      ? _formatDate(_dob!)
                                      : 'create_child_dob_select'.tr(),
                                  style: TextStyle(
                                      fontSize: 14,
                                      color:
                                          _dob != null ? _textPri : _textSec),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (errorText != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              errorText,
                              style: TextStyle(
                                fontSize: context.rf(11),
                                color: const Color(0xFFB91C1C),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 14),

                // ── Notes ────────────────────────────────────────────
                _label('create_child_notes_label'.tr()),
                TextFormField(
                  controller: _notesCtrl,
                  style: const TextStyle(fontSize: 14),
                  maxLines: 3,
                  decoration: _inputDeco('create_child_notes_hint'.tr()),
                ),
                const SizedBox(height: 14),

                // ── Age preview card ─────────────────────────────────
                if (_dob != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Text(
                      'create_child_age_preview'
                          .tr(namedArgs: {'age': _ageLabel(_dob!)}),
                      style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1E3A8A),
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(height: 28),

                // ── Save button ──────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.primary.withOpacity(0.6),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.check_rounded, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                  (_isEdit
                                          ? 'create_child_update_button'
                                          : 'create_child_save_button')
                                      .tr(),
                                  style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }

  Widget _buildProfilePhotoPreview() {
    final size = context.rs(88);

    if (_pickedImage != null) {
      return ClipOval(
        child: Image.file(
          File(_pickedImage!.path),
          width: size,
          height: size,
          fit: BoxFit.cover,
        ),
      );
    }

    return ChildProfileAvatar(
      imageUrl: _existingImageUrl,
      gender: _gender,
      size: 88,
    );
  }

  Widget _label(String text) => Padding(
        padding: EdgeInsetsDirectional.only(bottom: context.rg(6)),
        child: Text(
          text,
          style: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w500,
            color: const Color(0xFF374151),
          ),
        ),
      );

  Widget _requiredLabel(String text) => Padding(
        padding: EdgeInsetsDirectional.only(bottom: context.rg(6)),
        child: Row(
          children: [
            Flexible(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: context.rf(13),
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF374151),
                ),
              ),
            ),
            Text(
              'create_child_required_marker'.tr(),
              style: TextStyle(
                fontSize: context.rf(13),
                fontWeight: FontWeight.w600,
                color: const Color(0xFFB91C1C),
              ),
            ),
          ],
        ),
      );

  InputDecoration _inputDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: const Color(0xFF9CA3AF), fontSize: context.rf(14)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: Responsive.padSymmetric(
          context,
          horizontal: 18,
          vertical: 14,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
          borderSide: const BorderSide(color: _border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.rs(10)),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
        ),
        errorStyle: TextStyle(fontSize: context.rf(11), color: const Color(0xFFB91C1C)),
      );
}
