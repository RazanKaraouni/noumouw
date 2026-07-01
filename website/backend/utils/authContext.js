/** Read normalized auth set by `middleware/auth.js`. */

export function getTherapistId(req) {
  return req.auth?.role === 'therapist' ? req.auth.therapistId : null;
}

export function getParentUserId(req) {
  return req.auth?.role === 'parent' ? req.auth.parentUserId : null;
}

export function getAdminId(req) {
  return req.auth?.role === 'admin' ? req.auth.adminId || req.auth.userId : null;
}

export function getAuthEmail(req) {
  return req.auth?.email || '';
}

export function getTherapistDisplayName(req) {
  return req.auth?.displayName || '';
}

export function isAdmin(req) {
  return req.auth?.role === 'admin';
}

export function isTherapist(req) {
  return req.auth?.role === 'therapist';
}

export function isParent(req) {
  return req.auth?.role === 'parent';
}
