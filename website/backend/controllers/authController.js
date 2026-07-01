import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { findAdminByEmail } from '../models/adminModel.js';
import { findTherapistByEmail } from '../models/therapistModel.js';
import { ensureTherapistSenderId } from '../services/chatService.js';
import { isEmailBlocklisted } from '../middleware/blocklistGuard.js';
import { isPasswordSetupPending } from '../utils/therapistPasswordSetup.js';
import { logAuthEvent, requestIp } from '../services/authAuditService.js';
import { validateRequired, validationErrorResponse } from '../utils/validation.js';

const LOGIN_CREDENTIALS_ERROR = 'Incorrect email or password . Try again !';

function deriveAdminName(admin) {
  const explicit = admin.full_name && String(admin.full_name).trim();
  if (explicit) return explicit;
  const fromParts = [admin.first_name, admin.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fromParts) return fromParts;
  return admin.email ? String(admin.email).split('@')[0] : 'Admin';
}

export const login = async (req, res) => {
  const ip = requestIp(req);
  try {
    const requiredErrors = validateRequired(['email', 'password'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const { email, password } = req.body;

    if (await isEmailBlocklisted(email)) {
      void logAuthEvent({
        ip,
        outcome: 'suspended',
        details: 'blocklisted email at login',
      });
      return res.status(403).json({
        error: 'Account permanently suspended.',
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    const admin = await findAdminByEmail(email);
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        void logAuthEvent({
          userId: admin.admin_id,
          ip,
          outcome: 'failed_password',
          details: 'admin login',
        });
        return res.status(401).json({ message: LOGIN_CREDENTIALS_ERROR });
      }

      const adminName = deriveAdminName(admin);
      const token = jwt.sign(
        { admin_id: admin.admin_id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '8h' },
      );

      void logAuthEvent({
        userId: admin.admin_id,
        ip,
        outcome: 'success',
        details: 'admin login',
      });

      return res.json({
        token,
        user: {
          admin_id: admin.admin_id,
          full_name: adminName,
          email: admin.email,
          role: 'admin',
        },
        admin: {
          admin_id: admin.admin_id,
          full_name: adminName,
          email: admin.email,
        },
      });
    }

    const therapist = await findTherapistByEmail(email);
    if (!therapist) {
      void logAuthEvent({
        ip,
        outcome: 'failed_password',
        details: 'unknown email',
      });
      return res.status(401).json({ message: LOGIN_CREDENTIALS_ERROR });
    }

    if (isPasswordSetupPending(therapist)) {
      return res.status(403).json({
        message: 'Please set your password using the link in your approval email before signing in.',
      });
    }

    const isTherapistMatch = await bcrypt.compare(password, therapist.password || '');
    if (!isTherapistMatch) {
      void logAuthEvent({
        userId: therapist.therapist_id,
        ip,
        outcome: 'failed_password',
        details: 'therapist login',
      });
      return res.status(401).json({ message: LOGIN_CREDENTIALS_ERROR });
    }

    if (therapist.is_suspended) {
      void logAuthEvent({
        userId: therapist.therapist_id,
        ip,
        outcome: 'suspended',
        details: 'therapist login',
      });
      return res.status(401).json({ error: 'Account suspended' });
    }

    const token = jwt.sign(
      { therapist_id: therapist.therapist_id, email: therapist.email, role: 'therapist' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    const therapistSenderId = await ensureTherapistSenderId(
      therapist.therapist_id,
      therapist.email,
      therapist.full_name || '',
    );

    void logAuthEvent({
      userId: therapist.therapist_id,
      ip,
      outcome: 'success',
      details: 'therapist login',
    });

    res.json({
      token,
      user: {
        therapist_id: therapist.therapist_id,
        sender_id: therapistSenderId || null,
        full_name: therapist.full_name,
        email: therapist.email,
        role: 'therapist',
      },
      therapist: {
        therapist_id: therapist.therapist_id,
        full_name: therapist.full_name,
        email: therapist.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Parent mobile login — proxies Supabase password auth for devices on LAN without direct cloud access. */
export const parentLogin = async (req, res) => {
  try {
    const requiredErrors = validateRequired(['email', 'password'], req.body || {});
    if (requiredErrors.length) {
      return validationErrorResponse(res, requiredErrors);
    }

    const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
    if (!process.env.SUPABASE_URL || !anonKey) {
      return res.status(503).json({
        message: 'Parent login is temporarily unavailable. Please try again shortly.',
      });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (await isEmailBlocklisted(email)) {
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    const authClient = createClient(process.env.SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
        user: data.user,
      },
    });
  } catch (err) {
    console.error('[auth] parentLogin:', err?.message || err);
    return res.status(500).json({ message: 'Server error.' });
  }
};
