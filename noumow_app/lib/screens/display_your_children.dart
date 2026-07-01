import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_deletion_service.dart';
import '../utils/error_feedback.dart';
import '../widgets/child_profile_avatar.dart';
import 'create_child_page.dart';

class DisplayYourChildrenPage extends StatefulWidget {
  final String? initialSelectedChildId;

  const DisplayYourChildrenPage({
    super.key,
    this.initialSelectedChildId,
  });

  @override
  State<DisplayYourChildrenPage> createState() => _DisplayYourChildrenPageState();
}

class _DisplayYourChildrenPageState extends State<DisplayYourChildrenPage> {
  final _supabase = Supabase.instance.client;

  static const _green = Color(0xFF1D9E75);
  static const _textPri = Color(0xFF1A1A18);
  static const _textSec = Color(0xFF888880);
  static const _border = Color(0xFFE8EAE4);

  List<Map<String, dynamic>> _children = [];
  String? _selectedChildId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _selectedChildId = widget.initialSelectedChildId;
    _loadChildren();
  }

  String _childName(Map<String, dynamic> child) =>
      (child['full_name'] ?? child['name'] ?? 'display_children_unnamed'.tr())
          .toString();

  String _childAgeLabel(Map<String, dynamic> child) {
    try {
      final rawDob = (child['date_of_birth'] ?? child['dob'])?.toString();
      if (rawDob == null || rawDob.isEmpty) {
        return 'display_children_age_unknown'.tr();
      }
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      final days = now.difference(dob).inDays;
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      if (months < 0) months = 0;
      if (months < 1) {
        return days == 1
            ? 'display_children_age_one_day'.tr()
            : 'display_children_age_days'.tr(namedArgs: {'count': '$days'});
      }
      if (months < 12) {
        return 'display_children_age_months'
            .tr(namedArgs: {'count': '$months'});
      }
      final y = months ~/ 12;
      final m = months % 12;
      return m == 0
          ? 'display_children_age_years'.tr(namedArgs: {'years': '$y'})
          : 'display_children_age_years_months'
              .tr(namedArgs: {'years': '$y', 'months': '$m'});
    } catch (_) {
      return 'display_children_age_unknown'.tr();
    }
  }

  Future<void> _loadChildren() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        setState(() {
          _children = [];
          _loading = false;
        });
        return;
      }
      final data = await _supabase
          .from('children')
          .select()
          .eq('parent_id', user.id)
          .order('created_at', ascending: true);
      final children = List<Map<String, dynamic>>.from(data);

      String? selected = _selectedChildId;
      final hasSelected = children.any(
        (c) => (c['children_id'] ?? c['child_id'])?.toString() == selected,
      );
      if (!hasSelected) {
        selected = children.isNotEmpty
            ? (children.first['children_id'] ?? children.first['child_id'])
                ?.toString()
            : null;
      }

      setState(() {
        _children = children;
        _selectedChildId = selected;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      showErrorSnackBar(context, e);
    }
  }

  Future<void> _editChild(Map<String, dynamic> child) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => CreateChildPage(initialChild: child)),
    );
    if (result == true) await _loadChildren();
  }

  Future<void> _removeChild(Map<String, dynamic> child) async {
    final id = ChildDeletionService.childrenIdFrom(child);
    if (id == null) return;

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('display_children_remove_title'.tr()),
        content: Text('display_children_remove_confirm'
            .tr(namedArgs: {'name': _childName(child)})),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('display_children_cancel'.tr()),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('display_children_remove'.tr()),
          ),
        ],
      ),
    );
    if (shouldDelete != true) return;

    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;
      await ChildDeletionService().deleteChild(
        childrenId: id,
        parentId: user.id,
      );
      await _loadChildren();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('display_children_removed'.tr())),
      );
    } catch (e) {
      debugPrint('Remove child failed: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('display_children_remove_error'
              .tr(namedArgs: {'error': userFacingErrorMessage(e)})),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('display_children_title'.tr())),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 12)
                      .copyWith(bottom: context.rg(8)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      FilledButton.icon(
                        onPressed: () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const CreateChildPage()),
                          );
                          if (result == true) await _loadChildren();
                        },
                        icon: Icon(Icons.add, size: context.rs(20)),
                        label: Text(
                          'display_children_add'.tr(),
                          style: TextStyle(fontSize: context.rf(14)),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _children.isEmpty
                      ? Center(
                          child: Padding(
                            padding: context.pagePadding,
                            child: Text(
                              'display_children_empty'.tr(),
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: context.rf(14)),
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: Responsive.padSymmetric(context, horizontal: 16)
                              .copyWith(bottom: context.rg(16)),
                          itemCount: _children.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final c = _children[i];
                            final id =
                                (c['children_id'] ?? c['child_id'])?.toString();
                            final selected = id == _selectedChildId;
                            return AppCard(
                              padding: Responsive.padSymmetric(
                                context,
                                horizontal: 14,
                                vertical: 12,
                              ),
                              color: selected
                                  ? const Color(0xFFE1F5EE)
                                  : const Color(0xFFF7F8F5),
                              borderColor: selected ? _green : _border,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: InkWell(
                                      borderRadius:
                                          BorderRadius.circular(context.rs(10)),
                                      onTap: () {
                                        setState(() => _selectedChildId = id);
                                        Navigator.pop(context, id);
                                      },
                                      child: Row(
                                        children: [
                                          ChildProfileAvatar(
                                            imageUrl: (c['profile_image_url'] ?? '')
                                                .toString(),
                                            gender: c['gender']?.toString(),
                                            size: 36,
                                          ),
                                          SizedBox(width: context.rg(12)),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  _childName(c),
                                                  style: TextStyle(
                                                    fontSize: context.rf(13),
                                                    fontWeight: FontWeight.w600,
                                                    color: _textPri,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                                Text(
                                                  _childAgeLabel(c),
                                                  style: TextStyle(
                                                    fontSize: context.rf(11),
                                                    color: _textSec,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  PopupMenuButton<String>(
                                    icon: Icon(
                                      Icons.more_vert,
                                      size: context.rs(22),
                                      color: _textSec,
                                    ),
                                    padding: EdgeInsets.zero,
                                    onSelected: (action) {
                                      switch (action) {
                                        case 'edit':
                                          _editChild(c);
                                          break;
                                        case 'remove':
                                          _removeChild(c);
                                          break;
                                      }
                                    },
                                    itemBuilder: (_) => [
                                      PopupMenuItem(
                                        value: 'edit',
                                        child: Text('display_children_edit'.tr()),
                                      ),
                                      PopupMenuItem(
                                        value: 'remove',
                                        child: Text(
                                          'display_children_remove'.tr(),
                                          style: const TextStyle(color: Colors.red),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (selected)
                                    Padding(
                                      padding: EdgeInsets.only(left: context.rg(4)),
                                      child: Icon(
                                        Icons.check_circle_rounded,
                                        color: _green,
                                        size: context.rs(18),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
