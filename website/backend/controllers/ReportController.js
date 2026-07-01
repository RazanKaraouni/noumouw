import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../config/supabase.js';
import { getParentUserId, isParent } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { persistClinicalReport } from '../services/clinicalReportPersistence.js';
import { resolveParentRowByAuthUserId } from '../services/parentResolver.js';
import { reportPrimaryKey } from '../services/screeningFeedback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '..', 'reports');

const DEFAULT_CATEGORIES = ['Cognitive', 'Motor', 'Language', 'Social'];

function calculateAgeInMonths(dateOfBirth) {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;

  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months < 0 ? 0 : months;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1;
}

async function resolveChildByEither(childIdentifier) {
  if (childIdentifier === undefined || childIdentifier === null || childIdentifier === '') {
    return null;
  }

  const numericId = Number(childIdentifier);
  if (Number.isFinite(numericId) && Number.isInteger(numericId)) {
    const { data, error } = await supabase
      .from('children')
      .select('children_id, child_id, parent_id, full_name, date_of_birth, notes')
      .eq('children_id', numericId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await supabase
    .from('children')
    .select('children_id, child_id, parent_id, full_name, date_of_birth, notes')
    .eq('child_id', String(childIdentifier))
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function buildChildProgressPayload(child) {
  const { data: milestones, error: milestonesError } = await supabase
    .from('child_milestones')
    .select(
      'child_milestones_id, milestone_title, milestone_category, target_age_months, is_completed, completion_date, notes, created_at',
    )
    .eq('child_id', child.children_id)
    .order('created_at', { ascending: false });

  if (milestonesError) throw milestonesError;

  const ageMonths = calculateAgeInMonths(child.date_of_birth);
  const reportRows = (milestones ?? []).map((row) => {
    const targetAgeMonths = Number(row.target_age_months ?? 0);
    const isCompleted = toBoolean(row.is_completed);
    let ageStatus = 'Completed';
    if (!isCompleted) {
      ageStatus = targetAgeMonths > ageMonths ? 'Upcoming' : 'Overdue';
    }

    return {
      child_milestones_id: row.child_milestones_id,
      title: row.milestone_title ?? 'Untitled Milestone',
      category: row.milestone_category ?? 'Uncategorized',
      target_age_months: targetAgeMonths,
      is_completed: isCompleted,
      completion_date: row.completion_date ?? null,
      notes: row.notes ?? '',
      age_status: ageStatus,
    };
  });

  const totalMilestones = reportRows.length;
  const completedMilestones = reportRows.filter((m) => m.is_completed).length;
  const completionRate =
    totalMilestones === 0
      ? 0
      : Number(((completedMilestones / totalMilestones) * 100).toFixed(2));

  const categoryBreakdown = {};
  for (const category of DEFAULT_CATEGORIES) {
    categoryBreakdown[category] = { total: 0, completed: 0, completion_rate: 0 };
  }

  for (const milestone of reportRows) {
    const key = milestone.category || 'Uncategorized';
    if (!categoryBreakdown[key]) {
      categoryBreakdown[key] = { total: 0, completed: 0, completion_rate: 0 };
    }
    categoryBreakdown[key].total += 1;
    if (milestone.is_completed) categoryBreakdown[key].completed += 1;
  }

  for (const key of Object.keys(categoryBreakdown)) {
    const category = categoryBreakdown[key];
    category.completion_rate =
      category.total === 0
        ? 0
        : Number(((category.completed / category.total) * 100).toFixed(2));
  }

  const recentAchievements = reportRows
    .filter((m) => m.is_completed)
    .sort((a, b) => {
      const aDate = a.completion_date ? new Date(a.completion_date).getTime() : 0;
      const bDate = b.completion_date ? new Date(b.completion_date).getTime() : 0;
      return bDate - aDate;
    });

  const completedNotes = recentAchievements
    .filter((m) => String(m.notes || '').trim().length > 0)
    .map((m) => ({
      child_milestones_id: m.child_milestones_id,
      title: m.title,
      notes: m.notes,
      completion_date: m.completion_date,
    }));

  return {
    child: {
      children_id: child.children_id,
      child_id: child.child_id ?? null,
      full_name: child.full_name ?? 'Unnamed Child',
      date_of_birth: child.date_of_birth,
      age_months: ageMonths,
      notes: child.notes ?? '',
    },
    summary: {
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
      completion_rate: completionRate,
    },
    category_breakdown: categoryBreakdown,
    milestones: reportRows,
    recent_achievements: recentAchievements,
    notes: completedNotes,
    generated_at: new Date().toISOString(),
  };
}

export const getChildProgressReport = async (req, res) => {
  try {
    const childIdentifier =
      req.params.children_id || req.params.child_id || req.params.childId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id is required.' });
    }

    const parentId = getParentUserId(req);
    if (!parentId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (String(child.parent_id) !== String(parentId)) {
      return res.status(403).json({ message: 'You do not have access to this child.' });
    }

    const payload = await buildChildProgressPayload(child);
    return res.json(payload);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

/** GET /api/reports/admin/child/:children_id — admin milestone report (no parent ownership check). */
export const getAdminChildProgressReport = async (req, res) => {
  try {
    const childIdentifier =
      req.params.children_id || req.params.child_id || req.params.childId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id is required.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });

    const payload = await buildChildProgressPayload(child);
    return res.json(payload);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

function milestoneDomainKey(category) {
  return String(category || 'uncategorized')
    .trim()
    .toLowerCase();
}

function formatReportTitleDate(d = new Date()) {
  return d.toISOString().split('T')[0];
}

function buildMilestoneTrackingDataPayload(reportRows, ageMonths) {
  const total = reportRows.length;
  const completedCount = reportRows.filter((m) => m.is_completed).length;
  const completionRate =
    total === 0
      ? 0
      : Number(((completedCount / total) * 100).toFixed(2));

  const tally = {};
  for (const m of reportRows) {
    const key = milestoneDomainKey(m.category);
    if (!tally[key]) tally[key] = { total: 0, completed: 0 };
    tally[key].total += 1;
    if (m.is_completed) tally[key].completed += 1;
  }

  const byCategory = Object.entries(tally).map(([category, v]) => ({
    category,
    completion_percentage:
      v.total === 0 ? 0 : Number(((v.completed / v.total) * 100).toFixed(2)),
    completed: v.completed,
    total: v.total,
  }));

  const milestoneNotes = reportRows
    .filter((m) => String(m.notes || '').trim().length > 0)
    .map((m) => ({
      milestone_title: m.title,
      category: milestoneDomainKey(m.category),
      notes: String(m.notes || '').trim(),
      completion_date: m.completion_date ?? null,
      is_completed: Boolean(m.is_completed),
    }));

  const milestoneItems = reportRows.map((m) => ({
    child_milestones_id: m.child_milestones_id,
    milestone_title: m.title,
    milestone_category: m.category,
    target_age_months: m.target_age_months,
    is_completed: Boolean(m.is_completed),
    age_status: m.age_status,
    completion_date: m.completion_date ?? null,
  }));

  return {
    generated_at: new Date().toISOString(),
    child_age_months: ageMonths,
    overall_completion_percentage: completionRate,
    completed_milestones: completedCount,
    total_milestones: total,
    by_category: byCategory,
    milestone_notes: milestoneNotes,
    milestone_items: milestoneItems,
  };
}

function mapMilestoneRows(milestoneRows, ageMonths) {
  return (milestoneRows ?? []).map((row) => {
    const targetAgeMonths = Number(row.target_age_months ?? 0);
    const isCompleted = toBoolean(row.is_completed);
    let ageStatus = 'Completed';
    if (!isCompleted) {
      ageStatus = targetAgeMonths > ageMonths ? 'Upcoming' : 'Overdue';
    }
    return {
      child_milestones_id: row.child_milestones_id,
      title: row.milestone_title ?? 'Untitled Milestone',
      category: row.milestone_category ?? 'Uncategorized',
      target_age_months: targetAgeMonths,
      is_completed: isCompleted,
      completion_date: row.completion_date ?? null,
      notes: row.notes ?? '',
      age_status: ageStatus,
    };
  });
}

async function enrichReportsWithChildParent(rows) {
  const list = rows || [];
  const childIds = [...new Set(list.map((r) => r.child_id).filter((x) => x != null))];
  const parentIds = [...new Set(list.map((r) => r.parent_id).filter((x) => x != null))];
  const authUserIds = [
    ...new Set(list.map((r) => r.parent_auth_id).filter((x) => x != null && x !== '')),
  ];

  let childMap = {};
  if (childIds.length) {
    const { data: kids, error: cErr } = await supabase
      .from('children')
      .select('children_id, full_name, parent_id')
      .in('children_id', childIds);
    if (cErr) throw cErr;
    (kids || []).forEach((c) => {
      childMap[c.children_id] = c;
    });
  }

  let parentMap = {};
  if (parentIds.length) {
    const { data: pars, error: pErr } = await supabase
      .from('parents')
      .select('parent_id, user_id, full_name, email')
      .in('parent_id', parentIds);
    if (pErr) throw pErr;
    (pars || []).forEach((p) => {
      parentMap[p.parent_id] = p;
    });
  }

  let parentByAuthUser = {};
  if (authUserIds.length) {
    const { data: pars, error: pErr } = await supabase
      .from('parents')
      .select('parent_id, user_id, full_name, email')
      .in('user_id', authUserIds);
    if (pErr) throw pErr;
    (pars || []).forEach((p) => {
      if (p.user_id) parentByAuthUser[p.user_id] = p;
    });
  }

  return list.map((r) => {
    const child = childMap[r.child_id] || null;
    const parent =
      (r.parent_id && parentMap[r.parent_id]) ||
      (r.parent_auth_id && parentByAuthUser[r.parent_auth_id]) ||
      (child?.parent_id && parentByAuthUser[child.parent_id]) ||
      null;

    return {
      ...r,
      parent_id: r.parent_id ?? parent?.parent_id ?? null,
      child: child
        ? { full_name: child.full_name, children_id: child.children_id }
        : r.data_payload?.child
          ? {
              full_name: r.data_payload.child.full_name,
              children_id: r.data_payload.child.children_id,
            }
          : null,
      parent: parent
        ? {
            full_name: parent.full_name,
            email: parent.email,
            parent_id: parent.parent_id,
          }
        : null,
    };
  });
}

export const postMilestoneTrackingReport = async (req, res) => {
  try {
    const parentAuthId = getParentUserId(req);
    if (!parentAuthId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const {
      child_id: rawChildId,
      children_id: childrenIdInput,
      milestone_questionnaire_snapshot: questionnaireSnapshot,
    } = req.body || {};
    const childIdentifier = childrenIdInput ?? rawChildId;
    if (!childIdentifier) {
      return res.status(400).json({ message: 'children_id (or child_id) is required.' });
    }

    const child = await resolveChildByEither(childIdentifier);
    if (!child) return res.status(404).json({ message: 'Child not found.' });
    if (String(child.parent_id) !== String(parentAuthId)) {
      return res.status(403).json({ message: 'You do not have access to this child.' });
    }

    const { data: milestoneRows, error: milestonesError } = await supabase
      .from('child_milestones')
      .select(
        'child_milestones_id, milestone_title, milestone_category, target_age_months, is_completed, completion_date, notes, created_at',
      )
      .eq('child_id', child.children_id)
      .order('created_at', { ascending: false });

    if (milestonesError) throw milestonesError;

    const ageMonths = calculateAgeInMonths(child.date_of_birth);

    const reportRows = (milestoneRows ?? []).map((row) => {
      const targetAgeMonths = Number(row.target_age_months ?? 0);
      const isCompleted = toBoolean(row.is_completed);
      let ageStatus = 'Completed';
      if (!isCompleted) {
        ageStatus = targetAgeMonths > ageMonths ? 'Upcoming' : 'Overdue';
      }
      return {
        child_milestones_id: row.child_milestones_id,
        title: row.milestone_title ?? 'Untitled Milestone',
        category: row.milestone_category ?? 'Uncategorized',
        target_age_months: targetAgeMonths,
        is_completed: isCompleted,
        completion_date: row.completion_date ?? null,
        notes: row.notes ?? '',
        age_status: ageStatus,
      };
    });

    const dataPayload = {
      ...buildMilestoneTrackingDataPayload(reportRows, ageMonths),
    };

    const hasQuestionnaireSnapshot =
      questionnaireSnapshot &&
      typeof questionnaireSnapshot === 'object' &&
      !Array.isArray(questionnaireSnapshot) &&
      Array.isArray(questionnaireSnapshot.items) &&
      questionnaireSnapshot.items.length > 0;

    if (hasQuestionnaireSnapshot) {
      dataPayload.milestone_questionnaire_snapshot = questionnaireSnapshot;
    }

    if (!reportRows.length && !hasQuestionnaireSnapshot) {
      return res.status(200).json({
        message: 'No child_milestones rows for this child; report not saved.',
        skipped: true,
      });
    }

    const childDisplayName = String(child.full_name || 'Unnamed Child').trim() || 'Unnamed Child';
    const reportTitle = `Milestone Report: ${childDisplayName} - ${formatReportTitleDate()}`;

    const persistResult = await persistClinicalReport({
      parentAuthId: parentAuthId,
      child,
      reportType: 'milestone_tracking',
      title: reportTitle,
      parentHints: { email: req.supabaseUserEmail },
      dataPayload,
    });

    if (!persistResult.ok) {
      return res.status(500).json({
        message: persistResult.error || 'Failed to save milestone tracking report.',
      });
    }

    return res.status(201).json({
      message: 'Milestone tracking report saved.',
      report: persistResult.report,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: userFacingErrorMessage(err)});
  }
};

/**
 * Imports legacy autism screening JSON files from `website/backend/reports/`
 * into `public.reports` (admin-only). Skips files already represented in the DB.
 */
export const backfillScreeningReportsFromFiles = async (req, res) => {
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter(
      (f) => f.toLowerCase().startsWith('autism_screening_') && f.endsWith('.json'),
    );

    const { data: existing, error: existingErr } = await supabase
      .from('reports')
      .select('child_id, data_payload')
      .eq('report_type', 'screening_summary');
    if (existingErr) throw existingErr;

    const existingKeys = new Set(
      (existing || []).map((r) => {
        const at = r.data_payload?.generated_at || '';
        return `${r.child_id}:${at}`;
      }),
    );

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const fileName of reportFiles) {
      try {
        const raw = await fs.readFile(path.join(reportsDir, fileName), 'utf8');
        const parsed = JSON.parse(raw);
        const childrenId = parsed?.child?.children_id;
        const parentAuthId = parsed?.parent_id;
        const generatedAt = parsed?.generated_at;
        if (!childrenId || !parentAuthId || !generatedAt) {
          skipped += 1;
          continue;
        }

        const dedupeKey = `${childrenId}:${generatedAt}`;
        if (existingKeys.has(dedupeKey)) {
          skipped += 1;
          continue;
        }

        const child = await resolveChildByEither(childrenId);
        if (!child) {
          errors.push({ fileName, error: 'Child not found.' });
          continue;
        }

        const screening = parsed.screening || {};
        const normalizedRows = Array.isArray(parsed.responses) ? parsed.responses : [];
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
          if (r?.question_number != null) {
            responsesByQuestion[String(r.question_number)] = r.selected_answer;
          }
        }

        const childDisplayName =
          String(child.full_name || parsed?.child?.full_name || 'Unnamed Child').trim() ||
          'Unnamed Child';
        const reportTitleDate = String(generatedAt).split('T')[0];
        const reportTitle = `Autism Screening Summary: ${childDisplayName} - ${reportTitleDate}`;

        const persistResult = await persistClinicalReport({
          parentAuthId,
          child,
          reportType: 'screening_summary',
          title: reportTitle,
          dataPayload: {
            total_score: screening.total_score ?? 0,
            risk_level: screening.risk_level ?? 'Unknown',
            total_questions: screening.total_questions ?? normalizedRows.length,
            failed_questions: failedQuestions,
            responses_by_question: responsesByQuestion,
            responses: normalizedRows,
            generated_at: generatedAt,
            backfilled_from: fileName,
          },
        });

        if (!persistResult.ok) {
          errors.push({ fileName, error: persistResult.error });
          continue;
        }

        existingKeys.add(dedupeKey);
        imported += 1;
      } catch (fileErr) {
        errors.push({ fileName, error: fileErr?.message || String(fileErr) });
      }
    }

    return res.json({
      message: 'Screening report backfill finished.',
      imported,
      skipped,
      errors,
    });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

/** GET /api/reports/history — parent profile report list (service role; bypasses client RLS). */
export const listParentReportHistory = async (req, res) => {
  try {
    const parentUserId = getParentUserId(req);
    if (!isParent(req) || !parentUserId) {
      return res.status(403).json({ message: 'Parent sign-in required.' });
    }

    const authId = String(parentUserId);
    const parentsPk = await resolveParentRowByAuthUserId(authId);

    let dbReports = [];
    if (parentsPk) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('parent_id', parentsPk)
        .in('report_type', ['screening_summary', 'milestone_tracking'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      dbReports = (data || []).map((row) => ({
        reports_id: reportPrimaryKey(row),
        child_id: row.child_id,
        report_type: row.report_type,
        title: row.title,
        created_at: row.created_at,
      }));
    }

    const { data: children, error: childErr } = await supabase
      .from('children')
      .select('children_id')
      .eq('parent_id', authId);
    if (childErr) throw childErr;

    const childIds = (children || [])
      .map((c) => c.children_id)
      .filter((id) => id !== undefined && id !== null);

    const childrenWithScreeningReport = new Set(
      dbReports
        .filter((r) => r.report_type === 'screening_summary')
        .map((r) => String(r.child_id)),
    );

    const screeningExtras = [];
    if (childIds.length) {
      const { data: screeningRows, error: screeningErr } = await supabase
        .from('screening_results')
        .select('screening_results_id, child_id, score, risk_level, created_at')
        .in('child_id', childIds)
        .order('created_at', { ascending: false });
      if (screeningErr) {
        console.warn('[listParentReportHistory] screening_results:', screeningErr.message);
      } else {
        const seenChild = new Set();
        for (const row of screeningRows || []) {
          const cid = String(row.child_id);
          if (childrenWithScreeningReport.has(cid) || seenChild.has(cid)) continue;
          seenChild.add(cid);
          screeningExtras.push({
            reports_id: row.screening_results_id,
            child_id: row.child_id,
            report_type: 'screening_summary',
            title: `Autism screening summary (score: ${row.score ?? '—'})`,
            created_at: row.created_at,
          });
        }
      }
    }

    const merged = [...dbReports, ...screeningExtras].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
    );

    return res.json({ reports: merged });
  } catch (err) {
    console.error('[listParentReportHistory]', err);
    return sendErrorResponse(res, err, 500);
  }
};

function riskLevelFilterValues(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === 'all') return null;
  if (s === 'medium' || s === 'moderate') return ['medium', 'moderate'];
  return [s];
}

function matchesRiskFilter(riskLevel, filterValues) {
  if (!filterValues?.length) return true;
  const norm = String(riskLevel || '').trim().toLowerCase();
  return filterValues.some((f) => norm === f || (f === 'moderate' && norm === 'medium'));
}

/** Admin archive: screening_results joined with children and parents. */
export const listAdminScreeningArchive = async (req, res) => {
  try {
    const riskFilter = riskLevelFilterValues(req.query.risk_level);

    const { data: rows, error } = await supabase
      .from('screening_results')
      .select(
        'screening_results_id, child_id, parent_id, score, risk_level, created_at',
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const filtered = (rows || []).filter((r) =>
      matchesRiskFilter(r.risk_level, riskFilter),
    );

    const childIds = [...new Set(filtered.map((r) => r.child_id).filter((x) => x != null))];
    const authUserIds = [
      ...new Set(filtered.map((r) => r.parent_id).filter((x) => x != null)),
    ];

    let childMap = {};
    if (childIds.length) {
      const { data: kids, error: cErr } = await supabase
        .from('children')
        .select('children_id, full_name, parent_id, date_of_birth')
        .in('children_id', childIds);
      if (cErr) throw cErr;
      (kids || []).forEach((c) => {
        childMap[c.children_id] = c;
      });
      for (const kid of kids || []) {
        if (kid.parent_id && !authUserIds.includes(kid.parent_id)) {
          authUserIds.push(kid.parent_id);
        }
      }
    }

    let parentByAuth = {};
    if (authUserIds.length) {
      const { data: pars, error: pErr } = await supabase
        .from('parents')
        .select('parent_id, user_id, full_name, email')
        .in('user_id', authUserIds);
      if (pErr) throw pErr;
      (pars || []).forEach((p) => {
        if (p.user_id) parentByAuth[p.user_id] = p;
      });
    }

    const { data: savedReports } = await supabase
      .from('reports')
      .select('report_id, child_id, title, data_payload, file_url, created_at')
      .eq('report_type', 'screening_summary')
      .order('created_at', { ascending: false });

    const reportByChildTime = new Map();
    for (const rep of savedReports || []) {
      const key = `${rep.child_id}:${String(rep.created_at || '').slice(0, 16)}`;
      if (!reportByChildTime.has(key)) reportByChildTime.set(key, rep);
    }

    const items = filtered.map((row) => {
      const child = childMap[row.child_id] || null;
      const parentAuth =
        row.parent_id || child?.parent_id || null;
      const parent = parentAuth ? parentByAuth[parentAuth] || null : null;
      const timeKey = `${row.child_id}:${String(row.created_at || '').slice(0, 16)}`;
      const linkedReport = reportByChildTime.get(timeKey) || null;

      return {
        screening_results_id: row.screening_results_id,
        child_id: row.child_id,
        parent_auth_id: parentAuth,
        score: row.score,
        risk_level: row.risk_level,
        created_at: row.created_at,
        child_name: child?.full_name || null,
        parent_name: parent?.full_name || null,
        parent_email: parent?.email || null,
        child: child
          ? {
              children_id: child.children_id,
              full_name: child.full_name,
              date_of_birth: child.date_of_birth,
            }
          : null,
        parent: parent
          ? {
              parent_id: parent.parent_id,
              full_name: parent.full_name,
              email: parent.email,
            }
          : null,
        detail_payload: linkedReport?.data_payload || {
          total_score: row.score,
          risk_level: row.risk_level,
          generated_at: row.created_at,
          child: child || { children_id: row.child_id },
        },
        linked_report_id: linkedReport?.report_id || null,
        file_url: linkedReport?.file_url || null,
      };
    });

    return res.json(items);
  } catch (err) {
    console.error('[listAdminScreeningArchive]', err);
    return res
      .status(500)
      .json({ message: userFacingErrorMessage(err)});
  }
};

/** Admin archive: milestone_tracking reports for chart/summary views. */
export const listAdminMilestoneArchive = async (req, res) => {
  try {
    const { data: reports, error: repErr } = await supabase
      .from('reports')
      .select(
        'report_id, title, child_id, parent_id, file_url, created_at, data_payload, report_type',
      )
      .eq('report_type', 'milestone_tracking')
      .order('created_at', { ascending: false });

    if (repErr) throw repErr;

    const enrichedReports = await enrichReportsWithChildParent(
      (reports || []).map((r) => ({ ...r, source: 'reports' })),
    );

    return res.json({ reports: enrichedReports });
  } catch (err) {
    console.error('[listAdminMilestoneArchive]', err);
    return res
      .status(500)
      .json({ message: userFacingErrorMessage(err)});
  }
};
