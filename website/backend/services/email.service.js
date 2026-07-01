import { Resend } from 'resend';
import {
  brandGradientBackgroundStyle,
  escapeHtml,
  getResendFromAddress,
  renderNoumouwEmail,
  sendSmtpMail,
} from './mailService.js';

let _resendClient = null;

function getResendClient() {
  const key = process.env.EMAIL_API_KEY?.trim();
  if (!key) return null;
  if (!_resendClient) _resendClient = new Resend(key);
  return _resendClient;
}

function formatDateTime(startTime, timezone) {
  const date = new Date(startTime);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || 'UTC',
  });
}

/** Reusable Zoom join button block for appointment emails. */
export function zoomJoinEmailSection(joinUrl) {
  const safeUrl = escapeHtml(joinUrl);
  return `<p style="margin:24px 0;text-align:center;">
    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;${brandGradientBackgroundStyle()}color:#fff;padding:14px 28px;text-decoration:none;border-radius:10px;font-size:16px;font-weight:700;">
      Join Zoom Meeting
    </a>
  </p>`;
}

/**
 * Parent appointment decision email (SMTP). Optional zoomJoinUrl for confirmed sessions.
 */
export async function sendParentDecisionEmail(
  { toEmail, parentName, therapistName, appointmentDate, appointmentTime, childName, action },
  zoomJoinUrl = null,
) {
  if (!toEmail) return false;

  const isConfirmed = action === 'confirmed';
  const decisionText = isConfirmed ? 'confirmed' : 'cancelled';
  const safeParent = parentName || 'Parent';
  const safeTherapist = therapistName || 'your therapist';
  const safeDate = appointmentDate || 'Unknown date';
  const safeTime = appointmentTime || 'Unknown time';
  const safeChild = childName || 'your child';

  const text = `Hello ${safeParent}, your appointment is ${decisionText} with ${safeTherapist} on ${safeDate} at ${safeTime} for ${safeChild}.${
    isConfirmed && zoomJoinUrl ? `\n\nJoin your Zoom session: ${zoomJoinUrl}` : ''
  }`;

  const joinUrl = isConfirmed && zoomJoinUrl ? String(zoomJoinUrl).trim() : '';
  const html = renderNoumouwEmail({
    title: isConfirmed ? 'Appointment confirmed' : 'Appointment cancelled',
    greeting: `Hello ${safeParent},`,
    paragraphs: [`Your appointment has been ${decisionText}.`],
    detailRows: [
      { label: 'Therapist', value: safeTherapist },
      { label: 'Date', value: safeDate },
      { label: 'Time', value: safeTime },
      { label: 'Child', value: safeChild },
    ],
    ctaButton: joinUrl ? { label: 'Join Zoom Meeting', href: joinUrl } : undefined,
    footerNote: joinUrl
      ? 'The Zoom link becomes active at your appointment time.'
      : undefined,
  });

  return sendSmtpMail({
    to: toEmail,
    subject: `Appointment ${isConfirmed ? 'Confirmed' : 'Cancelled'}`,
    text,
    html,
  });
}

export async function sendConfirmationEmail({
  parentEmail,
  parentName,
  childName,
  startTime,
  duration,
  joinUrl,
  password,
  timezone,
}) {
  const formatted = formatDateTime(startTime, timezone);
  const therapistEmail = process.env.THERAPIST_EMAIL;
  const safeParent = parentName || 'Parent';
  const safeChild = childName || 'your child';

  const passwordRow = password
    ? [{ label: 'Meeting password', value: String(password) }]
    : [];

  const html = renderNoumouwEmail({
    title: `Appointment confirmed for ${safeChild}`,
    greeting: `Hello ${safeParent},`,
    paragraphs: ['Your session has been confirmed. Here are the details:'],
    detailRows: [
      { label: 'Child', value: safeChild },
      { label: 'When', value: formatted },
      { label: 'Duration', value: `${duration} minutes` },
      ...passwordRow,
    ],
    ctaButton: joinUrl ? { label: 'Join Zoom Meeting', href: joinUrl } : undefined,
    footerNote:
      'The therapist will receive this link as well. The link becomes active at your appointment time.',
  });

  const resend = getResendClient();
  if (!resend) {
    console.warn('sendConfirmationEmail skipped: EMAIL_API_KEY not configured.');
    return false;
  }

  const recipients = [parentEmail, therapistEmail].filter(Boolean);
  await resend.emails.send({
    from: getResendFromAddress(),
    to: recipients,
    subject: `Appointment confirmed for ${safeChild}`,
    html,
  });
  return true;
}

