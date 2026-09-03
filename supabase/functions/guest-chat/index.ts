import { fail, json, preflight, rateLimit } from '../_shared/http.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { cleanMultilineText, cleanText, isValidEmail, normalizeEmail } from '../_shared/validation.ts';
import { redact } from '../_shared/env.ts';

/**
 * Authorised guest access to a single booking conversation.
 *
 * A thread UUID is not a credential: it appears in browser history, referrer
 * headers, screenshots and mail-client link scanners. Every action here is
 * authorised instead by a bearer token whose SHA-256 hash is stored server-side,
 * scoped to exactly one thread, and independently expirable and revocable.
 *
 * The token authorises this conversation and nothing else. It grants no admin
 * capability, no access to another booking, and no direct database reach.
 */

const MANAGEMENT_PAYMENT_WELCOME_MESSAGE =
  'Welcome. The management team will communicate the means of payment to you in a few minutes.';

/** ~6 MB once base64 is accounted for. Payment proofs are screenshots. */
const MAX_ATTACHMENT_CHARS = 8_000_000;
const MAX_ATTACHMENTS = 5;

type Session = { threadId: string; adminAccountId: string; tokenId: string };

async function authorize(request: Request, body: Record<string, unknown>): Promise<Session | null> {
  const raw = request.headers.get('x-guest-token') || (typeof body.token === 'string' ? body.token : '');
  if (!raw || raw.length < 20) return null;

  const { data, error } = await supabaseAdmin().rpc('resolve_guest_chat_token', { p_token: raw });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;

  const row = (Array.isArray(data) ? data[0] : data) as {
    thread_id: string;
    admin_account_id: string;
    token_id: string;
  };
  if (!row?.thread_id) return null;

  await supabaseAdmin().rpc('touch_guest_chat_token', { p_token_id: row.token_id });
  return { threadId: row.thread_id, adminAccountId: row.admin_account_id, tokenId: row.token_id };
}

/** Shapes the thread for the customer. Deliberately omits admin-only fields. */
async function loadThread(session: Session) {
  const admin = supabaseAdmin();

  const { data: thread, error } = await admin
    .from('verification_threads')
    .select(
      'id, full_name, username, country, date_of_birth, email, phone, gender, package_id, package_name, package_price, host_name, host_avatar, host_initials, client_id, meeting_link_token, booking_reference, status, appointment, appointment_timezone, created_at, updated_at, unread_for_admin, unread_for_user, typing_user, typing_admin, onboarding_auto_reply_sent',
    )
    .eq('id', session.threadId)
    .single();

  if (error || !thread) return null;

  const [{ data: messages }, { data: attachments }] = await Promise.all([
    admin
      .from('verification_messages')
      .select('id, thread_id, sender, text, status, reply_to, created_at')
      .eq('thread_id', session.threadId)
      .order('created_at', { ascending: true }),
    admin
      .from('verification_attachments')
      .select('id, message_id, name, type, size, storage_path, payment_status, payment_status_updated_at')
      .eq('thread_id', session.threadId)
      .order('created_at', { ascending: true }),
  ]);

  return { thread, messages: messages ?? [], attachments: attachments ?? [] };
}

