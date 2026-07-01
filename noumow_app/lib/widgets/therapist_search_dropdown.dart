import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/app_colors.dart';
import '../utils/therapists_directory.dart';

/// Searchable therapist picker styled as a dropdown list.
/// Therapists load when the dropdown opens; search filters by name, specialty, or email.
class TherapistSearchDropdown extends StatefulWidget {
  const TherapistSearchDropdown({
    super.key,
    this.selectedTherapist,
    required this.onChanged,
  });

  final Map<String, dynamic>? selectedTherapist;
  final ValueChanged<Map<String, dynamic>?> onChanged;

  @override
  State<TherapistSearchDropdown> createState() =>
      _TherapistSearchDropdownState();
}

class _TherapistSearchDropdownState extends State<TherapistSearchDropdown> {
  final _supabase = Supabase.instance.client;
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();

  bool _open = false;
  bool _loading = false;
  bool _loadFailed = false;
  List<Map<String, dynamic>> _allTherapists = [];
  List<Map<String, dynamic>> _suggestions = [];

  @override
  void initState() {
    super.initState();
    _syncSearchFromSelection();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void didUpdateWidget(TherapistSearchDropdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedTherapist != widget.selectedTherapist) {
      _syncSearchFromSelection();
    }
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _syncSearchFromSelection() {
    final therapist = widget.selectedTherapist;
    if (therapist == null) return;
    final name = _name(therapist);
    if (_searchController.text != name) {
      _searchController.text = name;
    }
  }

  String _name(Map<String, dynamic> t) {
    final s = (t['full_name'] ?? '').toString().trim();
    return s.isEmpty ? 'therapists_default_name'.tr() : s;
  }

  String _profession(Map<String, dynamic> t) =>
      (t['profession'] ?? '').toString().trim();

  void _applyFilter(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      _suggestions = List<Map<String, dynamic>>.from(_allTherapists);
      return;
    }

    _suggestions = _allTherapists.where((therapist) {
      final name = _name(therapist).toLowerCase();
      final profession = _profession(therapist).toLowerCase();
      final email = (therapist['email'] ?? '').toString().trim().toLowerCase();
      return name.contains(q) || profession.contains(q) || email.contains(q);
    }).toList();
  }

  void _onSearchChanged() {
    final query = _searchController.text;
    if (widget.selectedTherapist != null &&
        _name(widget.selectedTherapist!) != query.trim()) {
      widget.onChanged(null);
    }
    setState(() => _applyFilter(query));
  }

