import { escapeHtml, escapeMultiline, htmlToText } from '../html.ts';
import {
  BRAND,
  button,
  detailTable,
  paragraph,
  quoteBlock,
  renderLayout,
  sectionLabel,
  statusPill,
} from './layout.ts';

/**
 * Typed template payloads and the renderers for the five (six with reschedule)
 * transactional messages.
 *
 * Every payload field originates in booking_email_payload() in
 * 20260903120200_email_event_triggers.sql. Nothing here reads the database, so
 * a template can never leak a column a trigger did not deliberately publish.
 */

export type EmailPayload = {
  threadId?: string;
  bookingReference?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCountry?: string;
  hostName?: string;
  packageName?: string;
  packagePrice?: string;
  status?: string;
  submittedAt?: string;
  appointment?: string;
  appointmentTimezone?: string;
  appointmentVersion?: number;
  previousAppointment?: string;
  paymentConfirmed?: boolean;
  messageId?: string;
  messageBody?: string;
  messageAt?: string;
  hasAttachment?: boolean;
};

export type TemplateContext = {
  payload: EmailPayload;
  brandName: string;
  /** Guest-token chat link. Empty when no token could be issued. */
  customerChatUrl: string;
  /** Admin dashboard conversation link. Requires normal admin sign-in. */
  adminChatUrl: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

function formatTimestamp(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }).format(date) + ' UTC';
}

function firstName(fullName?: string): string {
  const name = (fullName ?? '').trim().split(/\s+/)[0];
  return name || 'there';
}

function finish(
  context: TemplateContext,
  parts: { eyebrow: string; title: string; subject: string; preheader: string; body: string; footerNote?: string },
): RenderedEmail {
  const html = renderLayout({
    brandName: context.brandName,
    eyebrow: parts.eyebrow,
    title: parts.title,
    bodyHtml: parts.body,
    preheader: parts.preheader,
    footerNote: parts.footerNote,
  });
  return { subject: parts.subject, html, text: htmlToText(html) };
}

// ---------------------------------------------------------------------------
// 1. booking-confirmation-user
// ---------------------------------------------------------------------------
function bookingConfirmationUser(context: TemplateContext): RenderedEmail {
  const p = context.payload;
  const reference = p.bookingReference || '';

  const body = [
    paragraph(`Hello ${escapeHtml(firstName(p.customerName))},`),
    paragraph(
      `We have received your booking request for a private video call with <strong>${escapeHtml(p.hostName || 'your selected host')}</strong>. Nothing further is needed from you right now.`,
    ),
    sectionLabel('Booking details'),
    detailTable([
      { label: 'Reference', value: reference },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Price', value: p.packagePrice || '' },
      { label: 'Host', value: p.hostName || '' },
      { label: 'Status', value: statusPill(p.status || ''), isHtml: true },
      { label: 'Submitted', value: formatTimestamp(p.submittedAt) },
    ]),
    button('Open support chat', context.customerChatUrl),
    sectionLabel('What happens next'),
    paragraph(
      'The management team will confirm the payment method with you in your support chat. Once you have sent your payment proof there, it is reviewed and your video call session is scheduled. Every update arrives in that same conversation.',
      true,
    ),
    paragraph(
      `Quote reference <strong>${escapeHtml(reference)}</strong> in any correspondence about this booking.`,
      true,
    ),
  ].join('\n');

  return finish(context, {
    eyebrow: 'Booking received',
    title: 'Your video call booking registration was received',
    subject: `Booking received${reference ? ` — ${reference}` : ''}`,
    preheader: `We have your request for ${p.packageName || 'your selected package'}. Next step: confirm payment in your support chat.`,
    body,
  });
}

