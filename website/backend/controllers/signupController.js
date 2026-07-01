import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
// SERVICE ROLE: justified because signup uses auth.admin and pre-auth profile checks.
import supabase from '../config/supabase.js';
import { sendOtpEmail } from '../services/email.service.js';
import {
  ageYearsFromDateOfBirth,
  parseParentDateOfBirth,
} from '../utils/parentAge.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import {
  validatePasswordStrength,
  PASSWORD_POLICY_MESSAGE,
  validateRequired,
  validationErrorResponse,
} from '../utils/validation.js';
import { setOtp, getOtp, deleteOtp, OTP_TTL_SECONDS, OTP_CONFIRM_WINDOW_MS } from '../services/otpStore.js';

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

const pendingKey = (role, email) => `signup:${role}:${email}`;

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'therapist') {
    return { role: 'therapist', table: 'therapists' };
  }

  if (normalized === 'parent' || normalized === 'profile' || normalized === 'user') {
    return { role: 'parent', table: 'parents' };
  }

  return null;
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function findAuthUserByEmail(email) {
  const perPage = 200;
  const maxPages = 10;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(
      (u) => String(u?.email || '').trim().toLowerCase() === String(email).trim().toLowerCase(),
    );
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

const pendingResetKey = (role, email) => `reset:${role}:${email}`;

function validateOtpAgainstPending(pending, normalizedOtp) {
  if (!pending?.otpCode) {
    return { ok: false, message: 'Invalid or expired OTP.' };
  }
  if (String(pending.otpCode).trim() !== normalizedOtp) {
    return { ok: false, message: 'Invalid or expired OTP.' };
  }
  return { ok: true };
}

function deriveFullName({ full_name }) {
  return full_name && String(full_name).trim();
}

function resolveParentAge({ date_of_birth, age }) {
  const parsedDob = parseParentDateOfBirth(date_of_birth);
  if (parsedDob) {
    const computedAge = ageYearsFromDateOfBirth(parsedDob);
    if (computedAge < 18) {
      return { error: 'You must be at least 18 years old to create an account.' };
    }
    if (computedAge > 120) {
      return { error: 'Enter a valid date of birth.' };
    }
    return { dateOfBirth: parsedDob, age: computedAge };
  }

  if (age === null || age === undefined || age === '') {
    return { error: 'date_of_birth is required.' };
  }

  const parsedAge = Number.parseInt(String(age), 10);
  if (Number.isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
    return { error: 'Enter a valid date of birth.' };
  }

  return { dateOfBirth: null, age: parsedAge };
}

const tableSelectColumn = (table) =>
  table === 'therapists' ? 'therapist_id, is_verified' : 'parent_id, is_verified';

function isMissingParentsDobColumnError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('date_of_birth') &&
    (msg.includes('could not find') || msg.includes('schema cache') || msg.includes('does not exist'))
  );
}

/** Upsert parent row; date_of_birth is source of truth, age mirrors computed years. */
async function upsertParentProfile(pending, authUserId) {
  const computedAge =
    pending.dateOfBirth != null
      ? ageYearsFromDateOfBirth(pending.dateOfBirth)
      : Number.isNaN(pending.age)
        ? null
        : pending.age;

  const acceptedAt = pending.acceptedPrivacyPolicy ? new Date().toISOString() : null;

  const base = {
    user_id: authUserId,
    full_name: pending.fullName,
    email: pending.email,
    gender: pending.gender,
    age: computedAge,
    address: pending.address,
    is_verified: true,
    otp_code: null,
    otp_expires_at: null,
    accepted_privacy_policy: Boolean(pending.acceptedPrivacyPolicy),
    accepted_at: acceptedAt,
  };

  const withDob = {
    ...base,
    date_of_birth: pending.dateOfBirth,
  };

  const first = await supabase.from('parents').upsert(withDob, { onConflict: 'user_id' });
  if (!first.error) return { error: null };

  if (!isMissingParentsDobColumnError(first.error)) {
    return { error: first.error };
  }

  console.warn(
    '[signup] parents.date_of_birth missing — saved age only. Run parents_add_date_of_birth.sql in Supabase.',
  );
  const retry = await supabase.from('parents').upsert(base, { onConflict: 'user_id' });
  return { error: retry.error };
}

