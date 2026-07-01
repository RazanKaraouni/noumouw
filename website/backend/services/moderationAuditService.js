import supabase from '../config/supabase.js';

/** Audit event types shown in the admin moderation log. */
export const MODERATION_AUDIT_EVENTS = [
  'report_dismissed',
  'report_content_removed',
  'report_warn_user',
  'report_suspend_user',
  'tip_deleted',
  'tip_approved',
  'tip_rejected',
  'community_post_deleted',
  'community_comment_deleted',
  'community_user_warned',
  'community_user_suspended',
  'parent_suspended',
  'parent_deleted',
  'therapist_suspended',
  'resource_deleted',
];

const ACTION_LABELS = {
  report_dismissed: 'Dismiss report',
  report_content_removed: 'Remove content',
  report_warn_user: 'Warn user (report)',
  report_suspend_user: 'Suspend user (report)',
  tip_deleted: 'Delete tip',
  tip_approved: 'Approve tip',
  tip_rejected: 'Reject tip',
  community_post_deleted: 'Delete post',
  community_comment_deleted: 'Delete comment',
  community_user_warned: 'Warn user',
  community_user_suspended: 'Suspend user',
  parent_suspended: 'Suspend parent',
  parent_deleted: 'Delete parent',
  therapist_suspended: 'Suspend therapist',
  resource_deleted: 'Delete resource',
  user_warning: 'Warn user',
};

export function moderationActionLabel(eventType) {
  return ACTION_LABELS[eventType] || String(eventType || 'Moderation').replace(/_/g, ' ');
}

const USER_SUBJECT_EVENTS = new Set([
  'report_warn_user',
  'report_suspend_user',
  'community_user_warned',
  'community_user_suspended',
  'parent_suspended',
  'parent_deleted',
  'therapist_suspended',
  'user_warning',
]);

/** Resolve parent or therapist profile by auth user id (for audit metadata). */
export async function lookupSubjectByUserId(userId) {
  if (!userId) return {};

  const [parentRes, therapistRes] = await Promise.all([
    supabase.from('parents').select('user_id, full_name, email').eq('user_id', userId).maybeSingle(),
    supabase.from('therapists').select('user_id, full_name, email').eq('user_id', userId).maybeSingle(),
  ]);

  if (parentRes.error) throw parentRes.error;
  if (therapistRes.error) throw therapistRes.error;

  if (parentRes.data) {
    return {
      user_id: userId,
      user_name: parentRes.data.full_name,
      user_email: parentRes.data.email,
      subject_role: 'parent',
    };
  }
  if (therapistRes.data) {
    return {
      user_id: userId,
      user_name: therapistRes.data.full_name,
      user_email: therapistRes.data.email,
      subject_role: 'therapist',
    };
  }

  return { user_id: userId };
}

