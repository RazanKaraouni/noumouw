export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter and a symbol.';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

/** @returns {boolean} */
export function validatePasswordStrength(password) {
  return PASSWORD_REGEX.test(String(password || ''));
}

/** @deprecated Use validatePasswordStrength */
export function isValidPassword(password) {
  return validatePasswordStrength(password);
}

/**
 * @param {string[]} fields
 * @param {Record<string, unknown>} body
 * @returns {string[]} human-readable error messages
 */
export function validateRequired(fields, body) {
  const errors = [];
  const source = body && typeof body === 'object' ? body : {};
  for (const field of fields) {
    const raw = source[field];
    if (raw === undefined || raw === null) {
      errors.push(`${field} is required.`);
      continue;
    }
    if (typeof raw === 'string' && raw.trim() === '') {
      errors.push(`${field} is required.`);
    }
  }
  return errors;
}

/** @param {string[]} errors */
export function validationErrorResponse(res, errors) {
  return res.status(400).json({ errors });
}
