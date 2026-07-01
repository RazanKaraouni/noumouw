import supabase from '../config/supabase.js';
import {
  boundsFromCdcAgeLabel,
  labelForAgeBounds,
} from '../utils/cdcMilestoneAgeTiers.js';

const TABLE = 'activity_library';
const DOMAINS = ['Cognitive', 'Motor', 'Social', 'Language'];

const canonicalizeDomain = (value) => {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return DOMAINS.find((d) => d.toLowerCase() === lower) || null;
};

export function parseAgeRange(ageRange) {
  const raw = typeof ageRange === 'string' ? ageRange.trim() : '';
  const fromCdc = boundsFromCdcAgeLabel(raw);
  if (fromCdc) {
    return {
      min_age_months: fromCdc.minMonths,
      max_age_months: fromCdc.maxMonths,
    };
  }
  const match = raw.match(/^(\d+)\s*-\s*(\d+)\s*months?$/i);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  return { min_age_months: min, max_age_months: max };
}

export function formatAgeRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
  return labelForAgeBounds(min, max);
}

export function toApiRow(row) {
  if (!row) return null;
  return {
    activity_id: row.activity_id,
    activity_name: row.title,
    description: row.instructions || '',
    domain: row.domain,
    age_range: formatAgeRange(row.min_age_months, row.max_age_months),
    min_age_months: row.min_age_months,
    max_age_months: row.max_age_months,
    created_at: row.created_at,
  };
}

function toDbRow(payload) {
  const domain = canonicalizeDomain(payload.domain);
  const ages = parseAgeRange(payload.age_range);
  if (!domain) throw new Error('Invalid domain.');
  if (!ages) throw new Error('Invalid age_range. Use a CDC label (e.g. "by 2 Months").');

  const title = typeof payload.activity_name === 'string' ? payload.activity_name.trim() : '';
  if (!title) throw new Error('activity_name is required.');

  const instructions =
    typeof payload.description === 'string' && payload.description.trim()
      ? payload.description.trim()
      : ' ';

  return {
    title,
    instructions,
    domain,
    min_age_months: ages.min_age_months,
    max_age_months: ages.max_age_months,
  };
}

const SELECT_COLS =
  'activity_id, min_age_months, max_age_months, domain, title, instructions, created_at';

export const getAllMasterActivities = async (filters = {}) => {
  let query = supabase.from(TABLE).select(SELECT_COLS);

  const domain = canonicalizeDomain(filters.domain);
  if (domain) query = query.eq('domain', domain);

  const { data, error } = await query
    .order('min_age_months', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw error;
  return (data || []).map(toApiRow);
};

export const createMasterActivity = async (payload) => {
  const row = toDbRow(payload);
  const { data, error } = await supabase.from(TABLE).insert([row]).select(SELECT_COLS).single();
  if (error) throw error;
  return toApiRow(data);
};

export const updateMasterActivity = async (id, payload) => {
  const row = toDbRow(payload);
  const { data, error } = await supabase
    .from(TABLE)
    .update(row)
    .eq('activity_id', id)
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return toApiRow(data);
};

export const deleteMasterActivity = async (id) => {
  const { error } = await supabase.from(TABLE).delete().eq('activity_id', id);
  if (error) throw error;
};