Deno.serve(async (request: Request) => {
  const preflighted = preflight(request);
  if (preflighted) return preflighted;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request.', 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const admin = supabaseAdmin();

  // ---------------------------------------------------------------------
  // Recovery: never returns a credential to the caller. A fresh access link
  // is emailed to the address already on the booking, so guessing a name and
  // email reveals nothing and grants nothing. The response is identical
  // whether or not a booking matched.
  // ---------------------------------------------------------------------
  if (action === 'request-access-link') {
    if (!rateLimit(request, 'recover', 3, 900_000)) {
      return json({ ok: true });
    }

    const name = cleanText(body.fullName, 120).toLowerCase();
    const email = normalizeEmail(body.email);
    if (!name || !isValidEmail(email)) return json({ ok: true });

    const { data: threads } = await admin
      .from('verification_threads')
      .select('id, admin_account_id, full_name, email, booking_reference, package_name, package_price, host_name, status, created_at')
      .eq('email', email)
      .order('updated_at', { ascending: false })
      .limit(5);

    const match = (threads ?? []).find(
      (row) => String(row.full_name ?? '').trim().toLowerCase() === name,
    );

    if (match) {
      // One link per 15-minute window, enforced by the outbox's unique index
      // rather than by a check here, so repeated requests cannot fan out.
      const bucket = Math.floor(Date.now() / 900_000);
      await admin.from('email_outbox').insert({
        admin_account_id: match.admin_account_id,
        event_type: 'CHAT_ACCESS_REQUESTED',
        entity_type: 'verification_thread',
        entity_id: match.id,
        recipient_email: match.email,
        recipient_name: match.full_name,
        recipient_role: 'customer',
        recipient_source: 'verification_threads.email',
        template_key: 'chat-access-link-customer',
        template_payload: {
          threadId: match.id,
          bookingReference: match.booking_reference ?? '',
          customerName: match.full_name ?? '',
          packageName: match.package_name ?? '',
          packagePrice: match.package_price ?? '',
          hostName: match.host_name ?? '',
          status: match.status ?? '',
        },
        idempotency_key: `chat-access-link:${match.id}:${bucket}`,
      });
    }

    return json({ ok: true });
  }

  // Every other action requires a valid guest token.
  const session = await authorize(request, body);
  if (!session) return fail('This chat link is no longer valid. Request a new link from the booking page.', 401);

  try {
    switch (action) {
      case 'load': {
        const result = await loadThread(session);
        if (!result) return fail('Conversation not found.', 404);
        return json(result);
      }

      case 'send': {
        if (!rateLimit(request, 'send', 20, 60_000)) {
          return fail('Too many messages. Please wait a moment.', 429);
        }

        const text = cleanMultilineText(body.text, 4000);
        const rawAttachments = Array.isArray(body.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];

        if (!text && rawAttachments.length === 0) {
          return fail('Write a message or attach a file.', 422);
        }

        for (const item of rawAttachments) {
          const dataUrl = (item as Record<string, unknown>)?.dataUrl;
          if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
            return fail('Unsupported attachment.', 422);
          }
          if (dataUrl.length > MAX_ATTACHMENT_CHARS) {
            return fail('That file is too large. Please upload a file under 6 MB.', 413);
          }
        }

        // This INSERT is the authoritative customer-message event. The admin
        // email is a trigger consequence of it, so it happens once no matter
        // how many tabs or devices are watching.
        const { data: message, error: messageError } = await admin
          .from('verification_messages')
          .insert({
            thread_id: session.threadId,
            admin_account_id: session.adminAccountId,
            sender: 'user',
            text,
            status: 'Delivered',
            reply_to: body.replyTo ?? null,
          })
          .select('id, created_at')
          .single();

        if (messageError || !message) {
          console.error('guest message failed:', redact(messageError?.message));
          return fail('Unable to send your message. Please try again.', 500);
        }

        if (rawAttachments.length > 0) {
          const rows = rawAttachments.map((item) => {
            const attachment = item as Record<string, unknown>;
            return {
              message_id: message.id,
              thread_id: session.threadId,
              admin_account_id: session.adminAccountId,
              name: cleanText(attachment.name, 200) || 'attachment',
              type: cleanText(attachment.type, 120) || 'application/octet-stream',
              size: Number(attachment.size) || 0,
              storage_path: attachment.dataUrl as string,
              payment_status: 'Awaiting Approval',
              payment_status_updated_at: new Date().toISOString(),
            };
          });

          const { error: attachmentError } = await admin.from('verification_attachments').insert(rows);
          if (attachmentError) {
            console.error('guest attachment failed:', redact(attachmentError.message));
          }
        }

        // Mirrors the existing client behaviour: proof moves the booking to
        // review unless it has already progressed past that point.
        const { data: current } = await admin
          .from('verification_threads')
          .select('status, unread_for_admin')
          .eq('id', session.threadId)
          .single();

        const keepStatus = current?.status === 'Verified' || current?.status === 'Appointment Scheduled';
        await admin
          .from('verification_threads')
          .update({
            unread_for_admin: (current?.unread_for_admin ?? 0) + 1,
            typing_user: false,
            status: rawAttachments.length > 0 && !keepStatus ? 'Under Review' : current?.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.threadId);

        return json({ messageId: message.id, createdAt: message.created_at });
      }

      case 'onboarding': {
        // Idempotent by the conditional filter, not by a client-side flag:
        // the previous implementation wrote the message first and set the
        // guard afterwards, so two tabs produced two auto-replies.
        const { data: updated } = await admin
          .from('verification_threads')
          .update({ onboarding_auto_reply_sent: true, typing_admin: false })
          .eq('id', session.threadId)
          .eq('onboarding_auto_reply_sent', false)
          .select('id');

        if (updated && updated.length > 0) {
          await admin.from('verification_messages').insert({
            thread_id: session.threadId,
            admin_account_id: session.adminAccountId,
            sender: 'admin',
            text: MANAGEMENT_PAYMENT_WELCOME_MESSAGE,
            status: 'Delivered',
            // Canned onboarding copy, not a real support reply: it must not
            // email the customer who is already looking at the chat.
            suppress_email: true,
          });
        }

        return json({ ok: true });
      }

      case 'seen': {
        await admin
          .from('verification_threads')
          .update({ unread_for_user: 0, updated_at: new Date().toISOString() })
          .eq('id', session.threadId);
        await admin
          .from('verification_messages')
          .update({ status: 'Seen' })
          .eq('thread_id', session.threadId)
          .eq('sender', 'admin');
        return json({ ok: true });
      }

      case 'typing': {
        await admin
          .from('verification_threads')
          .update({ typing_user: Boolean(body.isTyping) })
          .eq('id', session.threadId);
        return json({ ok: true });
      }

      default:
        return fail('Unsupported action.', 400);
    }
  } catch (cause) {
    console.error('guest-chat failed:', redact(cause));
    return fail('Something went wrong. Please try again.', 500);
  }
});