export async function lookupSubjectByTherapistId(therapistId) {
  if (!therapistId) return {};

  const { data, error } = await supabase
    .from('therapists')
    .select('therapist_id, user_id, full_name, email')
    .eq('therapist_id', therapistId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { therapist_id: therapistId };

  return {
    therapist_id: therapistId,
    user_id: data.user_id,
    user_name: data.full_name,
    user_email: data.email,
    subject_role: 'therapist',
  };
}

export async function lookupSubjectByParentId(parentId) {
  if (!parentId) return {};

  const { data, error } = await supabase
    .from('parents')
    .select('parent_id, user_id, full_name, email')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { parent_id: parentId };

  return {
    parent_id: parentId,
    user_id: data.user_id,
    user_name: data.full_name,
    user_email: data.email,
    subject_role: 'parent',
  };
}

async function resolveReportAuthorUserId(report) {
  if (!report) return null;

  if (report.target_type === 'post' && report.post_id) {
    const { data } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('post_id', report.post_id)
      .maybeSingle();
    return data?.user_id || null;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const { data } = await supabase
      .from('community_comments')
      .select('user_id')
      .eq('comment_id', report.comment_id)
      .maybeSingle();
    return data?.user_id || null;
  }

  if (report.target_type === 'tip' && report.tip_id) {
    const { data } = await supabase
      .from('parenting_tips')
      .select('submitted_by, therapist_id')
      .eq('tip_id', report.tip_id)
      .maybeSingle();
    if (data?.submitted_by) return data.submitted_by;
    if (!data?.therapist_id) return null;
    const { data: therapist } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('therapist_id', data.therapist_id)
      .maybeSingle();
    return therapist?.user_id || null;
  }

  if (report.target_type === 'resource' && report.resource_id) {
    const { data: resource } = await supabase
      .from('resources')
      .select('therapist_id')
      .eq('resources_id', report.resource_id)
      .maybeSingle();
    if (!resource?.therapist_id) return null;
    const { data: therapist } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('therapist_id', resource.therapist_id)
      .maybeSingle();
    return therapist?.user_id || null;
  }

  return null;
}

async function buildReportAuthorUserMap(auditRows) {
  const reportIds = [
    ...new Set(
      auditRows
        .filter(
          (row) =>
            (row.event_type === 'report_warn_user' || row.event_type === 'report_suspend_user') &&
            row.metadata?.report_id &&
            !row.metadata?.user_id,
        )
        .map((row) => row.metadata.report_id),
    ),
  ];

  const map = new Map();
  if (!reportIds.length) return map;

  const { data: warningLinks, error: warnErr } = await supabase
    .from('user_warnings')
    .select('report_id, user_id')
    .in('report_id', reportIds);
  if (warnErr) throw warnErr;

  for (const row of warningLinks || []) {
    if (row.report_id && row.user_id) map.set(row.report_id, row.user_id);
  }

  const unresolved = reportIds.filter((id) => !map.has(id));
  if (!unresolved.length) return map;

  const { data: reports, error: repErr } = await supabase
    .from('resource_reports')
    .select('report_id, target_type, post_id, comment_id, tip_id, resource_id')
    .in('report_id', unresolved);
  if (repErr) throw repErr;

  for (const report of reports || []) {
    const userId = await resolveReportAuthorUserId(report);
    if (userId) map.set(report.report_id, userId);
  }

  return map;
}

export async function writeModerationAudit({
  event_type,
  adminId,
  targetTable,
  targetId,
  metadata = {},
}) {
  if (!event_type) return;

  const payload = {
    event_type,
    actor_id: null,
    target_table: targetTable || null,
    target_id: targetId != null ? String(targetId) : null,
    metadata: {
      ...metadata,
      ...(adminId != null ? { admin_id: adminId } : {}),
    },
  };

  const { error } = await supabase.from('audit_log').insert(payload);
  if (error) {
    console.error('[writeModerationAudit]', event_type, error.message || error);
  }
}

function adminDisplayName(admin) {
  if (!admin) return '—';
  const explicit = admin.full_name && String(admin.full_name).trim();
  if (explicit) return explicit;
  const parts = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim();
  return parts || admin.email || '—';
}

function buildTargetLabel(row) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  if (meta.target_label) return meta.target_label;
  if (meta.target_type && meta.content_preview) {
    return `${meta.target_type}: ${meta.content_preview}`;
  }
  if (meta.target_type) return String(meta.target_type);
  if (row.target_table && row.target_id) {
    return `${row.target_table} · ${row.target_id}`;
  }
  if (meta.user_email) return meta.user_email;
  if (meta.user_name) return meta.user_name;
  return '—';
}

function buildDetails(row) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const parts = [];
  if (meta.reason) parts.push(meta.reason);
  if (meta.report_reason && meta.report_reason !== meta.reason) {
    parts.push(`Report: ${meta.report_reason}`);
  }
  if (meta.rejection_reason) parts.push(`Rejection: ${meta.rejection_reason}`);
  return parts.join(' · ') || '—';
}

function collectSubjectLookupKeys(auditRows, warningRows) {
  const userIds = new Set();
  const therapistIds = new Set();
  const parentIds = new Set();

  for (const row of auditRows) {
    const meta = row.metadata || {};
    if (meta.user_id) userIds.add(meta.user_id);
    if (row.event_type === 'therapist_suspended' && row.target_id) {
      therapistIds.add(row.target_id);
    }
    if (
      (row.event_type === 'parent_suspended' || row.event_type === 'parent_deleted') &&
      row.target_id
    ) {
      parentIds.add(row.target_id);
    }
    if (
      (row.event_type === 'community_user_warned' ||
        row.event_type === 'community_user_suspended') &&
      meta.user_id
    ) {
      userIds.add(meta.user_id);
    }
  }

  for (const w of warningRows) {
    if (w.user_id) userIds.add(w.user_id);
  }

  return {
    userIds: [...userIds],
    therapistIds: [...therapistIds],
    parentIds: [...parentIds],
  };
}

