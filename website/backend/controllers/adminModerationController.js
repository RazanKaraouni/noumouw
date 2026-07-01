import supabase from '../config/supabase.js';
import {
  getAdminId,
  getParentUserId,
  getTherapistId,
  isTherapist,
} from '../utils/authContext.js';
import { sendErrorResponse, userFacingErrorMessage } from '../utils/errorFeedback.js';
import { writeModerationAudit, lookupSubjectByUserId } from '../services/moderationAuditService.js';
import { queueModerationNotification } from '../services/moderationNotifyService.js';
import { suspendParentAccount } from '../services/parentSuspensionService.js';
import { suspendTherapistById } from '../models/therapistModel.js';
import { apiCache } from '../utils/ttlCache.js';

const PENDING_REPORTS_CACHE_TTL_MS = 30_000;

function invalidateReportsCache() {
  apiCache.invalidatePrefix('admin:reports:');
}

const TARGET_TYPES = new Set(['resource', 'post', 'comment', 'tip']);
const RESOLVE_ACTIONS = new Set([
  'dismissed',
  'content_removed',
  'remove_content',
  'warn_user',
  'suspend_user',
  'ban_email',
]);
const RESOLVED_STATUSES = new Set(['resolved', 'content_removed', 'user_suspended']);

async function logReportModeration(req, report, action, extra = {}) {
  const eventMap = {
    dismissed: 'report_dismissed',
    remove_content: 'report_content_removed',
    content_removed: 'report_content_removed',
    warn_user: 'report_warn_user',
    suspend_user: 'report_suspend_user',
  };
  const event_type = eventMap[action];
  if (!event_type) return;

  await writeModerationAudit({
    event_type,
    adminId: getAdminId(req),
    targetTable: 'resource_reports',
    targetId: report.report_id,
    metadata: {
      action,
      report_id: report.report_id,
      target_type: report.target_type,
      report_reason: report.reason,
      reason: extra.reason || report.reason,
      ...extra,
    },
  });
}

function reporterIdFromRequest(req) {
  return getParentUserId(req) || req.auth?.userId;
}

