import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/child_progress_controller.dart';
import '../services/api_http_client.dart';
import '../theme/app_colors.dart';
import '../utils/auth_headers.dart';
import '../utils/autism_question_text.dart';
import '../utils/therapists_api.dart';
import '../widgets/questionnaire_answer_row.dart';

class AutismScreeningPage extends StatefulWidget {
  const AutismScreeningPage({
    super.key,
    this.childProgress,
    this.initialChildId,
  });

  final ChildProgressController? childProgress;

  /// When set (e.g. opened from profile), selects this child after loading `children`.
  final String? initialChildId;

  @override
  State<AutismScreeningPage> createState() => _AutismScreeningPageState();
}

class _AutismScreeningPageState extends State<AutismScreeningPage> {
  final _supabase = Supabase.instance.client;
  ChildProgressController? _ownedChildProgress;

  List<Map<String, dynamic>> _children = [];
  List<Map<String, dynamic>> _questions = [];
  String? _selectedChildId;
  int _currentIndex = 0;
  static const int _questionsPerPage = 2;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  final Map<String, String> _answers = {};
  final http.Client _httpClient = createApiHttpClient();

  ChildProgressController get _childProgress =>
      widget.childProgress ?? _ownedChildProgress!;

  @override
  void initState() {
    super.initState();
    if (widget.childProgress == null) {
      _ownedChildProgress = ChildProgressController();
    }
    _childProgress.addListener(_onActiveChildChanged);
    _loadData();
  }

  @override
  void dispose() {
    _childProgress.removeListener(_onActiveChildChanged);
    _ownedChildProgress?.dispose();
    _httpClient.close();
    super.dispose();
  }

  void _onActiveChildChanged() {
    if (!mounted) return;
    _syncSelectedChildFromController();
    setState(() {});
  }

