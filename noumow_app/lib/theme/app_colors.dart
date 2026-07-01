import 'package:flutter/material.dart';

/// Shared palette for parent home screens.
class AppColors {
  AppColors._();

  static const green = Color(0xFF1D9E75);
  static const primary = Color(0xFF2A5F5F);
  static const primaryGradient = LinearGradient(
    colors: [primary, green],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  /// Matches `assets/images/logo.png` canvas background.
  static const logoBg = Color(0xFFFAF9F6);
  static const bg = Color(0xFFF7F8F5);
  static const white = Colors.white;
  static const textPri = Color(0xFF1A1A18);
  static const textSec = Color(0xFF888880);
  static const border = Color(0xFFE8EAE4);
  static const warningBg = Color(0xFFFFF8E7);
  static const warningBorder = Color(0xFFF5D98C);
  static const warningText = Color(0xFF9A6700);
  static const roleParentBg = Color(0xFFF0F7FF);
  static const roleParentBorder = Color(0xFF3B6EA5);
  static const ageTierBg = Color(0xFFF1EFE8);
  static const ageTierBorder = Color(0xFFD8D4C8);
}
