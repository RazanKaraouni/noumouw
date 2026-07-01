import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';
import 'chat_screen.dart';

/// Full-screen therapist chat opened from Community hub or deep links.
class TherapistChatPage extends StatefulWidget {
  const TherapistChatPage({
    super.key,
    this.therapistId,
    this.roomId,
  });

  final String? therapistId;
  final String? roomId;

  @override
  State<TherapistChatPage> createState() => _TherapistChatPageState();
}

class _TherapistChatPageState extends State<TherapistChatPage> {
  final GlobalKey<ChatScreenState> _chatKey = GlobalKey<ChatScreenState>();

  @override
  void initState() {
    super.initState();
    final therapistId = widget.therapistId?.trim();
    final roomId = widget.roomId?.trim();
    if (therapistId != null &&
        therapistId.isNotEmpty &&
        roomId != null &&
        roomId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _chatKey.currentState?.openTherapistChat(
          therapistId: therapistId,
          roomId: roomId,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        foregroundColor: AppColors.textPri,
        title: Text(
          'chat_select_therapist'.tr(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: context.rf(18)),
        ),
      ),
      body: ChatScreen(key: _chatKey),
    );
  }
}
