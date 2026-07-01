import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { loadLatestScreeningRiskForChildIds } from '../services/screeningResultsService.js';
import { syncAppointmentChildLinksBatched } from '../services/therapistChildLinkService.js';
import {
  ageLabelFromDateOfBirth,
  ageMonthsFromDateOfBirth,
} from '../utils/childAge.js';
import { signChildProfileUrl } from '../utils/childProfileSignedUrl.js';

/** Latest screening risk per child_id (first row wins after sort desc). */
function latestRiskByChildId(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const id = r.child_id;
    if (id == null || map.has(id)) continue;
    map.set(id, r.risk_level ?? '—');
  }
  return map;
}

/** Latest completed appointment_date per child_id for this therapist. */
function latestCompletedSessionByChildId(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (String(r.status || '').toLowerCase() !== 'completed') continue;
    const id = r.child_id;
    if (id == null || !r.appointment_date) continue;
    const prev = map.get(id);
    const cur = String(r.appointment_date);
    if (!prev || cur > prev) map.set(id, cur);
  }
  return map;
}

function pendingAssignmentCountByChild(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (String(r.status || '').toLowerCase() !== 'pending') continue;
    const id = r.child_id;
    if (id == null) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

async function fetchTherapistChildLinks(therapistId) {
  const { data, error } = await supabase
    .from('therapist_children')
    .select('id, child_id, parent_id, appointment_id, assigned_at')
    .eq('therapist_id', therapistId)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listMyTherapistChildren(req, res) {
  try {
    const therapistId = getTherapistId(req);

    let links = await fetchTherapistChildLinks(therapistId);
    if (!links.length) {
      await syncAppointmentChildLinksBatched(therapistId);
      links = await fetchTherapistChildLinks(therapistId);
    }
    if (!links.length) return res.json([]);

    const childIds = [...new Set(links.map((l) => l.child_id))];
    const parentIds = [...new Set(links.map((l) => l.parent_id))];

    const [childrenRes, parentsRes, apptRes, assignRes] = await Promise.all([
      supabase
        .from('children')
        .select('children_id, full_name, date_of_birth, gender, profile_image_url')
        .in('children_id', childIds),
      supabase
        .from('parents')
        .select('parent_id, full_name, email, user_id')
        .in('parent_id', parentIds),
      supabase
        .from('appointments')
        .select('child_id, appointment_date, status')
        .eq('therapist_id', therapistId)
        .in('child_id', childIds),
      supabase
        .from('assignments')
        .select('child_id, status')
        .eq('therapist_id', therapistId)
        .in('child_id', childIds),
    ]);

    if (childrenRes.error) throw childrenRes.error;
    if (parentsRes.error) throw parentsRes.error;
    if (apptRes.error) throw apptRes.error;

    const screeningRows = await loadLatestScreeningRiskForChildIds(childIds);
    if (assignRes.error) throw assignRes.error;

    const childById = new Map((childrenRes.data || []).map((c) => [c.children_id, c]));
    const parentById = new Map((parentsRes.data || []).map((p) => [p.parent_id, p]));
    const riskByChild = latestRiskByChildId(screeningRows);
    const sessionByChild = latestCompletedSessionByChildId(apptRes.data);
    const pendingTasksByChild = pendingAssignmentCountByChild(assignRes.data);

    const out = links
      .filter((link) => childById.has(link.child_id))
      .map((link) => {
      const ch = childById.get(link.child_id);
      const par = parentById.get(link.parent_id);
      const risk = riskByChild.get(link.child_id) ?? '—';
      const active_tasks = pendingTasksByChild.get(link.child_id) ?? 0;
      const lastDt = sessionByChild.get(link.child_id) ?? null;
      return {
        id: link.id,
        therapist_child_id: link.id,
        children_id: link.child_id,
        child_id: link.child_id,
        parent_id: link.parent_id,
        assigned_at: link.assigned_at,
        full_name: ch?.full_name ?? '—',
        date_of_birth: ch?.date_of_birth ?? null,
        age_months: ageMonthsFromDateOfBirth(ch?.date_of_birth),
        age_label: ageLabelFromDateOfBirth(ch?.date_of_birth),
        gender: ch?.gender ?? '—',
        profile_image_url: ch?.profile_image_url ?? null,
        parent_name: (par?.full_name || '').trim() || '—',
        parent_email: par?.email ?? null,
        parent_user_id: par?.user_id ?? null,
        risk_level: risk,
        screening_risk_level: risk,
        active_tasks,
        last_session_date: lastDt,
        latest_session_date: lastDt,
      };
    });

    const signedOut = await Promise.all(
      out.map(async (row) => {
        if (!row.profile_image_url) return row;
        const signedUrl = await signChildProfileUrl(row.profile_image_url);
        return { ...row, profile_image_url: signedUrl };
      }),
    );

    signedOut.sort((a, b) => {
      const ad = a.last_session_date ? String(a.last_session_date) : '';
      const bd = b.last_session_date ? String(b.last_session_date) : '';
      return bd.localeCompare(ad);
    });

    return res.json(signedOut);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}
