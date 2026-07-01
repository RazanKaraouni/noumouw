import supabase from '../config/supabase.js';
import { getMessaging, initFirebaseAdmin, isFirebaseAdminReady } from '../config/firebaseAdmin.js';

/**
 * Server-side FCM helper (mirrors mobile `FcmService`).
 * Reads tokens from `device_tokens` and sends push notifications.
 */
class FcmService {
  static #instance = new FcmService();

  static get instance() {
    return FcmService.#instance;
  }

  constructor() {
    initFirebaseAdmin();
  }

  /** All FCM tokens registered for a user (auth.users id). */
  async getDeviceTokens(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return [];

    const { data, error } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', uid);

    if (error) throw error;

    return (data || [])
      .map((row) => String(row.token || '').trim())
      .filter(Boolean);
  }

  /** Primary token for a user (first registered device). */
  async getDeviceToken(userId) {
    const tokens = await this.getDeviceTokens(userId);
    return tokens[0] || null;
  }

  /**
   * Send a push notification to one raw FCM token.
   * @param {string} deviceToken
   * @param {{ title: string, body: string, data?: Record<string, string> }} payload
   */
  async sendToDeviceToken(deviceToken, { title, body, data = {} }) {
    const token = String(deviceToken || '').trim();
    if (!token) {
      return { sent: 0, failed: 0, skipped: true, reason: 'empty_token' };
    }
    if (!isFirebaseAdminReady()) {
      return {
        sent: 0,
        failed: 0,
        skipped: true,
        reason: 'firebase_admin_not_configured',
      };
    }

    const messaging = getMessaging();
    const messageId = await messaging.send(
      this.#buildSingleMessage(token, { title, body, data }),
    );

    return { sent: 1, failed: 0, messageId };
  }

  /**
   * Send a push to every device token for a user.
   * @param {string} userId auth.users id
   */
  async sendToUser(userId, { title, body, data = {} }) {
    const tokens = await this.getDeviceTokens(userId);
    if (!tokens.length) {
      return { sent: 0, failed: 0, skipped: true, reason: 'no_device_tokens' };
    }
    if (!isFirebaseAdminReady()) {
      return {
        sent: 0,
        failed: 0,
        skipped: true,
        reason: 'firebase_admin_not_configured',
      };
    }

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(
      this.#buildMulticastMessage(tokens, { title, body, data }),
    );

    await this.#pruneInvalidTokens(tokens, response.responses);

    return {
      sent: response.successCount,
      failed: response.failureCount,
      tokens: tokens.length,
    };
  }

  #stringifyData(data) {
    return Object.fromEntries(
      Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')]),
    );
  }

  #buildMulticastMessage(tokens, { title, body, data = {} }) {
    return {
      tokens,
      notification: { title, body },
      data: this.#stringifyData(data),
      android: {
        priority: 'high',
        notification: {
          channelId: 'noumouw_push',
          priority: 'high',
          defaultSound: true,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
  }

  #buildSingleMessage(token, { title, body, data = {} }) {
    return {
      token,
      notification: { title, body },
      data: this.#stringifyData(data),
      android: {
        priority: 'high',
        notification: {
          channelId: 'noumouw_push',
          priority: 'high',
          defaultSound: true,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
  }

  async #pruneInvalidTokens(tokens, responses) {
    const stale = [];
    responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        stale.push(tokens[index]);
      }
    });

    if (!stale.length) return;

    const { error } = await supabase.from('device_tokens').delete().in('token', stale);
    if (error) {
      console.error('[FcmService] failed to prune stale tokens:', error.message);
    } else {
      console.log('[FcmService] pruned stale tokens:', stale.length);
    }
  }
}

export default FcmService;