  Future<void> _loadTherapists() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    try {
      final rows = await fetchTherapistsDirectory(_supabase);
      if (!mounted) return;
      setState(() {
        _allTherapists = rows;
        _loading = false;
        _applyFilter(_searchController.text);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _allTherapists = [];
        _suggestions = [];
        _loading = false;
        _loadFailed = true;
      });
    }
  }

  void _toggleOpen() {
    final willOpen = !_open;
    setState(() => _open = willOpen);
    if (willOpen) {
      _loadTherapists();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _searchFocusNode.requestFocus();
      });
    } else {
      _searchFocusNode.unfocus();
    }
  }

  void _selectTherapist(Map<String, dynamic> therapist) {
    final name = _name(therapist);
    _searchController.text = name;
    widget.onChanged(therapist);
    setState(() {
      _open = false;
      _applyFilter(name);
    });
    _searchFocusNode.unfocus();
  }

  void _clearSelection() {
    _searchController.clear();
    widget.onChanged(null);
    setState(() {
      _loadFailed = false;
      _applyFilter('');
    });
  }

  Widget _therapistList(BuildContext context) {
    if (_loading) {
      return Padding(
        padding: Responsive.padAll(context, 20),
        child: Center(
          child: SizedBox(
            width: context.rs(24),
            height: context.rs(24),
            child: const CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.primary,
            ),
          ),
        ),
      );
    }

    if (_loadFailed) {
      return Padding(
        padding: Responsive.padAll(context, 14),
        child: Text(
          'booking_pick_therapists_unavailable'.tr(),
          style: TextStyle(fontSize: context.rf(12), color: Colors.redAccent),
        ),
      );
    }

    if (_suggestions.isEmpty) {
      return Padding(
        padding: Responsive.padAll(context, 14),
        child: Text(
          'booking_therapist_search_no_match'.tr(),
          style: TextStyle(fontSize: context.rf(12), color: AppColors.textSec),
        ),
      );
    }

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: context.rs(220)),
      child: ListView.separated(
        padding: EdgeInsets.zero,
        shrinkWrap: true,
        itemCount: _suggestions.length,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          indent: context.rs(14),
          endIndent: context.rs(14),
        ),
        itemBuilder: (context, index) {
          final therapist = _suggestions[index];
          final profession = _profession(therapist);
          final selectedId =
              (widget.selectedTherapist?['therapist_id'] ?? '').toString();
          final itemId = (therapist['therapist_id'] ?? '').toString();
          final isSelected = selectedId.isNotEmpty && selectedId == itemId;

          return ListTile(
            dense: true,
            selected: isSelected,
            selectedTileColor: AppColors.green.withOpacity(0.08),
            leading: CircleAvatar(
              radius: context.rs(18),
              backgroundColor: AppColors.primary.withOpacity(0.12),
              child: Text(
                _name(therapist).isNotEmpty
                    ? _name(therapist)[0].toUpperCase()
                    : '?',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                  fontSize: context.rf(14),
                ),
              ),
            ),
            title: Text(
              _name(therapist),
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: context.rf(14),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: profession.isNotEmpty
                ? Text(
                    profession,
                    style: TextStyle(fontSize: context.rf(12)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  )
                : null,
            trailing: isSelected
                ? Icon(
                    Icons.check_circle_rounded,
                    color: AppColors.green,
                    size: context.rs(20),
                  )
                : null,
            onTap: () => _selectTherapist(therapist),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selectedTherapist;
    final displayLabel = selected != null
        ? _name(selected)
        : 'booking_therapist_dropdown_placeholder'.tr();
    final radius = context.rs(12);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'booking_therapist_search_label'.tr(),
          style: TextStyle(
            fontSize: context.rf(15),
            fontWeight: FontWeight.w600,
            color: AppColors.textPri,
          ),
        ),
        SizedBox(height: context.rg(6)),
        Text(
          'booking_therapist_search_hint'.tr(),
          style: TextStyle(fontSize: context.rf(13), color: AppColors.textSec),
        ),
        SizedBox(height: context.rg(10)),
        Material(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(radius),
          child: InkWell(
            borderRadius: BorderRadius.circular(radius),
            onTap: _toggleOpen,
            child: Container(
              padding: Responsive.padSymmetric(
                context,
                horizontal: 14,
                vertical: 14,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(
                  color: _open ? AppColors.primary : AppColors.border,
                  width: _open ? 1.4 : 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.medical_services_outlined,
                      size: context.rs(20), color: AppColors.primary),
                  SizedBox(width: context.rg(10)),
                  Expanded(
                    child: Text(
                      displayLabel,
                      style: TextStyle(
                        fontSize: context.rf(14),
                        fontWeight:
                            selected != null ? FontWeight.w600 : FontWeight.w400,
                        color: selected != null
                            ? AppColors.textPri
                            : AppColors.textSec,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (selected != null)
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(
                        minWidth: context.rs(32),
                        minHeight: context.rs(32),
                      ),
                      icon: Icon(Icons.clear, size: context.rs(18)),
                      color: AppColors.textSec,
                      onPressed: _clearSelection,
                    ),
                  Icon(
                    _open
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textSec,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_open) ...[
          SizedBox(height: context.rg(6)),
          Container(
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: AppColors.border),
              boxShadow: Responsive.cardShadow(context),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: Responsive.padDirectional(
                    context,
                    start: 12,
                    top: 10,
                    end: 12,
                    bottom: 8,
                  ),
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    decoration: InputDecoration(
                      hintText: 'booking_therapist_search_placeholder'.tr(),
                      prefixIcon:
                          const Icon(Icons.search, color: AppColors.textSec),
                      isDense: true,
                      contentPadding: Responsive.padSymmetric(
                        context,
                        horizontal: 12,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(10)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(10)),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(context.rs(10)),
                        borderSide: const BorderSide(
                          color: AppColors.primary,
                          width: 1.3,
                        ),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF7F8F5),
                    ),
                    onChanged: (_) => _onSearchChanged(),
                  ),
                ),
                const Divider(height: 1),
                _therapistList(context),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
