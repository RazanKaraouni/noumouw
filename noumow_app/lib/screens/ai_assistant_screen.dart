import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/activity_suggestion_api_service.dart';
import '../services/child_progress_controller.dart';
import '../theme/app_colors.dart';

class _ChatMessage {
  const _ChatMessage({
    required this.text,
    required this.isUser,
    this.isThinking = false,
  });

  final String text;
  final bool isUser;
  final bool isThinking;
}

/// Parent AI assistant — active child from settings, backend + Gemini, no auto-start.
class AIAssistantChatScreen extends StatefulWidget {
  const AIAssistantChatScreen({super.key, required this.childProgress});

  final ChildProgressController childProgress;

  @override
  State<AIAssistantChatScreen> createState() => _AIAssistantChatScreenState();
}

class _AIAssistantChatScreenState extends State<AIAssistantChatScreen> {
  final _api = ActivitySuggestionApiService();
  final _scrollController = ScrollController();
  final _inputController = TextEditingController();
  final _inputFocus = FocusNode();

  bool _loadingChildren = true;
  bool _isThinking = false;
  String? _lastActiveChildId;
  final List<_ChatMessage> _messages = [];

  @override
  void initState() {
    super.initState();
    _lastActiveChildId = _selectedChildId;
    widget.childProgress.addListener(_onActiveChildChanged);
    _loadChildren();
  }

