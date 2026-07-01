import supabaseAdmin from '../config/supabase.js';

export function parseBearerToken(req) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) return null;
  return hdr.slice(7).trim();
}

/** Verify Supabase JWT and attach `req.user` (auth.users.id + email). */
export async function authenticateUser(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user?.id) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    req.user = { id: user.id, email: user.email || '' };
    req.accessToken = token;
    return next();
  } catch (err) {
    console.error('[authenticateUser]', err?.message || err);
    return res.status(401).json({ message: 'Token verification failed.' });
  }
}

/**
 * Database-backed role guard.
 * @param {'admin'|'therapist'|'parent'} role
 */
export function requireRole(role) {
  const normalized = String(role).toLowerCase();

  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authorization required.' });
    }

    try {
      if (normalized === 'admin') {
        const { data, error } = await supabaseAdmin
          .from('admins')
          .select('admin_id')
          .eq('email', req.user.email)
          .maybeSingle();
        if (error) throw error;
        if (!data?.admin_id) {
          return res.status(403).json({ message: 'Access denied.' });
        }
        req.admin = { admin_id: data.admin_id };
        return next();
      }

      if (normalized === 'therapist') {
        const { data, error } = await supabaseAdmin
          .from('therapists')
          .select('therapist_id')
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.therapist_id) {
          return res.status(403).json({ message: 'Access denied.' });
        }
        req.therapist = { therapist_id: data.therapist_id };
        return next();
      }

      if (normalized === 'parent') {
        const { data, error } = await supabaseAdmin
          .from('parents')
          .select('parent_id')
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.parent_id) {
          return res.status(403).json({ message: 'Access denied.' });
        }
        req.parent = { parent_id: data.parent_id };
        return next();
      }

      return res.status(500).json({ message: 'Invalid role configuration.' });
    } catch (err) {
      console.error('[requireRole]', err?.message || err);
      return res.status(500).json({ message: err.message || 'Role check failed.' });
    }
  };
}