async function loadSubjectMaps({ userIds, therapistIds, parentIds }) {
  const [parentsByUserRes, parentsByIdRes, therapistsByUserRes, therapistsByIdRes] =
    await Promise.all([
      userIds.length
        ? supabase
            .from('parents')
            .select('parent_id, user_id, full_name, email, is_suspended')
            .in('user_id', userIds)
        : { data: [], error: null },
      parentIds.length
        ? supabase
            .from('parents')
            .select('parent_id, user_id, full_name, email, is_suspended')
            .in('parent_id', parentIds)
        : { data: [], error: null },
      userIds.length
        ? supabase
            .from('therapists')
            .select('therapist_id, user_id, full_name, email, is_suspended')
            .in('user_id', userIds)
        : { data: [], error: null },
      therapistIds.length
        ? supabase
            .from('therapists')
            .select('therapist_id, user_id, full_name, email, is_suspended')
            .in('therapist_id', therapistIds)
        : { data: [], error: null },
    ]);

  if (parentsByUserRes.error) throw parentsByUserRes.error;
  if (parentsByIdRes.error) throw parentsByIdRes.error;
  if (therapistsByUserRes.error) throw therapistsByUserRes.error;
  if (therapistsByIdRes.error) throw therapistsByIdRes.error;

  const parentByUser = new Map();
  const parentById = new Map();
  for (const p of [...(parentsByUserRes.data || []), ...(parentsByIdRes.data || [])]) {
    if (p.user_id) parentByUser.set(p.user_id, p);
    if (p.parent_id) parentById.set(String(p.parent_id), p);
  }

  const therapistByUser = new Map();
  const therapistById = new Map();
  for (const t of [...(therapistsByUserRes.data || []), ...(therapistsByIdRes.data || [])]) {
    if (t.user_id) therapistByUser.set(t.user_id, t);
    if (t.therapist_id) therapistById.set(t.therapist_id, t);
  }

  return { parentByUser, parentById, therapistByUser, therapistById };
}

const EMPTY_SUBJECT = {
  subject_name: null,
  subject_email: null,
  subject_role: null,
  parent_id: null,
  therapist_id: null,
  subject_user_id: null,
  subject_is_suspended: null,
  can_suspend: false,
  can_reactivate: false,
};

function subjectFromParent(parent, userId = null) {
  if (!parent) return { ...EMPTY_SUBJECT };
  const isSuspended = Boolean(parent.is_suspended);
  const parentId = parent.parent_id ?? null;
  return {
    subject_name: parent.full_name ?? null,
    subject_email: parent.email ?? null,
    subject_role: 'parent',
    parent_id: parentId,
    therapist_id: null,
    subject_user_id: parent.user_id ?? userId ?? null,
    subject_is_suspended: isSuspended,
    can_suspend: Boolean(parentId) && !isSuspended,
    can_reactivate: Boolean(parentId) && isSuspended,
  };
}

function subjectFromTherapist(therapist, userId = null) {
  if (!therapist) return { ...EMPTY_SUBJECT };
  const isSuspended = Boolean(therapist.is_suspended);
  const therapistId = therapist.therapist_id ?? null;
  return {
    subject_name: therapist.full_name ?? null,
    subject_email: therapist.email ?? null,
    subject_role: 'therapist',
    parent_id: null,
    therapist_id: therapistId,
    subject_user_id: therapist.user_id ?? userId ?? null,
    subject_is_suspended: isSuspended,
    can_suspend: Boolean(therapistId) && !isSuspended,
    can_reactivate: Boolean(therapistId) && isSuspended,
  };
}

function subjectFromMeta(enrichedMeta, role) {
  return {
    subject_name: enrichedMeta.user_name || null,
    subject_email: enrichedMeta.user_email || null,
    subject_role: role,
    parent_id: null,
    therapist_id: null,
    subject_user_id: enrichedMeta.user_id ?? null,
    subject_is_suspended: null,
    can_suspend: false,
    can_reactivate: false,
  };
}