  @override
  void dispose() {
    widget.childProgress.removeListener(_onActiveChildChanged);
    _api.dispose();
    _scrollController.dispose();
    _inputController.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  String? get _selectedChildId =>
      ChildProgressController.idOf(widget.childProgress.activeChild);

  int? get _selectedChildrenIdInt => widget.childProgress.activeChildrenIdInt;

  void _onActiveChildChanged() {
    if (!mounted) return;
    final activeId = _selectedChildId;
    if (activeId != _lastActiveChildId) {
      _lastActiveChildId = activeId;
      _clearChat();
    }
    setState(() {});
  }

  void _clearChat() {
    setState(() {
      _messages.clear();
      _isThinking = false;
    });
    _inputController.clear();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    });
  }

  void _addAssistantMessage(String text) {
    setState(() {
      _messages.add(_ChatMessage(text: text, isUser: false));
    });
    _scrollToBottom();
  }

  void _addUserMessage(String text) {
    setState(() {
      _messages.add(_ChatMessage(text: text, isUser: true));
    });
    _scrollToBottom();
  }

  void _showThinkingBubble() {
    setState(() {
      _isThinking = true;
      _messages.removeWhere((m) => m.isThinking);
      _messages.add(
        _ChatMessage(
          text: 'ai_chat_thinking'.tr(),
          isUser: false,
          isThinking: true,
        ),
      );
    });
    _scrollToBottom();
  }

  void _replaceThinkingBubble(String text) {
    setState(() {
      _isThinking = false;
      final idx = _messages.lastIndexWhere((m) => m.isThinking);
      if (idx >= 0) {
        _messages[idx] = _ChatMessage(text: text, isUser: false);
      } else {
        _messages.add(_ChatMessage(text: text, isUser: false));
      }
    });
    _scrollToBottom();
  }

  Future<void> _loadChildren() async {
    setState(() => _loadingChildren = true);
    try {
      await widget.childProgress.loadChildren();
      if (!mounted) return;
      setState(() {
        _lastActiveChildId = _selectedChildId;
        _loadingChildren = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingChildren = false);
    }
  }

  Future<void> _onUserSend(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty ||
        _loadingChildren ||
        _children.isEmpty ||
        _isThinking) {
      return;
    }

    final childId = _selectedChildrenIdInt;
    if (childId == null) {
      _addAssistantMessage('ai_error_no_child'.tr());
      return;
    }

    _inputController.clear();
    _addUserMessage(trimmed);
    _showThinkingBubble();

    try {
      final answer = await _api.askAssistant(
        childId: childId,
        question: trimmed,
      );
      if (!mounted) return;
      _replaceThinkingBubble(
        answer.trim().isEmpty ? kErrorOccurredKey.tr() : answer,
      );
    } on ActivitySuggestionApiException catch (e) {
      if (!mounted) return;
      _replaceThinkingBubble(sanitizeUserMessage(e.message));
    } catch (e) {
      if (!mounted) return;
      _replaceThinkingBubble(userFacingErrorMessage(e));
    }
  }

  List<Map<String, dynamic>> get _children => widget.childProgress.children;

  Widget _buildEmptyState() {
    return Center(
      child: Icon(
        Icons.chat_bubble_outline_rounded,
        size: context.rs(56),
        color: AppColors.primary.withOpacity(0.35),
      ),
    );
  }

  Widget _buildBubble(_ChatMessage message) {
    final isUser = message.isUser;
    return Padding(
      padding: EdgeInsets.only(bottom: context.rg(10)),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            CircleAvatar(
              radius: context.rs(16),
              backgroundColor: AppColors.primary.withOpacity(0.12),
              child: Icon(
                Icons.auto_awesome_rounded,
                size: context.rs(16),
                color: AppColors.primary,
              ),
            ),
            SizedBox(width: context.rg(8)),
          ],
          Flexible(
            child: Container(
              padding: Responsive.padSymmetric(
                context,
                horizontal: 14,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: isUser ? AppColors.primary : AppColors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(context.rs(16)),
                  topRight: Radius.circular(context.rs(16)),
                  bottomLeft:
                      Radius.circular(isUser ? context.rs(16) : context.rs(4)),
                  bottomRight:
                      Radius.circular(isUser ? context.rs(4) : context.rs(16)),
                ),
                border: isUser ? null : Border.all(color: AppColors.border),
              ),
              child: message.isThinking
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          message.text,
                          style: TextStyle(
                            fontSize: context.rf(14),
                            height: 1.45,
                            color: AppColors.textSec,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        SizedBox(width: context.rg(8)),
                        SizedBox(
                          width: context.rs(14),
                          height: context.rs(14),
                          child: const CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      message.text,
                      style: TextStyle(
                        fontSize: context.rf(14),
                        height: 1.45,
                        color: isUser ? AppColors.white : AppColors.textPri,
                      ),
                    ),
            ),
          ),
          if (isUser) SizedBox(width: context.rg(8)),
        ],
      ),
    );
  }

  Widget _buildChatInput() {
    final enabled =
        !_loadingChildren && _children.isNotEmpty && !_isThinking;
    return SafeArea(
      top: false,
      child: Padding(
        padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                focusNode: _inputFocus,
                enabled: enabled,
                textInputAction: TextInputAction.send,
                onSubmitted: enabled ? _onUserSend : null,
                decoration: InputDecoration(
                  hintText: 'ai_chat_input_hint'.tr(),
                  filled: true,
                  fillColor: AppColors.white,
                  contentPadding: Responsive.padSymmetric(
                    context,
                    horizontal: 16,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(context.rs(24)),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(context.rs(24)),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  disabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(context.rs(24)),
                    borderSide:
                        BorderSide(color: AppColors.border.withOpacity(0.5)),
                  ),
                ),
              ),
            ),
            SizedBox(width: context.rg(8)),
            Material(
              color: enabled ? AppColors.green : AppColors.border,
              borderRadius: BorderRadius.circular(context.rs(24)),
              child: InkWell(
                onTap: enabled ? () => _onUserSend(_inputController.text) : null,
                borderRadius: BorderRadius.circular(context.rs(24)),
                child: SizedBox(
                  width: context.rs(48),
                  height: context.rs(48),
                  child: Icon(
                    Icons.send_rounded,
                    color: AppColors.white,
                    size: context.rs(22),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: Responsive.padSymmetric(context, horizontal: 20, vertical: 16)
              .copyWith(bottom: context.rs(8)),
          child: Row(
            children: [
              Container(
                width: context.rs(44),
                height: context.rs(44),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(context.rs(14)),
                ),
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.primary,
                  size: context.rs(26),
                ),
              ),
              SizedBox(width: context.rg(12)),
              Expanded(
                child: ListenableBuilder(
                  listenable: widget.childProgress,
                  builder: (context, _) {
                    final child = widget.childProgress.activeChild;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ai_assistant_title'.tr(),
                          style: TextStyle(
                            fontSize: context.rf(20),
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPri,
                          ),
                        ),
                        if (child != null && !_loadingChildren)
                          Text(
                            'ai_assistant_for_child'.tr(
                              namedArgs: {
                                'name': ChildProgressController.nameOf(child),
                                'age': ChildProgressController.ageLabelOf(child),
                              },
                            ),
                            style: TextStyle(
                              fontSize: context.rf(13),
                              color: AppColors.textSec,
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
              if (!_loadingChildren && _children.isNotEmpty)
                TextButton(
                  onPressed: _isThinking ? null : _clearChat,
                  child: Text(
                    'ai_new_chat'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(13),
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _loadingChildren
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : _children.isEmpty
                  ? Center(
                      child: Padding(
                        padding:
                            Responsive.padSymmetric(context, horizontal: 32),
                        child: Text(
                          'ai_error_no_child'.tr(),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: context.rf(15),
                            color: AppColors.textSec,
                          ),
                        ),
                      ),
                    )
                  : _messages.isEmpty
                      ? _buildEmptyState()
                      : ListView(
                          controller: _scrollController,
                          padding: Responsive.padSymmetric(
                            context,
                            horizontal: 16,
                            vertical: 8,
                          ),
                          children: [
                            for (final msg in _messages) _buildBubble(msg),
                          ],
                        ),
        ),
        if (!_loadingChildren && _children.isNotEmpty) _buildChatInput(),
      ],
    );
  }
}

/// Tab entry used by [HomePage].
class AiAssistantScreen extends StatelessWidget {
  const AiAssistantScreen({super.key, required this.childProgress});

  final ChildProgressController childProgress;

  @override
  Widget build(BuildContext context) {
    return AIAssistantChatScreen(childProgress: childProgress);
  }
}
