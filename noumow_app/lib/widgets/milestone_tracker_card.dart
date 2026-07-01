import 'package:flutter/material.dart';

import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';

/// Gradient milestone card with Yes / Not Yet buttons (profile daily tracker style).
class MilestoneTrackerCard extends StatelessWidget {
  const MilestoneTrackerCard({
    super.key,
    required this.metaLabel,
    required this.question,
    this.description,
    required this.answer,
    required this.yesLabel,
    required this.noLabel,
    required this.onAnswer,
    this.enabled = true,
    this.embedded = false,
  });

  final String metaLabel;
  final String question;
  final String? description;
  final bool? answer;
  final String yesLabel;
  final String noLabel;
  final ValueChanged<bool> onAnswer;
  final bool enabled;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: embedded
          ? EdgeInsets.zero
          : Responsive.padSymmetric(context, vertical: 6),
      padding: Responsive.padAll(context, 18),
      decoration: BoxDecoration(
        gradient: embedded
            ? null
            : const LinearGradient(
                colors: [AppColors.primary, AppColors.green],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        color: embedded ? Colors.white.withOpacity(0.14) : null,
        borderRadius: BorderRadius.circular(context.rs(18)),
        border: embedded
            ? Border.all(color: Colors.white.withOpacity(0.25))
            : null,
        boxShadow: embedded
            ? null
            : [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.28),
                  blurRadius: context.rs(12),
                  offset: Offset(0, context.rs(4)),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            metaLabel,
            style: TextStyle(
              fontSize: context.rf(12),
              fontWeight: FontWeight.w600,
              color: Colors.white.withOpacity(0.85),
            ),
          ),
          SizedBox(height: context.rg(8)),
          Text(
            question,
            style: TextStyle(
              fontSize: context.rf(15),
              fontWeight: FontWeight.w700,
              color: Colors.white.withOpacity(0.98),
              height: 1.4,
            ),
          ),
          if (description != null && description!.trim().isNotEmpty) ...[
            SizedBox(height: context.rg(6)),
            Text(
              description!,
              style: TextStyle(
                fontSize: context.rf(13),
                color: Colors.white.withOpacity(0.88),
                height: 1.35,
              ),
            ),
          ],
          SizedBox(height: context.rg(16)),
          Row(
            children: [
              Expanded(
                child: MilestoneTrackerAnswerButton(
                  label: yesLabel,
                  icon: Icons.thumb_up_alt_rounded,
                  selected: answer == true,
                  onPressed: enabled ? () => onAnswer(true) : null,
                ),
              ),
              SizedBox(width: context.rg(10)),
              Expanded(
                child: MilestoneTrackerAnswerButton(
                  label: noLabel,
                  icon: Icons.thumb_down_alt_rounded,
                  selected: answer == false,
                  onPressed: enabled ? () => onAnswer(false) : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class MilestoneTrackerAnswerButton extends StatelessWidget {
  const MilestoneTrackerAnswerButton({
    super.key,
    required this.label,
    required this.icon,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final bgColor = selected
        ? Colors.white.withOpacity(0.95)
        : Colors.white.withOpacity(0.18);
    final fgColor = selected ? AppColors.primary : Colors.white;

    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(context.rs(12)),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(context.rs(12)),
        child: Container(
          padding: Responsive.padSymmetric(context, vertical: 14),
          child: Column(
            children: [
              Icon(icon, color: fgColor, size: context.rs(22)),
              SizedBox(height: context.rg(4)),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: context.rf(13),
                  fontWeight: FontWeight.w700,
                  color: fgColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
