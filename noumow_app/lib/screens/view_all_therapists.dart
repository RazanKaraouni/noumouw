import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/chat_service.dart';
import '../theme/app_colors.dart';
import '../utils/therapists_directory.dart';

/// Lists therapists from Supabase.
class ViewAllTherapistsPage extends StatefulWidget {
  const ViewAllTherapistsPage({super.key});

  @override
  State<ViewAllTherapistsPage> createState() => _ViewAllTherapistsPageState();
}

class _ViewAllTherapistsPageState extends State<ViewAllTherapistsPage> {
  final _supabase = Supabase.instance.client;
  final _chatService = ChatService();

  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _err;
  String? _emptyHint;
  String? _contactingTherapistId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
      _emptyHint = null;
    });

    try {
      final cached = await readCachedTherapistsDirectory();
      if (cached != null && cached.isNotEmpty && mounted) {
        setState(() {
          _rows = cached;
          _loading = false;
        });
      }

      final fresh = await fetchTherapistsDirectory(_supabase);
      if (!mounted) return;

      if (fresh.isEmpty) {
        _emptyHint = 'therapists_empty_hint'.tr();
      }

      setState(() {
        _rows = fresh;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (_rows.isEmpty) _err = userFacingErrorMessage(e);
        _loading = false;
      });
    }
  }

  String _name(Map<String, dynamic> t) {
    final s = (t['full_name'] ?? '').toString().trim();
    return s.isEmpty ? 'therapists_default_name'.tr() : s;
  }

  Future<void> _contactTherapist(Map<String, dynamic> therapist) async {
    final therapistId = (therapist['therapist_id'] ?? '').toString().trim();
    if (therapistId.isEmpty) return;

    if (_supabase.auth.currentUser == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('therapists_sign_in_to_contact'.tr())),
      );
      return;
    }

    setState(() => _contactingTherapistId = therapistId);
    try {
      final roomId = await _chatService.ensureParentRoom(therapistId);
      if (!mounted) return;
      if (roomId == null || roomId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('chat_room_error'.tr())),
        );
        return;
      }
      Navigator.pop<Map<String, String>>(context, {
        'therapistId': therapistId,
        'roomId': roomId,
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'therapists_contact_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _contactingTherapistId = null);
    }
  }

  Widget _buildTherapistCard(Map<String, dynamic> t) {
    final profession = (t['profession'] ?? '').toString().trim();
    final email = (t['email'] ?? '').toString().trim();
    final address = (t['address'] ?? '').toString().trim();
    final bio = (t['bio'] ?? '').toString().trim();
    final therapistId = (t['therapist_id'] ?? '').toString();
    final contacting = _contactingTherapistId == therapistId;
    final name = _name(t);

    return AppCard(
      padding: Responsive.padAll(context, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: context.rs(22),
                backgroundColor: AppColors.primary.withOpacity(0.12),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                    fontSize: context.rf(14),
                  ),
                ),
              ),
              SizedBox(width: context.rg(12)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: TextStyle(
                        fontSize: context.rf(15),
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPri,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (profession.isNotEmpty) ...[
                      SizedBox(height: context.rg(4)),
                      Text(
                        profession,
                        style: TextStyle(
                          fontSize: context.rf(13),
                          fontWeight: FontWeight.w500,
                          color: AppColors.primary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (email.isNotEmpty) ...[
                      SizedBox(height: context.rg(4)),
                      Text(
                        email,
                        style: TextStyle(
                          fontSize: context.rf(12),
                          color: AppColors.textSec.withOpacity(0.95),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (address.isNotEmpty) ...[
                      SizedBox(height: context.rg(4)),
                      Text(
                        address,
                        style: TextStyle(
                          fontSize: context.rf(12),
                          color: AppColors.textSec.withOpacity(0.95),
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (bio.isNotEmpty) ...[
                      SizedBox(height: context.rg(4)),
                      Text(
                        bio,
                        style: TextStyle(
                          fontSize: context.rf(12),
                          color: AppColors.textSec.withOpacity(0.95),
                          height: 1.3,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (therapistId.isNotEmpty) ...[
            SizedBox(height: context.rg(12)),
            SizedBox(
              width: double.infinity,
              height: context.rs(44),
              child: contacting
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : FilledButton.icon(
                      onPressed: () => _contactTherapist(t),
                      icon: Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: context.rs(18),
                      ),
                      label: Text(
                        'therapists_contact'.tr(),
                        style: TextStyle(fontSize: context.rf(14)),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(context.rs(8)),
                        ),
                      ),
                    ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text('therapists_title'.tr()),
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.textPri,
        elevation: 0,
      ),
      body: _loading && _rows.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: AppColors.primary),
                  const SizedBox(height: 12),
                  Text(
                    'therapists_loading'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(13),
                      color: AppColors.textSec.withOpacity(0.95),
                    ),
                  ),
                ],
              ),
            )
          : _err != null && _rows.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _err!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.redAccent),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _load,
                          child: Text('therapists_try_again'.tr()),
                        ),
                      ],
                    ),
                  ),
                )
              : _rows.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'therapists_empty'.tr(),
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPri,
                              ),
                            ),
                            if (_emptyHint != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                _emptyHint!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSec.withOpacity(0.95),
                                  height: 1.4,
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: _load,
                              child: Text('therapists_try_again'.tr()),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      color: AppColors.green,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          context.rs(16),
                          context.rs(8),
                          context.rs(16),
                          MediaQuery.paddingOf(context).bottom + context.rs(20),
                        ),
                        itemCount: _rows.length,
                        separatorBuilder: (_, __) =>
                            SizedBox(height: context.rg(10)),
                        itemBuilder: (context, index) =>
                            _buildTherapistCard(_rows[index]),
                      ),
                    ),
    );
  }
}