/** OTP / verification code email for signup and password reset. */
export async function sendOtpEmail(toEmail, otpCode, { subject, intro } = {}) {
  const emailSubject = subject || 'Your verification code';
  const emailIntro = intro || 'Your verification code is';
  const safeCode = escapeHtml(otpCode);

  const text = `${emailIntro} ${otpCode}. It expires in 60 seconds.`;
  const html = renderNoumouwEmail({
    title: emailSubject,
    greeting: 'Hello,',
    paragraphs: [emailIntro],
    callout: {
      tone: 'info',
      text: `<span style="font-size:28px;font-weight:700;letter-spacing:0.2em;">${safeCode}</span>`,
    },
    footerNote: 'This code expires in 60 seconds. If you did not request it, you can ignore this email.',
  });

  const sent = await sendSmtpMail({ to: toEmail, subject: emailSubject, text, html });
  if (!sent) throw new Error('SMTP credentials are not configured.');
  return sent;
}

/** Therapist notification when a parent books an appointment. */
export async function sendTherapistBookingEmail({
  therapistEmail,
  therapistName,
  parentName,
  appointmentDate,
  startTime,
  endTime,
}) {
  if (!therapistEmail) return false;

  const safeTherapist = therapistName || 'Therapist';
  const safeParent = parentName || 'A parent';
  const safeDate = appointmentDate || 'Unknown date';
  const safeStart = (startTime || '').slice(0, 5) || '--:--';
  const safeEnd = (endTime || '').slice(0, 5) || '--:--';

  const text = `${safeParent} requested an appointment on ${safeDate} from ${safeStart} to ${safeEnd}. Please review and confirm this appointment in your dashboard.`;
  const html = renderNoumouwEmail({
    title: 'New appointment request',
    greeting: `Hello ${safeTherapist},`,
    paragraphs: [
      `${safeParent} requested an appointment and is waiting for your confirmation.`,
    ],
    detailRows: [
      { label: 'Parent', value: safeParent },
      { label: 'Date', value: safeDate },
      { label: 'Time', value: `${safeStart} – ${safeEnd}` },
    ],
    footerNote: 'Please open your Noumouw dashboard to review and confirm this appointment.',
  });

  return sendSmtpMail({
    to: therapistEmail,
    subject: 'New appointment request pending your confirmation',
    text,
    html,
  });
}

/** Therapist notification when a parent requests cancellation. */
export async function sendTherapistCancellationRequestEmail({
  therapistEmail,
  therapistName,
  parentName,
  parentEmail,
  appointmentDate,
  startTime,
  endTime,
  childName,
}) {
  if (!therapistEmail) return false;

  const safeTherapist = therapistName || 'Therapist';
  const safeParent = parentName || 'A parent';
  const safeDate = appointmentDate || 'Unknown date';
  const safeStart = (startTime || '').slice(0, 5) || '--:--';
  const safeEnd = (endTime || '').slice(0, 5) || '--:--';
  const safeChild = childName || 'the child';
  const parentContact = parentEmail ? ` (${parentEmail})` : '';

  const text = `${safeParent}${parentContact} requested to cancel the appointment on ${safeDate} from ${safeStart} to ${safeEnd} for ${safeChild}. Please review and confirm the cancellation in your Noumouw dashboard.`;
  const html = renderNoumouwEmail({
    title: 'Cancellation request',
    greeting: `Hello ${safeTherapist},`,
    paragraphs: [`${safeParent}${parentContact} requested to cancel an appointment.`],
    detailRows: [
      { label: 'Parent', value: `${safeParent}${parentContact}` },
      { label: 'Date', value: safeDate },
      { label: 'Time', value: `${safeStart} – ${safeEnd}` },
      { label: 'Child', value: safeChild },
    ],
    footerNote: 'Please open your Appointments page and approve the cancellation.',
  });

  return sendSmtpMail({
    to: therapistEmail,
    subject: 'Parent requested appointment cancellation',
    text,
    html,
  });
}
