/**
 * Escaping for email bodies.
 *
 * Every value that reaches a template comes from a customer or an admin and has
 * never been validated server-side anywhere else in this application. Nothing
 * is interpolated raw.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Escapes, then converts newlines to <br> for message bodies. */
export function escapeMultiline(value: unknown): string {
  return escapeHtml(value)
    .split('\n')
    .map((line) => line.trim())
    .join('<br>');
}

/**
 * Only absolute http(s) URLs on the configured application origin are allowed
 * into an href, so a stored value can never turn a link into javascript: or
 * point a customer at someone else's host.
 */
export function safeUrl(value: unknown, allowedOrigin: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (allowedOrigin) {
      const allowed = new URL(allowedOrigin);
      if (url.origin !== allowed.origin) return '';
    }
    return escapeHtml(url.toString());
  } catch {
    return '';
  }
}

/** Plain-text alternative part: strip tags, collapse whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|h1|h2|h3|div|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
    .trim();
}