// ---------------------------------------------------------------------------
// 2. new-booking-admin
// ---------------------------------------------------------------------------
function newBookingAdmin(context: TemplateContext): RenderedEmail {
  const p = context.payload;

  const body = [
    paragraph('A new video call booking has been submitted and is waiting for review.'),
    sectionLabel('Customer'),
    detailTable([
      { label: 'Name', value: p.customerName || '' },
      { label: 'Email', value: p.customerEmail || '' },
      { label: 'Phone', value: p.customerPhone || 'Not provided' },
      { label: 'Country', value: p.customerCountry || 'Not provided' },
    ]),
    sectionLabel('Booking'),
    detailTable([
      { label: 'Reference', value: p.bookingReference || '' },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Price', value: p.packagePrice || '' },
      { label: 'Host', value: p.hostName || '' },
      { label: 'Status', value: statusPill(p.status || ''), isHtml: true },
      { label: 'Submitted', value: formatTimestamp(p.submittedAt) },
    ]),
    button('Open booking', context.adminChatUrl),
    paragraph('Opening this booking requires your normal admin sign-in.', true),
  ].join('\n');

  return finish(context, {
    eyebrow: 'Admin notification',
    title: 'New video call booking',
    subject: `New booking — ${p.customerName || 'Customer'} · ${p.packageName || 'Package'}`,
    preheader: `${p.customerName || 'A customer'} booked ${p.packageName || 'a package'} (${p.packagePrice || ''}).`,
    body,
    footerNote: 'Sent to the configured administrator notification address.',
  });
}

// ---------------------------------------------------------------------------
// 3. new-customer-message-admin
// ---------------------------------------------------------------------------
function newCustomerMessageAdmin(context: TemplateContext): RenderedEmail {
  const p = context.payload;
  const attachmentNote = p.hasAttachment ? ' (includes an attachment)' : '';

  const body = [
    paragraph(`<strong>${escapeHtml(p.customerName || 'A customer')}</strong> sent a new message${escapeHtml(attachmentNote)}.`),
    quoteBlock(escapeMultiline(p.messageBody || ''), formatTimestamp(p.messageAt)),
    sectionLabel('Booking'),
    detailTable([
      { label: 'Reference', value: p.bookingReference || '' },
      { label: 'Customer', value: p.customerName || '' },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Status', value: statusPill(p.status || ''), isHtml: true },
    ]),
    button('View & reply', context.adminChatUrl),
    paragraph('This link opens the conversation in the admin dashboard and requires your normal sign-in.', true),
  ].join('\n');

  return finish(context, {
    eyebrow: 'New customer message',
    title: 'New customer message',
    subject: `New message from ${p.customerName || 'a customer'}${p.bookingReference ? ` — ${p.bookingReference}` : ''}`,
    preheader: (p.messageBody || '').slice(0, 120),
    body,
    footerNote: 'Sent to the configured administrator notification address.',
  });
}

// ---------------------------------------------------------------------------
// 4. admin-reply-customer
// ---------------------------------------------------------------------------
function adminReplyCustomer(context: TemplateContext): RenderedEmail {
  const p = context.payload;

  const body = [
    paragraph(`Hello ${escapeHtml(firstName(p.customerName))},`),
    paragraph('Customer Support has replied to your booking conversation.'),
    quoteBlock(escapeMultiline(p.messageBody || ''), formatTimestamp(p.messageAt)),
    button('View reply', context.customerChatUrl),
    sectionLabel('Your booking'),
    detailTable([
      { label: 'Reference', value: p.bookingReference || '' },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Status', value: statusPill(p.status || ''), isHtml: true },
    ]),
    paragraph('Reply inside the chat rather than to this email — replies to this address are not monitored.', true),
  ].join('\n');

  return finish(context, {
    eyebrow: 'Support reply',
    title: 'Customer Support replied',
    subject: `Support replied${p.bookingReference ? ` — ${p.bookingReference}` : ''}`,
    preheader: (p.messageBody || '').slice(0, 120),
    body,
  });
}

