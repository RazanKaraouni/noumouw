import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import supabaseAdmin from '../config/supabase.js';
import { writeModerationAudit } from '../services/moderationAuditService.js';
import {
  authenticateAdmin,
  authenticateJwt,
  parseBearerToken,
  requireTherapist,
  verifyBearerToken,
} from '../middleware/auth.js';
import { authenticateUser, requireRole } from '../middleware/requireRole.js';
import { ensureParentRowForAuthUser } from '../services/parentResolver.js';
import { apiCache } from '../utils/ttlCache.js';

dotenv.config();

const VALID_CATEGORIES = new Set([
  'child_development',
  'emotional_wellbeing',
  'behavior_guidance',
  'sleep',
  'autism_support',
  'screen_time',
  'positive_discipline',
  'social_skills',
  'parent_self_care',
  // legacy values on older rows
  'emotional_regulation',
  'communication',
  'routines',
  'general',
]);

const VALID_SUBMITTER_ROLES = new Set(['parent', 'therapist']);

const AGE_RANGE_MAX_LENGTH = 50;

function parseAgeRange(body) {
  const raw = body?.age_range;
  if (raw === undefined || raw === null) {
    throw new Error('Age range is required.');
  }

  const age_range = String(raw).trim();
  if (!age_range) {
    throw new Error('Age range is required.');
  }
  if (age_range.length > AGE_RANGE_MAX_LENGTH) {
    throw new Error(`Age range must be ${AGE_RANGE_MAX_LENGTH} characters or fewer.`);
  }
  if (!/\d/.test(age_range)) {
    throw new Error('Age range must include at least one number.');
  }

  return { age_range };
}

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/** @param {string} accessToken */
function supabaseClient(accessToken) {
  return createClient(process.env.SUPABASE_URL || '', supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

const router = express.Router();

const APPROVED_TIPS_TTL_MS = 5 * 60 * 1000;
const TIP_STATS_TTL_MS = 60 * 1000;

function invalidateTipsCache() {
  apiCache.invalidate('tips:approved');
  apiCache.invalidatePrefix('tips:today:');
  apiCache.invalidate('tips:stats');
}

async function loadApprovedTips() {
  return apiCache.getOrSet('tips:approved', APPROVED_TIPS_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin
      .from('parenting_tips')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

const authenticateTherapistPortal = [authenticateJwt, requireTherapist];

/** Therapist portal JWT or Supabase/parent JWT. */
async function authenticateTipActor(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  const portalAuth = await verifyBearerToken(token, { allowSupabase: false });
  if (portalAuth?.role === 'therapist') {
    req.auth = {
      userId: portalAuth.therapistId,
      role: 'therapist',
      email: portalAuth.email || '',
      therapistId: portalAuth.therapistId,
    };
    return next();
  }

  return authenticateUser(req, res, next);
}

/** Parent (app JWT or Supabase) or therapist portal JWT for tip submission. */
async function authenticateTipSubmit(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  const verified = await verifyBearerToken(token, { allowSupabase: true });
  if (!verified) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  if (verified.role === 'therapist') {
    req.auth = {
      userId: verified.therapistId,
      role: 'therapist',
      email: verified.email || '',
      therapistId: verified.therapistId,
    };
    req.authMode = 'therapist_portal';
    return next();
  }

  if (verified.role === 'parent') {
    req.user = {
      id: verified.parentUserId || verified.userId,
      email: verified.email || '',
    };
    req.authMode = 'parent';
    return next();
  }

  return res.status(403).json({ message: 'Only parents and therapists can submit tips.' });
}

async function therapistUserId(therapistId) {
  const { data, error } = await supabaseAdmin
    .from('therapists')
    .select('user_id')
    .eq('therapist_id', therapistId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

async function writeAuditLog({ event_type, actor_id, target_id, metadata = {} }) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    event_type,
    actor_id,
    target_table: 'parenting_tips',
    target_id,
    metadata,
  });
  if (error) console.error('[parentingTips audit_log]', error.message || error);
}

/** Parse min/max months from strings like "2-5 years", "0-12 months", "3-5". */
function parseAgeRangeMonths(ageRange) {
  const text = String(ageRange || '').toLowerCase();
  const nums = text.match(/\d+/g);
  if (!nums || nums.length === 0) return null;

  let min = parseInt(nums[0], 10);
  let max = nums.length > 1 ? parseInt(nums[1], 10) : min;
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  if (min > max) [min, max] = [max, min];

  const isYears = text.includes('year') || text.includes('yr');
  const isMonths = text.includes('month') || text.includes('mo');
  const multiplier = isYears ? 12 : isMonths || max > 18 ? 1 : 12;

  return { minMonths: min * multiplier, maxMonths: max * multiplier };
}

function tipMatchesAgeMonths(tip, ageMonths) {
  if (ageMonths == null || Number.isNaN(ageMonths)) return true;
  const parsed = parseAgeRangeMonths(tip.age_range);
  if (!parsed) return true;
  return ageMonths >= parsed.minMonths && ageMonths <= parsed.maxMonths;
}

function pickTodayTip(tips, ageMonths) {
  const pool = (tips || []).filter((t) => tipMatchesAgeMonths(t, ageMonths));
  const candidates = pool.length > 0 ? pool : tips || [];
  if (candidates.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const ageBucket = ageMonths != null && !Number.isNaN(ageMonths) ? Math.floor(ageMonths / 12) : 0;
  let hash = 0;
  const seed = `${today}:${ageBucket}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return candidates[hash % candidates.length];
}

async function enrichTipsWithSubmitterNames(tips) {
  const rows = tips || [];
  const userIds = [...new Set(rows.map((t) => t.submitted_by).filter(Boolean))];

  const [parentsRes, therapistsByUserRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from('parents').select('user_id, full_name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('therapists').select('user_id, full_name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (parentsRes.error) throw parentsRes.error;
  if (therapistsByUserRes.error) throw therapistsByUserRes.error;

  const parentNames = new Map(
    (parentsRes.data || []).map((p) => [p.user_id, p.full_name]),
  );
  const therapistNamesByUser = new Map(
    (therapistsByUserRes.data || []).map((t) => [t.user_id, t.full_name]),
  );

  return rows.map((tip) => ({
    ...tip,
    submitter_name:
      tip.submitted_by_role === 'parent'
        ? parentNames.get(tip.submitted_by) || null
        : therapistNamesByUser.get(tip.submitted_by) || null,
  }));
}

/** GET /api/tips — public approved tips; admin JWT returns all tips with submitter_name */
router.get('/', async (req, res) => {
  try {
    const token = parseBearerToken(req);
    let isAdmin = false;
    if (token) {
      const portalAuth = await verifyBearerToken(token, { allowSupabase: false });
      isAdmin = portalAuth?.role === 'admin';
    }

    let data = await loadApprovedTips();

    if (isAdmin) {
      data = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const enriched = await enrichTipsWithSubmitterNames(data);
      return res.json(enriched);
    }
    return res.json(data || []);
  } catch (err) {
    console.error('[GET /api/tips]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** POST /api/tips — therapist submits a tip (parents cannot submit) */
router.post('/', authenticateTipSubmit, async (req, res) => {
  try {
    const { title, content, category, submitted_by_role } = req.body || {};

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ message: 'Invalid category.' });
    }
    if (!VALID_SUBMITTER_ROLES.has(submitted_by_role)) {
      return res.status(400).json({ message: 'Invalid submitted_by_role.' });
    }

    if (submitted_by_role === 'parent') {
      return res.status(403).json({
        message: 'Parents cannot submit tips. Only therapists can add tips.',
      });
    }

    let ageRange;
    try {
      ageRange = parseAgeRange(req.body);
    } catch (ageErr) {
      return res.status(400).json({ message: ageErr.message || 'Invalid age range.' });
    }

    const insertRow = {
      title: title.trim(),
      content: content.trim(),
      category,
      submitted_by_role: 'therapist',
      status: 'approved',
      approved_at: new Date().toISOString(),
      ...ageRange,
    };

    if (submitted_by_role === 'therapist') {
      if (req.authMode !== 'therapist_portal' || req.auth?.role !== 'therapist') {
        return res.status(403).json({ message: 'Therapist authentication required.' });
      }

      const { data, error } = await supabaseAdmin
        .from('therapists')
        .select('therapist_id, user_id')
        .eq('therapist_id', req.auth.therapistId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.therapist_id) {
        return res.status(403).json({ message: 'Therapist profile not found.' });
      }
      if (!data.user_id) {
        return res.status(403).json({
          message: 'Therapist account is not linked to a login. Cannot submit tips.',
        });
      }
      insertRow.submitted_by = data.user_id;
    } else {
      if (req.authMode !== 'parent' || !req.user?.id) {
        return res.status(403).json({ message: 'Parent authentication required.' });
      }
      insertRow.submitted_by = req.user.id;
      const parentId = await ensureParentRowForAuthUser(req.user.id, {
        email: req.user.email,
      });
      if (!parentId) {
        return res.status(403).json({ message: 'Parent profile not found.' });
      }
      insertRow.parent_id = parentId;
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('parenting_tips')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertError) throw insertError;
    invalidateTipsCache();
    return res.status(201).json(created);
  } catch (err) {
    console.error('[POST /api/tips]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** GET /api/tips/today — deterministic daily featured tip */
router.get('/today', async (req, res) => {
  try {
    const rawAge = req.query.age_months;
    const ageMonths =
      rawAge != null && String(rawAge).trim() !== ''
        ? parseInt(String(rawAge), 10)
        : null;

    const ageKey =
      ageMonths != null && !Number.isNaN(ageMonths) ? String(ageMonths) : 'all';
    const cacheKey = `tips:today:${ageKey}`;

    const tip = await apiCache.getOrSet(cacheKey, APPROVED_TIPS_TTL_MS, async () => {
      const data = await loadApprovedTips();
      return pickTodayTip(data, ageMonths);
    });

    if (!tip) {
      return res.status(404).json({ message: 'No tips available.' });
    }
    return res.json(tip);
  } catch (err) {
    console.error('[GET /api/tips/today]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** GET /api/tips/pending — admin only */
router.get('/pending', ...authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('parenting_tips')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const enriched = await enrichTipsWithSubmitterNames(data);
    return res.json(enriched);
  } catch (err) {
    console.error('[GET /api/tips/pending]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** GET /api/tips/stats — admin only */
router.get('/stats', ...authenticateAdmin, async (req, res) => {
  try {
    const stats = await apiCache.getOrSet('tips:stats', TIP_STATS_TTL_MS, async () => {
      const countByStatus = async (status) => {
        const { count, error } = await supabaseAdmin
          .from('parenting_tips')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        if (error) throw error;
        return count ?? 0;
      };

      const [approved, pending, rejected, total] = await Promise.all([
        countByStatus('approved'),
        countByStatus('pending'),
        countByStatus('rejected'),
        supabaseAdmin
          .from('parenting_tips')
          .select('*', { count: 'exact', head: true })
          .then(({ count, error }) => {
            if (error) throw error;
            return count ?? 0;
          }),
      ]);

      return { total, approved, pending, rejected };
    });

    return res.json(stats);
  } catch (err) {
    console.error('[GET /api/tips/stats]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** GET /api/tips/therapist/:therapistId — therapist own tips (all statuses) */
router.get(
  '/therapist/:therapistId',
  ...authenticateTherapistPortal,
  async (req, res) => {
    try {
      const { therapistId } = req.params;
      if (req.auth.therapistId !== therapistId) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      const userId = await therapistUserId(therapistId);
      if (!userId) {
        return res.json([]);
      }

      const { data, error } = await supabaseAdmin
        .from('parenting_tips')
        .select('*')
        .eq('submitted_by', userId)
        .eq('submitted_by_role', 'therapist')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error('[GET /api/tips/therapist/:therapistId]', err);
      return sendErrorResponse(res, err, 500);
    }
  },
);

/** PATCH /api/tips/:id — therapist edits own pending or approved tip */
router.patch('/:id', ...authenticateTherapistPortal, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category } = req.body || {};

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    let ageRange;
    try {
      ageRange = parseAgeRange(req.body);
    } catch (ageErr) {
      return res.status(400).json({ message: ageErr.message || 'Invalid age range.' });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('parenting_tips')
      .select('tip_id, submitted_by, status')
      .eq('tip_id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ message: 'Tip not found.' });
    }
    const ownerUserId = await therapistUserId(req.auth.therapistId);
    if (!ownerUserId || existing.submitted_by !== ownerUserId) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (!['pending', 'approved'].includes(existing.status)) {
      return res.status(400).json({ message: 'Only pending or approved tips can be edited.' });
    }

    const { data, error } = await supabaseAdmin
      .from('parenting_tips')
      .update({
        title: title.trim(),
        content: content.trim(),
        category,
        ...ageRange,
      })
      .eq('tip_id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    invalidateTipsCache();
    return res.json(data);
  } catch (err) {
    console.error('[PATCH /api/tips/:id]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** PATCH /api/tips/:id/approve — admin only */
router.patch('/:id/approve', ...authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.auth.adminId;

    const { data, error } = await supabaseAdmin
      .from('parenting_tips')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('tip_id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Tip not found.' });
    }

    await writeAuditLog({
      event_type: 'tip_approved',
      actor_id: String(adminId),
      target_id: id,
    });

    invalidateTipsCache();
    return res.json(data);
  } catch (err) {
    console.error('[PATCH /api/tips/:id/approve]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** PATCH /api/tips/:id/reject — admin only */
router.patch('/:id/reject', ...authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rejectionReason = String(req.body?.rejection_reason || '').trim();

    if (rejectionReason.length < 10) {
      return res.status(400).json({
        message: 'rejection_reason is required and must be at least 10 characters.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('parenting_tips')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
      })
      .eq('tip_id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Tip not found.' });
    }

    await writeAuditLog({
      event_type: 'tip_rejected',
      actor_id: String(req.auth.adminId),
      target_id: id,
      metadata: { rejection_reason: rejectionReason },
    });

    invalidateTipsCache();
    return res.json(data);
  } catch (err) {
    console.error('[PATCH /api/tips/:id/reject]', err);
    return sendErrorResponse(res, err, 500);
  }
});

/** DELETE /api/tips/:id — therapist (own tip) or admin */
async function deleteTipHandler(req, res) {
  try {
    const { id } = req.params;

    const { data: tip, error: fetchError } = await supabaseAdmin
      .from('parenting_tips')
      .select('tip_id, submitted_by, title, content')
      .eq('tip_id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!tip) {
      return res.status(404).json({ message: 'Tip not found.' });
    }

    if (req.auth?.role === 'admin') {
      /* admin may delete any tip */
    } else if (req.auth?.role === 'therapist') {
      const ownerUserId = await therapistUserId(req.auth.therapistId);
      if (!ownerUserId || tip.submitted_by !== ownerUserId) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    } else if (req.user?.email) {
      const { data: admin, error: adminError } = await supabaseAdmin
        .from('admins')
        .select('admin_id')
        .eq('email', req.user.email)
        .maybeSingle();
      if (adminError) throw adminError;

      if (!admin?.admin_id) {
        if (tip.submitted_by !== req.user.id) {
          return res.status(403).json({ message: 'Access denied.' });
        }

        const { data: therapist, error: therapistError } = await supabaseAdmin
          .from('therapists')
          .select('therapist_id')
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (therapistError) throw therapistError;
        if (!therapist?.therapist_id) {
          return res.status(403).json({ message: 'Access denied.' });
        }
      }
    } else {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('parenting_tips')
      .delete()
      .eq('tip_id', id);

    if (deleteError) throw deleteError;

    invalidateTipsCache();

    const adminId =
      req.auth?.role === 'admin'
        ? req.auth.adminId
        : (
            await supabaseAdmin
              .from('admins')
              .select('admin_id')
              .eq('email', req.user?.email || '')
              .maybeSingle()
          ).data?.admin_id;

    if (adminId != null) {
      await writeModerationAudit({
        event_type: 'tip_deleted',
        adminId,
        targetTable: 'parenting_tips',
        targetId: id,
        metadata: {
          target_label: tip.title || 'Tip',
          reason: 'Admin deleted tip',
        },
      });
    }

    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[DELETE /api/tips/:id]', err);
    return sendErrorResponse(res, err, 500);
  }
}

async function authenticateDeleteActor(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  const portalAuth = await verifyBearerToken(token, { allowSupabase: false });
  if (portalAuth?.role === 'admin') {
    req.auth = {
      role: 'admin',
      adminId: portalAuth.adminId,
      email: portalAuth.email || '',
    };
    return next();
  }

  return authenticateTipActor(req, res, next);
}

router.delete('/:id', authenticateDeleteActor, deleteTipHandler);

export default router;
