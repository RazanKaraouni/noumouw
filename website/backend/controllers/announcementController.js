import {
  createAnnouncement,
  deleteAnnouncementById,
  listAnnouncements,
  targetAudienceLabel,
} from '../models/announcementModel.js';
import { getAdminId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

function withLabels(rows) {
  return (rows || []).map((row) => ({
    ...row,
    target_audience_label: targetAudienceLabel(row.target_audience),
  }));
}

/** GET /api/admin/announcements */
export async function listAdminAnnouncements(req, res) {
  try {
    const rows = await listAnnouncements();
    return res.json(withLabels(rows));
  } catch (err) {
    console.error('[listAdminAnnouncements]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/admin/announcements */
export async function createAdminAnnouncement(req, res) {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: 'Admin authentication required.' });
    }

    const { title, body, target_audience } = req.body || {};
    const row = await createAnnouncement({
      admin_id: adminId,
      title,
      body,
      target_audience,
    });

    return res.status(201).json({
      ...row,
      target_audience_label: targetAudienceLabel(row.target_audience),
    });
  } catch (err) {
    const raw = String(err?.message || '');
    const status = /required|Invalid/i.test(raw) ? 400 : 500;
    return sendErrorResponse(res, err, status);
  }
}

/** DELETE /api/admin/announcements/:announcementId */
export async function deleteAdminAnnouncement(req, res) {
  try {
    const { announcementId } = req.params;
    const ok = await deleteAnnouncementById(announcementId);
    if (!ok) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    return res.json({ ok: true, announcement_id: announcementId });
  } catch (err) {
    console.error('[deleteAdminAnnouncement]', err);
    return sendErrorResponse(res, err, 500);
  }
}
