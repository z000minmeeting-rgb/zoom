/**
 * Server-side input validation.
 *
 * The browser's checks are a courtesy to the person filling the form. These are
 * the ones that actually hold, because the Edge Function is the only way a
 * booking or a guest message reaches the database.
 */

/**
 * A format gate, not a proof of existence. It rejects the shapes that cannot
 * possibly be deliverable and accepts everything else; whether a mailbox exists
 * is only ever established by the mail server, later, asynchronously.
 *
 * Rejects: "john", "john@", "john@gmail", "@gmail.com", "john gmail.com".
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** C0 controls plus DEL. Stripping these is what stops header injection. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 254) return false;
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.split('@')[1] ?? '';
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  const tld = domain.split('.').pop() ?? '';
  return tld.length >= 2;
}

export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Multi-line input keeps its newlines; only the dangerous controls go. */
export function cleanMultilineText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Anything destined for an email header. CR and LF must not survive. */
export function cleanHeaderValue(value: unknown, maxLength = 200): string {
  return cleanText(value, maxLength).replace(/[\r\n]/g, ' ');
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type BookingInput = {
  fullName: string;
  username: string;
  country: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  packageId: string;
  packageName: string;
  packagePrice: string;
  hostName: string;
  hostAvatar: string;
  hostInitials: string;
  clientId: string;
  meetingLinkToken: string;
};

export type ValidationResult =
  | { ok: true; value: BookingInput }
  | { ok: false; field: string; message: string };

export function validateBooking(body: Record<string, unknown>): ValidationResult {
  const fullName = cleanText(body.fullName, 120);
  if (fullName.length < 2) {
    return { ok: false, field: 'fullName', message: 'Enter your full name.' };
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return {
      ok: false,
      field: 'email',
      message: 'Enter a valid email address, for example name@example.com.',
    };
  }

  const packageName = cleanText(body.packageName, 120);
  if (!packageName) {
    return { ok: false, field: 'packageId', message: 'Select a package before continuing.' };
  }

  const clientId = isUuid(body.clientId) ? body.clientId : '';

  return {
    ok: true,
    value: {
      fullName,
      username: cleanText(body.username, 80),
      country: cleanText(body.country, 80),
      email,
      phone: cleanText(body.phone, 40),
      gender: cleanText(body.gender, 40),
      dateOfBirth: cleanText(body.dateOfBirth, 40),
      packageId: cleanText(body.packageId, 80),
      packageName,
      packagePrice: cleanText(body.packagePrice, 40),
      hostName: cleanText(body.hostName, 120) || 'the meeting host',
      hostAvatar: cleanText(body.hostAvatar, 200) || '#0B5CFF',
      hostInitials: cleanText(body.hostInitials, 4) || 'H',
      clientId,
      meetingLinkToken: cleanText(body.meetingLinkToken, 200),
    },
  };
}
