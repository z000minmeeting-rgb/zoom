import { appUrl, optionalEnv, redact, requireEnv } from '../_shared/env.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { isValidEmail } from '../_shared/validation.ts';
import { createTransport } from '../_shared/mail/index.ts';
import { isKnownTemplate, renderTemplate, type EmailPayload } from '../_shared/templates/index.ts';

/**
 * The outbox drain.
 *
 * Invoked once a minute by pg_cron through pg_net. It claims a bounded batch
 * atomically, renders, sends, and records the outcome. It never reads business
 * tables to decide *whether* to send — that decision was already made, and
 * committed, by a database trigger.
 *
 * Guarded by a shared secret so the endpoint cannot be driven by anyone who
 * happens to find its URL.
 */

type OutboxRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  recipient_email: string | null;
  recipient_name: string | null;
  recipient_role: 'customer' | 'admin';
  template_key: string;
  template_payload: EmailPayload;
  attempt_count: number;
};

const BATCH_SIZE = 20;

/**
 * Each outbound link carries its own freshly minted, short-lived guest
 * credential. The database only ever stores the hash, so nothing here can leak
 * a reusable secret and a forwarded email can be revoked on its own.
 */
async function customerChatLink(threadId: string | undefined, base: string): Promise<string> {
  if (!threadId || !base) return '';
  const { data, error } = await supabaseAdmin().rpc('issue_guest_chat_token', {
    p_thread_id: threadId,
    p_ttl: '30 days',
  });
  if (error || !data) return '';
  return `${base}/verification-chat/${threadId}?access=${encodeURIComponent(data as string)}`;
}

function adminChatLink(threadId: string | undefined, base: string): string {
  if (!threadId || !base) return '';
  return `${base}/admin/chats/${threadId}`;
}

async function failPermanently(id: string, error: string): Promise<void> {
  await supabaseAdmin()
    .from('email_outbox')
    .update({ status: 'failed', failed_at: new Date().toISOString(), last_error: error })
    .eq('id', id);
}

async function processRow(
  row: OutboxRow,
  transport: ReturnType<typeof createTransport>,
  base: string,
  brandName: string,
  adminFallback: string,
): Promise<'sent' | 'failed' | 'retry'> {
  const admin = supabaseAdmin();

  // Admin rows may be enqueued without a recipient so that the configured
  // address stays authoritative at send time rather than at write time.
  const recipient = row.recipient_role === 'admin'
    ? (row.recipient_email || adminFallback)
    : row.recipient_email;

  if (!isValidEmail(recipient)) {
    await failPermanently(row.id, `No valid recipient for ${row.recipient_role} email`);
    return 'failed';
  }

  if (!isKnownTemplate(row.template_key)) {
    await failPermanently(row.id, `Unknown template: ${row.template_key}`);
    return 'failed';
  }

  const payload = row.template_payload ?? {};
  const isCustomer = row.recipient_role === 'customer';

  const rendered = renderTemplate(row.template_key, {
    payload,
    brandName,
    customerChatUrl: isCustomer ? await customerChatLink(payload.threadId, base) : '',
    adminChatUrl: isCustomer ? '' : adminChatLink(payload.threadId, base),
  });

  const outcome = await transport.send({
    to: recipient as string,
    toName: row.recipient_name ?? undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  if (outcome.ok) {
    await admin.rpc('mark_email_sent', { p_id: row.id });
    return 'sent';
  }

  // A 5xx rejection will fail identically on every retry; spending the budget
  // on it only delays the admin seeing the problem.
  if (outcome.permanent) {
    await failPermanently(row.id, outcome.error);
    return 'failed';
  }

  await admin.rpc('mark_email_failed', { p_id: row.id, p_error: outcome.error });
  return 'retry';
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expected = requireEnv('OUTBOX_DRAIN_SECRET');
  if (request.headers.get('x-outbox-secret') !== expected) {
    return new Response('Forbidden', { status: 403 });
  }

  const admin = supabaseAdmin();
  const base = appUrl();
  const brandName = optionalEnv('SMTP_FROM_NAME', 'Zoom Workplace');
  const adminFallback = optionalEnv('ADMIN_NOTIFICATION_EMAIL');

  // The same switch that stops triggers enqueueing also stops the drain, so
  // flipping it off during an incident halts sending without losing queued work.
  const { data: settings } = await admin
    .from('email_dispatch_settings')
    .select('enabled')
    .eq('id', true)
    .maybeSingle();

  if (!settings?.enabled) {
    return new Response(JSON.stringify({ skipped: 'dispatch_disabled' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await admin.rpc('reclaim_stuck_emails', { p_older_than: '10 minutes' });

  const { data, error } = await admin.rpc('claim_email_batch', { p_limit: BATCH_SIZE });
  if (error) {
    console.error('claim failed:', redact(error.message));
    return new Response(JSON.stringify({ error: 'claim_failed' }), { status: 500 });
  }

  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ claimed: 0, sent: 0, failed: 0, retry: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transport = createTransport();
  const tally = { sent: 0, failed: 0, retry: 0 };

  try {
    for (const row of rows) {
      try {
        const result = await processRow(row, transport, base, brandName, adminFallback);
        tally[result] += 1;
      } catch (cause) {
        // A render or network fault must never abandon the rest of the batch,
        // and must never leave this row stuck in 'processing'.
        const message = redact(cause);
        console.error(`outbox ${row.id} (${row.template_key}) failed: ${message}`);
        await admin.rpc('mark_email_failed', { p_id: row.id, p_error: message });
        tally.retry += 1;
      }
    }
  } finally {
    await transport.close();
  }

  console.log(
    `dispatch: claimed=${rows.length} sent=${tally.sent} retry=${tally.retry} failed=${tally.failed} transport=${transport.name}`,
  );

  return new Response(JSON.stringify({ claimed: rows.length, ...tally }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
