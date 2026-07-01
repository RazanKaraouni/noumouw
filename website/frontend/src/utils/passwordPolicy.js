export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_POLICY_HINT =
  '8+ characters, at least 1 uppercase letter and 1 symbol (e.g. @).';

export const PASSWORD_WEAK_ERROR =
  'Password is weak. The password must have at least 8 characters, one uppercase letter, and one symbol.';

/** @deprecated Use PASSWORD_WEAK_ERROR */
export const PASSWORD_POLICY_ERROR = PASSWORD_WEAK_ERROR;

export function validateNewPassword(password) {
  if (!String(password || '').trim()) return 'New password is required.';
  if (!PASSWORD_REGEX.test(password)) return PASSWORD_WEAK_ERROR;
  return null;
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  const errors = {};

  if (!String(currentPassword || '').trim()) {
    errors.currentPassword = 'Current password is required.';
  }

  const newErr = validateNewPassword(newPassword);
  if (newErr) errors.newPassword = newErr;

  if (!String(confirmPassword || '').trim()) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    message: Object.values(errors)[0] || '',
  };
}
