import 'package:flutter/material.dart';

/// Scales layout from a 390×844 design baseline (typical phone width).
class Responsive {
  Responsive._();

  static const double designWidth = 390;
  static const double designHeight = 844;
  static const double minScale = 0.82;
  static const double maxScale = 1.15;

  static double scaleW(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return (w / designWidth).clamp(minScale, maxScale);
  }

  static double scaleH(BuildContext context) {
    final h = MediaQuery.sizeOf(context).height;
    return (h / designHeight).clamp(minScale, maxScale);
  }

  /// Scale a horizontal / general dimension.
  static double s(BuildContext context, double designPx) =>
      designPx * scaleW(context);

  /// Scale font sizes and icon sizes.
  static double f(BuildContext context, double designPx) =>
      designPx * scaleW(context);

  static double gap(BuildContext context, double designPx) =>
      designPx * scaleW(context);

  static BorderRadius radius(BuildContext context, double designPx) =>
      BorderRadius.circular(s(context, designPx));

  static EdgeInsets padAll(BuildContext context, double designPx) =>
      EdgeInsets.all(s(context, designPx));

  static EdgeInsets padSymmetric(
    BuildContext context, {
    double horizontal = 0,
    double vertical = 0,
  }) =>
      EdgeInsets.symmetric(
        horizontal: s(context, horizontal),
        vertical: s(context, vertical),
      );

  static EdgeInsetsDirectional padDirectional(
    BuildContext context, {
    double start = 0,
    double top = 0,
    double end = 0,
    double bottom = 0,
  }) =>
      EdgeInsetsDirectional.fromSTEB(
        s(context, start),
        s(context, top),
        s(context, end),
        s(context, bottom),
      );

  static EdgeInsets pagePadding(BuildContext context) =>
      padSymmetric(context, horizontal: 16, vertical: 12);

  static double cardRadius(BuildContext context) => s(context, 14);

  static List<BoxShadow> cardShadow(
    BuildContext context, {
    Color color = Colors.black,
    double opacity = 0.08,
    double blur = 8,
    double offsetY = 2,
  }) =>
      [
        BoxShadow(
          color: color.withOpacity(opacity),
          blurRadius: s(context, blur),
          offset: Offset(0, s(context, offsetY)),
        ),
      ];
}

extension ResponsiveContext on BuildContext {
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
  double get textScaleFactor => MediaQuery.of(this).textScaleFactor;

  double rs(double designPx) => Responsive.s(this, designPx);
  double rf(double designPx) => Responsive.f(this, designPx);
  double rg(double designPx) => Responsive.gap(this, designPx);

  EdgeInsets get pagePadding => Responsive.pagePadding(this);
  double get cardRadius => Responsive.cardRadius(this);

  /// Fraction of screen width (0–1).
  double wp(double fraction) => screenWidth * fraction;

  /// Fraction of screen height (0–1).
  double hp(double fraction) => screenHeight * fraction;

  /// Reliable bottom inset for scrollable lists (gesture bar / home indicator).
  double get scrollBottomInset =>
      MediaQuery.viewPaddingOf(this).bottom + rs(24);

  /// Bottom padding when content sits above an in-page footer bar.
  double footerClearance(double footerHeight) =>
      MediaQuery.viewPaddingOf(this).bottom + footerHeight + rs(12);
}

/// Scrollable page body with horizontal safe-area padding — prevents horizontal overflow.
class ResponsiveScrollBody extends StatelessWidget {
  const ResponsiveScrollBody({
    super.key,
    required this.child,
    this.padding,
    this.controller,
    this.physics,
    this.center = false,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final ScrollController? controller;
  final ScrollPhysics? physics;
  final bool center;

  @override
  Widget build(BuildContext context) {
    final body = SingleChildScrollView(
      controller: controller,
      physics: physics ?? const AlwaysScrollableScrollPhysics(),
      padding: padding ?? context.pagePadding,
      child: child,
    );
    if (center) {
      return Center(child: body);
    }
    return body;
  }
}

/// Constrains content to screen width and applies card styling.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.color,
    this.borderColor,
    this.onTap,
    this.width,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final Color? borderColor;
  final VoidCallback? onTap;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final radius = context.cardRadius;
    final content = Container(
      width: width ?? double.infinity,
      margin: margin,
      padding: padding ?? Responsive.padAll(context, 12),
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: borderColor ?? const Color(0xFFE5E7EB),
          width: 1,
        ),
        boxShadow: Responsive.cardShadow(context),
      ),
      child: child,
    );
    if (onTap == null) return content;
    return GestureDetector(onTap: onTap, child: content);
  }
}
