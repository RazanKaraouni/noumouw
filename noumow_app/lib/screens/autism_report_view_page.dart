import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:http/http.dart' as http;

import '../services/child_progress_controller.dart';
import '../services/api_http_client.dart';
import '../utils/auth_headers.dart';
import '../utils/autism_question_text.dart';
import '../utils/therapists_api.dart';
import '../widgets/share_report_with_therapist.dart';
import 'autism_screening_page.dart';

class AutismReportViewPage extends StatefulWidget {
  const AutismReportViewPage({
    super.key,
    required this.childId,
    required this.childName,
    this.childProgress,
  });

  final String childId;
  final String childName;
  final ChildProgressController? childProgress;

  @override
  State<AutismReportViewPage> createState() => _AutismReportViewPageState();
}

class _AutismReportViewPageState extends State<AutismReportViewPage> {
  final _httpClient = createApiHttpClient();

  bool _loadingReport = false;
  bool _sharing = false;
  bool _noScreeningYet = false;
  String? _error;
  Map<String, dynamic>? _report;

  @override
  void initState() {
    super.initState();
    _loadReportForChild(widget.childId);
  }

  @override
  void dispose() {
    _httpClient.close();
    super.dispose();
  }

  Future<void> _loadReportForChild(String childId) async {
    setState(() {
      _loadingReport = true;
      _noScreeningYet = false;
      _error = null;
      _report = null;
    });
    try {
      final root = resolvedTherapistsApiBase();
      final uri = Uri.parse('$root/api/autism/report/$childId');
      final response =
          await _httpClient.get(uri, headers: authHeaders(json: true));
      final data = _parseJsonMap(response.body);
      if (response.statusCode == 404) {
        if (!mounted) return;
        setState(() {
          _loadingReport = false;
          _noScreeningYet = true;
        });
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(
          _extractError(data, 'screening_report_load_error'.tr()),
        );
      }
      if (!mounted) return;
      setState(() {
        _report = data['report'] as Map<String, dynamic>?;
        _loadingReport = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingReport = false;
        _error = userFacingErrorMessage(e);
      });
    }
  }

  Map<String, dynamic> _parseJsonMap(String raw) {
    try {
      final parsed = jsonDecode(raw);
      if (parsed is Map<String, dynamic>) return parsed;
    } catch (_) {}
    return <String, dynamic>{};
  }

  String _extractError(Map<String, dynamic> payload, String fallback) {
    final message = payload['message']?.toString();
    if (message != null && message.trim().isNotEmpty) {
      return sanitizeUserMessage(message);
    }
    return fallback;
  }

  String _localizedAnswer(String? answer) {
    final value = (answer ?? '').trim().toLowerCase();
    if (value == 'yes') return 'screening_yes'.tr();
    if (value == 'no') return 'screening_no'.tr();
    return (answer ?? '-').toString();
  }

  String _localizedRisk(String? raw) {
    final v = (raw ?? '').trim().toLowerCase();
    if (v.isEmpty) return 'screening_report_risk_unknown'.tr();
    if (v.contains('high')) return 'screening_risk_high'.tr();
    if (v.contains('moderate') || v.contains('medium')) {
      return 'screening_risk_moderate'.tr();
    }
    if (v.contains('low')) return 'screening_risk_low'.tr();
    return raw!.toString();
  }

  Future<void> _shareWithTherapist() async {
    if (_report == null || _sharing) return;
    setState(() => _sharing = true);
    try {
      final message = buildAutismReportShareMessage(
        reportPayload: {'report': _report},
        childName: widget.childName,
      );
      await shareReportWithTherapist(context, message: message);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('screening_report_title'.tr()),
        actions: [
          if (_report != null)
            IconButton(
              onPressed: _sharing ? null : _shareWithTherapist,
              tooltip: 'report_share_therapist'.tr(),
              icon: _sharing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loadingReport) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_noScreeningYet) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: FilledButton(
            onPressed: () {
              Navigator.push<void>(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => AutismScreeningPage(
                    childProgress: widget.childProgress,
                    initialChildId: widget.childId,
                  ),
                ),
              ).then((_) {
                if (mounted) _loadReportForChild(widget.childId);
              });
            },
            child: Text('screening_report_take_test'.tr()),
          ),
        ),
      );
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }
    if (_report == null) {
      return Center(child: Text('screening_report_none'.tr()));
    }

    final screening = (_report?['screening'] as Map<String, dynamic>?) ?? {};
    final responses = (_report?['responses'] as List?) ?? const [];
    final sorted = [...responses]
      ..sort((a, b) {
        final am = a is Map ? (a['question_number'] as num?)?.toInt() ?? 0 : 0;
        final bm = b is Map ? (b['question_number'] as num?)?.toInt() ?? 0 : 0;
        return am.compareTo(bm);
      });

    return ResponsiveScrollBody(
      padding: EdgeInsets.fromLTRB(
        context.rs(16),
        context.rs(12),
        context.rs(16),
        context.scrollBottomInset,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'screening_report_child'.tr(namedArgs: {'name': widget.childName}),
            style: TextStyle(fontSize: context.rf(14), fontWeight: FontWeight.w600),
          ),
          SizedBox(height: context.rg(8)),
          AppCard(
            padding: Responsive.padAll(context, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'screening_report_latest_title'.tr(),
                  style: TextStyle(
                    fontSize: context.rf(17),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: context.rg(8)),
                Text(
                  'screening_report_score'.tr(namedArgs: {
                    'score': '${screening['score'] ?? screening['total_score'] ?? 0}',
                    'total': '${screening['total_questions'] ?? 0}',
                  }),
                ),
                const SizedBox(height: 4),
                Text(
                  'screening_report_risk'.tr(namedArgs: {
                    'risk': _localizedRisk(screening['risk_level']?.toString()),
                  }),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          SizedBox(height: context.rg(12)),
          ...sorted.map((row) {
            final item =
                row is Map<String, dynamic> ? row : <String, dynamic>{};
            final isFail = item['is_fail'] == true;
            final number = (item['question_number'] as num?)?.toInt() ?? 0;
            final questionText = number > 0
                ? localizedAutismQuestionText(
                    number,
                    (item['question_text'] ?? '').toString(),
                  )
                : (item['question_text'] ?? '').toString();
            final exampleText = number > 0
                ? localizedAutismExampleText(
                    number,
                    (item['example_text'] ?? '').toString(),
                  )
                : (item['example_text'] ?? '').toString().trim();
            return AppCard(
              margin: EdgeInsets.only(bottom: context.rg(10)),
              padding: Responsive.padAll(context, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'screening_report_question'.tr(namedArgs: {
                      'number': '${item['question_number'] ?? ''}',
                    }),
                    style: TextStyle(
                      fontSize: context.rf(12),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: context.rg(6)),
                  Text(
                    questionText,
                    style: TextStyle(fontSize: context.rf(14)),
                  ),
                  if (exampleText.isNotEmpty) ...[
                    SizedBox(height: context.rg(6)),
                    Text(
                      exampleText,
                      style: TextStyle(
                        fontSize: context.rf(13),
                        color: Colors.black54,
                      ),
                    ),
                  ],
                  SizedBox(height: context.rg(6)),
                  Text(
                    'screening_report_answer'.tr(namedArgs: {
                      'answer': _localizedAnswer(
                        item['selected_answer']?.toString(),
                      ),
                    }),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color:
                          isFail ? Colors.red.shade700 : Colors.green.shade700,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
