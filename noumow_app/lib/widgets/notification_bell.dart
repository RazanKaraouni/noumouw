import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/notification_realtime_service.dart';
import '../theme/app_colors.dart';

/// Notification bell with a badge: [notificationCount] starts at 0 and +1 per alert.
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key, this.compact = false});

  final bool compact;

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  final _service = NotificationRealtimeService.instance;

  @override
  void initState() {
    super.initState();
    _service.ensureConnected();
    _service.addListener(_onCountChanged);
  }

  void _onCountChanged() {
    if (mounted) setState(() {});
  }

  String _badgeLabel(int count) {
    if (count <= 0) return '';
    if (count > 99) return '99+';
    return '$count';
  }

  Future<void> _openSheet() async {
    _service.markViewed();
    if (!mounted) return;
    var clearing = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(context.rs(20))),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return ListenableBuilder(
              listenable: _service,
              builder: (ctx, _) {
                final history = _service.history;
                final hasItems = history.isNotEmpty;
                return SafeArea(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      ctx.rs(20),
                      ctx.rs(16),
                      ctx.rs(20),
                      ctx.rs(24) + MediaQuery.of(ctx).viewInsets.bottom,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'notification_title'.tr(),
                          style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        SizedBox(height: ctx.rg(12)),
                        if (!hasItems)
                          Padding(
                            padding: Responsive.padSymmetric(ctx, vertical: 24),
                            child: Text(
                              'notification_empty'.tr(),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.textSec),
                            ),
                          )
                        else
                          Flexible(
                            child: ListView.separated(
                              shrinkWrap: true,
                              itemCount: history.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(height: 1),
                              itemBuilder: (_, i) {
                                final n = history[i];
                                final title = (n['title'] ?? '').toString();
                                final message =
                                    (n['message'] ?? n['body'] ?? '').toString();
                                final ts = (n['timestamp'] ?? n['sent_at'] ?? '')
                                    .toString();
                                return ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    title.isEmpty
                                        ? 'notification_default_title'.tr()
                                        : title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  subtitle: Text(
                                    message,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  trailing: ts.isEmpty
                                      ? null
                                      : Text(
                                          ts.length >= 16
                                              ? ts.substring(0, 16)
                                              : ts,
                                          style: TextStyle(
                                            fontSize: ctx.rf(11),
                                            color: AppColors.textSec,
                                          ),
                                        ),
                                );
                              },
                            ),
                          ),
                        if (hasItems) ...[
                          SizedBox(height: ctx.rg(16)),
                          OutlinedButton.icon(
                            onPressed: clearing
                                ? null
                                : () async {
                                    setSheetState(() => clearing = true);
                                    final ok = await _service.clearAll();
                                    if (ctx.mounted) {
                                      setSheetState(() => clearing = false);
                                    }
                                    if (!ok && ctx.mounted) {
                                      ScaffoldMessenger.of(ctx).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            'notification_clear_error'.tr(),
                                          ),
                                        ),
                                      );
                                    }
                                  },
                            icon: clearing
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.clear_all_outlined, size: 20),
                            label: Text(
                              clearing
                                  ? 'notification_clearing'.tr()
                                  : 'notification_clear'.tr(),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  @override
  void dispose() {
    _service.removeListener(_onCountChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = _service.notificationCount;
    final badge = _badgeLabel(count);
    final iconSize = context.rs(widget.compact ? 18.0 : 24.0);
    return IconButton(
      onPressed: _openSheet,
      padding: widget.compact
          ? EdgeInsets.symmetric(
              horizontal: context.rs(6),
              vertical: context.rs(3),
            )
          : null,
      constraints: widget.compact
          ? BoxConstraints(
              minWidth: context.rs(28),
              minHeight: context.rs(24),
            )
          : null,
      visualDensity: widget.compact ? VisualDensity.compact : null,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(
            Icons.notifications_outlined,
            color: AppColors.textPri,
            size: iconSize,
          ),
          if (badge.isNotEmpty)
            PositionedDirectional(
              end: context.rs(-4),
              top: context.rs(-4),
              child: Container(
                padding: Responsive.padSymmetric(
                  context,
                  horizontal: 5,
                  vertical: 2,
                ),
                constraints: BoxConstraints(
                  minWidth: context.rs(16),
                  minHeight: context.rs(16),
                ),
                decoration: const BoxDecoration(
                  color: AppColors.green,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  badge,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: context.rf(10),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