export async function signup(req, res) {
  try {
    const requiredErrors = validateRequired(
      ['email', 'password', 'full_name', 'role'],
      req.body || {},
    );
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const {
      email,
      password,
      full_name,
      role,
      gender,
      age,
      date_of_birth,
      address,
      accepted_privacy_policy,
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const roleConfig = normalizeRole(role);
    const fullName = deriveFullName({ full_name });

    if (!normalizedEmail || !password || !fullName || !roleConfig) {
      return res.status(400).json({
        errors: ['email, password, full_name, and a valid role are required.'],
      });
    }

    if (roleConfig.role === 'parent' && accepted_privacy_policy !== true) {
      return res.status(400).json({
        message: 'You must agree to the Privacy Policy to continue.',
      });
    }

    if (roleConfig.role === 'therapist') {
      return res.status(403).json({
        message: 'Therapist accounts can only be created by an administrator.',
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    const { data: existing, error: existingError } = await supabase
      .from(roleConfig.table)
      .select(tableSelectColumn(roleConfig.table))
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ message: existingError.message || 'Failed to validate email.' });
    }

    if (existing?.is_verified) {
      return res.status(409).json({ message: 'This email is already verified. Please log in.' });
    }

    const existingAuthUser = await findAuthUserByEmail(normalizedEmail);
    if (existingAuthUser) {
      return res.status(409).json({
        message: 'This email is already registered. Please log in or reset password.',
      });
    }

    const parentAge = roleConfig.role === 'parent'
      ? resolveParentAge({ date_of_birth, age })
      : { dateOfBirth: null, age: null };
    if (parentAge.error) {
      return res.status(400).json({ message: parentAge.error });
    }

    const otpCode = generateOtpCode();
    await setOtp(
      pendingKey(roleConfig.role, normalizedEmail),
      {
        role: roleConfig.role,
        email: normalizedEmail,
        password,
        fullName,
        gender: gender ? String(gender).trim() : null,
        age: parentAge.age,
        dateOfBirth: parentAge.dateOfBirth,
        address: address ? String(address).trim() : null,
        acceptedPrivacyPolicy: accepted_privacy_policy === true,
        otpCode,
      },
      OTP_TTL_SECONDS,
    );

    await sendOtpEmail(normalizedEmail, otpCode);

    return res.status(200).json({
      message: 'OTP sent to email. Account will be created after verification.',
      email: normalizedEmail,
      role: roleConfig.role,
    });
  } catch (error) {
    if (error?.code === 'EAUTH' || error?.code === 'ESOCKET' || error?.responseCode) {
      return res.status(502).json({ message: 'Failed to send OTP email.' });
    }

    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function resendOtp(req, res) {
  try {
    const { email, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const roleConfig = normalizeRole(role);
    const requiredErrors = validateRequired(['email', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }
    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role === 'therapist') {
      return res.status(403).json({
        message: 'Therapist accounts can only be created by an administrator.',
      });
    }

    const key = pendingKey(roleConfig.role, normalizedEmail);
    const pending = await getOtp(key);
    if (!pending) {
      return res.status(400).json({
        message: 'No pending signup found. Please sign up again.',
      });
    }
    const otpCode = generateOtpCode();
    pending.otpCode = otpCode;
    await setOtp(key, pending, OTP_TTL_SECONDS);

    await sendOtpEmail(normalizedEmail, otpCode);
    return res.status(200).json({ message: 'OTP resent successfully.' });
  } catch (error) {
    if (error?.code === 'EAUTH' || error?.code === 'ESOCKET' || error?.responseCode) {
      return res.status(502).json({ message: 'Failed to resend OTP email.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

async function markAuthEmailConfirmedById(userId) {
  if (!userId) return;
  const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (updateErr) throw updateErr;
}

function issueJwtSession({ userId, email, role }) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  const expiresIn = '8h';
  const payload = { email, role };
  if (role === 'therapist') payload.therapist_id = userId;
  else if (role === 'parent') payload.parent_user_id = userId;
  else if (role === 'admin') payload.admin_id = userId;
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  return { token, expiresIn };
}

export async function verify(req, res) {
  try {
    const requiredErrors = validateRequired(['email', 'otp_code', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, otp_code, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otp_code || '').trim();
    const roleConfig = normalizeRole(role);

    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role === 'therapist') {
      return res.status(403).json({
        message: 'Therapist accounts can only be created by an administrator.',
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (!OTP_REGEX.test(normalizedOtp)) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code.' });
    }

    const key = pendingKey(roleConfig.role, normalizedEmail);
    const pending = await getOtp(key);
    if (!pending?.otpCode) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }
    if (String(pending.otpCode).trim() !== normalizedOtp) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
      user_metadata: {
        role: pending.role,
        full_name: pending.fullName,
      },
    });
    if (createError || !createdUser?.user?.id) {
      return res.status(400).json({ message: createError?.message || 'Unable to create user.' });
    }

    const authUserId = createdUser.user.id;
    let profileErr = null;
    if (pending.role === 'parent') {
      const { error } = await upsertParentProfile(pending, authUserId);
      profileErr = error;
    } else if (pending.role === 'therapist') {
      const payload = {
        user_id: authUserId,
        full_name: pending.fullName,
        email: pending.email,
        is_verified: true,
        otp_code: null,
        otp_expires_at: null,
      };
      const { error } = await supabase.from('therapists').upsert(payload, { onConflict: 'user_id' });
      profileErr = error;
    }

    if (profileErr) {
      await supabase.auth.admin.deleteUser(authUserId);
      return res.status(500).json({
        message: profileErr.message || 'Failed to save profile details.',
      });
    }

    await deleteOtp(key);
    await markAuthEmailConfirmedById(authUserId);

    let session = null;
    try {
      session = issueJwtSession({
        userId: authUserId,
        email: normalizedEmail,
        role: roleConfig.role,
      });
    } catch (_) {
      session = null;
    }

    return res.status(200).json({
      message: 'OTP verified successfully.',
      result: true,
      session,
    });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function forgotPassword(req, res) {
  try {
    const requiredErrors = validateRequired(['email', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const roleConfig = normalizeRole(role);

    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role !== 'parent') {
      return res.status(403).json({ message: 'Password reset is only available for parent accounts.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const authUser = await findAuthUserByEmail(normalizedEmail);
    if (!authUser?.id) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    const otpCode = generateOtpCode();
    const key = pendingResetKey(roleConfig.role, normalizedEmail);
    await setOtp(
      key,
      {
        role: roleConfig.role,
        email: normalizedEmail,
        userId: authUser.id,
        otpCode,
        confirmed: false,
        confirmedExpiresAtMs: null,
      },
      OTP_TTL_SECONDS,
    );

    await sendOtpEmail(normalizedEmail, otpCode, {
      subject: 'Your password reset code',
      intro: 'Your password reset code is',
    });

    return res.status(200).json({
      message: 'OTP sent to email. Enter the code to reset your password.',
      email: normalizedEmail,
      role: roleConfig.role,
    });
  } catch (error) {
    if (error?.code === 'EAUTH' || error?.code === 'ESOCKET' || error?.responseCode) {
      return res.status(502).json({ message: 'Failed to send OTP email.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function resendResetOtp(req, res) {
  try {
    const requiredErrors = validateRequired(['email', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const roleConfig = normalizeRole(role);

    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role !== 'parent') {
      return res.status(403).json({ message: 'Password reset is only available for parent accounts.' });
    }

    const key = pendingResetKey(roleConfig.role, normalizedEmail);
    const pending = await getOtp(key);
    if (!pending) {
      return res.status(400).json({
        message: 'No pending password reset found. Please request a new code.',
      });
    }

    const otpCode = generateOtpCode();
    pending.otpCode = otpCode;
    pending.confirmed = false;
    pending.confirmedExpiresAtMs = null;
    await setOtp(key, pending, OTP_TTL_SECONDS);

    await sendOtpEmail(normalizedEmail, otpCode, {
      subject: 'Your password reset code',
      intro: 'Your password reset code is',
    });

    return res.status(200).json({ message: 'OTP resent successfully.' });
  } catch (error) {
    if (error?.code === 'EAUTH' || error?.code === 'ESOCKET' || error?.responseCode) {
      return res.status(502).json({ message: 'Failed to resend OTP email.' });
    }
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function confirmResetOtp(req, res) {
  try {
    const requiredErrors = validateRequired(['email', 'otp_code', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, otp_code, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otp_code || '').trim();
    const roleConfig = normalizeRole(role);

    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role !== 'parent') {
      return res.status(403).json({ message: 'Password reset is only available for parent accounts.' });
    }

    if (!OTP_REGEX.test(normalizedOtp)) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code.' });
    }

    const key = pendingResetKey(roleConfig.role, normalizedEmail);
    const pending = await getOtp(key);
    const otpCheck = validateOtpAgainstPending(pending, normalizedOtp);
    if (!otpCheck.ok) {
      if (!pending) await deleteOtp(key);
      return res.status(400).json({ message: otpCheck.message });
    }

    pending.confirmed = true;
    pending.confirmedExpiresAtMs = Date.now() + OTP_CONFIRM_WINDOW_MS;
    await setOtp(key, pending, OTP_TTL_SECONDS);

    return res.status(200).json({ message: 'OTP verified. You can now set a new password.' });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}

export async function resetPassword(req, res) {
  try {
    const requiredErrors = validateRequired(['email', 'password', 'role'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, password, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const roleConfig = normalizeRole(role);

    if (!roleConfig) {
      return res.status(400).json({ errors: ['role must be parent.'] });
    }

    if (roleConfig.role !== 'parent') {
      return res.status(403).json({ message: 'Password reset is only available for parent accounts.' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    const key = pendingResetKey(roleConfig.role, normalizedEmail);
    const pending = await getOtp(key);
    if (!pending?.confirmed || !pending.userId) {
      return res.status(400).json({ message: 'Please verify the OTP code first.' });
    }
    if (!pending.confirmedExpiresAtMs || pending.confirmedExpiresAtMs < Date.now()) {
      await deleteOtp(key);
      return res.status(400).json({ message: 'OTP verification expired. Please request a new code.' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(pending.userId, {
      password,
    });
    if (updateError) {
      return res.status(400).json({ message: 'Unable to reset password.' });
    }

    await deleteOtp(key);

    return res.status(200).json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    return res.status(500).json({ message: userFacingErrorMessage(error)});
  }
}
