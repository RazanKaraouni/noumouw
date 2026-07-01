import nodemailer from 'nodemailer';

export const NOUMOUW_PLATFORM_NAME = 'Noumouw Platform';
/** Matches AppColors.primary (AuthSplashScreen gradient start). */
export const NOUMOUW_BRAND_PRIMARY = '#2A5F5F';
/** Matches AppColors.green (AuthSplashScreen gradient end). */
export const NOUMOUW_BRAND_GREEN = '#1D9E75';

/** Inline CSS for the brand gradient with solid-color fallback for older clients. */
export function brandGradientBackgroundStyle() {
  return `background-color:${NOUMOUW_BRAND_PRIMARY};background-image:linear-gradient(135deg, ${NOUMOUW_BRAND_PRIMARY} 0%, ${NOUMOUW_BRAND_GREEN} 100%);`;
}

const BRAND_GRADIENT_STYLE = brandGradientBackgroundStyle();
const TEXT_PRIMARY = '#1A1A18';
const TEXT_MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const SURFACE = '#F9FAFB';

export function getSmtpAddress() {
  return String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
}

/** Display name in inbox: "Noumouw Platform" with the configured SMTP address (e.g. razanuni255@gmail.com). */
export function getNoumouwFromAddress() {
  const address = getSmtpAddress();
  if (!address) return `"${NOUMOUW_PLATFORM_NAME}"`;
  if (address.includes('<') && address.includes('>')) return address;
  return `"${NOUMOUW_PLATFORM_NAME}" <${address}>`;
}

export function getResendFromAddress() {
  const address = String(process.env.EMAIL_FROM || getSmtpAddress() || '').trim();
  if (!address) return `${NOUMOUW_PLATFORM_NAME} <onboarding@resend.dev>`;
  if (address.includes('<') && address.includes('>')) return address;
  return `${NOUMOUW_PLATFORM_NAME} <${address}>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const CALLOUT_STYLES = {
  info: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
  danger: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' },
};

/** Branded HTML wrapper for user-facing transactional emails. */
export function renderNoumouwEmail({
  title,
  greeting,
  paragraphs = [],
  detailRows = [],
  callout,
  ctaButton,
  footerNote,
}) {
  const safeTitle = escapeHtml(title || 'Noumouw');
  const greetingBlock = greeting
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXT_PRIMARY};text-align:center;">${escapeHtml(greeting)}</p>`
    : '';

  const paragraphBlocks = paragraphs
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT_PRIMARY};text-align:center;">${escapeHtml(p)}</p>`,
    )
    .join('');

  const detailBlock =
    detailRows.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px auto;border-collapse:collapse;background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
          ${detailRows
            .map(
              ({ label, value }) =>
                `<tr>
                  <td style="padding:12px 16px;font-size:13px;font-weight:600;color:${TEXT_MUTED};width:38%;border-bottom:1px solid ${BORDER};vertical-align:top;text-align:center;">${escapeHtml(label)}</td>
                  <td style="padding:12px 16px;font-size:14px;color:${TEXT_PRIMARY};border-bottom:1px solid ${BORDER};vertical-align:top;text-align:center;">${escapeHtml(value)}</td>
                </tr>`,
            )
            .join('')}
        </table>`
      : '';

  let calloutBlock = '';
  if (callout?.text) {
    const tone = CALLOUT_STYLES[callout.tone] || CALLOUT_STYLES.info;
    calloutBlock = `<div style="margin:20px auto;padding:14px 16px;border-radius:12px;background:${tone.bg};border:1px solid ${tone.border};color:${tone.color};font-size:14px;line-height:1.6;text-align:center;">${callout.text}</div>`;
  }

  const ctaBlock =
    ctaButton?.href && ctaButton?.label
      ? `<p style="margin:24px 0 8px;text-align:center;">
          <a href="${escapeHtml(ctaButton.href)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;${BRAND_GRADIENT_STYLE}color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;">
            ${escapeHtml(ctaButton.label)}
          </a>
        </p>`
      : '';

  const footer =
    footerNote ||
    `This message was sent by ${NOUMOUW_PLATFORM_NAME}. If you believe this is an error, please contact our support team.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="${BRAND_GRADIENT_STYLE}padding:22px 28px;text-align:center;">
            <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Noumouw</div>
            <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.92);margin-top:2px;">${NOUMOUW_PLATFORM_NAME}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;text-align:center;">
            <h1 style="margin:0 0 18px;font-size:20px;font-weight:700;color:${TEXT_PRIMARY};line-height:1.35;text-align:center;">${safeTitle}</h1>
            ${greetingBlock}
            ${paragraphBlocks}
            ${detailBlock}
            ${calloutBlock}
            ${ctaBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:${SURFACE};border-top:1px solid ${BORDER};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:${TEXT_MUTED};text-align:center;">
            ${escapeHtml(footer)}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendSmtpMail({ to, subject, text, html }) {
  if (!to) return false;
  const transporter = buildSmtpTransporter();
  if (!transporter) return false;
  await transporter.sendMail({
    from: getNoumouwFromAddress(),
    to,
    subject,
    text,
    html,
  });
  return true;
}
