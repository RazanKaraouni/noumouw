import * as communityService from '../services/communityService.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

const RESOLVE_ACTIONS = new Set(['dismissed', 'content_removed']);

/** GET /api/community/admin/reports/pending */
export async function listPendingCommunityReports(req, res) {
  try {
    const reports = await communityService.listPendingReportsForAdmin();
    return res.json(reports);
  } catch (err) {
    console.error('[listPendingCommunityReports]', err);
    return sendErrorResponse(res, err);
  }
}

/** PATCH /api/community/admin/reports/:reportId/resolve */
export async function resolveCommunityReport(req, res) {
  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!RESOLVE_ACTIONS.has(action)) {
      return res.status(400).json({
        error: "action must be 'dismissed' or 'content_removed'.",
      });
    }

    const updated = await communityService.resolveCommunityReport({
      reportId: req.params.reportId,
      action,
    });

    return res.json(updated);
  } catch (err) {
    console.error('[resolveCommunityReport]', err);
    return sendErrorResponse(res, err, err.status || 500);
  }
}
