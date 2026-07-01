import supabase from '../config/supabase.js';
import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { persistClinicalReport } from '../services/clinicalReportPersistence.js';
import {
  findLatestScreeningReportRow,
  loadScreeningResultsForChildId,
} from '../services/screeningResultsService.js';
import {
  reportPrimaryKey,
  upsertParentFeedback,
} from '../services/screeningFeedback.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '..', 'reports');

const QUESTION_COLUMNS =
  'autism_qs_id, question_number, question_text, example_text, fail_answer, created_at';

async function resolveChildByEither(childIdentifier) {
  if (childIdentifier === undefined || childIdentifier === null || childIdentifier === '') {
    return null;
  }

  const numericId = Number(childIdentifier);
  if (Number.isFinite(numericId) && Number.isInteger(numericId)) {
    const { data, error } = await supabase
      .from('children')
      .select('children_id, child_id, parent_id, full_name, date_of_birth, gender, notes, created_at')
      .eq('children_id', numericId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await supabase
    .from('children')
    .select('children_id, child_id, parent_id, full_name, date_of_birth, gender, notes, created_at')
    .eq('child_id', String(childIdentifier))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAutismQuestion(req, res) {
  try {
    const { question_number, question_text, example_text, fail_answer } = req.body;
    const num = Number(question_number);

    if (question_number === undefined || question_number === '' || !Number.isFinite(num)) {
      return res.status(400).json({ message: 'question_number is required and must be a number.' });
    }
    if (!Number.isInteger(num) || num < 1) {
      return res.status(400).json({ message: 'question_number must be a positive integer.' });
    }

    const qText = typeof question_text === 'string' ? question_text.trim() : '';
    const exText = typeof example_text === 'string' ? example_text.trim() : '';

    if (!qText || !exText || !fail_answer) {
      return res.status(400).json({
        message: 'question_text, example_text, and fail_answer are required and cannot be empty.',
      });
    }

    if (!['Yes', 'No'].includes(fail_answer)) {
      return res.status(400).json({ message: 'fail_answer must be Yes or No.' });
    }

    const { data, error } = await supabase
      .from('autism_questions')
      .insert({
        question_number: num,
        question_text: qText,
        example_text: exText,
        fail_answer,
      })
      .select(QUESTION_COLUMNS)
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    const msg = error?.message || '';
    const code = error?.code;
    if (code === '23505' || /unique|duplicate/i.test(msg)) {
      return res.status(409).json({ message: 'A question with this number already exists.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function listAutismQuestions(req, res) {
  try {
    const { data, error } = await supabase
      .from('autism_questions')
      .select(QUESTION_COLUMNS)
      .order('question_number', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function editAutismQuestion(req, res) {
  try {
    const autismQsId = req.params.autism_qs_id || req.params.id;
    const { question_number, question_text, example_text, fail_answer } = req.body;

    const updates = {};

    if (question_number !== undefined && question_number !== '') {
      const num = Number(question_number);
      if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
        return res.status(400).json({ message: 'question_number must be a positive integer.' });
      }
      updates.question_number = num;
    }

    if (question_text !== undefined) {
      const qText = typeof question_text === 'string' ? question_text.trim() : '';
      if (!qText) {
        return res.status(400).json({ message: 'question_text is required.' });
      }
      updates.question_text = qText;
    }

    if (example_text !== undefined) {
      const exText = typeof example_text === 'string' ? example_text.trim() : '';
      if (!exText) {
        return res.status(400).json({ message: 'example_text is required.' });
      }
      updates.example_text = exText;
    }

    if (fail_answer !== undefined) {
      if (!['Yes', 'No'].includes(fail_answer)) {
        return res.status(400).json({ message: 'fail_answer must be Yes or No.' });
      }
      updates.fail_answer = fail_answer;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    const { data, error } = await supabase
      .from('autism_questions')
      .update(updates)
      .eq('autism_qs_id', autismQsId)
      .select(QUESTION_COLUMNS)
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    const msg = error?.message || '';
    const code = error?.code;
    if (code === '23505' || /unique|duplicate/i.test(msg)) {
      return res.status(409).json({ message: 'A question with this number already exists.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function deleteAutismQuestion(req, res) {
  try {
    const autismQsId = req.params.autism_qs_id || req.params.id;
    const { error } = await supabase
      .from('autism_questions')
      .delete()
      .eq('autism_qs_id', autismQsId);
    if (error) throw error;
    return res.json({ message: 'Autism question deleted.' });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function submitAutismScreening(req, res) {
  try {
    const parentId = getParentUserId(req);
    if (!parentId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const { child_id: rawChildId, children_id: childrenIdInput, responses } = req.body || {};
    const childIdentifier = childrenIdInput ?? rawChildId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id (or child_id) is required.' });
    }
    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
      return res.status(400).json({ message: 'responses object is required.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (String(child.parent_id) !== String(parentId)) {
      return res.status(403).json({ message: 'You do not have access to this child.' });
    }

    const { data: questions, error: questionsError } = await supabase
      .from('autism_questions')
      .select(QUESTION_COLUMNS)
      .order('question_number', { ascending: true });

    if (questionsError) throw questionsError;
    if (!questions || questions.length === 0) {
      return res.status(400).json({ message: 'No autism questions found.' });
    }

    const missing = [];
    const normalizedRows = [];
    let totalScore = 0;

    for (const q of questions) {
      const number = Number(q.question_number);
      const answerRaw = responses[number] ?? responses[String(number)];
      const answer = typeof answerRaw === 'string' ? answerRaw.trim() : '';
      if (!answer) {
        missing.push(number);
        continue;
      }
      const failAnswer = String(q.fail_answer || '');
      const isFail = answer === failAnswer;
      if (isFail) totalScore += 1;
      normalizedRows.push({
        autism_qs_id: q.autism_qs_id,
        question_number: number,
        question_text: q.question_text || '',
        example_text: q.example_text || '',
        selected_answer: answer,
        fail_answer: failAnswer,
        is_fail: isFail,
      });
    }

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing answers for questions: ${missing.join(', ')}`,
      });
    }

    let riskLabel;
    if (totalScore <= 2) riskLabel = 'Low';
    else if (totalScore <= 7) riskLabel = 'Moderate';
    else riskLabel = 'High';

    const generatedAt = new Date().toISOString();
    const reportPayload = {
      generated_at: generatedAt,
      parent_id: parentId,
      child: {
        children_id: child.children_id,
        child_id: child.child_id ?? null,
        full_name: child.full_name ?? 'Unnamed Child',
        date_of_birth: child.date_of_birth ?? null,
        gender: child.gender ?? null,
        notes: child.notes ?? '',
      },
      screening: {
        total_questions: questions.length,
        total_score: totalScore,
        risk_level: riskLabel,
      },
      responses: normalizedRows,
    };

    const { error: screeningErr } = await supabase.from('screening_results').insert({
      child_id: child.children_id,
      parent_id: parentId,
      score: totalScore,
      risk_level: riskLabel,
    });
    if (screeningErr) {
      console.error('screening_results insert failed:', screeningErr.message || screeningErr);
    }

    const failedQuestions = normalizedRows
      .filter((r) => r.is_fail)
      .map((r) => ({
        autism_qs_id: r.autism_qs_id,
        question_number: r.question_number,
        question_text: r.question_text,
        example_text: r.example_text,
        selected_answer: r.selected_answer,
        fail_answer: r.fail_answer,
      }));
    const responsesByQuestion = {};
    for (const r of normalizedRows) {
      responsesByQuestion[String(r.question_number)] = r.selected_answer;
    }
    const childDisplayName = String(child.full_name || 'Unnamed Child').trim() || 'Unnamed Child';
    const reportTitleDate = generatedAt.split('T')[0];
    const reportTitle = `Autism Screening Summary: ${childDisplayName} - ${reportTitleDate}`;

    let reportSaved = false;
    let reportSaveError = null;
    try {
      const persistResult = await persistClinicalReport({
        parentAuthId: parentId,
        child,
        reportType: 'screening_summary',
        title: reportTitle,
        parentHints: { email: req.supabaseUserEmail },
        dataPayload: {
          total_score: totalScore,
          risk_level: riskLabel,
          total_questions: questions.length,
          failed_questions: failedQuestions,
          responses_by_question: responsesByQuestion,
          responses: normalizedRows,
          generated_at: generatedAt,
        },
      });
      reportSaved = persistResult.ok;
      if (!persistResult.ok) {
        reportSaveError = persistResult.error;
        console.error('reports (screening_summary) insert failed:', persistResult.error);
      }
    } catch (rErr) {
      reportSaveError = rErr?.message || String(rErr);
      console.error('reports (screening_summary) unexpected:', reportSaveError);
    }

    await fs.mkdir(reportsDir, { recursive: true });
    const safeName = String(child.full_name || 'child')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const timestamp = generatedAt.replace(/[:.]/g, '-');
    const fileName = `autism_screening_${safeName || 'child'}_${timestamp}.json`;
    const filePath = path.join(reportsDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(reportPayload, null, 2), 'utf8');

    return res.status(201).json({
      message: 'Screening submitted. Report generated.',
      summary: {
        score: totalScore,
        risk_level: riskLabel,
      },
      report_saved: reportSaved,
      report_save_error: reportSaveError,
      screening_saved: !screeningErr,
      report_file: fileName,
      report_path: filePath,
      generated_at: generatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

function screeningReportPkColumn(row) {
  if (row?.reports_id != null) return 'reports_id';
  if (row?.report_id != null) return 'report_id';
  return 'id';
}

export async function getAutismScreeningReport(req, res) {
  try {
    const parentId = getParentUserId(req);
    if (!parentId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const childIdentifier = req.params.children_id || req.params.child_id || req.params.childId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id is required.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (String(child.parent_id) !== String(parentId)) {
      return res.status(403).json({ message: 'You do not have access to this child.' });
    }

    const screenings = await loadScreeningResultsForChildId(child.children_id);
    const latest = screenings[0];
    if (latest?.responses?.length) {
      return res.json({
        report_id: latest.report_id ?? latest.screening_results_id ?? null,
        report_file: latest.source === 'json_file' ? String(latest.screening_results_id).replace(/^file:/, '') : null,
        report: {
          generated_at: latest.created_at,
          child: {
            children_id: child.children_id,
            child_id: child.child_id ?? null,
            full_name: child.full_name,
          },
          screening: {
            total_score: latest.score ?? 0,
            risk_level: latest.risk_level ?? 'Unknown',
            total_questions: latest.total_questions ?? latest.responses.length,
          },
          responses: latest.responses,
        },
      });
    }

    await fs.mkdir(reportsDir, { recursive: true });
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter(
      (f) => f.toLowerCase().startsWith('autism_screening_') && f.endsWith('.json'),
    );

    let latestReport = null;
    let latestFileName = null;
    let latestTime = 0;

    for (const fileName of reportFiles) {
      const filePath = path.join(reportsDir, fileName);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const parsedChildrenId = parsed?.child?.children_id?.toString?.() || '';
        const parsedChildUuid = parsed?.child?.child_id?.toString?.() || '';
        const parsedParentId = parsed?.parent_id?.toString?.() || '';
        const matchesChild =
          parsedChildrenId === String(child.children_id) ||
          (child.child_id && parsedChildUuid === String(child.child_id));
        if (!matchesChild || parsedParentId !== String(parentId)) {
          continue;
        }
        const generatedAt = new Date(parsed?.generated_at || 0).getTime();
        if (generatedAt > latestTime) {
          latestTime = generatedAt;
          latestReport = parsed;
          latestFileName = fileName;
        }
      } catch (_) {
        // Skip invalid report files.
      }
    }

    if (!latestReport) {
      return res.status(404).json({ message: 'No autism screening report found for this child.' });
    }

    return res.json({
      report_file: latestFileName,
      report: latestReport,
    });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function updateScreeningQuestionFeedback(req, res) {
  try {
    const parentId = getParentUserId(req);
    if (!parentId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const childIdentifier = req.params.children_id || req.params.child_id || req.params.childId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id is required.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (String(child.parent_id) !== String(parentId)) {
      return res.status(403).json({ message: 'You do not have access to this child.' });
    }

    const items = Array.isArray(req.body?.feedback)
      ? req.body.feedback
      : [
          {
            question_number: req.body?.question_number,
            parent_completed: req.body?.parent_completed,
            parent_notes: req.body?.parent_notes,
          },
        ];

    const validItems = items.filter((i) => i?.question_number != null);
    if (!validItems.length) {
      return res.status(400).json({ message: 'question_number or feedback array is required.' });
    }

    const reportRow = await findLatestScreeningReportRow(child.children_id);
    if (!reportRow) {
      return res.status(404).json({ message: 'No screening report found to update.' });
    }

    let payload =
      reportRow.data_payload && typeof reportRow.data_payload === 'object'
        ? { ...reportRow.data_payload }
        : {};

    for (const item of validItems) {
      payload = upsertParentFeedback(payload, item);
    }

    const pk = reportPrimaryKey(reportRow);
    const pkCol = screeningReportPkColumn(reportRow);
    if (pk == null) {
      return res.status(500).json({ message: 'Report id missing; cannot save feedback.' });
    }

    const { data, error } = await supabase
      .from('reports')
      .update({ data_payload: payload })
      .eq(pkCol, pk)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({
      message: 'Screening feedback saved.',
      parent_question_feedback: payload.parent_question_feedback ?? [],
      report_id: reportPrimaryKey(data),
    });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}
