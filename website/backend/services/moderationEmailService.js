import {
  escapeHtml,
  renderNoumouwEmail,
  sendSmtpMail,
} from './mailService.js';


export function sendModerationWarningEmail({ toEmail, reason }) {
  Promise.resolve()
    .then(async () => {
      const safeReason = String(reason || '').trim() || 'Moderation warning';
      const text = `You received a warning from Noumouw moderation.\n\nReason: ${safeReason}\n\nRepeated violations may lead to account suspension.`;
      const html = renderNoumouwEmail({
        title: 'Community warning',
        greeting: 'Hello,',
        paragraphs: [
          'You received a warning from Noumouw moderation regarding content linked to your account.',
        ],
        callout: {
          tone: 'warning',
          text: `<strong>Reason:</strong> ${escapeHtml(safeReason)}`,
        },
        footerNote: 'Repeated violations may lead to account suspension.',
      });
      await sendSmtpMail({
        to: toEmail,
        subject: 'Noumouw community warning',
        text,
        html,
      });
    })
    .catch((err) => {
      console.error('[moderationEmail] warning email failed:', err?.message || err);
    });
}

/**
 * Fire-and-forget suspension notice (do not await in request handlers).
 */
export function sendAccountSuspensionWarningEmail({ toEmail, reason }) {
  Promise.resolve()
    .then(async () => {
      const safeReason = String(reason || '').trim() || 'Moderation action';
      const text = `Your Noumouw account has been permanently suspended.\n\nReason: ${safeReason}\n\nIf you believe this is an error, contact Noumouw Platform support.`;
      const html = renderNoumouwEmail({
        title: 'Account suspended',
        greeting: 'Hello,',
        paragraphs: [
          'Your Noumouw account has been permanently suspended and you will no longer be able to sign in or use parent features.',
        ],
        callout: {
          tone: 'danger',
          text: `<strong>Reason:</strong> ${escapeHtml(safeReason)}`,
        },
        footerNote: 'If you believe this is an error, please contact Noumouw Platform support.',
      });
      await sendSmtpMail({
        to: toEmail,
        subject: 'Noumouw account suspension notice',
        text,
        html,
      });
    })
    .catch((err) => {
      console.error('[moderationEmail] suspension email failed:', err?.message || err);
    });
}

/**
 * Fire-and-forget account reactivation notice (do not await in request handlers).
 */
export function sendAccountReactivationEmail({ toEmail, userName, role = 'parent' }) {
  Promise.resolve()
    .then(async () => {
      if (!toEmail) return;
      const name = String(userName || '').trim() || 'there';
      const isTherapist = String(role || '').toLowerCase() === 'therapist';
      const accountLabel = isTherapist ? 'therapist account' : 'account';
      const text = `Hello ${name},\n\nYour Noumouw ${accountLabel} has been reactivated. You can sign in and use Noumouw again.\n\nIf you did not expect this change, please contact Noumouw Platform support.`;
      const html = renderNoumouwEmail({
        title: 'Account reactivated',
        greeting: `Hello ${name},`,
        paragraphs: [
          `Your Noumouw ${accountLabel} has been reactivated by our team.`,
          'You can sign in and use Noumouw again.',
        ],
        callout: {
          tone: 'info',
          text: 'Your access has been restored.',
        },
        footerNote:
          'If you did not expect this change, please contact Noumouw Platform support.',
      });
      await sendSmtpMail({
        to: toEmail,
        subject: 'Your Noumouw account has been reactivated',
        text,
        html,
      });
    })
    .catch((err) => {
      console.error('[moderationEmail] reactivation email failed:', err?.message || err);
    });
}