function resolveSubject(eventType, meta, targetTable, targetId, maps, reportUserMap = new Map()) {
  if (!USER_SUBJECT_EVENTS.has(eventType)) {
    return { ...EMPTY_SUBJECT };
  }

  const enrichedMeta = { ...meta };
  if (!enrichedMeta.user_id && enrichedMeta.report_id && reportUserMap.has(enrichedMeta.report_id)) {
    enrichedMeta.user_id = reportUserMap.get(enrichedMeta.report_id);
  }

  const { parentByUser, parentById, therapistByUser, therapistById } = maps;

  if (enrichedMeta.user_name || enrichedMeta.user_email) {
    let role = enrichedMeta.subject_role || null;
    const userId = enrichedMeta.user_id || null;
    if (!role && userId) {
      if (therapistByUser.has(userId)) role = 'therapist';
      else if (parentByUser.has(userId)) role = 'parent';
    }
    if (!role && eventType === 'therapist_suspended') role = 'therapist';
    if (!role && eventType.startsWith('parent_')) role = 'parent';

    if (role === 'parent' && userId && parentByUser.has(userId)) {
      return subjectFromParent(parentByUser.get(userId), userId);
    }
    if (role === 'therapist' && userId && therapistByUser.has(userId)) {
      return subjectFromTherapist(therapistByUser.get(userId), userId);
    }

    return subjectFromMeta(enrichedMeta, role);
  }

  if (eventType === 'therapist_suspended' && targetId) {
    const therapist = therapistById.get(targetId);
    if (therapist) return subjectFromTherapist(therapist);
  }

  if (eventType.startsWith('parent_') && targetId) {
    const parent = parentById.get(String(targetId));
    if (parent) return subjectFromParent(parent);
  }

  const userId = enrichedMeta.user_id || (targetTable === 'parents' ? targetId : null);
  if (userId) {
    const parent = parentByUser.get(userId);
    if (parent) return subjectFromParent(parent, userId);
    const therapist = therapistByUser.get(userId);
    if (therapist) return subjectFromTherapist(therapist, userId);
  }

  return { ...EMPTY_SUBJECT };
}

function subjectRoleLabel(role) {
  if (role === 'therapist') return 'Therapist';
  if (role === 'parent') return 'Parent';
  return null;
}

