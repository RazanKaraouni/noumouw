import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  getTherapistAuthById,
  getTherapistOwnProfile,
  updateTherapistOwnProfile,
  updateTherapistPassword,
} from '../models/therapistModel.js';
import { sendOtpEmail } from '../services/email.service.js';
import { deleteOtp, getOtp, setOtp, OTP_TTL_SECONDS } from '../services/otpStore.js';
import { getTherapistId } from '../utils/authContext.js';
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';

const OTP_REGEX = /^\d{6}$/;

const pendingPasswordChangeKey = (therapistId) => `therapist-pwd:${therapistId}`;

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function validateOtpAgainstPending(pending, normalizedOtp) {
  if (!pending?.otpCode) {
    return { ok: false, message: 'Invalid or expired OTP.' };
  }
  if (String(pending.otpCode).trim() !== normalizedOtp) {
    return { ok: false, message: 'Invalid or expired OTP.' };
  }
  return { ok: true };
}

async function validatePasswordChangePayload(therapistId, { currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      message: 'Current password, new password, and confirmation are required.',
    };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, status: 400, message: 'New password and confirmation do not match.' };
  }

  if (!isValidPassword(newPassword)) {
    return { ok: false, status: 400, message: PASSWORD_POLICY_MESSAGE };
  }

  if (String(currentPassword) === String(newPassword)) {
    return {
      ok: false,
      status: 400,
      message: 'New password must be different from your current password.',
    };
  }

  const therapist = await getTherapistAuthById(therapistId);
  if (!therapist) {
    return { ok: false, status: 404, message: 'Therapist account not found.' };
  }

  const isMatch = await bcrypt.compare(String(currentPassword), therapist.password || '');
  if (!isMatch) {
    return { ok: false, status: 401, message: 'Current password is incorrect.' };
  }

  return { ok: true, therapist };
}

const FULL_NAME_REGEX = /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s'.-]*$/;
const ADDRESS_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s,.'#/-]{3,}$/;

const PROFILE_FIELDS = [
  'full_name',
  'profession',
  'bio',
  'phone',
  'address',
  'years_of_experience',
  'online_consultation',
];

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

function buildProfileUpdates(body) {
  const updates = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

export async function getTherapistProfile(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist access only.' });
    }

    const profile = await getTherapistOwnProfile(therapistId);
    if (!profile) {
      return res.status(404).json({ message: 'Therapist account not found.' });
    }

    return res.json(profile);
  } catch (err) {
    console.error('[therapistAccount] getProfile:', err?.message || err);
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
}

export async function updateTherapistProfile(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist access only.' });
    }

    const updates = buildProfileUpdates(req.body || {});

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
    if (updates.profession != null) {
      updates.profession = String(updates.profession).trim();
      if (!updates.profession) {
        return res.status(400).json({ message: 'Profession is required.' });
      }
    }
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

    const profile = await updateTherapistOwnProfile(therapistId, updates);
    return res.json(profile);
  } catch (err) {
    console.error('[therapistAccount] updateProfile:', err?.message || err);
    return res.status(500).json({ message: 'Unable to update profile.' });
  }
}

export async function sendTherapistPasswordChangeOtp(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist access only.' });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    const validation = await validatePasswordChangePayload(therapistId, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const email = String(validation.therapist.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'No email is associated with this account.' });
    }

    const otpCode = generateOtpCode();
    const key = pendingPasswordChangeKey(therapistId);
    await setOtp(
      key,
      {
        therapistId,
        email,
        otpCode,
        newPassword: String(newPassword),
      },
      OTP_TTL_SECONDS,
    );

    await sendOtpEmail(email, otpCode, {
      subject: 'Your password change verification code',
      intro: 'Your password change verification code is',
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email.',
      email,
    });
  } catch (err) {
    if (err?.code === 'EAUTH' || err?.code === 'ESOCKET' || err?.responseCode) {
      return res.status(502).json({ message: 'Failed to send verification email.' });
    }
    console.error('[therapistAccount] sendPasswordChangeOtp:', err?.message || err);
    return res.status(500).json({ message: 'Unable to send verification code.' });
  }
}

export async function resendTherapistPasswordChangeOtp(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist access only.' });
    }

    const key = pendingPasswordChangeKey(therapistId);
    const pending = await getOtp(key);
    if (!pending?.email) {
      return res.status(400).json({
        message: 'No pending password change found. Please request a new verification code.',
      });
    }

    const otpCode = generateOtpCode();
    pending.otpCode = otpCode;
    await setOtp(key, pending, OTP_TTL_SECONDS);

    await sendOtpEmail(pending.email, otpCode, {
      subject: 'Your password change verification code',
      intro: 'Your password change verification code is',
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code resent.',
      email: pending.email,
    });
  } catch (err) {
    if (err?.code === 'EAUTH' || err?.code === 'ESOCKET' || err?.responseCode) {
      return res.status(502).json({ message: 'Failed to send verification email.' });
    }
    console.error('[therapistAccount] resendPasswordChangeOtp:', err?.message || err);
    return res.status(500).json({ message: 'Unable to resend verification code.' });
  }
}

export async function changeTherapistPassword(req, res) {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(403).json({ message: 'Therapist access only.' });
    }

    const { currentPassword, newPassword, confirmPassword, otp_code } = req.body || {};
    const normalizedOtp = String(otp_code || '').trim();

    if (!OTP_REGEX.test(normalizedOtp)) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code.' });
    }

    const validation = await validatePasswordChangePayload(therapistId, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!validation.ok) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const key = pendingPasswordChangeKey(therapistId);
    const pending = await getOtp(key);
    const otpCheck = validateOtpAgainstPending(pending, normalizedOtp);
    if (!otpCheck.ok) {
      if (!pending) await deleteOtp(key);
      return res.status(400).json({ message: otpCheck.message });
    }

    if (String(pending.newPassword) !== String(newPassword)) {
      return res.status(400).json({
        message: 'New password does not match the one used when requesting the verification code.',
      });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await updateTherapistPassword(therapistId, passwordHash);
    await deleteOtp(key);

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[therapistAccount] changePassword:', err?.message || err);
    return res.status(500).json({ message: 'Unable to change password.' });
  }
}
