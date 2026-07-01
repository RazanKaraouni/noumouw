import 'package:flutter/material.dart';
import 'package:noumouw_parent/theme/app_colors.dart';
import 'package:noumouw_parent/utils/responsive.dart';

class GradientPrimaryButton extends StatelessWidget {
  const GradientPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.height = 50,
    this.radius = 12,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final borderRadius = Responsive.radius(context, radius);
    final disabled = onPressed == null || isLoading;

    return SizedBox(
      width: double.infinity,
      height: context.rs(height),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: disabled
              ? LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.6),
                    AppColors.green.withValues(alpha: 0.6),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : AppColors.primaryGradient,
          borderRadius: borderRadius,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: disabled ? null : onPressed,
            borderRadius: borderRadius,
            child: Center(
              child: isLoading
                  ? SizedBox(
                      width: context.rs(18),
                      height: context.rs(18),
                      child: const CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: context.rf(15),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
