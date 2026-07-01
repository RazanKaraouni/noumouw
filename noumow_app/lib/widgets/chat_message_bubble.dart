import 'package:flutter/material.dart';
import 'package:noumouw_parent/theme/app_colors.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../models/chat_message.dart';

class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
    required this.isMine,
    required this.timeText,
  });

  final ChatMessage message;
  final bool isMine;
  final String timeText;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: context.wp(0.75)),
        margin: EdgeInsets.symmetric(vertical: context.rs(5)),
        padding: Responsive.padSymmetric(context, horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMine ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(context.rs(14)),
          boxShadow: Responsive.cardShadow(context, opacity: 0.08, blur: 7, offsetY: 3),
        ),
        child: Column(
          crossAxisAlignment:
              isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              message.content,
              style: TextStyle(
                color: isMine ? Colors.white : const Color(0xFF1E293B),
                fontSize: context.rf(13.5),
              ),
            ),
            SizedBox(height: context.rg(3)),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  timeText,
                  style: TextStyle(
                    color: isMine
                        ? const Color(0xFFD9EFE8)
                        : const Color(0xFF7A8F89),
                    fontSize: context.rf(10),
                  ),
                ),
                if (isMine) ...[
                  SizedBox(width: context.rg(6)),
                  Icon(
                    message.isRead
                        ? Icons.done_all_rounded
                        : Icons.done_rounded,
                    size: context.rs(13),
                    color: message.isRead
                        ? const Color(0xFFC7F0E3)
                        : const Color(0xFFD9EFE8),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
