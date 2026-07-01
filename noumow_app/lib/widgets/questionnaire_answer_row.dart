import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';

/// Full-width tappable row for Yes/No questionnaire answers.
class QuestionnaireAnswerRow<T> extends StatelessWidget {
  const QuestionnaireAnswerRow({
    super.key,
    required this.value,
    required this.groupValue,
    required this.label,
    required this.onChanged,
    this.enabled = true,
  });

  final T value;
  final T? groupValue;
  final String label;
  final ValueChanged<T?>? onChanged;
  final bool enabled;

  bool get _selected => groupValue == value;

  @override
  Widget build(BuildContext context) {
    final canTap = enabled && onChanged != null;

    return Material(
      color: _selected ? AppColors.green.withOpacity(0.08) : Colors.transparent,
      borderRadius: BorderRadius.circular(context.rs(10)),
      child: InkWell(
        onTap: canTap ? () => onChanged!(value) : null,
        borderRadius: BorderRadius.circular(context.rs(10)),
        child: Padding(
          padding: Responsive.padSymmetric(context, horizontal: 4, vertical: 2),
          child: Row(
            children: [
              Radio<T>(
                value: value,
                groupValue: groupValue,
                activeColor: AppColors.green,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
                onChanged: canTap ? onChanged : null,
              ),
              Expanded(
                child: Text(
                  label,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(15),
                    fontWeight: _selected ? FontWeight.w600 : FontWeight.w400,
                    color: _selected ? AppColors.textPri : AppColors.textSec,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
