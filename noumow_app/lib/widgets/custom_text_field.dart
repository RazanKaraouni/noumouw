import 'package:flutter/material.dart';
import 'package:noumouw_parent/theme/app_colors.dart';
import 'package:noumouw_parent/utils/responsive.dart';

class CustomTextField extends StatefulWidget {
  final String label;
  final String hint;
  final TextEditingController controller;
  final bool isPassword;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final FocusNode? focusNode;
  final void Function(String)? onFieldSubmitted;
  final String? Function(String?)? validator;
  final Widget? suffixIcon;

  const CustomTextField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.isPassword = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.focusNode,
    this.onFieldSubmitted,
    this.validator,
    this.suffixIcon,
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    Widget? suffix;
    if (widget.isPassword) {
      suffix = IconButton(
        icon: Icon(
          _obscure
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined,
          size: context.rf(18),
          color: const Color(0xFF9CA3AF),
        ),
        onPressed: () => setState(() => _obscure = !_obscure),
      );
    } else {
      suffix = widget.suffixIcon;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: context.rf(13),
            fontWeight: FontWeight.w500,
            color: const Color(0xFF374151),
          ),
        ),
        SizedBox(height: context.rg(6)),
        TextFormField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          obscureText: widget.isPassword ? _obscure : false,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          onFieldSubmitted: widget.onFieldSubmitted,
          validator: widget.validator,
          style: TextStyle(
            fontSize: context.rf(14),
            color: const Color(0xFF111827),
          ),
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: TextStyle(
              color: const Color(0xFF9CA3AF),
              fontSize: context.rf(14),
            ),
            suffixIcon: suffix,
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding: Responsive.padSymmetric(
              context,
              horizontal: 14,
              vertical: 13,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: Responsive.radius(context, 10),
              borderSide: BorderSide(
                color: const Color(0xFFE5E7EB),
                width: context.rs(1),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: Responsive.radius(context, 10),
              borderSide: BorderSide(
                color: AppColors.primary,
                width: context.rs(1.5),
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: Responsive.radius(context, 10),
              borderSide: BorderSide(
                color: const Color(0xFFEF4444),
                width: context.rs(1),
              ),
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
          ),
        ),
      ],
    );
  }
}
