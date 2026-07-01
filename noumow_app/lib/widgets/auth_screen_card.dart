import 'package:flutter/material.dart';
import 'package:noumouw_parent/theme/app_colors.dart';
import 'package:noumouw_parent/utils/responsive.dart';

InputDecoration authScreenInputDecoration(BuildContext context, String hint) =>
    InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: const Color(0xFF9CA3AF),
        fontSize: context.rf(14),
      ),
      filled: true,
      fillColor: const Color(0xFFF9FAFB),
      contentPadding: Responsive.padSymmetric(
        context,
        horizontal: 14,
        vertical: 13,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: Responsive.radius(context, 10),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: Responsive.radius(context, 10),
        borderSide: BorderSide(color: AppColors.primary, width: context.rs(1.5)),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: Responsive.radius(context, 10),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: Responsive.radius(context, 10),
        borderSide: BorderSide(
          color: const Color(0xFFEF4444),
          width: context.rs(1.5),
        ),
      ),
      errorStyle: TextStyle(
        fontSize: context.rf(11),
        color: const Color(0xFFB91C1C),
      ),
    );

class AuthScreenCard extends StatelessWidget {
  const AuthScreenCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: Responsive.padSymmetric(
        context,
        horizontal: 28,
        vertical: 36,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: Responsive.radius(context, 20),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: context.rs(20),
            offset: Offset(0, context.rs(4)),
          ),
        ],
      ),
      child: child,
    );
  }
}
