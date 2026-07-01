import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { getAdminId } from '../utils/authContext.js';
import { writeModerationAudit, lookupSubjectByTherapistId } from '../services/moderationAuditService.js';
import { queueModerationNotification } from '../services/moderationNotifyService.js';
import { sendAccountReactivationEmail } from '../services/moderationEmailService.js';
import { clearSuspensionArtifacts } from '../services/accountReactivationService.js';
import bcrypt from 'bcryptjs';
import supabase from '../config/supabase.js';
import {
  validatePasswordStrength,
  PASSWORD_POLICY_MESSAGE,
} from '../utils/validation.js';
import {
  createTherapist,
  deleteTherapist,
  getAllTherapistsAdmin,
  getStats,
  reactivateTherapistById,
  suspendTherapistById,
  updateTherapist,
} from '../models/therapistModel.js';
import { logTherapistAudit } from '../services/auditLogService.js';
import { apiCache } from '../utils/ttlCache.js';

const ADMIN_THERAPISTS_CACHE_TTL_MS = 30_000;

function invalidateAdminTherapistsCache() {
  apiCache.invalidate('admin:therapists:list');
  apiCache.invalidate('therapists:directory');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_REGEX = /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s'.-]*$/;
const ADDRESS_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s,.'#/-]{3,}$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateTherapistName(name) {
  const value = String(name || '').trim();
  if (!value) return 'Full name is required.';
  if (/^\d+$/.test(value) || !FULL_NAME_REGEX.test(value)) {
    return 'Enter a valid full name using letters only.';
  }
  return null;
}

function validateTherapistAddress(address) {
  const value = String(address || '').trim();
  if (!value) return 'Address is required.';
  if (/^\d+$/.test(value) || !ADDRESS_REGEX.test(value)) {
    return 'Enter a valid address (include street or area name).';
  }
  return null;
}

function validateYearsOfExperience(years) {
  if (years == null || years === '') {
    return 'Choose years of experience.';
  }
  const n = Number(years);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    return 'Choose a valid years of experience value.';
  }
  return null;
}

const EDITABLE_FIELDS = [
  'full_name',
  'profession',
  'bio',
  'phone',
  'address',
  'years_of_experience',
  'online_consultation',
];

const DEFAULT_SPECIALIZATIONS = [
  { specialization_id: 1, specialization_name: 'Speech Therapy', description: null },
  { specialization_id: 2, specialization_name: 'Psychomotor Therapy', description: null },
];

