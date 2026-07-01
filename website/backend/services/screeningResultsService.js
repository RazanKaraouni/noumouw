import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../config/supabase.js';
import {
  mergeResponsesWithFeedback,
  parentFeedbackByQuestion,
  reportPrimaryKey,
} from './screeningFeedback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '..', 'reports');

function normalizeRow(row) {
  const childId = Number(row.child_id);
  if (!Number.isFinite(childId)) return null;
  const createdAt = row.created_at || row.generated_at || null;
  if (!createdAt) return null;
  const pk = row.screening_results_id ?? reportPrimaryKey(row) ?? row.report_id ?? null;
  return {
    screening_results_id: pk,
    report_id: reportPrimaryKey(row) ?? row.report_id ?? null,
    child_id: childId,
    score: row.score ?? null,
    risk_level: row.risk_level ?? null,
    created_at: createdAt,
    source: row.source || 'screening_results',
    responses: row.responses ?? [],
    total_questions: row.total_questions ?? null,
  };
}

function dedupeKey(row) {
  return `${row.child_id}|${String(row.created_at)}|${row.score ?? ''}|${row.risk_level ?? ''}`;
}

function mergeRows(...groups) {
  const byKey = new Map();
  const sourceRank = { screening_results: 3, reports: 2, json_file: 1 };
  for (const rows of groups) {
    for (const raw of rows || []) {
      const row = normalizeRow(raw);
      if (!row) continue;
      const key = dedupeKey(row);
      const prev = byKey.get(key);
      if (!prev || (sourceRank[row.source] || 0) > (sourceRank[prev.source] || 0)) {
        byKey.set(key, row);
      } else if (prev && (row.responses?.length || 0) > (prev.responses?.length || 0)) {
        byKey.set(key, { ...prev, responses: row.responses, total_questions: row.total_questions ?? prev.total_questions });
      }
    }
  }
  return [...byKey.values()].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
}

function buildDetailFromPayload(payload, meta) {
  const feedbackMap = parentFeedbackByQuestion(payload);
  const responses = mergeResponsesWithFeedback(payload?.responses, feedbackMap);
  return {
    ...meta,
    score: meta.score ?? payload?.total_score ?? null,
    risk_level: meta.risk_level ?? payload?.risk_level ?? null,
    total_questions: payload?.total_questions ?? responses.length ?? null,
    responses,
  };
}

async function loadFromScreeningResultsTable(childIds) {
  if (!childIds?.length) return [];
  const { data, error } = await supabase
    .from('screening_results')
    .select('screening_results_id, child_id, score, risk_level, created_at')
    .in('child_id', childIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, source: 'screening_results', responses: [] }));
}

async function loadFromReportsTable(childIds) {
  if (!childIds?.length) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('report_type', 'screening_summary')
    .in('child_id', childIds)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('reports screening_summary load skipped:', error.message);
    return [];
  }
  return (data || []).map((r) => {
    const payload = r.data_payload || {};
    const pk = reportPrimaryKey(r);
    const meta = {
      report_id: pk,
      screening_results_id: pk,
      child_id: r.child_id,
      score: payload.total_score ?? null,
      risk_level: payload.risk_level ?? null,
      created_at: payload.generated_at || r.created_at,
      source: 'reports',
    };
    return buildDetailFromPayload(payload, meta);
  });
}

async function loadFromJsonFiles(childIds) {
  const idSet = new Set(childIds.map((id) => Number(id)).filter(Number.isFinite));
  if (!idSet.size) return [];

  const out = [];
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter(
      (f) => f.toLowerCase().startsWith('autism_screening_') && f.endsWith('.json'),
    );

    for (const fileName of reportFiles) {
      try {
        const raw = await fs.readFile(path.join(reportsDir, fileName), 'utf8');
        const parsed = JSON.parse(raw);
        const childrenId = Number(parsed?.child?.children_id);
        if (!idSet.has(childrenId)) continue;

        const screening = parsed.screening || {};
        const generatedAt = parsed.generated_at;
        if (!generatedAt) continue;

        const meta = {
          screening_results_id: `file:${fileName}`,
          report_id: null,
          child_id: childrenId,
          score: screening.total_score ?? null,
          risk_level: screening.risk_level ?? null,
          created_at: generatedAt,
          source: 'json_file',
        };
        out.push(
          buildDetailFromPayload(
            {
              ...parsed,
              total_score: screening.total_score,
              risk_level: screening.risk_level,
              total_questions: screening.total_questions,
              responses: parsed.responses,
            },
            meta,
          ),
        );
      } catch {
        // Skip invalid files.
      }
    }
  } catch (err) {
    console.warn('screening JSON files load skipped:', err?.message || err);
  }
  return out;
}

/** Latest risk per child for list views — DB only, no JSON file scan. */
export async function loadLatestScreeningRiskForChildIds(childIds) {
  const ids = [...new Set(childIds.map((id) => Number(id)).filter(Number.isFinite))];
  if (!ids.length) return [];

  const [tableRows, reportRows] = await Promise.all([
    loadFromScreeningResultsTable(ids),
    loadRiskSummariesFromReportsTable(ids),
  ]);

  return mergeRows(tableRows, reportRows);
}

async function loadRiskSummariesFromReportsTable(childIds) {
  if (!childIds?.length) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('child_id, created_at, data_payload')
    .eq('report_type', 'screening_summary')
    .in('child_id', childIds)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('reports screening_summary load skipped:', error.message);
    return [];
  }
  return (data || []).map((r) => {
    const payload = r.data_payload || {};
    const pk = reportPrimaryKey(r);
    return {
      report_id: pk,
      screening_results_id: pk,
      child_id: r.child_id,
      score: payload.total_score ?? null,
      risk_level: payload.risk_level ?? null,
      created_at: payload.generated_at || r.created_at,
      source: 'reports',
      responses: [],
    };
  });
}

/**
 * Merges screening rows from DB, clinical reports, and legacy JSON files.
 */
export async function loadScreeningResultsForChildIds(childIds) {
  const ids = [...new Set(childIds.map((id) => Number(id)).filter(Number.isFinite))];
  if (!ids.length) return [];

  const [tableRows, reportRows, fileRows] = await Promise.all([
    loadFromScreeningResultsTable(ids),
    loadFromReportsTable(ids),
    loadFromJsonFiles(ids),
  ]);

  return mergeRows(tableRows, reportRows, fileRows);
}

export async function loadScreeningResultsForChildId(childId) {
  return loadScreeningResultsForChildIds([childId]);
}

/** Latest screening report row in `reports` for parent feedback updates. */
export async function findLatestScreeningReportRow(childId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('report_type', 'screening_summary')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