  void _syncSelectedChildFromController() {
    final activeId =
        ChildProgressController.idOf(_childProgress.activeChild);
    if (activeId != null) {
      _selectedChildId = activeId;
      _children = _childProgress.children;
    }
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Please sign in first.');

      await _childProgress.loadChildren();
      final children = _childProgress.children;

      final questions = await _supabase
          .from('autism_questions')
          .select(
              'autism_qs_id,question_number,question_text,example_text,fail_answer')
          .order('question_number', ascending: true);

      if (!mounted) return;
      setState(() {
        _children = children;
        _questions = List<Map<String, dynamic>>.from(questions);
        final pref = widget.initialChildId?.trim();
        String? picked;
        if (pref != null && pref.isNotEmpty) {
          for (final c in _children) {
            final id =
                (c['children_id'] ?? c['child_id'])?.toString().trim() ?? '';
            if (id == pref) {
              picked = id;
              break;
            }
          }
        }
        picked ??= ChildProgressController.idOf(_childProgress.activeChild);
        picked ??= _children.isNotEmpty
            ? (_children.first['children_id'] ?? _children.first['child_id'])
                .toString()
            : null;
        _selectedChildId = picked;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = userFacingErrorMessage(e);
      });
    }
  }

  Map<String, dynamic>? get _selectedChild {
    if (_selectedChildId == null) return null;
    for (final child in _children) {
      final id = (child['children_id'] ?? child['child_id'])?.toString();
      if (id == _selectedChildId) return child;
    }
    return null;
  }

  int? get _selectedChildrenIdInt {
    final child = _selectedChild;
    if (child == null) return null;
    final raw = child['children_id'];
    if (raw is int) return raw;
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '');
  }

  double get _progress =>
      _questions.isEmpty ? 0 : _answers.length / _questions.length;

  String _questionKey(Map<String, dynamic> q) {
    final id = q['autism_qs_id']?.toString().trim() ?? '';
    if (id.isNotEmpty) return id;
    return 'q_${(q['question_number'] as num?)?.toInt() ?? -1}';
  }

  List<Map<String, dynamic>> _currentPageQuestions() {
    return _questions
        .skip(_currentIndex)
        .take(_questionsPerPage)
        .map((q) => Map<String, dynamic>.from(q))
        .toList();
  }

  bool _isCurrentPageAnswered() {
    final currentQuestions = _currentPageQuestions();
    if (currentQuestions.isEmpty) return false;
    for (final q in currentQuestions) {
      final answer = _answers[_questionKey(q)];
      if (answer == null || answer.trim().isEmpty) return false;
    }
    return true;
  }

  Future<void> _showAnswerRequiredDialog() async {
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('screening_missing_answer_title'.tr()),
          content: Text('screening_missing_answer_body'.tr()),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('screening_ok'.tr()),
            ),
          ],
        );
      },
    );
  }

  int _countFailAnswers() {
    var fails = 0;
    for (final q in _questions) {
      final answer = _answers[_questionKey(q)]?.trim();
      final failAnswer = (q['fail_answer'] ?? '').toString().trim();
      if (answer != null && answer == failAnswer) {
        fails += 1;
      }
    }
    return fails;
  }

  String _riskFromScore(int score) {
    if (score <= 2) return 'Low';
    if (score <= 7) return 'Moderate';
    return 'High';
  }

  String _localizedRisk(String raw) {
    final value = raw.trim().toLowerCase();
    if (value.contains('high')) return 'screening_risk_high'.tr();
    if (value.contains('moderate') || value.contains('medium')) {
      return 'screening_risk_moderate'.tr();
    }
    if (value.contains('low')) return 'screening_risk_low'.tr();
    return 'screening_risk_unknown'.tr();
  }

  String _guidanceForRisk(String raw) {
    final value = raw.trim().toLowerCase();
    if (value.contains('high')) return 'screening_guidance_high'.tr();
    if (value.contains('moderate') || value.contains('medium')) {
      return 'screening_guidance_moderate'.tr();
    }
    return 'screening_guidance_low'.tr();
  }

  Color _riskColor(String raw) {
    final value = raw.trim().toLowerCase();
    if (value.contains('high')) return Colors.red.shade700;
    if (value.contains('moderate') || value.contains('medium')) {
      return AppColors.warningText;
    }
    return AppColors.green;
  }

  Future<void> _showResultDialog({
    required int score,
    required int total,
    required String riskLevel,
  }) async {
    final localizedRisk = _localizedRisk(riskLevel);
    final guidance = _guidanceForRisk(riskLevel);
    final riskColor = _riskColor(riskLevel);

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: Text('screening_result_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'screening_total_score'.tr(namedArgs: {
                    'score': '$score',
                    'total': '$total',
                  }),
                  style: TextStyle(fontSize: context.rf(15)),
                ),
                SizedBox(height: context.rg(10)),
                Text(
                  'screening_risk_level'.tr(namedArgs: {'risk': localizedRisk}),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: riskColor,
                    fontSize: context.rf(16),
                  ),
                ),
                SizedBox(height: context.rg(12)),
                Text(
                  guidance,
                  style: TextStyle(fontSize: context.rf(14)),
                ),
                SizedBox(height: context.rg(12)),
                Text(
                  'screening_medical_advice'.tr(),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: context.rf(14),
                    color: AppColors.primary,
                  ),
                ),
                SizedBox(height: context.rg(10)),
                Text(
                  'screening_report_saved'.tr(),
                  style: TextStyle(
                    fontSize: context.rf(13),
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _goHome();
              },
              child: Text('screening_ok'.tr()),
            ),
          ],
        );
      },
    );
  }

  void _goHome() {
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  Future<void> _submitAndGenerateReport() async {
    if (_selectedChildId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('screening_select_child_first'.tr())),
      );
      return;
    }
    if (_answers.length != _questions.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('screening_answer_all'.tr(
                namedArgs: {'count': '${_questions.length}'}))),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final responses = <String, String>{};
      for (final q in _questions) {
        final number = (q['question_number'] as num?)?.toInt();
        if (number == null) continue;
        final answer = _answers[_questionKey(q)];
        if (answer != null && answer.trim().isNotEmpty) {
          responses[number.toString()] = answer;
        }
      }
      final root = resolvedTherapistsApiBase();
      final uri = Uri.parse('$root/api/autism/submit');

      final response = await _httpClient.post(
        uri,
        headers: authHeaders(json: true),
        body: jsonEncode({
          'children_id': _selectedChildrenIdInt ?? _selectedChildId,
          'responses': responses,
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(
            _extractError(response.body, 'screening_submit_error'.tr()));
      }

      final parsed = _decodeJsonMap(response.body);
      final summary = parsed['summary'];
      var score = _countFailAnswers();
      var riskLevel = _riskFromScore(score);
      if (summary is Map) {
        final apiScore = summary['score'];
        if (apiScore is num) score = apiScore.toInt();
        final apiRisk = summary['risk_level']?.toString().trim();
        if (apiRisk != null && apiRisk.isNotEmpty) riskLevel = apiRisk;
      }

      if (!mounted) return;
      setState(() => _saving = false);
      await _showResultDialog(
        score: score,
        total: _questions.length,
        riskLevel: riskLevel,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'screening_save_failed'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
          ),
        ),
      );
    }
  }

  Future<void> _finishScreening() async {
    if (_selectedChildId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('screening_select_child_first'.tr())),
      );
      return;
    }
    if (_answers.length != _questions.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('screening_answer_all'.tr(
                namedArgs: {'count': '${_questions.length}'}))),
      );
      return;
    }
    await _submitAndGenerateReport();
  }

  Map<String, dynamic> _decodeJsonMap(String raw) {
    try {
      final decoded = raw.trim().isEmpty
          ? <String, dynamic>{}
          : (jsonDecode(raw) as Map<String, dynamic>);
      return decoded;
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  String _extractError(String body, String fallback) {
    try {
      final parsed = _decodeJsonMap(body);
      final message = parsed['message']?.toString();
      if (message != null && message.trim().isNotEmpty) return message;
    } catch (_) {}
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    final showQuestionnaire =
        !_loading && _error == null && _children.isNotEmpty && _questions.isNotEmpty;
    final pageStart = _currentIndex;
    final isLastPage = pageStart + _questionsPerPage >= _questions.length;

    return Scaffold(
      appBar: AppBar(
        title: Text('screening_title'.tr()),
        actions: [
          IconButton(
            tooltip: 'screening_close_tooltip'.tr(),
            icon: const Icon(Icons.close),
            onPressed: _goHome,
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _buildQuestionnaire(
                    showFooter: showQuestionnaire,
                    canGoBack: pageStart > 0,
                    isLastPage: isLastPage,
                  ),
      ),
    );
  }

  Widget _buildQuestionnaire({
    required bool showFooter,
    required bool canGoBack,
    required bool isLastPage,
  }) {
    if (_children.isEmpty) {
      return Center(child: Text('screening_no_children'.tr()));
    }
    if (_questions.isEmpty) {
      return Center(child: Text('screening_no_questions'.tr()));
    }
    final pageQuestions = _currentPageQuestions();

    return Column(
      children: [
        Padding(
          padding: context.pagePadding,
          child: DropdownButtonFormField<String>(
            value: _selectedChildId,
            isExpanded: true,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: 'screening_select_child_label'.tr(),
              contentPadding: Responsive.padSymmetric(
                context,
                horizontal: 12,
                vertical: 12,
              ),
            ),
            items: _children
                .map((c) => DropdownMenuItem<String>(
                      value: (c['children_id'] ?? c['child_id']).toString(),
                      child: Text(
                        (c['full_name'] ?? 'screening_child_default'.tr())
                            .toString(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ))
                .toList(),
            onChanged: (v) {
              if (v == null) return;
              final index = _childProgress.children.indexWhere(
                (c) => ChildProgressController.idOf(c) == v,
              );
              if (index >= 0) {
                _childProgress.selectChild(index);
              } else {
                setState(() => _selectedChildId = v);
              }
            },
          ),
        ),
        Padding(
          padding: Responsive.padSymmetric(context, horizontal: 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(context.rs(4)),
            child: LinearProgressIndicator(
              value: _progress,
              minHeight: context.rs(8),
            ),
          ),
        ),
        Padding(
          padding: Responsive.padDirectional(
            context,
            start: 12,
            top: 6,
            end: 12,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'screening_answered_progress'.tr(namedArgs: {
                'answered': '${_answers.length}',
                'total': '${_questions.length}',
              }),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
        SizedBox(height: context.rg(10)),
        Expanded(
          child: ResponsiveScrollBody(
            padding: EdgeInsets.fromLTRB(
              context.rs(16),
              context.rs(12),
              context.rs(16),
              context.rs(16),
            ),
            child: Column(
              children:
                  pageQuestions.map((q) => _buildQuestionCard(q)).toList(),
            ),
          ),
        ),
        if (showFooter)
          _buildBottomActions(
            canGoBack: canGoBack,
            isLastPage: isLastPage,
          ),
      ],
    );
  }

  Widget _buildBottomActions({
    required bool canGoBack,
    required bool isLastPage,
  }) {
    final buttonHeight = context.rs(48);
    final buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(context.rs(8)),
    );

    return Material(
      elevation: 8,
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(
            top: BorderSide(
              color: Theme.of(context).dividerColor.withOpacity(0.35),
            ),
          ),
        ),
        padding: EdgeInsets.fromLTRB(
          context.rs(16),
          context.rs(12),
          context.rs(16),
          context.rs(12) + MediaQuery.viewPaddingOf(context).bottom,
        ),
        child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: !canGoBack
                      ? null
                      : () =>
                          setState(() => _currentIndex -= _questionsPerPage),
                  style: OutlinedButton.styleFrom(
                    minimumSize: Size(0, buttonHeight),
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 12,
                      vertical: 12,
                    ),
                    shape: buttonShape,
                    textStyle: TextStyle(fontSize: context.rf(15)),
                  ),
                  child: Text('screening_back'.tr()),
                ),
              ),
              SizedBox(width: context.rg(12)),
              Expanded(
                child: FilledButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          if (!_isCurrentPageAnswered()) {
                            await _showAnswerRequiredDialog();
                            return;
                          }
                          if (isLastPage) {
                            await _finishScreening();
                          } else {
                            setState(() => _currentIndex += _questionsPerPage);
                          }
                        },
                  style: FilledButton.styleFrom(
                    minimumSize: Size(0, buttonHeight),
                    padding: Responsive.padSymmetric(
                      context,
                      horizontal: 12,
                      vertical: 12,
                    ),
                    shape: buttonShape,
                    textStyle: TextStyle(fontSize: context.rf(15)),
                  ),
                  child: _saving
                      ? SizedBox(
                          width: context.rs(20),
                          height: context.rs(20),
                          child: const CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          isLastPage
                              ? 'screening_finish'.tr()
                              : 'screening_next'.tr(),
                        ),
                ),
              ),
            ],
          ),
        ),
    );
  }

  Widget _buildQuestionCard(Map<String, dynamic> q) {
    final number = (q['question_number'] as num).toInt();
    final key = _questionKey(q);
    final selected = _answers[key];
    final questionText = localizedAutismQuestionText(
      number,
      (q['question_text'] ?? '').toString(),
    );
    final exampleText = localizedAutismExampleText(
      number,
      (q['example_text'] ?? '').toString(),
    );

    return AppCard(
      margin: EdgeInsets.only(bottom: context.rg(12)),
      padding: Responsive.padAll(context, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'screening_question_number'.tr(namedArgs: {'number': '$number'}),
            style: TextStyle(
              fontSize: context.rf(12),
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: context.rg(8)),
          Text(
            questionText,
            style: TextStyle(
              fontSize: context.rf(17),
              fontWeight: FontWeight.w700,
            ),
            maxLines: 6,
            overflow: TextOverflow.ellipsis,
          ),
          if (exampleText.isNotEmpty) ...[
            SizedBox(height: context.rg(8)),
            Text(
              exampleText,
              style: TextStyle(
                fontSize: context.rf(13),
                color: Colors.black54,
              ),
              maxLines: 6,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          SizedBox(height: context.rg(16)),
          QuestionnaireAnswerRow<String>(
            value: 'Yes',
            groupValue: selected,
            label: 'screening_yes'.tr(),
            onChanged: (v) {
              if (v == null) return;
              setState(() => _answers[key] = v);
            },
          ),
          QuestionnaireAnswerRow<String>(
            value: 'No',
            groupValue: selected,
            label: 'screening_no'.tr(),
            onChanged: (v) {
              if (v == null) return;
              setState(() => _answers[key] = v);
            },
          ),
        ],
      ),
    );
  }

}
