import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    required this.isLoading,
    required this.child,
  });

  final bool isLoading;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: ColoredBox(
              color: Colors.black.withOpacity(0.22),
              child: Center(
                child: SizedBox(
                  width: context.rs(36),
                  height: context.rs(36),
                  child: const CircularProgressIndicator(),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
