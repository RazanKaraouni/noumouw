import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

class HomeStorysetImage extends StatelessWidget {
  const HomeStorysetImage({
    super.key,
    required this.assetPath,
    this.height = 72,
    this.width,
  });

  final String assetPath;
  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final scaledHeight = context.rs(height);
    final scaledWidth = width == null
        ? null
        : width!.isFinite
            ? context.rs(width!)
            : width;

    return Image.asset(
      assetPath,
      height: scaledHeight,
      width: scaledWidth,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Icon(
        Icons.image_not_supported_outlined,
        size: scaledHeight * 0.5,
        color: Colors.grey,
      ),
    );
  }
}
