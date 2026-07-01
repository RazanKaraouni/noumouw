import supabase from '../config/supabase.js';
import { sendErrorResponse } from '../utils/errorFeedback.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function adminDisplayName(admin) {
  if (!admin) return '—';
  const parts = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim();
  return parts || admin.full_name || admin.email || '—';
}

/** GET /api/admin/logs/blocklist */
export async function listEmailBlocklist(req, res) {
  try {
    const { data, error } = await supabase
      .from('email_blocklist')
      .select('block_id, email, reason, banned_at')
      .order('banned_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('[listEmailBlocklist]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/admin/logs/blocklist */
export async function addEmailBlocklistEntry(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const reason = String(req.body?.reason || '').trim();
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Reason is required.' });
    }

    const { data, error } = await supabase
      .from('email_blocklist')
      .upsert({ email, reason }, { onConflict: 'email' })
      .select('block_id, email, reason, banned_at')
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    const msg = err.message || 'Failed to add email.';
    const status = /duplicate|unique/i.test(msg) ? 409 : 500;
    return res.status(status).json({ message: msg });
  }
}

/** DELETE /api/admin/logs/blocklist/:blockId */
export async function deleteEmailBlocklistEntry(req, res) {
  try {
    const { blockId } = req.params;
    const { data, error } = await supabase
      .from('email_blocklist')
      .delete()
      .eq('block_id', blockId)
      .select('block_id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Blocklist entry not found.' });
    }
    return res.json({ ok: true, block_id: blockId });
  } catch (err) {
    console.error('[deleteEmailBlocklistEntry]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** GET /api/admin/logs/warnings */
export async function listUserWarnings(req, res) {
  try {
    const { data, error } = await supabase
      .from('user_warnings')
      .select('id, user_id, admin_id, report_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = data || [];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean))];

    const [parentsRes, adminsRes] = await Promise.all([
      userIds.length
        ? supabase
            .from('parents')
            .select('user_id, full_name, email')
            .in('user_id', userIds)
        : { data: [] },
      adminIds.length
        ? supabase
            .from('admins')
            .select('admin_id, first_name, last_name, email')
            .in('admin_id', adminIds)
        : { data: [] },
    ]);

    if (parentsRes.error) throw parentsRes.error;
    if (adminsRes.error) throw adminsRes.error;

    const parentMap = new Map((parentsRes.data || []).map((p) => [p.user_id, p]));
    const adminMap = new Map((adminsRes.data || []).map((a) => [a.admin_id, a]));

    const enriched = rows.map((row) => {
      const parent = parentMap.get(row.user_id);
      const admin = row.admin_id ? adminMap.get(row.admin_id) : null;
      return {
        ...row,
        warning_id: row.id,
        warned_user_name: parent?.full_name || '—',
        warned_user_email: parent?.email || '',
        admin_name: adminDisplayName(admin),
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error('[listUserWarnings]', err);
    return sendErrorResponse(res, err, 500);
  }
}
