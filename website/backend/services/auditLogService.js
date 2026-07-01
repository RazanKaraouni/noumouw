import supabase from '../config/supabase.js';

// SERVICE ROLE: audit_log is server-written only (no admin UI; Moderation Log uses separate API).

const THERAPIST_AUDIT_EVENTS = new Set([
  'therapist_created',
  'therapist_approved',
  'therapist_suspended',
  'therapist_unsuspended',
]);

/**
 * @param {{
 *   event_type: string,
 *   actor_id?: string | null,
 *   target_table?: string | null,
 *   target_id?: string | null,
 *   metadata?: Record<string, unknown>,
 * }} entry
 */
export async function writeAuditLog(entry) {
  const eventType = String(entry?.event_type || '').trim();
  if (!eventType) return;

  const payload = {
    event_type: eventType,
    actor_id: entry.actor_id ? String(entry.actor_id) : null,
    target_table: entry.target_table ? String(entry.target_table) : null,
    target_id: entry.target_id != null ? String(entry.target_id) : null,
    metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
  };

  const { error } = await supabase.from('audit_log').insert(payload);
  if (error) {
    console.error('[auditLog]', eventType, error.message || error);
  }
}

export async function logTherapistAudit({
  eventType,
  actorUserId,
  targetUserId,
  therapistEmail,
  reason,
  extraMetadata,
}) {
  if (!THERAPIST_AUDIT_EVENTS.has(eventType)) return;

  const metadata = {
    ...(extraMetadata && typeof extraMetadata === 'object' ? extraMetadata : {}),
  };
  if (therapistEmail) metadata.therapist_email = String(therapistEmail).trim().toLowerCase();
  if (reason) metadata.reason = String(reason).trim();

  const therapistId = metadata.therapist_id ? String(metadata.therapist_id) : null;

  await writeAuditLog({
    event_type: eventType,
    actor_id: null,
    target_table: therapistId ? 'therapists' : null,
    target_id: therapistId || (targetUserId ? String(targetUserId) : null),
    metadata: {
      ...metadata,
      admin_id: actorUserId != null ? actorUserId : null,
      target_user_id: targetUserId ? String(targetUserId) : null,
    },
  });
}