/** GET /api/admin/logs/moderation — unified moderation history for admins. */
export async function listModerationLog(req, res) {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const actionFilter = String(req.query.action || '').trim();
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);

    let auditQuery = supabase
      .from('audit_log')
      .select('id, event_type, actor_id, target_table, target_id, metadata, created_at')
      .in('event_type', MODERATION_AUDIT_EVENTS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionFilter) {
      auditQuery = auditQuery.eq('event_type', actionFilter);
    }
    if (dateFrom) {
      auditQuery = auditQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        auditQuery = auditQuery.lte('created_at', end.toISOString());
      }
    }

    const warningsQuery = supabase
      .from('user_warnings')
      .select('id, user_id, admin_id, report_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const [auditRes, warningsRes] = await Promise.all([auditQuery, warningsQuery]);
    if (auditRes.error) throw auditRes.error;
    if (warningsRes.error) throw warningsRes.error;

    const auditRows = auditRes.data || [];
    const warningRows = warningsRes.data || [];

    function warningCoveredByAudit(w) {
      if (
        w.report_id &&
        auditRows.some(
          (a) =>
            a.event_type === 'report_warn_user' &&
            String(a.metadata?.report_id) === String(w.report_id),
        )
      ) {
        return true;
      }
      const warnTime = new Date(w.created_at).getTime();
      return auditRows.some((a) => {
        if (a.event_type !== 'community_user_warned') return false;
        if (String(a.metadata?.user_id) !== String(w.user_id)) return false;
        const auditTime = new Date(a.created_at).getTime();
        return Math.abs(auditTime - warnTime) < 10_000;
      });
    }

    const adminIds = new Set();
    for (const row of auditRows) {
      const aid = row.metadata?.admin_id;
      if (aid != null) adminIds.add(aid);
    }
    for (const row of warningRows) {
      if (row.admin_id != null) adminIds.add(row.admin_id);
    }

    const userIds = [...new Set(warningRows.map((w) => w.user_id).filter(Boolean))];

    const subjectKeys = collectSubjectLookupKeys(auditRows, warningRows);
    for (const id of userIds) {
      if (!subjectKeys.userIds.includes(id)) subjectKeys.userIds.push(id);
    }

    const reportUserMap = await buildReportAuthorUserMap(auditRows);
    for (const uid of reportUserMap.values()) {
      if (!subjectKeys.userIds.includes(uid)) subjectKeys.userIds.push(uid);
    }

    const [adminsRes, subjectMaps] = await Promise.all([
      adminIds.size
        ? supabase
            .from('admins')
            .select('admin_id, full_name, first_name, last_name, email')
            .in('admin_id', [...adminIds])
        : { data: [], error: null },
      loadSubjectMaps(subjectKeys),
    ]);

    if (adminsRes.error) throw adminsRes.error;

    const adminMap = new Map((adminsRes.data || []).map((a) => [a.admin_id, a]));

    const fromWarnings = warningRows
      .filter((w) => !actionFilter || actionFilter === 'user_warning')
      .filter((w) => !warningCoveredByAudit(w))
      .map((w) => {
        const admin = w.admin_id ? adminMap.get(w.admin_id) : null;
        const subject = resolveSubject(
          'user_warning',
          { user_id: w.user_id },
          'parents',
          w.user_id,
          subjectMaps,
          reportUserMap,
        );
        return {
          log_id: `warning-${w.id}`,
          source: 'user_warnings',
          event_type: 'user_warning',
          action_label: moderationActionLabel('user_warning'),
          admin_id: w.admin_id,
          admin_name: adminDisplayName(admin),
          target_label: 'User account',
          subject_name: subject.subject_name,
          subject_email: subject.subject_email,
          subject_role: subject.subject_role,
          subject_role_label: subjectRoleLabel(subject.subject_role),
          parent_id: subject.parent_id,
          therapist_id: subject.therapist_id,
          subject_user_id: subject.subject_user_id,
          subject_is_suspended: subject.subject_is_suspended,
          can_suspend: subject.can_suspend,
          can_reactivate: subject.can_reactivate,
          details: w.reason || '—',
          report_id: w.report_id,
          created_at: w.created_at,
        };
      });

    const fromAudit = auditRows.map((row) => {
      const adminId = row.metadata?.admin_id;
      const admin = adminId != null ? adminMap.get(adminId) : null;
      const meta = row.metadata || {};
      const subject = resolveSubject(
        row.event_type,
        meta,
        row.target_table,
        row.target_id,
        subjectMaps,
        reportUserMap,
      );
      return {
        log_id: row.id,
        source: 'audit_log',
        event_type: row.event_type,
        action_label: moderationActionLabel(row.event_type),
        admin_id: adminId ?? null,
        admin_name: adminDisplayName(admin),
        target_label: buildTargetLabel(row),
        subject_name: subject.subject_name,
        subject_email: subject.subject_email,
        subject_role: subject.subject_role,
        subject_role_label: subjectRoleLabel(subject.subject_role),
        parent_id: subject.parent_id,
        therapist_id: subject.therapist_id,
        subject_user_id: subject.subject_user_id,
        subject_is_suspended: subject.subject_is_suspended,
        can_suspend: subject.can_suspend,
        can_reactivate: subject.can_reactivate,
        details: buildDetails(row),
        report_id: meta.report_id || null,
        created_at: row.created_at,
      };
    });

    let rows = [...fromAudit, ...fromWarnings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    if (search) {
      rows = rows.filter((row) => {
        const blob = [
          row.action_label,
          row.admin_name,
          row.target_label,
          row.subject_name,
          row.subject_email,
          row.subject_role_label,
          row.details,
          row.event_type,
          row.report_id,
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(search);
      });
    }

    rows = rows.slice(0, limit);

    const actionOptions = [
      { value: 'user_warning', label: moderationActionLabel('user_warning') },
      ...MODERATION_AUDIT_EVENTS.map((value) => ({
        value,
        label: moderationActionLabel(value),
      })),
    ];

    return res.json({
      rows,
      action_options: actionOptions,
      total: rows.length,
    });
  } catch (err) {
    console.error('[listModerationLog]', err);
    return res.status(500).json({ message: err.message || 'Failed to load moderation log.' });
  }
}
