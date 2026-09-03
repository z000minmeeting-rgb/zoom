import { fail, json, preflight, rateLimit } from '../_shared/http.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { validateBooking } from '../_shared/validation.ts';
import { redact } from '../_shared/env.ts';

/**
 * Public booking intake.
 *
 * Customers have no accounts by product design, so before this function the
 * registration form had no way to reach the database: every write path in
 * src/app/data goes through requireAdminWorkspace(), which throws for anyone
 * who is not a signed-in admin.
 *
 * This is the validated server-side entry point the deployment notes called
 * for. It is the alternative to handing `anon` table permissions back — the
 * browser still cannot write to verification_threads directly, and the shape of
 * what it may submit is fixed here.
 *
 * Creating the booking row is also what fires the email triggers, so the two
 * booking emails are a consequence of the committed row, not of this handler.
 */

const OPENING_MESSAGE_PREFIX = 'Hello Management, I am interested in completing payment verification for the';

/**
 * Which workspace owns this booking. Normally the host client the customer
 * arrived through; otherwise the sole workspace, if there is exactly one.
 * Ambiguity is refused rather than guessed.
 */
async function resolveWorkspace(clientId: string): Promise<string | null> {
  const admin = supabaseAdmin();

  if (clientId) {
    const { data } = await admin
      .from('client_profiles')
      .select('admin_account_id')
      .eq('id', clientId)
      .maybeSingle();
    if (data?.admin_account_id) return data.admin_account_id as string;
  }

  const { data: accounts } = await admin.from('admin_accounts').select('id').limit(2);
  if (accounts && accounts.length === 1) return accounts[0].id as string;

  return null;
}

Deno.serve(async (request: Request) => {
  const preflighted = preflight(request);
  if (preflighted) return preflighted;

  if (request.method !== 'POST') return fail('Method not allowed', 405);

  if (!rateLimit(request, 'booking', 5, 60_000)) {
    return fail('Too many booking attempts. Please wait a moment and try again.', 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request.', 400);
  }

  const validated = validateBooking(body);
  if (!validated.ok) {
    return json({ error: validated.message, field: validated.field }, 422);
  }
  const input = validated.value;

  const admin = supabaseAdmin();
  const workspaceId = await resolveWorkspace(input.clientId);
  if (!workspaceId) {
    return fail('Bookings are not available right now. Please contact support.', 503);
  }

  const now = new Date().toISOString();

  try {
    const { data: thread, error: threadError } = await admin
      .from('verification_threads')
      .insert({
        admin_account_id: workspaceId,
        full_name: input.fullName,
        username: input.username,
        country: input.country,
        date_of_birth: input.dateOfBirth,
        email: input.email,
        phone: input.phone,
        gender: input.gender,
        package_id: input.packageId,
        package_name: input.packageName,
        package_price: input.packagePrice,
        host_name: input.hostName,
        host_avatar: input.hostAvatar,
        host_initials: input.hostInitials,
        client_id: input.clientId || null,
        meeting_link_token: input.meetingLinkToken,
        status: 'Pending Verification',
        appointment: '',
        unread_for_admin: 1,
        unread_for_user: 0,
        typing_user: false,
        typing_admin: true,
        onboarding_auto_reply_sent: false,
        created_at: now,
        updated_at: now,
      })
      .select('id, booking_reference, status, created_at')
      .single();

    if (threadError || !thread) {
      console.error('booking insert failed:', redact(threadError?.message));
      return fail('Unable to create your booking. Please try again.', 500);
    }

    // The synthetic opening message is scene-setting, not correspondence, so it
    // is flagged to produce no admin email — the booking notification already
    // covers this event.
    const { error: messageError } = await admin.from('verification_messages').insert({
      thread_id: thread.id,
      admin_account_id: workspaceId,
      sender: 'user',
      text: `${OPENING_MESSAGE_PREFIX} ${input.packageName} plan (${input.packagePrice}) with ${input.hostName}. Please guide me through the payment confirmation process.`,
      status: 'Delivered',
      created_at: now,
      suppress_email: true,
    });

    if (messageError) {
      console.error('opening message failed:', redact(messageError.message));
    }

    // The customer's own browser session credential. Longer-lived than the
    // per-email links so returning in the same browser keeps working.
    const { data: token, error: tokenError } = await admin.rpc('issue_guest_chat_token', {
      p_thread_id: thread.id,
      p_ttl: '90 days',
    });

    if (tokenError) {
      console.error('guest token failed:', redact(tokenError.message));
    }

    return json({
      threadId: thread.id,
      bookingReference: thread.booking_reference,
      status: thread.status,
      createdAt: thread.created_at,
      guestToken: (token as string | null) ?? '',
    });
  } catch (cause) {
    console.error('booking failed:', redact(cause));
    return fail('Unable to create your booking. Please try again.', 500);
  }
});