export async function listSpecializations(req, res) {
  try {
    const { data, error } = await supabase
      .from('therapist_specializations')
      .select('specialization_id, specialization_name, description')
      .order('specialization_name', { ascending: true });

    if (error) {
      // Table optional — fall back to static profession list used by the admin UI.
      if (error.code === '42P01' || /therapist_specializations/i.test(error.message || '')) {
        return res.json(DEFAULT_SPECIALIZATIONS);
      }
      throw error;
    }
    return res.json(data?.length ? data : DEFAULT_SPECIALIZATIONS);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function listAdminTherapists(req, res) {
  try {
    const therapists = await apiCache.getOrSet(
      'admin:therapists:list',
      ADMIN_THERAPISTS_CACHE_TTL_MS,
      () => getAllTherapistsAdmin(),
    );
    return res.json(therapists);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function getTherapistStatsHandler(req, res) {
  try {
    const stats = await getStats();
    return res.json(stats);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function createAdminTherapist(req, res) {
  try {
    const {
      full_name,
      profession,
      bio,
      phone,
      address,
      years_of_experience,
      email,
      password,
    } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const name = String(full_name || '').trim();
    const prof = String(profession || '').trim();
    const addr = String(address || '').trim();

    if (!prof || !normalizedEmail) {
      return res.status(400).json({
        message: 'Profession and email are required.',
      });
    }

    const nameError = validateTherapistName(name);
    if (nameError) return res.status(400).json({ message: nameError });

    const addressError = validateTherapistAddress(addr);
    if (addressError) return res.status(400).json({ message: addressError });

    const yearsError = validateYearsOfExperience(years_of_experience);
    if (yearsError) return res.status(400).json({ message: yearsError });

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email address.' });
    }
    if (!password || !validatePasswordStrength(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const years = Number(years_of_experience);

    const therapist = await createTherapist({
      full_name: name,
      profession: prof,
      email: normalizedEmail,
      address: addr,
      password: passwordHash,
      bio: bio ? String(bio).trim() : null,
      phone: phone ? String(phone).trim() : null,
      years_of_experience: Number.isFinite(years) ? years : null,
      password_setup_token_hash: null,
      password_setup_expires_at: null,
      is_verified: true,
    });

    const actorId = getAdminId(req);
    const targetUserId = therapist?.user_id ? String(therapist.user_id) : null;
    void logTherapistAudit({
      eventType: 'therapist_created',
      actorUserId: actorId,
      targetUserId,
      therapistEmail: normalizedEmail,
      extraMetadata: { therapist_id: therapist?.therapist_id },
    });
    void logTherapistAudit({
      eventType: 'therapist_approved',
      actorUserId: actorId,
      targetUserId,
      therapistEmail: normalizedEmail,
      extraMetadata: { therapist_id: therapist?.therapist_id },
    });

    invalidateAdminTherapistsCache();
    return res.status(201).json(therapist);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'A therapist with this email already exists.' });
    }
    return sendErrorResponse(res, err, 500);
  }
}

export async function updateAdminTherapist(req, res) {
  try {
    const { therapist_id: therapistId } = req.params;
    const updates = {};
    for (const key of EDITABLE_FIELDS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.years_of_experience !== undefined) {
      const yearsError = validateYearsOfExperience(updates.years_of_experience);
      if (yearsError) return res.status(400).json({ message: yearsError });
      updates.years_of_experience = Number(updates.years_of_experience);
    }
    if (updates.online_consultation !== undefined) {
      updates.online_consultation = Boolean(updates.online_consultation);
    }
    if (updates.full_name != null) {
      updates.full_name = String(updates.full_name).trim();
      const nameError = validateTherapistName(updates.full_name);
      if (nameError) return res.status(400).json({ message: nameError });
    }
    if (updates.profession != null) updates.profession = String(updates.profession).trim();
    if (updates.bio != null) updates.bio = String(updates.bio).trim() || null;
    if (updates.phone != null) updates.phone = String(updates.phone).trim() || null;
    if (updates.address != null) {
      updates.address = String(updates.address).trim();
      const addressError = validateTherapistAddress(updates.address);
      if (addressError) return res.status(400).json({ message: addressError });
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    const therapist = await updateTherapist(therapistId, updates);
    invalidateAdminTherapistsCache();
    return res.json(therapist);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function deleteAdminTherapist(req, res) {
  try {
    await deleteTherapist(req.params.therapist_id);
    invalidateAdminTherapistsCache();
    return res.json({ message: 'Therapist deleted.' });
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function suspendAdminTherapist(req, res) {
  try {
    const therapist = await suspendTherapistById(req.params.therapist_id);
    if (therapist?.user_id) {
      queueModerationNotification({
        userId: therapist.user_id,
        action: 'suspend',
        reason: 'Suspended from Therapists directory',
      });
    }
    const subject = await lookupSubjectByTherapistId(req.params.therapist_id);
    await writeModerationAudit({
      event_type: 'therapist_suspended',
      adminId: getAdminId(req),
      targetTable: 'therapists',
      targetId: req.params.therapist_id,
      metadata: {
        user_name: therapist?.full_name,
        user_email: therapist?.email,
        reason: 'Suspended from Therapists directory',
        ...subject,
      },
    });
    void logTherapistAudit({
      eventType: 'therapist_suspended',
      actorUserId: getAdminId(req),
      targetUserId: therapist?.user_id ? String(therapist.user_id) : null,
      therapistEmail: therapist?.email,
      reason: 'Suspended from Therapists directory',
      extraMetadata: { therapist_id: req.params.therapist_id },
    });
    invalidateAdminTherapistsCache();
    return res.json(therapist);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function reactivateAdminTherapist(req, res) {
  try {
    const therapist = await reactivateTherapistById(req.params.therapist_id);
    await clearSuspensionArtifacts({
      email: therapist?.email,
      userId: therapist?.user_id,
    });
    if (therapist?.email) {
      sendAccountReactivationEmail({
        toEmail: therapist.email,
        userName: therapist.full_name,
        role: 'therapist',
      });
    }
    void logTherapistAudit({
      eventType: 'therapist_unsuspended',
      actorUserId: getAdminId(req),
      targetUserId: therapist?.user_id ? String(therapist.user_id) : null,
      therapistEmail: therapist?.email,
      reason: 'Reactivated from Therapists directory',
      extraMetadata: { therapist_id: req.params.therapist_id },
    });
    invalidateAdminTherapistsCache();
    return res.json(therapist);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}
