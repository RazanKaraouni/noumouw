import supabase from '../config/supabase.js';
import { filterActivitiesByChildAge } from '../utils/activityAgeFilter.js';

function dedupeActivitiesByTitle(activities) {
  const byKey = new Map();
  for (const activity of activities) {
    const key = [
      String(activity.title || '').trim().toLowerCase(),
      String(activity.domain || '').trim().toLowerCase(),
      activity.min_age_months,
      activity.max_age_months,
    ].join('|');
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, activity);
      continue;
    }
    const prevLen = String(prev.instructions || '').length;
    const nextLen = String(activity.instructions || '').length;
    const prevCreated = String(prev.created_at || '');
    const nextCreated = String(activity.created_at || '');
    if (nextLen > prevLen || (nextLen === prevLen && nextCreated > prevCreated)) {
      byKey.set(key, activity);
    }
  }
  return [...byKey.values()];
}

/** Matches `activity_library.domain` CHECK (capitalized). */
const ALLOWED_DOMAINS = ['Cognitive', 'Motor', 'Social', 'Language'];

const canonicalizeDomain = (value) => {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return ALLOWED_DOMAINS.find((d) => d.toLowerCase() === lower) || null;
};

/** @deprecated Use canonicalizeDomain — activity_library does not accept lowercase domains. */
export const normalizeActivityDomainForDb = canonicalizeDomain;

function resolveActivityDomain(value) {
  return canonicalizeDomain(value);
}

export const createActivityInLibrary = async (payload) => {
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('Title is required.');

  const domain = resolveActivityDomain(payload.domain);
  if (!domain) throw new Error('Invalid domain.');

  const min = Number(payload.min_age_months);
  const max = Number(payload.max_age_months);
  if (!Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max < 0) {
    throw new Error('min_age_months and max_age_months are required.');
  }
  if (max < min) throw new Error('max_age_months must be >= min_age_months.');

  const instructions =
    payload.instructions != null ? String(payload.instructions) : '';

  const { data, error } = await supabase
    .from('activity_library')
    .insert([
      {
        title,
        instructions,
        domain,
        min_age_months: Math.floor(min),
        max_age_months: Math.floor(max),
      },
    ])
    .select(
      'activity_id, min_age_months, max_age_months, domain, title, instructions, created_at',
    )
    .single();

  if (error) throw error;
  return data;
};

export const getAllActivities = async (filters = {}) => {
  let query = supabase
    .from('activity_library')
    .select(
      'activity_id, min_age_months, max_age_months, domain, title, instructions, created_at',
    );

  const domain = canonicalizeDomain(filters.domain);
  if (domain) query = query.eq('domain', domain);

  const { data, error } = await query
    .order('min_age_months', { ascending: true })
    .order('max_age_months', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw error;
  let rows = data || [];
  if (Number.isFinite(filters.childAgeMonths)) {
    rows = filterActivitiesByChildAge(rows, filters.childAgeMonths);
  }
  return dedupeActivitiesByTitle(rows);
};

export const updateActivityById = async (activityId, payload) => {
  const updates = {};
  if (payload.title != null) {
    const t = String(payload.title).trim();
    if (!t) throw new Error('Title is required.');
    updates.title = t;
  }
  if (payload.instructions != null) {
    updates.instructions = String(payload.instructions);
  }
  if (payload.domain != null) {
    const d = resolveActivityDomain(payload.domain);
    if (!d) throw new Error('Invalid domain.');
    updates.domain = d;
  }
  if (payload.min_age_months != null) {
    const n = Number(payload.min_age_months);
    if (!Number.isFinite(n) || n < 0) throw new Error('Invalid min_age_months.');
    updates.min_age_months = Math.floor(n);
  }
  if (payload.max_age_months != null) {
    const n = Number(payload.max_age_months);
    if (!Number.isFinite(n) || n < 0) throw new Error('Invalid max_age_months.');
    updates.max_age_months = Math.floor(n);
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update.');
  }
  if (
    updates.min_age_months != null &&
    updates.max_age_months != null &&
    updates.max_age_months < updates.min_age_months
  ) {
    throw new Error('max_age_months must be >= min_age_months.');
  }

  const { data, error } = await supabase
    .from('activity_library')
    .update(updates)
    .eq('activity_id', activityId)
    .select(
      'activity_id, min_age_months, max_age_months, domain, title, instructions, created_at',
    )
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const deleteActivityById = async (activityId) => {
  const found = await supabase
    .from('activity_library')
    .select('activity_id')
    .eq('activity_id', activityId)
    .maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) return false;
  const { error } = await supabase.from('activity_library').delete().eq('activity_id', activityId);
  if (error) throw error;
  return true;
};