// ---------------------------------------------------------------------------
// 5. chat-access-link-customer
// ---------------------------------------------------------------------------
// Recovery for a customer who no longer has their link. Sent only to the address
// already on the booking, so requesting one reveals nothing to the requester.
function chatAccessLinkCustomer(context: TemplateContext): RenderedEmail {
  const p = context.payload;

  const body = [
    paragraph(`Hello ${escapeHtml(firstName(p.customerName))},`),
    paragraph('Here is a fresh secure link to your booking conversation.'),
    button('Open your conversation', context.customerChatUrl),
    sectionLabel('Your booking'),
    detailTable([
      { label: 'Reference', value: p.bookingReference || '' },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Host', value: p.hostName || '' },
      { label: 'Status', value: statusPill(p.status || ''), isHtml: true },
    ]),
    paragraph(
      'This link expires in 30 days and opens only your own conversation. If you did not request it, you can ignore this message &mdash; nothing has changed on your booking.',
      true,
    ),
  ].join('\n');

  return finish(context, {
    eyebrow: 'Secure access',
    title: 'Your booking conversation link',
    subject: `Your booking conversation link${p.bookingReference ? ` — ${p.bookingReference}` : ''}`,
    preheader: 'A secure link to reopen your booking conversation.',
    body,
    footerNote: 'Chat links are private. Do not forward this email.',
  });
}

// ---------------------------------------------------------------------------
// 6 & 7. call-scheduled-customer / call-rescheduled-customer
// ---------------------------------------------------------------------------
function callScheduled(context: TemplateContext, rescheduled: boolean): RenderedEmail {
  const p = context.payload;
  const timezone = p.appointmentTimezone || '';

  const body = [
    paragraph(`Hello ${escapeHtml(firstName(p.customerName))},`),
    paragraph(
      rescheduled
        ? 'Your video call session has been rescheduled. The details below replace the previous arrangement.'
        : 'Your payment has been confirmed and your video call session is scheduled.',
    ),
    sectionLabel('Session details'),
    detailTable([
      { label: 'Host', value: p.hostName || '' },
      { label: 'Package', value: p.packageName || '' },
      { label: 'Scheduled for', value: p.appointment || '' },
      {
        label: 'Timezone',
        value: timezone || 'Confirm in your support chat',
      },
      ...(rescheduled && p.previousAppointment
        ? [{ label: 'Previously', value: p.previousAppointment }]
        : []),
      { label: 'Reference', value: p.bookingReference || '' },
      { label: 'Price', value: p.packagePrice || '' },
      { label: 'Payment', value: 'Confirmed' },
      { label: 'Booking status', value: statusPill(p.status || ''), isHtml: true },
    ]),
    button('View booking', context.customerChatUrl),
    sectionLabel('Before your session'),
    paragraph(
      timezone
        ? `All times are shown in <strong>${escapeHtml(timezone)}</strong>. If that is not your local timezone, convert before the session and confirm in the chat if anything looks wrong.`
        : 'Confirm the timezone with the management team in your support chat before the session.',
      true,
    ),
    paragraph(
      'The joining link is issued closer to the session and will appear in your support chat. No joining link exists yet, so treat any that arrives elsewhere as untrustworthy.',
      true,
    ),
  ].join('\n');

  const when = p.appointment ? ` — ${p.appointment}` : '';
  return finish(context, {
    eyebrow: rescheduled ? 'Session rescheduled' : 'Session confirmed',
    title: rescheduled ? 'Your video call has been rescheduled' : 'Your video call has been scheduled',
    subject: rescheduled ? `Session rescheduled${when}` : `Video call scheduled${when}`,
    preheader: `${p.packageName || 'Your session'} with ${p.hostName || 'your host'}${when}${timezone ? ` (${timezone})` : ''}.`,
    body,
  });
}

// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, (context: TemplateContext) => RenderedEmail> = {
  'booking-confirmation-user': bookingConfirmationUser,
  'new-booking-admin': newBookingAdmin,
  'new-customer-message-admin': newCustomerMessageAdmin,
  'admin-reply-customer': adminReplyCustomer,
  'chat-access-link-customer': chatAccessLinkCustomer,
  'call-scheduled-customer': (context) => callScheduled(context, false),
  'call-rescheduled-customer': (context) => callScheduled(context, true),
};

export function isKnownTemplate(key: string): boolean {
  return Object.hasOwn(TEMPLATES, key);
}

export function renderTemplate(key: string, context: TemplateContext): RenderedEmail {
  const render = TEMPLATES[key];
  if (!render) {
    throw new Error(`Unknown template: ${key}`);
  }
  return render(context);
}

export function templateAudience(key: string): 'customer' | 'admin' {
  return key === 'new-booking-admin' || key === 'new-customer-message-admin' ? 'admin' : 'customer';
}

export { BRAND };
