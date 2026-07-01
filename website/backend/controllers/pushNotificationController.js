import { sendErrorResponse } from '../utils/errorFeedback.js';
import { getMessaging } from '../config/firebaseAdmin.js';
import {
  resolveParentUserIdForDeviceToken,
  therapistCanNotifyParentUser,
} from '../services/pushNotificationAuthService.js';

/**
 * POST /api/send-notification
 * Body: { token, title?, body? }
 * Admin or therapist only; therapists may notify parents on their caseload only.
 */
export async function sendPushNotification(req, res) {
  try {
    const role = String(req.auth?.role || '').toLowerCase();

    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ message: 'token is required.' });
    }

    if (role === 'therapist') {
      const therapistId = req.auth?.therapistId;
      const parentUserId = await resolveParentUserIdForDeviceToken(token);
      if (!parentUserId) {
        return res.status(403).json({ message: 'Access denied.' });
      }

      const allowed = await therapistCanNotifyParentUser({
        therapistId,
        parentUserId,
      });
      if (!allowed) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    const title = String(req.body?.title || 'Hello').trim();
    const body = String(req.body?.body || 'Test notification').trim();

    const messaging = getMessaging();
    const messageId = await messaging.send({
      token,
      notification: {
        title,
        body,
      },
    });

    return res.json({ success: true, messageId });
  } catch (err) {
    console.error('[sendPushNotification]', err);
    return sendErrorResponse(res, err, 500);
  }
}
