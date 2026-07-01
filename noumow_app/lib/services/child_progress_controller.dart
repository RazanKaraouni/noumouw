import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'offline_cache_service.dart';

class ChildProgressController extends ChangeNotifier {
  ChildProgressController({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  static const _childrenCacheKey = 'children:parent:v1';
  static const _selectedIndexCacheKey = 'children:selected_index:v1';
  static const _childColumns =
      'children_id, child_id, parent_id, full_name, date_of_birth, gender, profile_image_url, created_at';

  List<Map<String, dynamic>> _children = [];
  int _selectedChildIndex = 0;
  bool _hasSavedMilestones = false;
  bool _checkingSavedMilestones = false;
  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  List<Map<String, dynamic>> get children => List.unmodifiable(_children);
  int get selectedChildIndex => _selectedChildIndex;
  bool get hasSavedMilestones => _hasSavedMilestones;
  bool get checkingSavedMilestones => _checkingSavedMilestones;

  Map<String, dynamic>? get activeChild =>
      _children.isNotEmpty ? _children[_selectedChildIndex] : null;

  /// Database `children_id` for the active tracking child.
  int? get activeChildrenIdInt => _childrenIdInt(activeChild);

  Future<void> loadChildren() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final cacheKey = '$_childrenCacheKey:${user.id}';
    final cached =
        await OfflineCacheService.instance.readJson<List<dynamic>>(cacheKey);
    if (cached != null && cached.isNotEmpty) {
      _children = cached
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      await _restoreSelectedChildIndex(user.id);
      _notify();
    }

    try {
      final data = await _supabase
          .from('children')
          .select(_childColumns)
          .eq('parent_id', user.id)
          .order('created_at', ascending: true)
          .timeout(const Duration(seconds: 8));

      _children = List<Map<String, dynamic>>.from(data);
      await _restoreSelectedChildIndex(user.id);
      await OfflineCacheService.instance.saveJson(cacheKey, _children);
      _notify();
    } catch (_) {
      if (_children.isEmpty) rethrow;
    }

    unawaited(refreshSavedMilestonesState());
  }

  Future<void> selectChild(int index) async {
    if (index < 0 || index >= _children.length) return;
    _selectedChildIndex = index;
    final userId = _supabase.auth.currentUser?.id;
    if (userId != null) {
      await OfflineCacheService.instance.saveJson(
        '$_selectedIndexCacheKey:$userId',
        index,
      );
    }
    _notify();
    await refreshSavedMilestonesState();
  }

  Future<void> _restoreSelectedChildIndex(String userId) async {
    if (_children.isEmpty) {
      _selectedChildIndex = 0;
      return;
    }
    final cached = await OfflineCacheService.instance
        .readJson<num>('$_selectedIndexCacheKey:$userId');
    final index = cached?.toInt();
    if (index != null && index >= 0 && index < _children.length) {
      _selectedChildIndex = index;
    } else if (_selectedChildIndex >= _children.length) {
      _selectedChildIndex = 0;
    }
  }

  /// Loads the parent's children and returns the active progress-tracking child.
  Future<Map<String, dynamic>?> loadTrackingChild() async {
    await loadChildren();
    return activeChild;
  }

  int? _childrenIdInt(Map<String, dynamic>? child) {
    if (child == null) return null;
    final raw = child['children_id'];
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '');
  }

  Future<void> refreshSavedMilestonesState() async {
    if (_disposed) return;
    final childrenIdInt = _childrenIdInt(activeChild);
    if (childrenIdInt == null) {
      _hasSavedMilestones = false;
      _checkingSavedMilestones = false;
      _notify();
      return;
    }

    _checkingSavedMilestones = true;
    _notify();
    try {
      final rows = await _supabase
          .from('child_milestones')
          .select('child_milestones_id')
          .eq('child_id', childrenIdInt)
          .limit(1);
      _hasSavedMilestones = rows.isNotEmpty;
    } catch (_) {
      _hasSavedMilestones = false;
    } finally {
      _checkingSavedMilestones = false;
      _notify();
    }
  }

  static String? idOf(Map<String, dynamic>? child) {
    final raw = child?['children_id'] ?? child?['child_id'];
    final id = raw?.toString().trim();
    return id == null || id.isEmpty ? null : id;
  }

  static String nameOf(Map<String, dynamic>? child) {
    return (child?['full_name'] ?? child?['name'] ?? 'Child').toString();
  }

  static int ageMonthsOf(Map<String, dynamic> child) {
    try {
      final rawDob = (child['date_of_birth'] ?? child['dob']) as String?;
      if (rawDob == null || rawDob.isEmpty) return 0;
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      int months = (now.year - dob.year) * 12 + (now.month - dob.month);
      if (now.day < dob.day) months--;
      return months < 0 ? 0 : months;
    } catch (_) {
      return 0;
    }
  }

  static String ageLabelOf(Map<String, dynamic>? child) {
    if (child == null) return '0 mo';
    try {
      final rawDob = (child['date_of_birth'] ?? child['dob']) as String?;
      if (rawDob == null || rawDob.isEmpty) return '0 mo';
      final dob = DateTime.parse(rawDob);
      final now = DateTime.now();
      final days = now.difference(dob).inDays;
      final months = ageMonthsOf(child);
      if (months < 1) return days == 1 ? '1 day' : '$days days';
      if (months < 12) return '$months mo';
      final years = months ~/ 12;
      final remainder = months % 12;
      return remainder == 0 ? '${years}y' : '${years}y ${remainder}mo';
    } catch (_) {
      return '0 mo';
    }
  }
}