async function resolveReporterId(req) {
  if (isTherapist(req)) {
    const therapistId = getTherapistId(req);
    if (therapistId) {
      const { data, error } = await supabase
        .from('therapists')
        .select('user_id')
        .eq('therapist_id', therapistId)
        .maybeSingle();
      if (error) throw error;
      if (data?.user_id) return data.user_id;
    }
  }

  return reporterIdFromRequest(req);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function deleteReportedContent(report) {
  const targetType = report.target_type;

  if (targetType === 'resource') {
    if (!report.resource_id) {
      throw new Error('Report is missing resource_id.');
    }
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('resources_id', report.resource_id);
    if (error) throw error;
    return;
  }

  if (targetType === 'post') {
    if (!report.post_id) {
      throw new Error('Report is missing post_id.');
    }
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('post_id', report.post_id);
    if (error) throw error;
    return;
  }

  if (targetType === 'comment') {
    if (!report.comment_id) {
      throw new Error('Report is missing comment_id.');
    }
    const { error } = await supabase
      .from('community_comments')
      .delete()
      .eq('comment_id', report.comment_id);
    if (error) throw error;
    return;
  }

  if (targetType === 'tip') {
    if (!report.tip_id) {
      throw new Error('Report is missing tip_id.');
    }
    const { error } = await supabase
      .from('parenting_tips')
      .delete()
      .eq('tip_id', report.tip_id);
    if (error) throw error;
    return;
  }

  throw new Error('Unsupported target_type.');
}

async function markReportsUserSuspendedForTarget(userId) {
  const stamp = new Date().toISOString();
  const patch = { status: 'user_suspended', updated_at: stamp };

  const { error: reporterErr } = await supabase
    .from('resource_reports')
    .update(patch)
    .eq('status', 'pending')
    .eq('reporter_id', userId);
  if (reporterErr) throw reporterErr;

  const { data: posts, error: postsErr } = await supabase
    .from('community_posts')
    .select('post_id')
    .eq('user_id', userId);
  if (postsErr) throw postsErr;
  const postIds = (posts || []).map((p) => p.post_id).filter(Boolean);
  if (postIds.length) {
    const { error } = await supabase
      .from('resource_reports')
      .update(patch)
      .eq('status', 'pending')
      .in('post_id', postIds);
    if (error) throw error;
  }

  const { data: comments, error: commentsErr } = await supabase
    .from('community_comments')
    .select('comment_id')
    .eq('user_id', userId);
  if (commentsErr) throw commentsErr;
  const commentIds = (comments || []).map((c) => c.comment_id).filter(Boolean);
  if (commentIds.length) {
    const { error } = await supabase
      .from('resource_reports')
      .update(patch)
      .eq('status', 'pending')
      .in('comment_id', commentIds);
    if (error) throw error;
  }

  const { data: therapistRow, error: therapistErr } = await supabase
    .from('therapists')
    .select('therapist_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (therapistErr && !String(therapistErr.message || '').toLowerCase().includes('user_id')) {
    throw therapistErr;
  }
  if (therapistRow?.therapist_id) {
    const { data: resources, error: resErr } = await supabase
      .from('resources')
      .select('resources_id')
      .eq('therapist_id', therapistRow.therapist_id);
    if (resErr) throw resErr;
    const resourceIds = (resources || []).map((r) => r.resources_id).filter(Boolean);
    if (resourceIds.length) {
      const { error } = await supabase
        .from('resource_reports')
        .update(patch)
        .eq('status', 'pending')
        .in('resource_id', resourceIds);
      if (error) throw error;
    }
  }
}

export async function submitResourceReport(req, res) {
  try {
    const reporter_id = await resolveReporterId(req);
    if (!reporter_id) {
      return res.status(401).json({ error: 'Reporter identity required.' });
    }

    const { target_type, resource_id, post_id, comment_id, tip_id, reason } = req.body || {};
    const normalizedType = String(target_type || '').trim().toLowerCase();

    if (!TARGET_TYPES.has(normalizedType)) {
      return res.status(400).json({ error: 'Invalid target_type.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason is required.' });
    }

    const row = {
      reporter_id,
      target_type: normalizedType,
      reason: String(reason).trim(),
      status: 'pending',
    };

    if (normalizedType === 'resource') {
      if (!resource_id) {
        return res.status(400).json({ error: 'resource_id is required for resource reports.' });
      }
      row.resource_id = resource_id;
    } else if (normalizedType === 'post') {
      if (!post_id) {
        return res.status(400).json({ error: 'post_id is required for post reports.' });
      }
      row.post_id = post_id;
    } else if (normalizedType === 'comment') {
      if (!comment_id) {
        return res.status(400).json({ error: 'comment_id is required for comment reports.' });
      }
      row.comment_id = comment_id;
    } else if (normalizedType === 'tip') {
      if (!tip_id) {
        return res.status(400).json({ error: 'tip_id is required for tip reports.' });
      }
      const { data: tipRow, error: tipErr } = await supabase
        .from('parenting_tips')
        .select('tip_id, status')
        .eq('tip_id', tip_id)
        .maybeSingle();
      if (tipErr) throw tipErr;
      if (!tipRow || tipRow.status !== 'approved') {
        return res.status(400).json({ error: 'Tip not found or not available for reporting.' });
      }
      row.tip_id = tip_id;
    }

    const { data, error } = await supabase
      .from('resource_reports')
      .insert(row)
      .select(
        'report_id, reporter_id, target_type, resource_id, post_id, comment_id, tip_id, reason, status, created_at',
      )
      .single();

    if (error) throw error;
    invalidateReportsCache();
    return res.status(201).json(data);
  } catch (err) {
    console.error('[submitResourceReport]', err);
    return sendErrorResponse(res, err);
  }
}

async function targetUserIdForReport(report) {
  if (report.target_type === 'post' && report.post_id) {
    const { data, error } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('post_id', report.post_id)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id || null;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const { data, error } = await supabase
      .from('community_comments')
      .select('user_id')
      .eq('comment_id', report.comment_id)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id || null;
  }

  if (report.target_type === 'tip' && report.tip_id) {
    const { data, error } = await supabase
      .from('parenting_tips')
      .select('submitted_by')
      .eq('tip_id', report.tip_id)
      .maybeSingle();
    if (error) throw error;
    return data?.submitted_by || null;
  }

  if (report.target_type === 'resource' && report.resource_id) {
    const { data: resource, error: resErr } = await supabase
      .from('resources')
      .select('therapist_id')
      .eq('resources_id', report.resource_id)
      .maybeSingle();
    if (resErr) throw resErr;
    if (!resource?.therapist_id) return null;

    const { data: therapist, error: thErr } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('therapist_id', resource.therapist_id)
      .maybeSingle();
    if (thErr && !String(thErr.message || '').toLowerCase().includes('user_id')) {
      throw thErr;
    }
    return therapist?.user_id || null;
  }

  return null;
}

async function therapistIdForResourceReport(report) {
  if (report.target_type !== 'resource' || !report.resource_id) return null;
  const { data, error } = await supabase
    .from('resources')
    .select('therapist_id')
    .eq('resources_id', report.resource_id)
    .maybeSingle();
  if (error) throw error;
  return data?.therapist_id || null;
}

/** Content author for warn/suspend — poster of resource, post, comment, or tip. */
async function resolveReportAuthor(report) {
  const therapistIdFromResource = await therapistIdForResourceReport(report);
  const userId = await targetUserIdForReport(report);

  if (therapistIdFromResource) {
    const { data: therapist, error } = await supabase
      .from('therapists')
      .select('therapist_id, user_id, full_name, email')
      .eq('therapist_id', therapistIdFromResource)
      .maybeSingle();
    if (error) throw error;
    return {
      userId: therapist?.user_id || userId || null,
      therapistId: therapistIdFromResource,
      role: 'therapist',
      authorName: (therapist?.full_name || '').trim() || null,
      authorEmail: (therapist?.email || '').trim() || null,
    };
  }

  if (!userId) {
    return { userId: null, therapistId: null, role: null, authorName: null, authorEmail: null };
  }

  const subject = await lookupSubjectByUserId(userId);
  let therapistId = null;
  if (subject.subject_role === 'therapist') {
    const { data: therapist, error } = await supabase
      .from('therapists')
      .select('therapist_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    therapistId = therapist?.therapist_id || null;
  }

  return {
    userId,
    therapistId,
    role: subject.subject_role || 'parent',
    authorName: subject.user_name || null,
    authorEmail: subject.user_email || null,
  };
}

async function suspendReportedAuthor(author, reason) {
  if (author.role === 'therapist' && author.therapistId) {
    const suspended = await suspendTherapistById(author.therapistId);
    return { email: suspended.email, user_id: suspended.user_id };
  }
  if (author.userId) {
    return suspendParentAccount(author.userId, reason);
  }
  throw new Error('Could not suspend content author.');
}

function truncatePreview(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

async function reporterProfilesByUserIds(userIds) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('parents')
    .select('user_id, full_name, email')
    .in('user_id', unique);

  if (error) throw error;

  return new Map(
    (data || []).map((p) => [
      p.user_id,
      { reporter_name: p.full_name || '—', reporter_email: p.email || '' },
    ]),
  );
}

async function contentPreviewForReport(report) {
  if (report.target_type === 'resource' && report.resource_id) {
    const { data, error } = await supabase
      .from('resources')
      .select('title, body_text')
      .eq('resources_id', report.resource_id)
      .maybeSingle();
    if (error) throw error;
    return truncatePreview(data?.title || data?.body_text || '');
  }

  if (report.target_type === 'post' && report.post_id) {
    const { data, error } = await supabase
      .from('community_posts')
      .select('content')
      .eq('post_id', report.post_id)
      .maybeSingle();
    if (error) throw error;
    return truncatePreview(data?.content || '');
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const { data, error } = await supabase
      .from('community_comments')
      .select('comment_text')
      .eq('comment_id', report.comment_id)
      .maybeSingle();
    if (error) throw error;
    return truncatePreview(data?.comment_text || '');
  }

  if (report.target_type === 'tip' && report.tip_id) {
    const { data, error } = await supabase
      .from('parenting_tips')
      .select('title, content')
      .eq('tip_id', report.tip_id)
      .maybeSingle();
    if (error) throw error;
    return truncatePreview(data?.title || data?.content || '');
  }

  return '';
}

async function batchReportAuthorsForReports(rows) {
  const list = rows || [];
  const postIds = [...new Set(list.filter((r) => r.target_type === 'post' && r.post_id).map((r) => r.post_id))];
  const commentIds = [
    ...new Set(list.filter((r) => r.target_type === 'comment' && r.comment_id).map((r) => r.comment_id)),
  ];
  const tipIds = [...new Set(list.filter((r) => r.target_type === 'tip' && r.tip_id).map((r) => r.tip_id))];
  const resourceIds = [
    ...new Set(list.filter((r) => r.target_type === 'resource' && r.resource_id).map((r) => r.resource_id)),
  ];

  const [postsRes, commentsRes, tipsRes, resourcesRes] = await Promise.all([
    postIds.length
      ? supabase.from('community_posts').select('post_id, user_id').in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase.from('community_comments').select('comment_id, user_id').in('comment_id', commentIds)
      : Promise.resolve({ data: [], error: null }),
    tipIds.length
      ? supabase
          .from('parenting_tips')
          .select('tip_id, submitted_by')
          .in('tip_id', tipIds)
      : Promise.resolve({ data: [], error: null }),
    resourceIds.length
      ? supabase.from('resources').select('resources_id, therapist_id').in('resources_id', resourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (postsRes.error) throw postsRes.error;
  if (commentsRes.error) throw commentsRes.error;
  if (tipsRes.error) throw tipsRes.error;
  if (resourcesRes.error) throw resourcesRes.error;

  const postUserById = new Map((postsRes.data || []).map((p) => [p.post_id, p.user_id || null]));
  const commentUserById = new Map(
    (commentsRes.data || []).map((c) => [c.comment_id, c.user_id || null]),
  );

  const resourceTherapistIds = [
    ...new Set((resourcesRes.data || []).map((r) => r.therapist_id).filter(Boolean)),
  ];
  const therapistIds = [...new Set(resourceTherapistIds)];

  let therapistById = new Map();
  if (therapistIds.length) {
    const { data: therapists, error: thErr } = await supabase
      .from('therapists')
      .select('therapist_id, user_id, full_name, email')
      .in('therapist_id', therapistIds);
    if (thErr && !String(thErr.message || '').toLowerCase().includes('user_id')) {
      throw thErr;
    }
    therapistById = new Map((therapists || []).map((t) => [t.therapist_id, t]));
  }

  const tipById = new Map((tipsRes.data || []).map((t) => [t.tip_id, t]));
  const resourceById = new Map((resourcesRes.data || []).map((r) => [r.resources_id, r]));

  const parentUserIds = new Set();
  for (const row of list) {
    if (row.target_type === 'post' && row.post_id) {
      const uid = postUserById.get(row.post_id);
      if (uid) parentUserIds.add(uid);
    } else if (row.target_type === 'comment' && row.comment_id) {
      const uid = commentUserById.get(row.comment_id);
      if (uid) parentUserIds.add(uid);
    } else if (row.target_type === 'tip' && row.tip_id) {
      const uid = tipById.get(row.tip_id)?.submitted_by;
      if (uid) parentUserIds.add(uid);
    }
  }

  let parentByUserId = new Map();
  if (parentUserIds.size) {
    const { data: parents, error: parentErr } = await supabase
      .from('parents')
      .select('user_id, full_name, email')
      .in('user_id', [...parentUserIds]);
    if (parentErr) throw parentErr;
    parentByUserId = new Map((parents || []).map((p) => [p.user_id, p]));
  }

  const authorByReportKey = new Map();
  for (const row of list) {
    const key = row.report_id;
    if (row.target_type === 'post' && row.post_id) {
      const userId = postUserById.get(row.post_id) || null;
      const parent = userId ? parentByUserId.get(userId) : null;
      authorByReportKey.set(key, {
        target_user_id: userId,
        target_therapist_id: null,
        target_author_role: userId ? 'parent' : null,
        target_author_name: (parent?.full_name || '').trim() || null,
        target_author_email: (parent?.email || '').trim() || null,
      });
    } else if (row.target_type === 'comment' && row.comment_id) {
      const userId = commentUserById.get(row.comment_id) || null;
      const parent = userId ? parentByUserId.get(userId) : null;
      authorByReportKey.set(key, {
        target_user_id: userId,
        target_therapist_id: null,
        target_author_role: userId ? 'parent' : null,
        target_author_name: (parent?.full_name || '').trim() || null,
        target_author_email: (parent?.email || '').trim() || null,
      });
    } else if (row.target_type === 'tip' && row.tip_id) {
      const userId = tipById.get(row.tip_id)?.submitted_by || null;
      const parent = userId ? parentByUserId.get(userId) : null;
      authorByReportKey.set(key, {
        target_user_id: userId,
        target_therapist_id: null,
        target_author_role: userId ? 'parent' : null,
        target_author_name: (parent?.full_name || '').trim() || null,
        target_author_email: (parent?.email || '').trim() || null,
      });
    } else if (row.target_type === 'resource' && row.resource_id) {
      const resource = resourceById.get(row.resource_id);
      const therapist = resource?.therapist_id ? therapistById.get(resource.therapist_id) : null;
      authorByReportKey.set(key, {
        target_user_id: therapist?.user_id || null,
        target_therapist_id: resource?.therapist_id || null,
        target_author_role: resource?.therapist_id ? 'therapist' : null,
        target_author_name: (therapist?.full_name || '').trim() || null,
        target_author_email: (therapist?.email || '').trim() || null,
      });
    } else {
      authorByReportKey.set(key, {
        target_user_id: null,
        target_therapist_id: null,
        target_author_role: null,
        target_author_name: null,
        target_author_email: null,
      });
    }
  }

  return authorByReportKey;
}

async function batchContentPreviewsForReports(rows) {
  const list = rows || [];
  const resourceIds = [
    ...new Set(list.filter((r) => r.target_type === 'resource' && r.resource_id).map((r) => r.resource_id)),
  ];
  const postIds = [...new Set(list.filter((r) => r.target_type === 'post' && r.post_id).map((r) => r.post_id))];
  const commentIds = [
    ...new Set(list.filter((r) => r.target_type === 'comment' && r.comment_id).map((r) => r.comment_id)),
  ];
  const tipIds = [...new Set(list.filter((r) => r.target_type === 'tip' && r.tip_id).map((r) => r.tip_id))];

  const [resourcesRes, postsRes, commentsRes, tipsRes] = await Promise.all([
    resourceIds.length
      ? supabase.from('resources').select('resources_id, title, body_text').in('resources_id', resourceIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from('community_posts').select('post_id, content').in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase
          .from('community_comments')
          .select('comment_id, comment_text')
          .in('comment_id', commentIds)
      : Promise.resolve({ data: [], error: null }),
    tipIds.length
      ? supabase.from('parenting_tips').select('tip_id, title, content').in('tip_id', tipIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (resourcesRes.error) throw resourcesRes.error;
  if (postsRes.error) throw postsRes.error;
  if (commentsRes.error) throw commentsRes.error;
  if (tipsRes.error) throw tipsRes.error;

  const resourcePreviewById = new Map(
    (resourcesRes.data || []).map((r) => [
      r.resources_id,
      truncatePreview(r.title || r.body_text || ''),
    ]),
  );
  const postPreviewById = new Map(
    (postsRes.data || []).map((p) => [p.post_id, truncatePreview(p.content || '')]),
  );
  const commentPreviewById = new Map(
    (commentsRes.data || []).map((c) => [c.comment_id, truncatePreview(c.comment_text || '')]),
  );
  const tipPreviewById = new Map(
    (tipsRes.data || []).map((t) => [t.tip_id, truncatePreview(t.title || t.content || '')]),
  );

  const previewByReportKey = new Map();
  for (const row of list) {
    const key = row.report_id;
    if (row.target_type === 'resource' && row.resource_id) {
      previewByReportKey.set(key, resourcePreviewById.get(row.resource_id) || '');
    } else if (row.target_type === 'post' && row.post_id) {
      previewByReportKey.set(key, postPreviewById.get(row.post_id) || '');
    } else if (row.target_type === 'comment' && row.comment_id) {
      previewByReportKey.set(key, commentPreviewById.get(row.comment_id) || '');
    } else if (row.target_type === 'tip' && row.tip_id) {
      previewByReportKey.set(key, tipPreviewById.get(row.tip_id) || '');
    } else {
      previewByReportKey.set(key, '');
    }
  }

  return previewByReportKey;
}

async function enrichReports(rows) {
  const list = rows || [];
  if (!list.length) return [];

  const [reporterMap, authorByReportKey, previewByReportKey] = await Promise.all([
    reporterProfilesByUserIds(list.map((r) => r.reporter_id)),
    batchReportAuthorsForReports(list),
    batchContentPreviewsForReports(list),
  ]);

  return list.map((row) => {
    const reporter = reporterMap.get(row.reporter_id) || {
      reporter_name: '—',
      reporter_email: '',
    };
    const author = authorByReportKey.get(row.report_id) || {
      target_user_id: null,
      target_therapist_id: null,
      target_author_role: null,
      target_author_name: null,
      target_author_email: null,
    };

    return {
      ...row,
      ...reporter,
      ...author,
      content_preview: previewByReportKey.get(row.report_id) ?? '',
    };
  });
}

/** GET /api/reports — admin report queue with optional filters. */
export async function listResourceReports(req, res) {
  try {
    const statusFilter = String(req.query.status || 'pending').trim().toLowerCase();
    const targetTypeFilter = String(req.query.target_type || '').trim().toLowerCase();
    const cacheKey = `admin:reports:${statusFilter}:${targetTypeFilter || 'all'}`;

    const payload = await apiCache.getOrSet(cacheKey, PENDING_REPORTS_CACHE_TTL_MS, async () => {
      let query = supabase
        .from('resource_reports')
        .select(
          'report_id, reporter_id, target_type, resource_id, post_id, comment_id, tip_id, reason, status, created_at, updated_at',
        )
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'resolved') {
          query = query.in('status', [...RESOLVED_STATUSES]);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      if (targetTypeFilter && TARGET_TYPES.has(targetTypeFilter)) {
        query = query.eq('target_type', targetTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return enrichReports(data || []);
    });

    return res.json(payload);
  } catch (err) {
    console.error('[listResourceReports]', err);
    return sendErrorResponse(res, err);
  }
}

/** @deprecated alias — pending only (defaults to status=pending in listResourceReports) */
export async function listPendingReports(req, res) {
  return listResourceReports(req, res);
}

async function emailForUserId(userId) {
  const { data: parent, error: parentErr } = await supabase
    .from('parents')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (parent?.email) return normalizeEmail(parent.email);

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr) throw authErr;
  return normalizeEmail(authUser?.user?.email);
}

async function insertUserWarning({ userId, reportId, reason, adminId }) {
  const text = String(reason || '').trim();
  if (!text) throw new Error('Warning reason is required.');

  const payload = {
    user_id: userId,
    report_id: reportId,
    reason: text,
  };
  if (adminId) payload.admin_id = adminId;

  const { error } = await supabase.from('user_warnings').insert(payload);
  if (error) throw error;
}

async function banEmailForUserId(userId, reason) {
  const email = await emailForUserId(userId);
  if (!email) throw new Error('User email not found.');

  const { error } = await supabase.from('email_blocklist').upsert(
    { email, reason: String(reason || '').trim() || 'Moderation action' },
    { onConflict: 'email' },
  );
  if (error) throw error;
  return email;
}

async function markReportResolved(reportId, status = 'resolved') {
  const { data, error } = await supabase
    .from('resource_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('report_id', reportId)
    .select(
      'report_id, reporter_id, target_type, resource_id, post_id, comment_id, tip_id, reason, status, created_at, updated_at',
    )
    .single();

  if (error) throw error;
  return data;
}

export async function resolveResourceReport(req, res) {
  try {
    const { reportId } = req.params;
    const action = String(req.body?.action || '').trim().toLowerCase();
    const note = String(req.body?.reason || req.body?.note || '').trim();

    if (!RESOLVE_ACTIONS.has(action)) {
      return res.status(400).json({
        error:
          "action must be one of: dismissed, remove_content, warn_user, suspend_user, ban_email.",
      });
    }

    const { data: report, error: fetchErr } = await supabase
      .from('resource_reports')
      .select('*')
      .eq('report_id', reportId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    if (report.status !== 'pending') {
      return res.status(400).json({ error: 'Report is no longer pending.' });
    }

    if (action === 'dismissed') {
      const updated = await markReportResolved(reportId, 'dismissed');
      await logReportModeration(req, report, action);
      invalidateReportsCache();
      return res.json(updated);
    }

    const removeContent = action === 'content_removed' || action === 'remove_content';
    if (removeContent) {
      await deleteReportedContent(report);
      const updated = await markReportResolved(reportId, 'resolved');
      await logReportModeration(req, report, 'remove_content');
      invalidateReportsCache();
      return res.json(updated);
    }

    const author = await resolveReportAuthor(report);
    const notifyUserId = author.userId;
    const canModerateAuthor =
      author.userId || (author.role === 'therapist' && author.therapistId);

    if (!canModerateAuthor) {
      return res.status(400).json({ error: 'Could not resolve the content author for this report.' });
    }

    const actionReason = note || report.reason;
    const authorSubject = {
      user_id: author.userId,
      user_name: author.authorName,
      user_email: author.authorEmail,
      subject_role: author.role,
      therapist_id: author.therapistId,
    };

    if (action === 'warn_user') {
      if (!author.userId) {
        return res.status(400).json({
          error: 'This author has no linked login account; use Suspend therapist instead.',
        });
      }
      await insertUserWarning({
        userId: author.userId,
        reportId: report.report_id,
        reason: actionReason,
        adminId: getAdminId(req),
      });
      queueModerationNotification({
        userId: author.userId,
        action: 'warn',
        reason: actionReason,
      });
      const updated = await markReportResolved(reportId, 'resolved');
      await logReportModeration(req, report, action, { reason: actionReason, ...authorSubject });
      invalidateReportsCache();
      return res.json(updated);
    }

    if (action === 'suspend_user') {
      const suspended = await suspendReportedAuthor(author, actionReason);
      if (notifyUserId) {
        queueModerationNotification({
          userId: notifyUserId,
          action: 'suspend',
          reason: actionReason,
        });
      }
      const updated = await markReportResolved(reportId, 'resolved');
      await logReportModeration(req, report, action, {
        reason: actionReason,
        banned_email: suspended.email,
        ...authorSubject,
      });
      invalidateReportsCache();
      return res.json({ ...updated, banned_email: suspended.email });
    }

    if (action === 'ban_email') {
      if (!author.userId) {
        return res.status(400).json({ error: 'Could not resolve the content author login for this report.' });
      }
      const email = await banEmailForUserId(author.userId, actionReason);
      const subject = await lookupSubjectByUserId(author.userId);
      const updated = await markReportResolved(reportId, 'resolved');
      await logReportModeration(req, report, 'suspend_user', {
        reason: actionReason,
        banned_email: email,
        ...subject,
      });
      invalidateReportsCache();
      return res.json({ ...updated, banned_email: email });
    }

    return res.status(400).json({ error: 'Unsupported action.' });
  } catch (err) {
    console.error('[resolveResourceReport]', err);
    const raw = String(err?.message || '');
    const status = /not found|required|resolve/i.test(raw) ? 400 : 500;
    return sendErrorResponse(res, err, status);
  }
}

export async function suspendUserAccount(req, res) {
  try {
    const { userId } = req.params;
    const reason = String(req.body?.reason || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'reason is required.' });
    }

    const suspended = await suspendParentAccount(userId, reason);
    await markReportsUserSuspendedForTarget(userId);

    return res.json({
      ok: true,
      userId,
      email: suspended.email,
      message: 'Account suspended, parent flagged, and blocklist updated.',
    });
  } catch (err) {
    console.error('[suspendUserAccount]', err);
    return sendErrorResponse(res, err);
  }
}
