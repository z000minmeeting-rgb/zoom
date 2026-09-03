/**
 * Writes every template to an HTML file so the rendered email can be opened in
 * a browser and forwarded to a real mail client for client-compatibility checks.
 *
 * Run with:
 *   node --experimental-strip-types supabase/functions/_tests/preview.ts
 *
 * Output lands in .email-previews/ (gitignored). No mail is sent and nothing
 * touches the database.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTemplate, type TemplateContext } from '../_shared/templates/index.ts';

const OUT_DIR = '.email-previews';

const context: TemplateContext = {
  payload: {
    threadId: '11111111-2222-4333-8444-555555555555',
    bookingReference: 'ZB-7K2M9QXA',
    customerName: 'Alessandra Moretti',
    customerEmail: 'alessandra@example.com',
    customerPhone: '+39 333 555 0199',
    customerCountry: 'Italy',
    hostName: 'Jordan Vale',
    packageName: 'Gold Access',
    packagePrice: '$520',
    status: 'Under Review',
    submittedAt: '2026-09-03T10:30:00Z',
    appointment: '14 Mar 2026, 15:00',
    appointmentTimezone: 'Europe/Rome',
    appointmentVersion: 2,
    previousAppointment: '10 Mar 2026, 12:00',
    messageId: '99999999-2222-4333-8444-555555555555',
    messageBody:
      'Hello, I have just sent the payment screenshot from my bank app.\nCould you confirm you can see it? Thank you.',
    messageAt: '2026-09-03T11:00:00Z',
    hasAttachment: true,
  },
  brandName: 'Zoom Workplace',
  customerChatUrl:
    'https://example.com/verification-chat/11111111-2222-4333-8444-555555555555?access=EXAMPLE-TOKEN',
  adminChatUrl: 'https://example.com/admin/chats/11111111-2222-4333-8444-555555555555',
};

const keys = [
  'booking-confirmation-user',
  'new-booking-admin',
  'new-customer-message-admin',
  'admin-reply-customer',
  'chat-access-link-customer',
  'call-scheduled-customer',
  'call-rescheduled-customer',
];

mkdirSync(OUT_DIR, { recursive: true });

for (const key of keys) {
  const rendered = renderTemplate(key, context);
  writeFileSync(join(OUT_DIR, `${key}.html`), rendered.html, 'utf8');
  writeFileSync(join(OUT_DIR, `${key}.txt`), `Subject: ${rendered.subject}\n\n${rendered.text}`, 'utf8');
  console.log(`${key}  →  ${OUT_DIR}/${key}.html   (subject: ${rendered.subject})`);
}

console.log(`\n${keys.length} previews written to ${OUT_DIR}/`);
