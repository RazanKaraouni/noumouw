import axios from 'axios';

let cachedToken = null;
let tokenExpiresAt = 0;

function hasZoomCredentials() {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}

export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { data } = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    null,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

/**
 * Server-to-Server OAuth scheduled meeting (type 2).
 * @returns {{ id: string, join_url: string, start_url: string, password: string|null }|null}
 */
export async function createZoomMeeting({ topic, startTime, duration, timezone }) {
  if (!hasZoomCredentials()) {
    console.warn('⚠️  Zoom credentials not configured. Skipping meeting creation.');
    return null;
  }
  const token = await getAccessToken();
  const { data } = await axios.post(
    'https://api.zoom.us/v2/users/me/meetings',
    {
      topic: topic || 'Therapy Session',
      type: 2,
      start_time: startTime,
      duration: duration || 60,
      timezone: timezone || process.env.ZOOM_TIMEZONE || 'Asia/Beirut',
      settings: {
        join_before_host: true,
        waiting_room: false,
        auto_recording: 'none',
        mute_upon_entry: true,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return {
    id: String(data.id),
    join_url: data.join_url,
    start_url: data.start_url,
    password: data.password || null,
  };
}

/** @deprecated Use createZoomMeeting */
export async function createMeeting(params) {
  return createZoomMeeting(params);
}

/**
 * PATCH meeting schedule (reschedule).
 * @returns {Promise<boolean>}
 */
export async function updateZoomMeeting(meetingId, { topic, startTime, duration, timezone }) {
  if (!hasZoomCredentials()) {
    console.warn('⚠️  Zoom credentials not configured. Skipping meeting update.');
    return false;
  }
  if (!meetingId) return false;
  const token = await getAccessToken();
  const res = await axios.patch(
    `https://api.zoom.us/v2/meetings/${meetingId}`,
    {
      topic: topic || 'Therapy Session',
      start_time: startTime,
      duration: duration || 60,
      timezone: timezone || process.env.ZOOM_TIMEZONE || 'Asia/Beirut',
      settings: { join_before_host: true },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    },
  );
  if (res.status === 204) return true;
  const body =
    typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? res.statusText);
  throw new Error(body || `Zoom PATCH failed with status ${res.status}`);
}

export async function deleteMeeting(meetingId) {
  if (!meetingId) return false;
  if (!hasZoomCredentials()) {
    console.warn('⚠️  Zoom credentials not configured. Skipping meeting deletion.');
    return false;
  }
  try {
    const token = await getAccessToken();
    await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch {
    return false;
  }
}

const ZOOM_CLEARED_FIELDS = {
  zoom_meeting_id: null,
  zoom_join_url: null,
  zoom_start_url: null,
  zoom_password: null,
};

/**
 * Delete Zoom meeting and return DB fields to null out (empty object if delete fails).
 */
export async function clearZoomMeetingFields(zoomMeetingId) {
  if (!zoomMeetingId) return {};
  try {
    const deleted = await deleteMeeting(zoomMeetingId);
    if (deleted) return { ...ZOOM_CLEARED_FIELDS };
    console.warn(`⚠️  Zoom deleteMeeting returned false for meeting ${zoomMeetingId}`);
  } catch (err) {
    console.warn('⚠️  Zoom deleteMeeting failed:', err?.message || err);
  }
  return {};
}

export function isTerminalZoomClearStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['cancelled', 'rejected', 'cancellation_requested'].includes(s);
}
