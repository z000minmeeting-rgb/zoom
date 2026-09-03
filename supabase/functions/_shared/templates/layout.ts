import { escapeHtml } from '../html.ts';

/**
 * Email-safe shell for every template.
 *
 * Table-based, 600px, inline styles only. No flexbox, no grid, no CSS
 * variables, no external stylesheet, no web font — Gmail strips or ignores all
 * of them. The palette is the application's own: #0B5CFF primary, #25B7FF
 * accent, #172033 ink, #F7FAFF surface, #E5E9F2 rules, #6B7280 muted.
 */

export const BRAND = {
  primary: '#0B5CFF',
  accent: '#25B7FF',
  ink: '#172033',
  muted: '#6B7280',
  rule: '#E5E9F2',
  surface: '#F7FAFF',
  page: '#EFF3F9',
} as const;

/** Mirrors formatStatusColor() in src/app/data/verificationChat.ts. */
export function statusColors(status: string): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'Verified':
      return { bg: '#EEFBF4', fg: '#157347', border: '#BFE7D1' };
    case 'Rejected':
      return { bg: '#FFF5F4', fg: '#B42318', border: '#FEE4E2' };
    case 'Appointment Scheduled':
      return { bg: '#EEF4FF', fg: '#155EEF', border: '#C7D7FE' };
    case 'Under Review':
      return { bg: '#FFF8E6', fg: '#A16207', border: '#F4D680' };
    default:
      return { bg: '#F4F8FF', fg: '#0B5CFF', border: '#D8E4FF' };
  }
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function statusPill(status: string): string {
  if (!status) return '';
  const c = statusColors(status);
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${c.bg};color:${c.fg};border:1px solid ${c.border};font-size:12px;font-weight:700;font-family:${FONT};">${escapeHtml(status)}</span>`;
}

export type DetailRow = { label: string; value: string; isHtml?: boolean };

/** Definition rows. Two columns on desktop, stacked naturally on narrow mail apps. */
export function detailTable(rows: DetailRow[]): string {
  const body = rows
    .filter((row) => row.isHtml || String(row.value ?? '').trim() !== '')
    .map((row, index) => {
      const border = index === 0 ? 'none' : `1px solid ${BRAND.rule}`;
      const value = row.isHtml ? row.value : escapeHtml(row.value);
      return `<tr>
  <td style="padding:11px 0;border-top:${border};font-family:${FONT};font-size:13px;color:${BRAND.muted};width:42%;vertical-align:top;">${escapeHtml(row.label)}</td>
  <td style="padding:11px 0;border-top:${border};font-family:${FONT};font-size:14px;color:${BRAND.ink};font-weight:600;text-align:right;vertical-align:top;">${value}</td>
</tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:${BRAND.surface};border:1px solid ${BRAND.rule};border-radius:12px;padding:6px 18px;">
${body}
</table>`;
}

/**
 * Bulletproof button: a table cell with a background, not a styled <a>, because
 * Outlook drops padding and background on inline anchors.
 */
export function button(label: string, url: string): string {
  if (!url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px;">
  <tr>
    <td align="center" bgcolor="${BRAND.primary}" style="border-radius:999px;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function paragraph(html: string, muted = false): string {
  const color = muted ? BRAND.muted : BRAND.ink;
  const size = muted ? '13px' : '15px';
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:${size};line-height:1.6;color:${color};">${html}</p>`;
}

export function sectionLabel(text: string): string {
  return `<p style="margin:26px 0 10px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(text)}</p>`;
}

/** A quoted chat message. Left rule, tinted ground — never raw HTML. */
export function quoteBlock(bodyHtml: string, meta: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:6px 0 4px;">
  <tr>
    <td style="padding:16px 18px;background:${BRAND.surface};border-left:4px solid ${BRAND.primary};border-radius:0 12px 12px 0;">
      <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.ink};">${bodyHtml}</div>
      ${meta ? `<div style="margin-top:10px;font-family:${FONT};font-size:12px;color:${BRAND.muted};">${escapeHtml(meta)}</div>` : ''}
    </td>
  </tr>
</table>`;
}

export type LayoutOptions = {
  brandName: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  preheader: string;
  footerNote?: string;
};

export function renderLayout(options: LayoutOptions): string {
  const { brandName, eyebrow, title, bodyHtml, preheader, footerNote } = options;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BRAND.page};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${BRAND.page};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">

        <tr>
          <td style="padding:22px 28px;background:${BRAND.primary};background-image:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border-radius:16px 16px 0 0;">
            <span style="font-family:${FONT};font-size:19px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">${escapeHtml(brandName)}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:30px 28px 34px;background:#FFFFFF;border-left:1px solid ${BRAND.rule};border-right:1px solid ${BRAND.rule};">
            <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:${BRAND.primary};">${escapeHtml(eyebrow)}</p>
            <h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>

        <tr>
          <td style="padding:20px 28px 26px;background:#FFFFFF;border:1px solid ${BRAND.rule};border-top:none;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;font-weight:600;color:${BRAND.ink};">Customer Support</p>
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              ${escapeHtml(footerNote || 'Reply in your support chat and the management team will respond there.')}
            </p>
            <p style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#9AA3B0;">
              ${escapeHtml(brandName)} &middot; This is an automated message about your booking. Please do not share this email; its links give access to your conversation.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
