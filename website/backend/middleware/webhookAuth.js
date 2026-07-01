/**
 * Validates inbound webhook requests using a shared secret.
 * Set CHAT_WEBHOOK_SECRET (or WEBHOOK_SECRET) in the environment.
 */
export function requireWebhookSecret(req, res, next) {
  const expected = process.env.CHAT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (!expected) {
    console.error('[webhook] CHAT_WEBHOOK_SECRET is not configured.');
    return res.status(503).json({ message: 'Webhook authentication is not configured.' });
  }

  const headerSecret = req.headers['x-webhook-secret'];
  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

  const provided = String(headerSecret || bearer || '').trim();
  if (!provided || provided !== expected) {
    return res.status(401).json({ message: 'Invalid webhook signature.' });
  }

  return next();
}
