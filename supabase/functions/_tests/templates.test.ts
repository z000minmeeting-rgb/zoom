/**
 * Executable checks for the pieces that can be tested without a database or an
 * SMTP server: email-format validation, escaping, and template rendering.
 *
 * Run with:
 *   node --experimental-strip-types supabase/functions/_tests/templates.test.ts
 *
 * These cover the injection and validation requirements. They do not and cannot
 * cover delivery, idempotency under concurrency, or trigger behaviour — those
 * need a live Supabase project.
 */

import { isValidEmail, cleanHeaderValue, cleanMultilineText } from '../_shared/validation.ts';
import { escapeHtml, safeUrl } from '../_shared/html.ts';
import { renderTemplate, type TemplateContext } from '../_shared/templates/index.ts';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\nEmail format validation');
for (const bad of ['john', 'john@', 'john@gmail', '@gmail.com', 'john gmail.com', '', 'a@b.c d', 'john@@gmail.com']) {
  check(`rejects ${JSON.stringify(bad)}`, !isValidEmail(bad));
}
for (const good of ['john@gmail.com', 'first.last+tag@sub.example.co.uk', 'A@B.IO']) {
  check(`accepts ${JSON.stringify(good)}`, isValidEmail(good));
}

console.log('\nHeader and body sanitisation');
check(
  'strips CR/LF from header values',
  !/[\r\n]/.test(cleanHeaderValue('Subject\r\nBcc: attacker@evil.test')),
);
check(
  'keeps newlines in multi-line bodies',
  cleanMultilineText('line one\nline two', 500).includes('\n'),
);
check('escapes angle brackets', escapeHtml('<script>') === '&lt;script&gt;');
check('escapes quotes', escapeHtml(`"'`) === '&quot;&#39;');

console.log('\nURL safety');
check('rejects javascript: URLs', safeUrl('javascript:alert(1)', 'https://app.test') === '');
check('rejects a foreign origin', safeUrl('https://evil.test/x', 'https://app.test') === '');
check('accepts the app origin', safeUrl('https://app.test/chat', 'https://app.test').startsWith('https://app.test'));

console.log('\nTemplate rendering');

const hostileName = '<img src=x onerror="alert(1)">Mallory';
const hostileMessage = 'Pay here: <a href="javascript:alert(1)">click</a>\r\nBcc: attacker@evil.test';

const context: TemplateContext = {
  payload: {
    threadId: '11111111-2222-4333-8444-555555555555',
    bookingReference: 'ZB-7K2M9QXA',
    customerName: hostileName,
    customerEmail: 'customer@example.test',
    customerPhone: '+39 000 000 000',
    customerCountry: 'Italy',
    hostName: 'Example Host',
    packageName: 'Gold Access',
    packagePrice: '$520',
    status: 'Under Review',
    submittedAt: '2026-09-03T10:30:00Z',
    appointment: '14 Mar 2026, 15:00',
    appointmentTimezone: 'Europe/Rome',
    appointmentVersion: 2,
    previousAppointment: '10 Mar 2026, 12:00',
    messageId: '99999999-2222-4333-8444-555555555555',
    messageBody: hostileMessage,
    messageAt: '2026-09-03T11:00:00Z',
    hasAttachment: true,
  },
  brandName: 'Zoom Workplace',
  customerChatUrl: 'https://app.test/verification-chat/11111111-2222-4333-8444-555555555555?access=tok',
  adminChatUrl: 'https://app.test/admin/chats/11111111-2222-4333-8444-555555555555',
};

const templates = [
  'booking-confirmation-user',
  'new-booking-admin',
  'new-customer-message-admin',
  'admin-reply-customer',
  'chat-access-link-customer',
  'call-scheduled-customer',
  'call-rescheduled-customer',
];

for (const key of templates) {
  const rendered = renderTemplate(key, context);

  check(`${key}: has a subject`, rendered.subject.length > 0);
  check(`${key}: subject has no CR/LF`, !/[\r\n]/.test(rendered.subject));
  check(`${key}: renders a full document`, rendered.html.includes('<html') && rendered.html.includes('</html>'));
  check(`${key}: has a text alternative`, rendered.text.length > 30);
  check(
    `${key}: does not inject the hostile name`,
    !rendered.html.includes('<img src=x'),
    'unescaped customer name reached the body',
  );
  check(
    `${key}: does not inject a javascript: anchor`,
    !rendered.html.includes('href="javascript:'),
  );
  check(
    `${key}: uses no unsupported layout CSS`,
    !/display:\s*(flex|grid)/i.test(rendered.html),
  );
  check(`${key}: is width-constrained for mail clients`, rendered.html.includes('max-width:600px'));
}

const bookingEmail = renderTemplate('booking-confirmation-user', context);
check('booking email states the reference', bookingEmail.html.includes('ZB-7K2M9QXA'));
check('booking email states the price', bookingEmail.html.includes('$520'));
check('booking email links to the chat', bookingEmail.html.includes('access=tok'));

const adminEmail = renderTemplate('new-booking-admin', context);
check('admin email states the customer address', adminEmail.html.includes('customer@example.test'));
check('admin email links to the admin route', adminEmail.html.includes('/admin/chats/'));
check('admin email carries no guest token', !adminEmail.html.includes('access=tok'));

const scheduled = renderTemplate('call-scheduled-customer', context);
check('scheduled email states the timezone', scheduled.html.includes('Europe/Rome'));
check('scheduled email states the date', scheduled.html.includes('14 Mar 2026, 15:00'));

const rescheduled = renderTemplate('call-rescheduled-customer', context);
check('reschedule email shows the previous time', rescheduled.html.includes('10 Mar 2026, 12:00'));
check('reschedule subject differs from schedule subject', rescheduled.subject !== scheduled.subject);

const customerFacing = ['booking-confirmation-user', 'admin-reply-customer', 'call-scheduled-customer'];
for (const key of customerFacing) {
  const rendered = renderTemplate(key, context);
  check(`${key}: exposes no admin route`, !rendered.html.includes('/admin/'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
