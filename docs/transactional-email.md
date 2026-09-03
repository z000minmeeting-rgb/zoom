# Transactional email

Booking confirmations, chat notifications and session emails for the guest
booking flow. Customers have no accounts by design; nothing here changes that.

## Architecture

```text
React (anon key only)
      │
      ▼
public-booking / guest-chat Edge Function      admin browser (Supabase client)
      │                                                │
      └────────────────────┬───────────────────────────┘
                           ▼
                   Supabase Postgres
                   business row committed
                           │
                           ▼  AFTER INSERT / AFTER UPDATE trigger
                   enqueue_email()  →  email_outbox
                   ON CONFLICT (idempotency_key) DO NOTHING
                           │
                           ▼  pg_cron every minute, via pg_net
                   dispatch-emails Edge Function
                   claim_email_batch()  FOR UPDATE SKIP LOCKED
                           │
                           ▼
                   MailTransport → GoogleSmtpTransport
                           │
                           ▼
                     smtp.gmail.com
                           │
                  customer / admin inbox
```

Email is never enqueued by a React component, a Realtime handler, a poll or a
reconnect. The trigger fires once per committed row change, so the number of
open tabs, devices and subscriptions is irrelevant.

## Deploy

### Production CLI workflow

The migration folder is authoritative. Do not manually run a migration and then run `db push` for the same file.

```bash
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
supabase secrets list
supabase functions deploy
supabase functions list
```

Copy `supabase/.env.edge.example` to the gitignored `supabase/.env.edge.production.local`, then populate only the App Password and independently generated `OUTBOX_DRAIN_SECRET` on a trusted workstation:

```bash
supabase secrets set --env-file supabase/.env.edge.production.local
```

Never put either secret in a Vite/Netlify environment variable. The function only reads them through `Deno.env.get`.

Order matters. Steps 1–4 send nothing.

### 1. Apply the migrations

```bash
supabase db push
```

Adds, in order:

| Migration | Contents |
| --- | --- |
| `20260903120000_email_outbox.sql` | `email_outbox`, `email_dispatch_settings`, claim/complete functions |
| `20260903120100_guest_chat_access.sql` | `guest_chat_tokens`, booking references, appointment versioning |
| `20260903120200_email_event_triggers.sql` | `enqueue_email()` and the four event triggers |
| `20260903120300_email_dispatch_cron.sql` | pg_cron schedule — **edit the placeholders first** |

Hold back `..._cron.sql` until step 3.

### 2. Set the function secrets

Never with a `VITE_` prefix, never in `.env`, never in Netlify build variables.

```bash
supabase secrets set \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=465 \
  SMTP_USER=z000minmeeting@gmail.com \
  SMTP_APP_PASSWORD=<set-securely-outside-source-control> \
  SMTP_FROM_EMAIL=z000minmeeting@gmail.com \
  SMTP_FROM_NAME="Z00m" \
  ADMIN_NOTIFICATION_EMAIL=z000minmeeting@gmail.com \
  APP_URL=https://z00m.netlify.app \
  OUTBOX_DRAIN_SECRET="$(openssl rand -hex 32)" \
  MAIL_TRANSPORT=google-smtp
```

`MAIL_TRANSPORT=log` runs the whole pipeline and logs recipients instead of
sending. The production Gmail transport value is `google-smtp` (not `smtp`).

The Google App Password requires 2FA on the account and grants **full mailbox
access** — it cannot be scoped to sending. Use a dedicated account.

### 3. Deploy the functions

```bash
supabase functions deploy public-booking
supabase functions deploy guest-chat
supabase functions deploy dispatch-emails
```

`supabase/config.toml` already sets `verify_jwt = false` for all three. They are
not unauthenticated: `public-booking` validates and rate-limits, `guest-chat`
requires a hashed guest token, `dispatch-emails` requires `OUTBOX_DRAIN_SECRET`.

Then apply `20260903120300_email_dispatch_cron.sql` with the project ref and
drain secret filled in.

### 4. Confirm the transport before writing anything real

Supabase Edge Functions run on Deno Deploy, where outbound TCP on 465/587 is
usually available but not contractually guaranteed. Prove it:

```bash
supabase secrets set MAIL_TRANSPORT=google-smtp
# queue one row manually, then:
curl -X POST https://<ref>.supabase.co/functions/v1/dispatch-emails \
  -H "x-outbox-secret: <secret>"
```

