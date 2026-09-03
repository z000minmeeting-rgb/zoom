-- The authoritative email event sources.
--
-- Every email this application will ever send originates here, from a committed
-- row change, in the same transaction as the business write. Nothing in the
-- browser enqueues email; nothing enqueues email in response to Realtime, a
-- poll, a render or a reconnect. That separation is what makes "one persisted
-- message = one email" true across any number of devices and tabs.
--
-- Four event families, matching the product flow:
--   1. Booking registration submitted  -> customer + admin
--   2. Customer sends a chat message   -> admin
--   3. Admin sends a chat reply        -> customer
--   4. Admin schedules the video call  -> customer

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Legacy-import protection. A historic booking upserted from an old device
-- carries its original created_at, which predates the cutover, so it produces
-- no email. Live bookings always postdate it.
create or replace function public.email_dispatch_allowed(p_entity_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.enabled and p_entity_created_at >= s.enabled_from
       from public.email_dispatch_settings s
      where s.id),
    false
  );
$$;

-- Admin notification recipient. The settings row is authoritative so the
-- address is inspectable and changeable without a redeploy; when it is unset we
-- fall back to the workspace's own members, which keeps this correct for a
-- multi-admin workspace. The dispatcher applies ADMIN_NOTIFICATION_EMAIL as a
-- last resort if both are empty.
create or replace function public.resolve_admin_recipient(p_admin_account_id uuid)
returns table (email text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_configured text;
  v_member text;
begin
  select nullif(trim(s.admin_notification_email), '')
    into v_configured
    from public.email_dispatch_settings s
   where s.id;

  if v_configured is not null then
    return query select v_configured, 'email_dispatch_settings.admin_notification_email'::text;
    return;
  end if;

  select u.email into v_member
    from public.admin_members m
    join auth.users u on u.id = m.user_id
   where m.admin_account_id = p_admin_account_id
     and u.email is not null
   order by case m.role when 'owner' then 0 else 1 end, m.created_at
   limit 1;

  if v_member is not null then
    return query select v_member, 'auth.users.email'::text;
    return;
  end if;

  return query select null::text, 'ADMIN_NOTIFICATION_EMAIL'::text;
end;
$$;

-- Deliberately conservative: this is a gate, not a validator. It rejects the
-- shapes the brief calls out and leaves everything else to the mail server.
create or replace function public.is_probably_email(p_value text)
returns boolean
language sql
immutable
as $$
  select p_value is not null
     and p_value ~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'
     and length(p_value) between 6 and 254;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue
-- ---------------------------------------------------------------------------
-- ON CONFLICT DO NOTHING against the unique idempotency_key is the whole
-- duplicate-prevention story. Two devices, a retried request, a replayed
-- trigger and a reconnecting worker all collapse to one row.
create or replace function public.enqueue_email(
  p_admin_account_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_recipient_role text,
  p_recipient_source text,
  p_template_key text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- An admin row may legitimately have a null recipient here: the dispatcher
  -- resolves it from ADMIN_NOTIFICATION_EMAIL. A customer row may not.
  if p_recipient_role = 'customer' and not public.is_probably_email(p_recipient_email) then
    return null;
  end if;

  insert into public.email_outbox (
    admin_account_id, event_type, entity_type, entity_id,
    recipient_email, recipient_name, recipient_role, recipient_source,
    template_key, template_payload, idempotency_key
  ) values (
    p_admin_account_id, p_event_type, p_entity_type, p_entity_id,
    lower(trim(p_recipient_email)), p_recipient_name, p_recipient_role, p_recipient_source,
    p_template_key, coalesce(p_payload, '{}'::jsonb), p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- Shared booking facts every template needs. Kept in one place so the five
-- templates cannot drift apart on what a "booking" looks like.
create or replace function public.booking_email_payload(t public.verification_threads)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'threadId', t.id,
    'bookingReference', coalesce(t.booking_reference, ''),
    'customerName', coalesce(t.full_name, ''),
    'customerEmail', coalesce(t.email, ''),
    'customerPhone', coalesce(t.phone, ''),
    'customerCountry', coalesce(t.country, ''),
    'hostName', coalesce(t.host_name, ''),
    'packageName', coalesce(t.package_name, ''),
    'packagePrice', coalesce(t.package_price, ''),
    'status', coalesce(t.status, ''),
    'submittedAt', to_char(t.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'appointment', coalesce(t.appointment, ''),
    'appointmentTimezone', coalesce(t.appointment_timezone, ''),
    'appointmentVersion', coalesce(t.appointment_version, 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- Event 1 — booking registration submitted
-- ---------------------------------------------------------------------------
create or replace function public.on_booking_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_admin record;
begin
  if not public.email_dispatch_allowed(new.created_at) then
    return null;
  end if;

  v_payload := public.booking_email_payload(new);

  perform public.enqueue_email(
    new.admin_account_id, 'BOOKING_SUBMITTED', 'verification_thread', new.id,
    new.email, new.full_name, 'customer', 'verification_threads.email',
    'booking-confirmation-user', v_payload,
    'booking-user-confirmation:' || new.id::text
  );

  select * into v_admin from public.resolve_admin_recipient(new.admin_account_id);

  perform public.enqueue_email(
    new.admin_account_id, 'BOOKING_SUBMITTED', 'verification_thread', new.id,
    v_admin.email, null, 'admin', v_admin.source,
    'new-booking-admin', v_payload,
    'booking-admin-notification:' || new.id::text
  );

  return null;
end;
$$;

drop trigger if exists verification_threads_email_on_insert on public.verification_threads;
create trigger verification_threads_email_on_insert
  after insert on public.verification_threads
  for each row execute function public.on_booking_created();

-- ---------------------------------------------------------------------------
-- Events 2 & 3 — chat messages
-- ---------------------------------------------------------------------------
-- Fires on INSERT only. persistThreadRemote() re-upserts the whole message
-- array on every typing tick and read receipt; those resolve to UPDATEs on
-- existing ids and are invisible here.
create or replace function public.on_chat_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.verification_threads;
  v_payload jsonb;
  v_admin record;
  v_preview text;
begin
  if new.suppress_email or new.sender = 'system' then
    return null;
  end if;

  select * into t from public.verification_threads where id = new.thread_id;
  if not found then
    return null;
  end if;

  -- Guard on the *booking's* age, not the message's: a legacy import replays
  -- old messages with fresh insert times but the parent booking predates the
  -- cutover.
  if not public.email_dispatch_allowed(t.created_at) then
    return null;
  end if;

  v_preview := left(coalesce(nullif(trim(new.text), ''), '[attachment]'), 500);
  v_payload := public.booking_email_payload(t)
    || jsonb_build_object(
         'messageId', new.id,
         'messageBody', v_preview,
         'messageAt', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'hasAttachment', exists (
           select 1 from public.verification_attachments a where a.message_id = new.id
         )
       );

  if new.sender = 'user' then
    select * into v_admin from public.resolve_admin_recipient(t.admin_account_id);
    perform public.enqueue_email(
      t.admin_account_id, 'CUSTOMER_MESSAGE', 'verification_message', new.id,
      v_admin.email, null, 'admin', v_admin.source,
      'new-customer-message-admin', v_payload,
      'customer-message-admin:' || new.id::text
    );
  elsif new.sender = 'admin' then
    perform public.enqueue_email(
      t.admin_account_id, 'ADMIN_REPLY', 'verification_message', new.id,
      t.email, t.full_name, 'customer', 'verification_threads.email',
      'admin-reply-customer', v_payload,
      'admin-message-customer:' || new.id::text
    );
  end if;

  return null;
end;
$$;

drop trigger if exists verification_messages_email_on_insert on public.verification_messages;
create trigger verification_messages_email_on_insert
  after insert on public.verification_messages
  for each row execute function public.on_chat_message_created();

-- ---------------------------------------------------------------------------
-- Event 4 — video call scheduled / rescheduled
-- ---------------------------------------------------------------------------
-- Payment gate: a schedule only mails the customer once payment has actually
-- been confirmed through the existing workflow — an approved payment proof, or
-- a thread an admin has explicitly moved to Verified.
create or replace function public.thread_payment_confirmed(p_thread_id uuid, p_status text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_status in ('Verified', 'Appointment Scheduled')
      or exists (
        select 1 from public.verification_attachments a
         where a.thread_id = p_thread_id
           and a.payment_status = 'Approved'
      );
$$;

create or replace function public.on_appointment_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_event text;
  v_template text;
begin
  -- Only a genuinely new appointment version. Typing indicators, read receipts
  -- and unrelated status flips all leave appointment_version untouched.
  if coalesce(new.appointment_version, 0) <= coalesce(old.appointment_version, 0) then
    return null;
  end if;

  if coalesce(new.appointment, '') = '' then
    return null;
  end if;

  if not public.email_dispatch_allowed(new.created_at) then
    return null;
  end if;

  if not public.thread_payment_confirmed(new.id, coalesce(old.status, new.status)) then
    return null;
  end if;

  if new.appointment_version = 1 then
    v_event := 'CALL_SCHEDULED';
    v_template := 'call-scheduled-customer';
  else
    v_event := 'CALL_RESCHEDULED';
    v_template := 'call-rescheduled-customer';
  end if;

  v_payload := public.booking_email_payload(new)
    || jsonb_build_object(
         'paymentConfirmed', true,
         'previousAppointment', coalesce(old.appointment, '')
       );

  perform public.enqueue_email(
    new.admin_account_id, v_event, 'verification_thread', new.id,
    new.email, new.full_name, 'customer', 'verification_threads.email',
    v_template, v_payload,
    -- Version in the key: a reschedule is a distinct email, never suppressed by
    -- the original schedule's key.
    'call-scheduled-customer:' || new.id::text || ':' || new.appointment_version::text
  );

  return null;
end;
$$;

drop trigger if exists verification_threads_email_on_schedule on public.verification_threads;
create trigger verification_threads_email_on_schedule
  after update on public.verification_threads
  for each row execute function public.on_appointment_scheduled();

revoke all on function public.enqueue_email(uuid, text, text, uuid, text, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.resolve_admin_recipient(uuid) from public, anon, authenticated;
