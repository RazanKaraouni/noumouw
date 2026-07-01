import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../theme/app_colors.dart';

/// Six single-digit boxes for OTP entry. Syncs with [controller] as a 6-char string.
class OtpDigitInput extends StatefulWidget {
  const OtpDigitInput({
    super.key,
    required this.controller,
    this.enabled = true,
    this.errorText,
    this.onCompleted,
  });

  final TextEditingController controller;
  final bool enabled;
  final String? errorText;
  final VoidCallback? onCompleted;

  @override
  State<OtpDigitInput> createState() => _OtpDigitInputState();
}

class _OtpDigitInputState extends State<OtpDigitInput> {
  static const _length = 6;

  late final List<TextEditingController> _digitControllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _digitControllers = List.generate(_length, (_) => TextEditingController());
    _focusNodes = List.generate(_length, (index) {
      final node = FocusNode();
      node.addListener(() {
        if (mounted) setState(() {});
      });
      return node;
    });
    widget.controller.addListener(_syncFromParentController);
    _applyParentValue(widget.controller.text);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.enabled && mounted) {
        _focusNodes.first.requestFocus();
      }
    });
  }

  @override
  void didUpdateWidget(covariant OtpDigitInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_syncFromParentController);
      widget.controller.addListener(_syncFromParentController);
      _applyParentValue(widget.controller.text);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncFromParentController);
    for (final c in _digitControllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _syncFromParentController() {
    _applyParentValue(widget.controller.text);
  }

  void _applyParentValue(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '').split('');
    for (var i = 0; i < _length; i++) {
      final digit = i < digits.length ? digits[i] : '';
      if (_digitControllers[i].text != digit) {
        _digitControllers[i].text = digit;
      }
    }
    if (mounted) setState(() {});
  }

  void _syncToParent() {
    final code = _digitControllers.map((c) => c.text).join();
    if (widget.controller.text != code) {
      widget.controller.text = code;
    }
    if (code.length == _length) {
      widget.onCompleted?.call();
    }
  }

  void _fillFromPaste(String raw, int startIndex) {
    final digits = raw.replaceAll(RegExp(r'\D'), '').split('');
    if (digits.isEmpty) return;

    var index = startIndex;
    for (final digit in digits) {
      if (index >= _length) break;
      _digitControllers[index].text = digit;
      index += 1;
    }

    if (index < _length) {
      _focusNodes[index].requestFocus();
    } else {
      _focusNodes[_length - 1].unfocus();
    }
    setState(_syncToParent);
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      _fillFromPaste(value, index);
      return;
    }

    setState(() {
      if (value.isEmpty) {
        _syncToParent();
        return;
      }

      if (index < _length - 1) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
      }
      _syncToParent();
    });
  }

  KeyEventResult _onKeyEvent(int index, KeyEvent event) {
    if (event is! KeyDownEvent ||
        event.logicalKey != LogicalKeyboardKey.backspace) {
      return KeyEventResult.ignored;
    }

    if (_digitControllers[index].text.isEmpty && index > 0) {
      setState(() {
        _digitControllers[index - 1].clear();
        _focusNodes[index - 1].requestFocus();
        _syncToParent();
      });
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  bool get _hasError =>
      widget.errorText != null && widget.errorText!.isNotEmpty;

  Color _fillColor(int index) {
    if (!widget.enabled) return AppColors.primary.withOpacity(0.04);
    if (_hasError) return const Color(0xFFFFF5F5);

    final focused = _focusNodes[index].hasFocus;
    final filled = _digitControllers[index].text.isNotEmpty;
    if (focused) return AppColors.primary.withOpacity(0.14);
    if (filled) return AppColors.primary.withOpacity(0.1);
    return AppColors.primary.withOpacity(0.06);
  }

  BorderSide _borderSide(BuildContext context, int index) {
    if (!widget.enabled) {
      return BorderSide(color: AppColors.primary.withOpacity(0.2));
    }
    if (_hasError) {
      return const BorderSide(color: Color(0xFFEF4444));
    }

    final focused = _focusNodes[index].hasFocus;
    final filled = _digitControllers[index].text.isNotEmpty;
    if (focused) {
      return BorderSide(color: AppColors.primary, width: context.rs(1.5));
    }
    if (filled) {
      return BorderSide(color: AppColors.primary.withOpacity(0.65));
    }
    return BorderSide(color: AppColors.primary.withOpacity(0.28));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(_length, (index) {
            final border = OutlineInputBorder(
              borderRadius: Responsive.radius(context, 10),
              borderSide: _borderSide(context, index),
            );

            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: index < _length - 1 ? context.rg(8) : 0,
                ),
                child: Focus(
                  onKeyEvent: (node, event) => _onKeyEvent(index, event),
                  child: TextField(
                    controller: _digitControllers[index],
                    focusNode: _focusNodes[index],
                    enabled: widget.enabled,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 1,
                    style: TextStyle(
                      fontSize: context.rf(20),
                      fontWeight: FontWeight.w700,
                      color: widget.enabled
                          ? AppColors.primary
                          : AppColors.primary.withOpacity(0.45),
                    ),
                    cursorColor: AppColors.primary,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      counterText: '',
                      contentPadding: Responsive.padSymmetric(
                        context,
                        vertical: 12,
                      ),
                      filled: true,
                      fillColor: _fillColor(index),
                      enabledBorder: border,
                      focusedBorder: border,
                      disabledBorder: border,
                      errorBorder: border,
                      focusedErrorBorder: border,
                    ),
                    onChanged: (value) => _onDigitChanged(index, value),
                  ),
                ),
              ),
            );
          }),
        ),
        if (_hasError) ...[
          SizedBox(height: context.rg(8)),
          Text(
            widget.errorText!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.rf(12),
              color: const Color(0xFFB91C1C),
            ),
          ),
        ],
      ],
    );
  }
}
