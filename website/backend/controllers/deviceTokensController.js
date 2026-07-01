import supabase from '../config/supabase.js';
import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

const PLATFORMS = new Set(['android', 'ios', 'web']);

async function upsertDeviceToken(userId, token, platform) {
  // Same physical device may register under a new account; drop stale owner first.
  await supabase.from('device_tokens').delete().eq('token', token);

  return supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    )
    .select('device_token_id, user_id, platform, updated_at')
    .maybeSingle();
}

function resolveAuthUserId(req) {
  return getParentUserId(req) || req.auth?.userId || null;
}

/** POST /api/device-tokens — register or refresh an FCM device token. */
export async function registerDeviceToken(req, res) {
  try {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || '').trim().toLowerCase();

    if (!token) {
      return res.status(400).json({ message: 'token is required.' });
    }
    if (!PLATFORMS.has(platform)) {
      return res.status(400).json({
        message: 'platform must be one of: android, ios, web.',
      });
    }

    const { data, error } = await upsertDeviceToken(userId, token, platform);
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      deviceTokenId: data?.device_token_id || null,
      platform: data?.platform || platform,
      updatedAt: data?.updated_at || null,
    });
  } catch (err) {
    console.error('[registerDeviceToken]', err);
    return sendErrorResponse(res, err, 500);
  }
}

/** POST /api/save-token — alias used by the mobile app ({ token } in body). */
export async function saveDeviceToken(req, res) {
  try {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = String(req.body?.token || '').trim();
    const platformRaw = String(req.body?.platform || 'android').trim().toLowerCase();
    const platform = PLATFORMS.has(platformRaw) ? platformRaw : 'android';

    if (!token) {
      return res.status(400).json({ message: 'token is required.' });
    }

    const { error } = await upsertDeviceToken(userId, token, platform);
    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('[saveDeviceToken]', err);
    return sendErrorResponse(res, err, 500);
  }
}