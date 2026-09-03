/**
 * Email format validation for the booking form.
 *
 * This mirrors `isValidEmail` in supabase/functions/_shared/validation.ts. The
 * server copy is the one that actually protects the database; this copy exists
 * so the person filling the form finds out immediately rather than after a
 * round trip.
 *
 * Neither copy can tell you whether a mailbox exists. Format validity and
 * deliverability are different questions, and only the mail server answers the
 * second one — later, and asynchronously.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmailFormat(value: string) {
  const email = normalizeEmail(value);

  if (email.length < 6 || email.length > 254) {
    return false;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return false;
  }

  const domain = email.split('@')[1] ?? '';

  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false;
  }

  return (domain.split('.').pop() ?? '').length >= 2;
}

/** Returns an inline error message, or an empty string when the format is fine. */
export function emailFormatError(value: string) {
  if (!value.trim()) {
    return 'Enter your email address.';
  }

  if (!isValidEmailFormat(value)) {
    return 'Enter a valid email address, for example name@example.com.';
  }

  return '';
}