If the socket is refused, switch to the **Gmail API over HTTPS with OAuth2**.
That is a new file next to `googleSmtpTransport.ts` plus one case in
`_shared/mail/index.ts`. The outbox, triggers, templates and idempotency keys
are unaffected — this is exactly why the transport sits behind an interface.

### 5. Set the cutover

This is the legacy-import protection. Triggers only fire for bookings created
at or after `enabled_from`, so importing a historic device stays silent.

```sql
update public.email_dispatch_settings
   set enabled = true,
       enabled_from = now(),
       admin_notification_email = 'ops@your-domain',
       app_url = 'https://your-domain'
 where id;
```

`admin_notification_email` here is authoritative. `ADMIN_NOTIFICATION_EMAIL` is
the dispatcher's fallback; if both are unset, the workspace owner's
`auth.users.email` is used.

### 6. Go live

```bash
supabase secrets set MAIL_TRANSPORT=google-smtp
```

Watch `/admin/email` in the dashboard.

## Rolling back

```sql
update public.email_dispatch_settings set enabled = false where id;
```

Triggers stop enqueueing and the drain stops sending. Queued rows are kept.

## Events

| Event | Trigger source | Recipients | Idempotency key |
| --- | --- | --- | --- |
| `BOOKING_SUBMITTED` | `AFTER INSERT ON verification_threads` | customer + admin | `booking-user-confirmation:<thread>` / `booking-admin-notification:<thread>` |
| `CUSTOMER_MESSAGE` | `AFTER INSERT ON verification_messages` where `sender='user'` | admin | `customer-message-admin:<message>` |
| `ADMIN_REPLY` | `AFTER INSERT ON verification_messages` where `sender='admin'` | customer | `admin-message-customer:<message>` |
| `CALL_SCHEDULED` / `CALL_RESCHEDULED` | `AFTER UPDATE ON verification_threads` when `appointment_version` increases | customer | `call-scheduled-customer:<thread>:<version>` |
| `CHAT_ACCESS_REQUESTED` | explicit request in `guest-chat` | customer | `chat-access-link:<thread>:<15-min bucket>` |

Messages flagged `suppress_email` — the synthetic booking opening message and
the canned onboarding auto-reply — produce nothing.

## Guest chat access

A thread UUID is not a credential. Access is a bearer token:

- 32 random bytes, base64url. Only `sha256(token)` is stored.
- Scoped to exactly one thread. No admin capability, no other booking.
- The customer's own browser gets a 90-day token at booking time; every email
  link carries its own fresh 30-day token.
- Revoke with `select public.revoke_guest_chat_tokens('<thread-uuid>');`
- `?access=` is stripped from the address bar on arrival.

Recovery emails a fresh link to the address already on the booking and returns
nothing to the requester, so guessing a name and email reveals nothing.

## Failure handling

A failed email never affects the business record. The booking, the message and
the schedule are all committed before the outbox row is even claimed.

| State | Meaning |
| --- | --- |
| `pending` | enqueued, never attempted |
| `processing` | claimed, send in flight |
| `sent` | SMTP accepted it |
| `retry` | failed, attempts remain |
| `failed` | terminal |

Backoff is 1, 5, 15, 60, 240 minutes; five attempts then `failed`. A 5xx
rejection or an invalid recipient fails immediately rather than spending the
budget. Rows stuck in `processing` for 10 minutes are reclaimed.

Gmail's SMTP relay provides **no bounce webhook** — a hard bounce returns to the
sending mailbox as a message a human must read. `sent` means "handed off", not
"delivered". If real bounce handling becomes a requirement, that is the point to
move to a transactional provider.

## Local checks

```bash
node --experimental-strip-types supabase/functions/_tests/templates.test.ts
node --experimental-strip-types supabase/functions/_tests/preview.ts
```

The first asserts email validation, escaping and template output. The second
writes all seven templates to `.email-previews/` for opening in a browser or
forwarding to a real mail client.

## Follow-ups not covered here

- Attachments are still stored as base64 data URLs in
  `verification_attachments.storage_path`. Emails link to the chat and never
  carry them, but the rows remain large. `uploadAssetFile()` exists and is unused.
- The `zoom-assets` storage bucket still permits anonymous uploads
  (`supabase/schema.sql`), untouched by the admin-sync migration.
- `zoom-workspace-users-v2` plaintext password storage still ships in
  `UserContext`. Unreachable — `register()` has no call sites — but present.
